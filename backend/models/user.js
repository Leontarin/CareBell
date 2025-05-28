const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    id:{
        type: String,
        required: true,
    },
    fullName:{
        type: String,
        required: true
    },
    phoneNumber:{
        type: String,
        required: true
    },
    address:{
        type: String,
        required: true
    },
    dateOfBirth:{
        type: Date,
        required: true
    },
    gender:{
        type: String,
        required: true
    },
    allergies:{
        type: [String],
        required: false
    }
});

userSchema.index({ id: 1 });


module.exports = mongoose.model('User', userSchema);