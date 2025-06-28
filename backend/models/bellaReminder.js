// models/bellaReminder.js

const mongoose = require('mongoose');

const bellaReminderSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    reminderTime: {
        type: Date,
        required: true
    },
    isImportant: {
        type: Boolean,
        required: true
    },
    embedding: {
        type: [Number],
        index: false
    }
});

bellaReminderSchema.index({ userId: 1 });

module.exports = mongoose.model('BellaReminder', bellaReminderSchema);
