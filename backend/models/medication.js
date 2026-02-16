const mongoose = require('mongoose');

const medicationSchema = new mongoose.Schema({
    userId:{
        type: String,
        require: true,
    },
    name:{
        type: String,
        require: true
    },
    dosage:{
        type: String,
        require: true
    },
    frequency:{
        type: String,
        require: true
    },
    lastTaken:{
        type: String,
        require: true
    },
    nextDue:{
        type: String,
        require: true
    },
});

medicationSchema.index({ userId: 1 });


module.exports = mongoose.model('Medications', medicationSchema);