const mongoose = require('mongoose');

const TeamSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  logoHash: { type: String },
  seasonId: { type: Number, required: true },
  seasonName: { type: String, required: true },
  lastUpdated: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Team', TeamSchema);
