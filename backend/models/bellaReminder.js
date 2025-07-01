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
  // no longer required—will omit when saving only category/entities
  description: {
    type: String
  },
  // new field: store exactly what the model returned
  category: {
    type: String,
    required: true,
    enum: ['personal_information','private_information','question','other']
  },
  // new field: free-form object of extracted entities
  entities: {
    type: mongoose.Schema.Types.Mixed
  },
  reminderTime: {
    type: Date,
    required: true
  },
  isImportant: {
    type: Boolean,
    required: true
  },
  // you can still keep embeddings if you plan to use them later
  embedding: {
    type: [Number],
    index: false
  }
});

// index for faster lookups by user
bellaReminderSchema.index({ userId: 1 });

module.exports = mongoose.model('BellaReminder', bellaReminderSchema);
