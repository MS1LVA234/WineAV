const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

// POST rate a wine (insert or update)
router.post('/', requireAuth, async (req, res) => {
  const wineId = parseInt(req.params.wineId, 10);
  if (isNaN(wineId)) return res.status(400).json({ error: 'ID inválido.' });

  const { rating } = req.body;
  if (rating === undefined || rating === null || rating === '') {
    return res.status(400).json({ error: 'Avaliação é obrigatória.' });
  }

  const ratingVal = parseFloat(rating);
  if (isNaN(ratingVal) || ratingVal < 0 || ratingVal > 10) {
    return res.status(400).json({ error: 'Avaliação deve ser entre 0 e 10.' });
  }

  try {
    const [wines] = await db.execute('SELECT * FROM wines WHERE id = ?', [wineId]);
    if (wines.length === 0) return res.status(404).json({ error: 'Vinho não encontrado.' });

    const wine = wines[0];

    const [membership] = await db.execute(
      'SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?',
      [wine.room_id, req.session.userId]
    );
    if (membership.length === 0) {
      return res.status(403).json({ error: 'Não és membro desta sala.' });
    }

    // Upsert: insert or update rating
    await db.execute(
      `INSERT INTO ratings (wine_id, user_id, rating) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE rating = VALUES(rating), created_at = CURRENT_TIMESTAMP`,
      [wineId, req.session.userId, ratingVal]
    );

    const [avg] = await db.execute(
      'SELECT ROUND(AVG(rating), 1) AS avg_rating, COUNT(*) AS rating_count FROM ratings WHERE wine_id = ?',
      [wineId]
    );

    res.json({
      success: true,
      avg_rating: avg[0].avg_rating,
      rating_count: avg[0].rating_count,
      my_rating: ratingVal
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao registar avaliação.' });
  }
});

// GET all ratings for a wine
router.get('/', requireAuth, async (req, res) => {
  const wineId = parseInt(req.params.wineId, 10);
  if (isNaN(wineId)) return res.status(400).json({ error: 'ID inválido.' });

  try {
    const [wines] = await db.execute('SELECT * FROM wines WHERE id = ?', [wineId]);
    if (wines.length === 0) return res.status(404).json({ error: 'Vinho não encontrado.' });

    const [membership] = await db.execute(
      'SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?',
      [wines[0].room_id, req.session.userId]
    );
    if (membership.length === 0) {
      return res.status(403).json({ error: 'Não és membro desta sala.' });
    }

    const [ratings] = await db.execute(
      `SELECT r.rating, r.created_at, u.username
       FROM ratings r
       JOIN users u ON r.user_id = u.id
       WHERE r.wine_id = ?
       ORDER BY r.rating DESC`,
      [wineId]
    );

    res.json({ ratings });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao obter avaliações.' });
  }
});

module.exports = router;
