// models/exercise.js

const mongoose = require('mongoose');

const exerciseSchema = new mongoose.Schema({
    guid: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        index: true
    },
    description: {
        type: String,
        required: true
    },
    instructions: {
        type: String,
        required: true
    },
    difficulty: {
        type: String,
        enum: ['Easy', 'Medium', 'Hard'],
        required: true,
        index: true
    },
    targetAreas: {
        type: [String],
        required: true,
        index: true
    },
    duration: {
        type: Number, // Duration in minutes
        required: true,
        min: 1
    },
    caloriesBurned: {
        type: Number,
        default: 0,
        min: 0
    },
    reps: {
        type: Number,
        default: 0,
        min: 0
    },
    sets: {
        type: Number,
        default: 0,
        min: 0
    },
    equipment: {
        type: [String],
        default: []
    },
    videoUrl: {
        type: String,
        default: null
    },
    gifUrl: {
        type: String,
        default: null
    },
    thumbnailUrl: {
        type: String,
        default: null
    },
    benefits: {
        type: [String],
        default: []
    },
    precautions: {
        type: [String],
        default: []
    },
    modifications: {
        type: [String],
        default: []
    },
    category: {
        type: String,
        enum: ['Strength', 'Flexibility', 'Balance', 'Cardio', 'Other'],
        required: true,
        index: true
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    elderlyFriendly: {
        type: Boolean,
        default: true,
        index: true
    }
}, {
    timestamps: true
});

// Compound indexes for common queries
exerciseSchema.index({ category: 1, difficulty: 1 });
exerciseSchema.index({ elderlyFriendly: 1, difficulty: 1 });

module.exports = mongoose.model('Exercise', exerciseSchema);