const express = require('express');
const Reminder = require('../models/reminder');

const router = express.Router();

// Add a new reminder
router.post('/', async (req, res) => {
    try {
        const reminder = new Reminder(req.body);
        await reminder.save();
        res.status(201).json(reminder);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Get all reminders for a specific user
router.get('/:userId', async (req, res) => {
    try {
        const reminders = await Reminder.find({ userId: req.params.userId });
        res.json(reminders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a reminder by ID and userID
router.delete('/:userId/:id', async (req, res) => {
    try {
        const reminder = await Reminder.findOneAndDelete({
            _id: req.params.id,
            userId: req.params.userId
        });
        if (!reminder) {
            return res.status(404).json({ error: 'Reminder not found for this user' });
        }
        res.json({ message: 'Reminder deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update a reminder by ID and userID
router.put('/:userId/:id', async (req, res) => {
    try {
        const reminder = await Reminder.findOneAndUpdate(
            { _id: req.params.id, userId: req.params.userId },
            req.body,
            { new: true, runValidators: true }
        );
        if (!reminder) {
            return res.status(404).json({ error: 'Reminder not found for this user' });
        }
        res.json(reminder);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;