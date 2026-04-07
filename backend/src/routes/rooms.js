const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

function generateInviteCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// Create room
router.post('/', requireAuth, async (req, res) => {
  const { name } = req.body;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Nome da sala é obrigatório.' });
  }

  try {
    let invite_code;
    let exists = true;
    while (exists) {
      invite_code = generateInviteCode();
      const [rows] = await db.execute('SELECT id FROM rooms WHERE invite_code = ?', [invite_code]);
      exists = rows.length > 0;
    }

    const [result] = await db.execute(
      'INSERT INTO rooms (name, invite_code, created_by) VALUES (?, ?, ?)',
      [name.trim(), invite_code, req.session.userId]
    );

    await db.execute(
      'INSERT INTO room_members (room_id, user_id) VALUES (?, ?)',
      [result.insertId, req.session.userId]
    );

    res.status(201).json({
      success: true,
      room: { id: result.insertId, name: name.trim(), invite_code }
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar sala.' });
  }
});

// Join room by invite code
router.post('/join', requireAuth, async (req, res) => {
  const { invite_code } = req.body;
  if (!invite_code) {
    return res.status(400).json({ error: 'Código de convite é obrigatório.' });
  }

  try {
    const [rooms] = await db.execute(
      'SELECT * FROM rooms WHERE invite_code = ?',
      [invite_code.trim().toUpperCase()]
    );
    if (rooms.length === 0) {
      return res.status(404).json({ error: 'Sala não encontrada. Verifica o código.' });
    }

    const room = rooms[0];
    const [existing] = await db.execute(
      'SELECT * FROM room_members WHERE room_id = ? AND user_id = ?',
      [room.id, req.session.userId]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Já és membro desta sala.' });
    }

    await db.execute(
      'INSERT INTO room_members (room_id, user_id) VALUES (?, ?)',
      [room.id, req.session.userId]
    );

    res.json({ success: true, room: { id: room.id, name: room.name, invite_code: room.invite_code } });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao entrar na sala.' });
  }
});

// Get all rooms for logged-in user
router.get('/', requireAuth, async (req, res) => {
  try {
    const [rooms] = await db.execute(
      `SELECT r.id, r.name, r.invite_code, r.created_at,
              u.username AS creator_name,
              (SELECT COUNT(*) FROM room_members rm2 WHERE rm2.room_id = r.id) AS member_count,
              (SELECT COUNT(*) FROM wines w WHERE w.room_id = r.id) AS wine_count
       FROM rooms r
       JOIN room_members rm ON r.id = rm.room_id
       JOIN users u ON r.created_by = u.id
       WHERE rm.user_id = ?
       ORDER BY r.created_at DESC`,
      [req.session.userId]
    );
    res.json({ rooms });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao obter salas.' });
  }
});

// Get room details + members
router.get('/:id', requireAuth, async (req, res) => {
  const roomId = parseInt(req.params.id, 10);
  if (isNaN(roomId)) return res.status(400).json({ error: 'ID inválido.' });

  try {
    const [membership] = await db.execute(
      'SELECT * FROM room_members WHERE room_id = ? AND user_id = ?',
      [roomId, req.session.userId]
    );
    if (membership.length === 0) {
      return res.status(403).json({ error: 'Não és membro desta sala.' });
    }

    const [rooms] = await db.execute(
      `SELECT r.*, u.username AS creator_name
       FROM rooms r JOIN users u ON r.created_by = u.id
       WHERE r.id = ?`,
      [roomId]
    );
    if (rooms.length === 0) return res.status(404).json({ error: 'Sala não encontrada.' });

    const [members] = await db.execute(
      `SELECT u.id, u.username
       FROM users u
       JOIN room_members rm ON u.id = rm.user_id
       WHERE rm.room_id = ?
       ORDER BY rm.joined_at ASC`,
      [roomId]
    );

    res.json({ room: rooms[0], members });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao obter sala.' });
  }
});

module.exports = router;
