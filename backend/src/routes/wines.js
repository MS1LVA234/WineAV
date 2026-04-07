const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

async function checkMembership(roomId, userId) {
  const [rows] = await db.execute(
    'SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?',
    [roomId, userId]
  );
  return rows.length > 0;
}

// GET all wines in a room
router.get('/', requireAuth, async (req, res) => {
  const roomId = parseInt(req.params.roomId, 10);
  if (isNaN(roomId)) return res.status(400).json({ error: 'ID inválido.' });

  try {
    if (!await checkMembership(roomId, req.session.userId)) {
      return res.status(403).json({ error: 'Não és membro desta sala.' });
    }

    const [wines] = await db.execute(
      `SELECT w.*,
              u1.username AS added_by_name,
              u2.username AS chosen_by_name,
              ROUND(AVG(r.rating), 1) AS avg_rating,
              COUNT(r.id) AS rating_count,
              (SELECT r2.rating FROM ratings r2
               WHERE r2.wine_id = w.id AND r2.user_id = ?) AS my_rating
       FROM wines w
       LEFT JOIN users u1 ON w.added_by = u1.id
       LEFT JOIN users u2 ON w.chosen_by = u2.id
       LEFT JOIN ratings r ON w.id = r.wine_id
       WHERE w.room_id = ?
       GROUP BY w.id
       ORDER BY w.created_at DESC`,
      [req.session.userId, roomId]
    );

    res.json({ wines });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao obter vinhos.' });
  }
});

// GET top 10 wines in a room (must be before /:wineId)
router.get('/top10', requireAuth, async (req, res) => {
  const roomId = parseInt(req.params.roomId, 10);
  if (isNaN(roomId)) return res.status(400).json({ error: 'ID inválido.' });

  try {
    if (!await checkMembership(roomId, req.session.userId)) {
      return res.status(403).json({ error: 'Não és membro desta sala.' });
    }

    const [wines] = await db.execute(
      `SELECT w.*,
              u1.username AS added_by_name,
              u2.username AS chosen_by_name,
              ROUND(AVG(r.rating), 1) AS avg_rating,
              COUNT(r.id) AS rating_count
       FROM wines w
       LEFT JOIN users u1 ON w.added_by = u1.id
       LEFT JOIN users u2 ON w.chosen_by = u2.id
       LEFT JOIN ratings r ON w.id = r.wine_id
       WHERE w.room_id = ?
       GROUP BY w.id
       HAVING rating_count > 0
       ORDER BY avg_rating DESC, rating_count DESC
       LIMIT 10`,
      [roomId]
    );

    res.json({ wines });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao obter top 10.' });
  }
});

// GET single wine
router.get('/:wineId', requireAuth, async (req, res) => {
  const wineId = parseInt(req.params.wineId, 10);
  if (isNaN(wineId)) return res.status(400).json({ error: 'ID inválido.' });

  try {
    const [wines] = await db.execute(
      `SELECT w.*, u1.username AS added_by_name, u2.username AS chosen_by_name
       FROM wines w
       LEFT JOIN users u1 ON w.added_by = u1.id
       LEFT JOIN users u2 ON w.chosen_by = u2.id
       WHERE w.id = ?`,
      [wineId]
    );
    if (wines.length === 0) return res.status(404).json({ error: 'Vinho não encontrado.' });

    const wine = wines[0];
    if (!await checkMembership(wine.room_id, req.session.userId)) {
      return res.status(403).json({ error: 'Não és membro desta sala.' });
    }

    res.json({ wine });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao obter vinho.' });
  }
});

