const mongoose = require('mongoose')


const PlayerStatisticsSchema = new mongoose.Schema({
  playerId: { type: Number, required: true },
  teamId: { type: Number, required: true },
  teamName: { type: String, required: true },
  teamLogo: { type: String, required: true },
  gameId: { type: Number, required: true },
  groups: [
    {
      groupName: { type: String, required: true },
      players: [
        {
          playerId: { type: Number, required: true },
          playerName: { type: String, required: true },
          playerImage: { type: String, required: true },
          points: { type: Number, default: 0 },
          statistics: [
            {
              name: { type: String, required: true },
              value: { type: String, required: true }
            },
          ],
        },
      ],
    },
  ],
  lastUpdated: { type: Date, default: Date.now },
});

module.exports = mongoose.model("PlayerStatistics", PlayerStatisticsSchema);
