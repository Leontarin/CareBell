const express = require('express');
const router = express.Router();
const Room = require('../models/room');

// Add multer middleware to handle FormData from sendBeacon
const multer = require('multer');
const upload = multer(); // for parsing multipart/form-data



// Create default/permanent rooms (admin function or seed data)
router.post('/create-default', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Missing room name' });
    
    // Check if room already exists
    const existingRoom = await Room.findOne({ name });
    if (existingRoom) {
      return res.status(400).json({ error: 'Room name already exists' });
    }
    
    const room = new Room({ 
      name, 
      participants: [], 
      isActive: false,
      isTemporary: false // This is a permanent default room
    });
    await room.save();
    
    // Emit to all clients that a new default room was created
    req.app.get('io').emit('room-created', room);
    
    res.status(201).json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new temporary room and add the user as the first participant
router.post('/create', async (req, res) => {
  try {
    const { name, userId } = req.body;
    if (!name || !userId) return res.status(400).json({ error: 'Missing name or userId' });
    
    // Check if room already exists
    const existingRoom = await Room.findOne({ name });
    if (existingRoom) {
      return res.status(400).json({ error: 'Room name already exists' });
    }
    
    const room = new Room({ 
      name, 
      participants: [userId], 
      isActive: true,
      isTemporary: true // This is a temporary room
    });
    await room.save();
    
    // Emit to all clients that a new room was created
    req.app.get('io').emit('room-created', room);
    
    res.status(201).json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Join a room
router.post('/join', async (req, res) => {
  try {
    const { roomName, userId } = req.body;
    const room = await Room.findOne({ name: roomName });
    if (!room) return res.status(404).json({ error: 'Room not found' });
    
    if (!room.participants.includes(userId)) {
      room.participants.push(userId);
      room.isActive = true; // Mark room as active when someone joins
      await room.save();
      
      // Emit participant update
      req.app.get('io').emit('room-updated', room);
    }
    
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Leave a room (and delete if empty AND temporary) - Handle both JSON and FormData
router.post('/leave', upload.none(), async (req, res) => {
  try {
    const { roomName, userId } = req.body;
    
    if (!roomName || !userId) {
      return res.status(400).json({ error: 'Missing roomName or userId' });
    }
    
    const room = await Room.findOne({ name: roomName });
    if (!room) return res.status(404).json({ error: 'Room not found' });
    
    room.participants = room.participants.filter(id => id.toString() !== userId);
    
    if (room.participants.length === 0) {
      if (room.isTemporary) {
        // Only delete if it's a temporary room
        await room.deleteOne();
        req.app.get('io').emit('room-deleted', { name: roomName });
        return res.json({ message: 'Temporary room deleted' });
      } else {
        // For default rooms, just mark as inactive and save
        room.isActive = false;
        await room.save();
        req.app.get('io').emit('room-updated', room);
        return res.json({ message: 'Default room cleared but preserved', room });
      }
    } else {
      await room.save();
      // Emit participant update
      req.app.get('io').emit('room-updated', room);
      return res.json(room);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all rooms
router.get('/', async (req, res) => {
  try {
    const rooms = await Room.find();
    const User = require('../models/user');
    
    // Add participant details to each room
    const roomsWithDetails = await Promise.all(
      rooms.map(async (room) => {
        const participantDetails = await Promise.all(
          room.participants.map(async (userId) => {
            try {
              const user = await User.findOne({ id: userId });
              return {
                userId: userId,
                fullName: user ? user.fullName : `User ${userId.slice(-4)}`
              };
            } catch (error) {
              return {
                userId: userId,
                fullName: `User ${userId.slice(-4)}`
              };
            }
          })
        );
        
        return {
          ...room.toObject(),
          participantDetails: participantDetails
        };
      })
    );
    
    res.json(roomsWithDetails);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get only default/permanent rooms
router.get('/default', async (req, res) => {
  try {
    const rooms = await Room.find({ isTemporary: false });
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// Get room by ID with participants
router.get('/:roomId', async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update room status (active/inactive)
router.patch('/:roomId/status', async (req, res) => {
  try {
    const { isActive } = req.body;
    const room = await Room.findByIdAndUpdate(
      req.params.roomId,
      { isActive },
      { new: true }
    );
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



router.get('/details/:roomName', async (req, res) => {
  try {
    const { roomName } = req.params;
    const room = await Room.findOne({ name: roomName });
    
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Get participant details from User collection
    const User = require('../models/user'); // Import User model
    const participantDetails = await Promise.all(
      room.participants.map(async (userId) => {
        try {
          const user = await User.findOne({ id: userId });
          return {
            userId: userId,
            fullName: user ? user.fullName : `User ${userId.slice(-4)}` // Fallback name
          };
        } catch (error) {
          console.error(`Error fetching user ${userId}:`, error);
          return {
            userId: userId,
            fullName: `User ${userId.slice(-4)}`
          };
        }
      })
    );

    res.json({
      ...room.toObject(),
      participantDetails: participantDetails
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



module.exports = router;