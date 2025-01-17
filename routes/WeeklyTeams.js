const express = require('express')
const router = express.Router()
const mongoose = require('mongoose')
const axios = require("axios");
const dotenv = require("dotenv")

dotenv.config()


const WeeklyTeamsSchema = new mongoose.Schema({
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    teamName: {
        type: String,
        required: true,
        trim: true
    },
    credits: {
        type: Number,
        required: true,
        min: 0,
        default: 100
    },
    offensivePlayers: [
        {
            type: String,
            ref: 'Player'
        }
    ],
    defensivePlayers: [
        {
            type: String,
            ref: 'Player'
        }
    ],
    specialistPlayer: {
        type: String,
        ref: 'Player'
    }
}, { timestamps: true });





module.exports = router;