require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const session = require('express-session');
const path = require('path');
const db = require('./db');

const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const wineRoutes = require('./routes/wines');
const ratingRoutes = require('./routes/ratings');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'wineav-dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,
    sameSite: 'lax'
  }
}));

// Serve frontend static files (works both locally and on Railway)
const frontendPath = path.join(__dirname, '../../frontend');
app.use(express.static(frontendPath));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/rooms/:roomId/wines', wineRoutes);
app.use('/api/wines/:wineId/ratings', ratingRoutes);

// Fallback: serve index.html for non-API routes
app.get(/^(?!\/api).*$/, (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Run DB migrations and start server
async function startServer() {
  // Add role column if it doesn't exist
  await db.execute(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role ENUM('user','admin') DEFAULT 'user'
  `).catch(() => {}); // ignore if already exists or DB doesn't support IF NOT EXISTS

  app.listen(PORT, () => {
    console.log(`WineAV server running at http://localhost:${PORT}`);
  });
}

startServer();
