const mongoose = require('mongoose');

const contactsSchema = new mongoose.Schema({
    userId:{
        type: String,
        require: true,
    },
    fullName:{
        type: String,
        require: true
    },
    phoneNumber:{
        type: String,
        require: true
    },
    relationship:{
        type: String,
        require: true
    },
});

contactsSchema.index({ userId: 1 });


module.exports = mongoose.model('Contacts', contactsSchema);