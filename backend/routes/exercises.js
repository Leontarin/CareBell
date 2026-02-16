// routes/exercises.js

const express = require('express');
const router = express.Router();
const Exercise = require('../models/exercise');

// Get all exercises
router.get('/', async (req, res) => {
    try {
        const exercises = await Exercise.find();
        res.json(exercises);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get all active exercises for elderly
router.get('/elderly-friendly', async (req, res) => {
    try {
        const exercises = await Exercise.find({ 
            elderlyFriendly: true,
            isActive: true,
            difficulty: { $in: ['Easy', 'Medium'] }
        });
        
        res.json(exercises);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get exercises by category
router.get('/category/:category', async (req, res) => {
    try {
        const exercises = await Exercise.find({ 
            category: req.params.category,
            isActive: true 
        });
        
        res.json(exercises);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get single exercise by ID
router.get('/:id', async (req, res) => {
    try {
        const exercise = await Exercise.findById(req.params.id);
        
        if (!exercise) {
            return res.status(404).json({ message: 'Exercise not found' });
        }
        
        res.json(exercise);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Populate database with sample exercises
router.post('/populate-sample', async (req, res) => {
    try {
        const sampleExercises = [
            {
                guid: "exercise-001",
                name: "Chair Squats",
                description: "Safe and effective leg strengthening exercise using a chair for support.",
                instructions: "1. Stand in front of a chair with feet hip-width apart\n2. Lower yourself slowly until you sit on the chair\n3. Press through your heels to stand back up\n4. Repeat 8-10 times",
                difficulty: "Easy",
                targetAreas: ["Legs", "Glutes", "Core"],
                duration: 5,
                caloriesBurned: 30,
                reps: 10,
                sets: 2,
                equipment: ["Chair"],
                thumbnailUrl: "https://images.unsplash.com/photo-1599058917212-d750089bc07e?w=400&h=300&fit=crop",
                gifUrl: "https://media.giphy.com/media/26FPnAKcCBHoCLJqE/giphy.gif",
                benefits: ["Strengthens leg muscles", "Improves balance", "Helps with daily activities"],
                precautions: ["Hold onto chair for balance", "Don't drop down quickly"],
                modifications: ["Use armrest for extra support", "Partial squats only"],
                category: "Strength",
                isActive: true,
                elderlyFriendly: true
            },
            {
                guid: "exercise-002",
                name: "Wall Push-Ups",
                description: "Upper body strength exercise that's easier than floor push-ups.",
                instructions: "1. Stand arm's length from a wall\n2. Place hands flat against wall at shoulder height\n3. Lean forward, bending elbows\n4. Push back to starting position\n5. Repeat 8-10 times",
                difficulty: "Easy",
                targetAreas: ["Arms", "Chest", "Shoulders"],
                duration: 5,
                caloriesBurned: 25,
                reps: 10,
                sets: 2,
                equipment: ["Wall"],
                thumbnailUrl: "https://images.unsplash.com/photo-1598632640214-7bfe84b69233?w=400&h=300&fit=crop",
                gifUrl: "https://media.giphy.com/media/l0HlxBqvQZN99FnO8/giphy.gif",
                benefits: ["Builds upper body strength", "Improves posture", "Safe for beginners"],
                precautions: ["Keep core engaged", "Don't push beyond comfort"],
                modifications: ["Stand closer to wall for less resistance"],
                category: "Strength",
                isActive: true,
                elderlyFriendly: true
            },
            {
                guid: "exercise-003",
                name: "Seated Shoulder Rolls",
                description: "Gentle shoulder mobility exercise that can be done anywhere.",
                instructions: "1. Sit comfortably with feet flat on floor\n2. Roll shoulders forward in slow circles\n3. Complete 5 circles forward\n4. Reverse direction for 5 circles\n5. Repeat 2-3 times",
                difficulty: "Easy",
                targetAreas: ["Shoulders", "Neck"],
                duration: 3,
                caloriesBurned: 10,
                reps: 10,
                sets: 3,
                equipment: ["Chair"],
                thumbnailUrl: "https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?w=400&h=300&fit=crop",
                gifUrl: "https://media.giphy.com/media/l0HlqY5VxJOCL0xEs/giphy.gif",
                benefits: ["Reduces shoulder tension", "Improves range of motion", "Can be done anywhere"],
                precautions: ["Move slowly", "Stop if you feel pain"],
                modifications: ["Do one shoulder at a time", "Smaller movements if needed"],
                category: "Flexibility",
                isActive: true,
                elderlyFriendly: true
            },
            {
                guid: "exercise-004",
                name: "Standing Balance",
                description: "Simple balance exercise to help prevent falls.",
                instructions: "1. Stand behind a chair for support\n2. Lift one foot slightly off the ground\n3. Hold for 10 seconds\n4. Switch to other foot\n5. Repeat 3-5 times each leg",
                difficulty: "Medium",
                targetAreas: ["Balance", "Core", "Legs"],
                duration: 5,
                caloriesBurned: 15,
                reps: 5,
                sets: 2,
                equipment: ["Chair"],
                thumbnailUrl: "https://images.unsplash.com/photo-1599058917837-35e4265399d2?w=400&h=300&fit=crop",
                gifUrl: "https://media.giphy.com/media/xUOxf7jH2XZQR5hZWE/giphy.gif",
                benefits: ["Improves balance", "Prevents falls", "Strengthens core"],
                precautions: ["Always keep chair within reach", "Don't close eyes"],
                modifications: ["Just lift heel off ground", "Use wall for extra support"],
                category: "Balance",
                isActive: true,
                elderlyFriendly: true
            },
            {
                guid: "exercise-005",
                name: "Seated Marching",
                description: "Gentle cardio exercise that can be done while sitting.",
                instructions: "1. Sit tall in chair with feet flat\n2. Lift one knee up as high as comfortable\n3. Lower it back down\n4. Repeat with other leg\n5. Continue alternating for 30 seconds",
                difficulty: "Easy",
                targetAreas: ["Hips", "Core", "Circulation"],
                duration: 3,
                caloriesBurned: 20,
                reps: 20,
                sets: 3,
                equipment: ["Chair"],
                thumbnailUrl: "https://images.unsplash.com/photo-1584863265910-214e011dd42b?w=400&h=300&fit=crop",
                gifUrl: "https://media.giphy.com/media/xUOxf5lDwJMqBDJ2Sgo/giphy.gif",
                benefits: ["Improves circulation", "Gentle cardio", "Strengthens hip flexors"],
                precautions: ["Keep back straight", "Don't strain"],
                modifications: ["Add arm swings for more movement", "Lift knees lower if needed"],
                category: "Cardio",
                isActive: true,
                elderlyFriendly: true
            }
        ];

        const result = await Exercise.insertMany(sampleExercises);
        
        res.status(201).json({
            message: `Successfully added ${result.length} sample exercises`,
            exercises: result
        });
    } catch (error) {
        res.status(500).json({ 
            message: 'Error populating exercises', 
            error: error.message 
        });
    }
});

// Clear all exercises (use with caution)
router.delete('/clear-all', async (req, res) => {
    try {
        const result = await Exercise.deleteMany({});
        res.json({ message: `Deleted ${result.deletedCount} exercises` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;