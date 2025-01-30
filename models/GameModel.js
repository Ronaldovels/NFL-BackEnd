const mongoose = require('mongoose');

const GameSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true },
    name: { type: String },
    tournament: {
        id: { type: Number },
        name: { type: String },
        importance: { type: Number },
    },
    season: {
        id: { type: Number },
        name: { type: String },
        statisticsType: { type: String },
    },
    status: {
        type: { type: String },
        reason: { type: String },
    },
    arena: {
        id: { type: Number },
        name: { type: String },
        imageHash: { type: String },
    },
    teams: {
        home: {
            id: { type: Number },
            name: { type: String },
            logoHash: { type: String },
            score: {
                current: { type: Number },
                display: { type: Number },
                period_1: { type: Number },
                period_2: { type: Number },
                period_3: { type: Number },
                period_4: { type: Number },
                defaultTime: { type: Number },
            },
        },
        away: {
            id: { type: Number },
            name: { type: String },
            logoHash: { type: String },
            score: {
                current: { type: Number },
                display: { type: Number },
                period_1: { type: Number },
                period_2: { type: Number },
                period_3: { type: Number },
                period_4: { type: Number },
                defaultTime: { type: Number },
            },
        },
    },
    times: {
        specificStartTime: { type: String },
        startTime: { type: String },
        duration: { type: Number },
    },
    coaches: {
        home: {
            id: { type: Number },
            name: { type: String },
            imageHash: { type: String },
        },
        away: {
            id: { type: Number },
            name: { type: String },
            imageHash: { type: String },
        },
    },
    league: {
        id: { type: Number },
        name: { type: String },
        logoHash: { type: String },
    },
    class: {
        id: { type: Number },
        name: { type: String },
        imageHash: { type: String },
    },
    lastUpdated: { type: Date, default: Date.now }, // Controle de cache
});

module.exports = mongoose.model('Game', GameSchema);
