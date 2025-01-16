const express = require('express')
const router = express.Router()
const mongoose = require('mongoose')
const axios = require("axios");
const dotenv = require("dotenv")

dotenv.config()

  
router.get('/players', async (req, res) => {
    const { name } = req.query;
  
    try {
      const response = await axios.get('https://v1.american-football.api-sports.io/players', {
        params: {
          name, 
          season: 2024,
          team,
        },
        headers: {
          'x-rapidapi-host': 'v1.american-football.api-sports.io',
          'x-rapidapi-key': process.env.APIFOOTBALL,
        },  
      });
  
      // Filtrar jogadores pela posição no back-end, se necessário
      const players = response.data.response;
      console.log(response.data);
      res.json(players); // Retorna a lista de jogadores filtrada
    } catch (error) {
      console.error('Erro ao buscar jogadores:', error.message);
      res.status(500).json({ error: 'Erro ao buscar jogadores.' });
    }
  });


  router.post('/team/add-player', async (req, res) => {
    const { userId, playerId, cost } = req.body;
  
    try {
      // Buscar o time do usuário no banco de dados
      const team = await Team.findOne({ ownerId: userId });
  
      // Verificar se há créditos suficientes
      if (team.credits < cost) {
        return res.status(400).json({ error: 'Créditos insuficientes.' });
      }
  
      // Adicionar o jogador ao time
      team.players.push(playerId);
      team.credits -= cost;
  
      await team.save();
      res.json({ message: 'Jogador adicionado com sucesso!', team });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao adicionar jogador ao time.' });
    }
  });
  
  module.exports = router;






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





