const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Resend } = require('resend');
const db = require('../db');

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

function validatePassword(password) {
  if (password.length < 8) return 'Password deve ter pelo menos 8 caracteres.';
  if (!/[A-Z]/.test(password)) return 'Password deve ter pelo menos uma letra maiúscula.';
  if (!/[a-z]/.test(password)) return 'Password deve ter pelo menos uma letra minúscula.';
  if (!/[0-9]/.test(password)) return 'Password deve ter pelo menos um número.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password deve ter pelo menos um carácter especial (ex: !@#$).';
  return null;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
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
  const pwError = validatePassword(password);
  if (pwError) return res.status(400).json({ error: pwError });

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

    req.session.save((err) => {
      if (err) console.error('Session save error:', err);
      res.json({
        success: true,
        user: { id: user.id, username: user.username, email: user.email }
      });
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
router.get('/me', async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }
  try {
    const [rows] = await db.execute('SELECT id, username, email, avatar FROM users WHERE id = ?', [req.session.userId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Utilizador não encontrado.' });
    res.json({ user: rows[0] });
  } catch (err) {
    console.error('GET /me error:', err);
    // Fallback: usa dados da sessão se a BD falhar
    res.json({ user: { id: req.session.userId, username: req.session.username, email: null, avatar: null } });
  }
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
    const tokenHash = hashToken(token);
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await db.execute(
      'DELETE FROM password_reset_tokens WHERE user_id = ?',
      [user.id]
    );
    await db.execute(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [user.id, tokenHash, expires]
    );

    const appUrl = process.env.APP_URL || 'http://localhost:8080';
    const resetUrl = `${appUrl}/reset-password.html?token=${token}`;

    const resend = getResend();
    await resend.emails.send({
      from: 'WineAV <onboarding@resend.dev>',
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
  const pwError = validatePassword(password);
  if (pwError) return res.status(400).json({ error: pwError });

  try {
    const tokenHash = hashToken(token);
    const [rows] = await db.execute(
      'SELECT user_id, expires_at FROM password_reset_tokens WHERE token_hash = ?',
      [tokenHash]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Link inválido ou expirado.' });
    }

    const { user_id, expires_at } = rows[0];
    if (new Date() > new Date(expires_at)) {
      await db.execute('DELETE FROM password_reset_tokens WHERE token_hash = ?', [tokenHash]);
      return res.status(400).json({ error: 'Link expirado. Pede um novo.' });
    }

    const hashed = await bcrypt.hash(password, 12);
    await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashed, user_id]);
    await db.execute('DELETE FROM password_reset_tokens WHERE token_hash = ?', [tokenHash]);

    res.json({ success: true });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// Change password (autenticado)
router.put('/profile/password', async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
  }
  const pwError = validatePassword(newPassword);
  if (pwError) return res.status(400).json({ error: pwError });

  try {
    const [rows] = await db.execute('SELECT password FROM users WHERE id = ?', [req.session.userId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Utilizador não encontrado.' });

    const valid = await bcrypt.compare(currentPassword, rows[0].password);
    if (!valid) return res.status(400).json({ error: 'Password atual incorreta.' });

    const hashed = await bcrypt.hash(newPassword, 12);
    await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashed, req.session.userId]);

    res.json({ success: true });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// Update avatar (autenticado, base64)
router.put('/profile/avatar', async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }
  const { avatar } = req.body;
  if (!avatar) return res.status(400).json({ error: 'Imagem em falta.' });

  // Validação: apenas data URLs de imagem, máx ~300KB base64
  if (!/^data:image\/(jpeg|png|gif|webp);base64,/.test(avatar)) {
    return res.status(400).json({ error: 'Formato de imagem inválido. Usa JPG, PNG ou WEBP.' });
  }
  if (avatar.length > 400000) {
    return res.status(400).json({ error: 'Imagem demasiado grande. Máximo 300KB.' });
  }

  try {
    await db.execute('UPDATE users SET avatar = ? WHERE id = ?', [avatar, req.session.userId]);
    res.json({ success: true, avatar });
  } catch (err) {
    console.error('Avatar update error:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

module.exports = router;
