const express = require('express')
const router = express.Router()
const mongoose = require('mongoose')
const axios = require("axios");
const dotenv = require("dotenv")

dotenv.config()

const PlayerSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true }, 
  name: { type: String, required: true },            
  playerPosition: { type: String, required: true },  
  teamId: { type: Number, required: true },          
  group: { type: String, required: false }, 
  image: { type: String, required: false }, 
  lastUpdated: { type: Date, default: Date.now }   
});



const weeklyTeamSchema = new mongoose.Schema({
    teamName: { type: String, required: true },
    teamLogo: { type: String, required: true },
    players: [PlayerSchema],
    credits: { type: Number, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lastUpdated: { type: Date, default: Date.now },
  });

const WeeklyTeam = mongoose.model('WeeklyTeam', weeklyTeamSchema)

router.post('/create', async (req, res) => {
    try {
      const { userId, teamName, teamLogo, credits } = req.body;
  
      const existingTeam = await WeeklyTeam.findOne({ userId });
  
      if (existingTeam) {
        return res.status(400).json({ message: 'Você já possui um time. Atualize ou exclua-o antes de criar um novo.' });
      }
  
      const newTeam = new WeeklyTeam({
        userId,
        teamName,
        teamLogo,
        players: [], 
        credits,
      });
  
      await newTeam.save();
      return res.status(201).json(newTeam);
    } catch (error) {
      console.error('Erro ao criar o time:', error.message);
      return res.status(500).json({ message: 'Erro interno ao criar o time.' });
    }
  });
  
  router.put('/addPlayer', async (req, res) => {
    const { userId, player } = req.body;
  
    if (!userId || !player) {
      return res.status(400).json({ message: 'userId e player são obrigatórios.' });
    }
  
    try {
      const team = await WeeklyTeam.findOne({ userId });
  
      if (!team) {
        return res.status(404).json({ message: 'Time não encontrado.' });
      }
  
      // Verifica se o jogador já está no time
      const isPlayerAlreadyInTeam = team.players.some((p) => p.id === player.id);
      if (isPlayerAlreadyInTeam) {
        return res.status(400).json({ message: 'Jogador já está no time.' });
      }
  
      team.players.push(player);
      await team.save();
  
      res.status(200).json({ message: 'Jogador adicionado com sucesso!', team });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Erro interno no servidor.' });
    }
  });

  router.put('/updatePlayer', async (req, res) => {
    try {
      const { userId, playerId, updatedPlayerData } = req.body; // `updatedPlayerData` contém os dados atualizados do jogador
  
      const team = await WeeklyTeam.findOne({ userId });
  
      if (!team) {
        return res.status(404).json({ message: 'Time não encontrado!' });
      }
  
      const playerIndex = team.players.findIndex(player => player.id === playerId);
  
      if (playerIndex === -1) {
        return res.status(404).json({ message: 'Jogador não encontrado!' });
      }
  
      // Atualiza os dados do jogador
      team.players[playerIndex] = { ...team.players[playerIndex], ...updatedPlayerData };
      team.lastUpdated = new Date();
  
      await team.save();
      return res.status(200).json(team);
    } catch (error) {
      console.error('Erro ao atualizar o jogador:', error.message);
      return res.status(500).json({ message: 'Erro interno ao atualizar o jogador.' });
    }
  });

  // Rota para consultar o time de um jogador
  router.get('/:id', async (req, res) => {
    try {
      const userId = req.params.id;
  
      const team = await WeeklyTeam.findOne({ userId });
  
      if (!team) {
        return res.status(404).json({ message: 'Time não encontrado!' });
      }
  
      return res.status(200).json(team);
    } catch (error) {
      console.error('Erro ao buscar o time:', error.message);
      return res.status(500).json({ message: 'Erro interno ao buscar o time.' });
    }
  });



module.exports = router;