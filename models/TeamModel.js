const mongoose = require('mongoose');

const TeamSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  code: { type: String },
  city: { type: String },
  coach: { type: String },
  owner: { type: String },
  stadium: { type: String },
  established: { type: Number },
  logo: { type: String },
  country: {
    name: String,
    code: String,
    flag: String,
  },
  lastUpdated: { type: Date, default: Date.now },
});


module.exports = mongoose.model('Team', TeamSchema);