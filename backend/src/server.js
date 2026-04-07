require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const path = require('path');

const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const wineRoutes = require('./routes/wines');
const ratingRoutes = require('./routes/ratings');

const app = express();
const PORT = process.env.PORT || 3000;

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas tentativas. Tenta novamente em 15 minutos.' }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'wineav-dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
}));

// Serve frontend static files (works both locally and on Railway)
const frontendPath = path.join(__dirname, '../../frontend');
app.use(express.static(frontendPath));

// API Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/rooms/:roomId/wines', wineRoutes);
app.use('/api/wines/:wineId/ratings', ratingRoutes);

// Fallback: serve index.html for non-API routes
app.get(/^(?!\/api).*$/, (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`WineAV server running at http://localhost:${PORT}`);
});
