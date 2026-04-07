const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const db = require('../db');

function createTransporter() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 15000
  });
}

// Register
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
  }
  if (username.length < 3 || username.length > 50) {
    return res.status(400).json({ error: 'Username deve ter entre 3 e 50 caracteres.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password deve ter pelo menos 6 caracteres.' });
  }

  try {
    const hashed = await bcrypt.hash(password, 12);
    const [result] = await db.execute(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username.trim(), email.trim().toLowerCase(), hashed]
    );

    req.session.userId = result.insertId;
    req.session.username = username.trim();

    res.status(201).json({
      success: true,
      user: { id: result.insertId, username: username.trim(), email: email.trim().toLowerCase() }
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Username ou email já existe.' });
    }
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e password são obrigatórios.' });
  }

  try {
    const [rows] = await db.execute(
      'SELECT * FROM users WHERE email = ?',
      [email.trim().toLowerCase()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    req.session.userId = user.id;
    req.session.username = user.username;

    res.json({
      success: true,
      user: { id: user.id, username: user.username, email: user.email }
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

// Get current user
router.get('/me', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }
  res.json({ user: { id: req.session.userId, username: req.session.username } });
});

// Forgot password — envia email com link de recuperação
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email é obrigatório.' });

  try {
    const [rows] = await db.execute(
      'SELECT id, username FROM users WHERE email = ?',
      [email.trim().toLowerCase()]
    );

    // Responde sempre com sucesso para não revelar se email existe
    if (rows.length === 0) {
      return res.json({ success: true });
    }

    const user = rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await db.execute(
      'DELETE FROM password_reset_tokens WHERE user_id = ?',
      [user.id]
    );
    await db.execute(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, token, expires]
    );

    const appUrl = process.env.APP_URL || 'http://localhost:8080';
    const resetUrl = `${appUrl}/reset-password.html?token=${token}`;

    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"WineAV" <${process.env.EMAIL_USER}>`,
      to: email.trim().toLowerCase(),
      subject: 'Recuperação de password – WineAV',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto">
          <h2 style="color:#7B2D3E">🍷 WineAV</h2>
          <p>Olá <strong>${user.username}</strong>,</p>
          <p>Recebemos um pedido para recuperar a tua password.</p>
          <p>Clica no botão abaixo para definir uma nova password. O link é válido durante <strong>1 hora</strong>.</p>
          <a href="${resetUrl}" style="display:inline-block;background:#7B2D3E;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0">Recuperar password</a>
          <p style="color:#888;font-size:0.85rem">Se não pediste isto, ignora este email.</p>
        </div>
      `
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Erro ao enviar email. Tenta novamente.' });
  }
});

// Reset password — valida token e define nova password
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Dados inválidos.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password deve ter pelo menos 6 caracteres.' });

  try {
    const [rows] = await db.execute(
      'SELECT user_id, expires_at FROM password_reset_tokens WHERE token = ?',
      [token]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Link inválido ou expirado.' });
    }

    const { user_id, expires_at } = rows[0];
    if (new Date() > new Date(expires_at)) {
      await db.execute('DELETE FROM password_reset_tokens WHERE token = ?', [token]);
      return res.status(400).json({ error: 'Link expirado. Pede um novo.' });
    }

    const hashed = await bcrypt.hash(password, 12);
    await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashed, user_id]);
    await db.execute('DELETE FROM password_reset_tokens WHERE token = ?', [token]);

    res.json({ success: true });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

module.exports = router;
