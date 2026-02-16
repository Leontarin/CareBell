const express = require('express');
const router = express.Router();
const Medication = require('../models/medication'); // Adjust path as needed

router.get('/', async (req, res) => {
    try {
        const meds = await Medication.find();
        res.json(meds);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/:userId', async (req, res) => {
    try {
        const meds = await Medication.find({ userId: req.params.userId });

        if (!meds.length) {
            return res.status(404).json({ message: 'No medications found for this user' });
        }

        res.json(meds);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});



router.get('/getAll/:userId', async (req, res) => {
    try {
        const medications = await Medication.find({ userId: req.params.userId });

        if (!medications.length) {
            return res.status(404).json({ message: 'No medications found for this user' });
        }

        res.json(medications);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});



router.post('/addMedication', async (req, res) => {
    try {
        const { userId, name, dosage, frequency, lastTaken, nextDue } = req.body;

        const newMedication = new Medication({
            userId,
            name,
            dosage,
            frequency,
            lastTaken,
            nextDue
        });

        const savedMedication = await newMedication.save();
        res.status(201).json(savedMedication);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});



router.delete('/:id', async (req, res) => {
    try {
        const deletedMed = await Medication.findByIdAndDelete(req.params.id);

        if (!deletedMed) {
            return res.status(404).json({ message: 'Medication not found' });
        }

        res.json({ message: 'Medication deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.patch('/:id/updateLastTaken', async (req, res) => {
    try {
        const { lastTaken } = req.body;
        const updatedMed = await Medication.findByIdAndUpdate(
            req.params.id,
            { lastTaken },
            { new: true }
        );

        if (!updatedMed) {
            return res.status(404).json({ message: 'Medication not found' });
        }

        res.json(updatedMed);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.patch('/:id/updateNextDue', async (req, res) => {
    try {
        const { nextDue } = req.body;
        const updatedMed = await Medication.findByIdAndUpdate(
            req.params.id,
            { nextDue },
            { new: true }
        );

        if (!updatedMed) {
            return res.status(404).json({ message: 'Medication not found' });
        }

        res.json(updatedMed);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});


module.exports = router;