// POST add wine
router.post('/', requireAuth, async (req, res) => {
  const roomId = parseInt(req.params.roomId, 10);
  if (isNaN(roomId)) return res.status(400).json({ error: 'ID inválido.' });

  const { name, region, year, castas, tempo_estagio, volume_alcool, preco, chosen_by } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Nome do vinho é obrigatório.' });
  }

  const parsedYear = year ? parseInt(year, 10) : null;
  if (parsedYear && (parsedYear < 1800 || parsedYear > new Date().getFullYear())) {
    return res.status(400).json({ error: 'Ano inválido.' });
  }

  const parsedAlcool = volume_alcool ? parseFloat(volume_alcool) : null;
  if (parsedAlcool !== null && (parsedAlcool < 0 || parsedAlcool > 25)) {
    return res.status(400).json({ error: 'Volume de álcool inválido.' });
  }

  const parsedPreco = preco ? parseFloat(preco) : null;
  if (parsedPreco !== null && parsedPreco < 0) {
    return res.status(400).json({ error: 'Preço inválido.' });
  }

  const parsedChosenBy = chosen_by ? parseInt(chosen_by, 10) : null;

  try {
    if (!await checkMembership(roomId, req.session.userId)) {
      return res.status(403).json({ error: 'Não és membro desta sala.' });
    }

    if (parsedChosenBy) {
      if (!await checkMembership(roomId, parsedChosenBy)) {
        return res.status(400).json({ error: 'O utilizador escolhido não é membro da sala.' });
      }
    }

    const [result] = await db.execute(
      `INSERT INTO wines (room_id, name, region, year, castas, tempo_estagio, volume_alcool, preco, chosen_by, added_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        roomId,
        name.trim(),
        region ? region.trim() : null,
        parsedYear,
        castas ? castas.trim() : null,
        tempo_estagio ? tempo_estagio.trim() : null,
        parsedAlcool,
        parsedPreco,
        parsedChosenBy,
        req.session.userId
      ]
    );

    res.status(201).json({ success: true, wineId: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao adicionar vinho.' });
  }
});

// PUT edit wine
router.put('/:wineId', requireAuth, async (req, res) => {
  const wineId = parseInt(req.params.wineId, 10);
  const roomId = parseInt(req.params.roomId, 10);
  if (isNaN(wineId) || isNaN(roomId)) return res.status(400).json({ error: 'ID inválido.' });

  const { name, region, year, castas, tempo_estagio, volume_alcool, preco, chosen_by } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Nome do vinho é obrigatório.' });
  }

  const parsedYear = year ? parseInt(year, 10) : null;
  const parsedAlcool = volume_alcool ? parseFloat(volume_alcool) : null;
  const parsedPreco = preco ? parseFloat(preco) : null;
  const parsedChosenBy = chosen_by ? parseInt(chosen_by, 10) : null;

  try {
    const [wines] = await db.execute('SELECT * FROM wines WHERE id = ? AND room_id = ?', [wineId, roomId]);
    if (wines.length === 0) return res.status(404).json({ error: 'Vinho não encontrado.' });

    if (!await checkMembership(roomId, req.session.userId)) {
      return res.status(403).json({ error: 'Não és membro desta sala.' });
    }

    if (parsedChosenBy && !await checkMembership(roomId, parsedChosenBy)) {
      return res.status(400).json({ error: 'O utilizador escolhido não é membro da sala.' });
    }

    await db.execute(
      `UPDATE wines SET name=?, region=?, year=?, castas=?, tempo_estagio=?, volume_alcool=?, preco=?, chosen_by=?
       WHERE id=?`,
      [
        name.trim(),
        region ? region.trim() : null,
        parsedYear,
        castas ? castas.trim() : null,
        tempo_estagio ? tempo_estagio.trim() : null,
        parsedAlcool,
        parsedPreco,
        parsedChosenBy,
        wineId
      ]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao editar vinho.' });
  }
});

// DELETE wine
router.delete('/:wineId', requireAuth, async (req, res) => {
  const wineId = parseInt(req.params.wineId, 10);
  const roomId = parseInt(req.params.roomId, 10);
  if (isNaN(wineId) || isNaN(roomId)) return res.status(400).json({ error: 'ID inválido.' });

  try {
    const [wines] = await db.execute('SELECT * FROM wines WHERE id = ? AND room_id = ?', [wineId, roomId]);
    if (wines.length === 0) return res.status(404).json({ error: 'Vinho não encontrado.' });

    if (wines[0].added_by !== req.session.userId) {
      return res.status(403).json({ error: 'Apenas quem adicionou o vinho o pode eliminar.' });
    }

    await db.execute('DELETE FROM wines WHERE id = ?', [wineId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao eliminar vinho.' });
  }
});

module.exports = router;
