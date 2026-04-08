const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Resend } = require('resend');
const db = require('../db');

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
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
    req.session.userRole = user.role || 'user';

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
router.get('/me', async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }
  try {
    const [rows] = await db.execute('SELECT id, username, email, avatar, role FROM users WHERE id = ?', [req.session.userId]);
    if (rows.length === 0) return res.status(401).json({ error: 'Não autenticado.' });
    req.session.userRole = rows[0].role || 'user';
    res.json({ user: rows[0] });
  } catch (err) {
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

// Alterar password (autenticado)
router.put('/profile/password', async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password deve ter pelo menos 6 caracteres.' });
  }
  try {
    const [rows] = await db.execute('SELECT password FROM users WHERE id = ?', [req.session.userId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Utilizador não encontrado.' });
    const valid = await bcrypt.compare(currentPassword, rows[0].password);
    if (!valid) return res.status(400).json({ error: 'Password atual incorreta.' });
    const hashed = await bcrypt.hash(newPassword, 12);
    await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashed, req.session.userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// Alterar dados pessoais (username e email)
router.put('/profile/info', async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }
  const { username, email } = req.body;
  if (!username && !email) {
    return res.status(400).json({ error: 'Indica pelo menos username ou email.' });
  }
  if (username !== undefined && (username.length < 3 || username.length > 50)) {
    return res.status(400).json({ error: 'Username deve ter entre 3 e 50 caracteres.' });
  }
  try {
    const fields = [];
    const values = [];
    if (username !== undefined) { fields.push('username = ?'); values.push(username.trim()); }
    if (email !== undefined) { fields.push('email = ?'); values.push(email.trim().toLowerCase()); }
    values.push(req.session.userId);
    await db.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    if (username !== undefined) req.session.username = username.trim();
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Username ou email já existe.' });
    }
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// ── ADMIN ──────────────────────────────────────────────────────────────────

// Setup inicial: torna um email admin, só funciona se não existir nenhum admin ainda
router.post('/setup-admin', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email obrigatório.' });
  try {
    const [admins] = await db.execute("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    if (admins.length > 0) {
      return res.status(403).json({ error: 'Já existe um admin. Acesso negado.' });
    }
    const [result] = await db.execute("UPDATE users SET role = 'admin' WHERE email = ?", [email.trim().toLowerCase()]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Email não encontrado.' });
    res.json({ success: true, message: `${email} é agora admin.` });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno.' });
  }
});

async function requireAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }
  // Verificar diretamente na DB (não depende da sessão estar atualizada)
  try {
    const [rows] = await db.execute("SELECT role FROM users WHERE id = ?", [req.session.userId]);
    if (rows.length === 0 || rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado.' });
    }
    req.session.userRole = 'admin';
    next();
  } catch (err) {
    res.status(500).json({ error: 'Erro interno.' });
  }
}

// Listar todos os utilizadores (admin)
router.get('/admin/users', requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ users: rows });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// Apagar utilizador (admin, não pode apagar a si próprio)
router.delete('/admin/users/:id', requireAdmin, async (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  if (targetId === req.session.userId) {
    return res.status(400).json({ error: 'Não podes apagar a tua própria conta.' });
  }
  try {
    await db.execute('DELETE FROM users WHERE id = ?', [targetId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// Promover utilizador a admin
router.put('/admin/users/:id/role', requireAdmin, async (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  const { role } = req.body;
  if (!['user', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Role inválido.' });
  }
  try {
    await db.execute('UPDATE users SET role = ? WHERE id = ?', [role, targetId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

module.exports = router;