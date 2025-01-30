const mongoose = require('mongoose');

const StatisticsSchema = new mongoose.Schema({
  defensive: {
    combine_tackles: { type: Number, default: 0 },
    assist_tackles: { type: Number, default: 0 },
    sacks: { type: Number, default: 0 },
    forced_fumbles: { type: Number, default: 0 },
    interceptions: { type: Number, default: 0 },
    passes_defensed: { type: Number, default: 0 }
  },
  receiving: {
    touchdowns: { type: Number, default: 0 },
    receptions: { type: Number, default: 0 },
    yards: { type: Number, default: 0 },
    longest: { type: Number, default: 0 },
    yards_per_reception: { type: Number, default: 0 }
  },
  punt_returns: {
    total: { type: Number, default: 0 },
    yards: { type: Number, default: 0 },
    longest: { type: Number, default: 0 }
  },
  passing: {
    attempts: { type: Number, default: 0 },
    completions: { type: Number, default: 0 },
    yards: { type: Number, default: 0 },
    net_yards: { type: Number, default: 0 },
    interceptions: { type: Number, default: 0 },
    longest: { type: Number, default: 0 },
    sacked: { type: Number, default: 0 },
    touchdowns: { type: Number, default: 0 }
  },
  rushing: {
    attempts: { type: Number, default: 0 },
    yards: { type: Number, default: 0 },
    touchdowns: { type: Number, default: 0 },
    longest: { type: Number, default: 0 },
    yards_per_attempt: { type: Number, default: 0 }
  },
  kicking: {
    extra_made: { type: Number, default: 0 },
    extra_attempts: { type: Number, default: 0 },
    fg_attempts: { type: Number, default: 0 },
    fg_made: { type: Number, default: 0 },
    fg_long: { type: Number, default: 0 }
  }
});

const PlayerStatisticsSchema = new mongoose.Schema({
  match_id: { type: Number, required: true },
  playerId: { type: Number, required: true },
  teamId: { type: Number, required: true },
  position: { type: String, required: true },
  statistics: { type: StatisticsSchema, default: {} },
  points: { type: Number, default: 0 }, 
  lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PlayerStatistics', PlayerStatisticsSchema);