const express = require('express');
const router = express.Router();

/*
  TEMPORARY STUB ROUTES
  --------------------
  This file intentionally contains NO business logic.
  It exists only so the backend compiles while we
  redesign rooms properly.

  Do NOT add logic here yet.
*/

// Get all rooms (stub)
router.get('/', async (req, res) => {
  return res.json([]);
});

// Create room (stub)
router.post('/create', async (req, res) => {
  return res.status(501).json({
    error: 'Rooms not implemented yet'
  });
});

// Join room (stub)
router.post('/join', async (req, res) => {
  return res.status(501).json({
    error: 'Rooms not implemented yet'
  });
});

// Leave room (stub)
router.post('/leave', async (req, res) => {
  return res.status(200).json({
    message: 'Leave acknowledged (stub)'
  });
});

// Optional: default rooms (stub)
router.get('/default', async (req, res) => {
  return res.json([]);
});

// Optional: room details (stub)
router.get('/details/:roomName', async (req, res) => {
  return res.status(404).json({
    error: 'Room not found (stub)'
  });
});

module.exports = router;
