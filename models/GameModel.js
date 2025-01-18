const mongoose = require('mongoose');

const GameSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true },
    stage: { type: String },
    week: { type: String },
    date: {
        timezone: { type: String },
        date: { type: String },
        time: { type: String },
        timestamp: { type: Number },
    },
    venue: {
        name: { type: String },
        city: { type: String },
    },
    status: {
        short: { type: String },
        long: { type: String },
        timer: { type: String, default: null },
    },
    league: {
        id: { type: Number },
        name: { type: String },
        season: { type: String },
        logo: { type: String },
        country: {
            name: { type: String },
            code: { type: String },
            flag: { type: String },
        },
    },
    teams: {
        home: {
            id: { type: Number },
            name: { type: String },
            logo: { type: String },
        },
        away: {
            id: { type: Number },
            name: { type: String },
            logo: { type: String },
        },
    },
    scores: {
        home: {
            quarter_1: { type: Number, default: null },
            quarter_2: { type: Number, default: null },
            quarter_3: { type: Number, default: null },
            quarter_4: { type: Number, default: null },
            overtime: { type: Number, default: null },
            total: { type: Number, default: null },
        },
        away: {
            quarter_1: { type: Number, default: null },
            quarter_2: { type: Number, default: null },
            quarter_3: { type: Number, default: null },
            quarter_4: { type: Number, default: null },
            overtime: { type: Number, default: null },
            total: { type: Number, default: null },
        },
    },
    lastUpdated: { type: Date, default: Date.now }, // Controle de cache
});

module.exports = mongoose.model('Game', GameSchema);