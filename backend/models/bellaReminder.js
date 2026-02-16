const mongoose = require('mongoose');

const bellaReminderSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true // Faster lookups
  },
  
  // ✅ UPDATED: The 7 Core Categories required
  category: {
    type: String,
    required: true,
    enum: [
      'Places', 
      'Experiences', 
      'Hobbies', 
      'Appointments', 
      'Health', 
      'Relationships', 
      'Wishes'
    ]
  },

  // ✅ The actual fact/memory content (formerly 'title' or 'description')
  content: {
    type: String,
    required: true
  },

  // Stores details like { "city": "Berlin" } or { "medication": "Aspirin" }
  entities: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // ✅ CHANGED: Now optional. Only used if Category == 'Appointments'
  reminderTime: {
    type: Date,
    required: false 
  },

  // ✅ NEW: Critical for your "Health" requirement
  isEncrypted: {
    type: Boolean,
    default: false
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('BellaReminder', bellaReminderSchema);




// const mongoose = require('mongoose');

// const bellaReminderSchema = new mongoose.Schema({
//   userId: {
//     type: String,
//     required: true
//   },
//   title: {
//     type: String,
//     required: true
//   },
//   // no longer required—will omit when saving only category/entities
//   description: {
//     type: String
//   },
//   // new field: store exactly what the model returned
//   category: {
//     type: String,
//     required: true,
//     enum: ['personal_information','private_information','question','other']
//   },
//   // new field: free-form object of extracted entities
//   entities: {
//     type: mongoose.Schema.Types.Mixed
//   },
//   reminderTime: {
//     type: Date,
//     required: true
//   },
//   isImportant: {
//     type: Boolean,
//     required: true
//   },
//   // you can still keep embeddings if you plan to use them later
//   embedding: {
//     type: [Number],
//     index: false
//   }
// });

// // index for faster lookups by user
// bellaReminderSchema.index({ userId: 1 });

// module.exports = mongoose.model('BellaReminder', bellaReminderSchema);
