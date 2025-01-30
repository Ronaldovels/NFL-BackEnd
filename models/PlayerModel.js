const mongoose = require('mongoose');

const PlayerSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true }, 
  name: { type: String, required: true },            
  nickname: { type: String },
  playerPosition: { type: String, required: true },  
  playerJerseyNumber: { type: String },  
  playerHeight: { type: Number },
  shirtNumber: { type: Number },
  imageHash: { type: String },
  teamId: { type: Number, required: true },          
  teamName: { type: String },
  teamImageHash: { type: String },
  lastUpdated: { type: Date, default: Date.now }   
});

module.exports = mongoose.model('Player', PlayerSchema);
