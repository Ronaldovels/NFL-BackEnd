const mongoose = require('mongoose');

const PlayerSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true }, 
  name: { type: String, required: true },            
  playerPosition: { type: String, required: true },  
  teamId: { type: Number, required: true },           
  lastUpdated: { type: Date, default: Date.now },     
});


module.exports = mongoose.model('Player', PlayerSchema);