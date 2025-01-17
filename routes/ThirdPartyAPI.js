const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const axios = require('axios');
const dotenv = require('dotenv');
const Player = require('../models/PlayerModel'); 
const Team = require('../models/TeamModel');
const cron = require('node-cron');

dotenv.config();

const TEAM_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34];
const LEAGUE_ID = 1;
const SEASON = 2024;
const REQUESTS_LIMIT = 10; 
const DELAY_BETWEEN_REQUESTS = 60 * 1000 / REQUESTS_LIMIT; 

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Função para atualizar os dados dos times
const updateTeamsData = async () => {
  try {
    const now = new Date();
    
    for (const teamId of TEAM_IDS) {
      const cachedTeam = await Team.findOne({ id: teamId });

      if (cachedTeam) {
        const lastUpdated = cachedTeam.lastUpdated;
        const hoursDifference = Math.abs(now - lastUpdated) / 36e5; // Diferença em horas

        if (hoursDifference <= 24) {
          console.log(`Dados do time ${teamId} carregados do cache.`);
          continue;
        }
      }

      const response = await axios.get('https://v1.american-football.api-sports.io/teams', {
        params: {
          id: parseInt(teamId),
          league: LEAGUE_ID,
          season: SEASON,
        },
        headers: {
          'x-rapidapi-host': 'v1.american-football.api-sports.io',
          'x-rapidapi-key': process.env.APIFOOTBALL,
        },
      });

      const teamData = response.data.response[0];

      if (!teamData) {
        console.warn(`Nenhum dado retornado para o time ${teamId}`);
        continue;
      }

      await Team.updateOne(
        { id: teamData.id },
        {
          $set: {
            ...teamData,
            lastUpdated: new Date(),
          },
        },
        { upsert: true }
      );

      console.log(`Dados do time ${teamId} salvos/atualizados no banco.`);

      await delay(DELAY_BETWEEN_REQUESTS);
    }
  } catch (error) {
    console.error('Erro ao atualizar dados dos times:', error.message);
  }
};

// Função para atualizar os jogadores
const updatePlayersData = async () => {
  const positions = {
    QB: [],
    WR: [],
    RB: [],
    FB: [],
    HB: [],
    TE: [],
    C: [],
    OT: [],
    G: [],
    DE: [],
    DT: [],
    LB: [],
    CB: [],
    S: [],
    SS: [],
    FS: [],
    P: [],
    PK: [],
  };

  try {
    for (const teamId of TEAM_IDS) {
      const cachedPlayers = await Player.find({ teamId });

      if (cachedPlayers.length > 0) {
        const lastUpdated = cachedPlayers[0].lastUpdated;
        const now = new Date();
        const hoursDifference = Math.abs(now - lastUpdated) / 36e5;

        if (hoursDifference < 24) {
          console.log(`Jogadores do time ${teamId} carregados do cache.`);

          cachedPlayers.forEach(player => {
            if (positions[player.playerPosition]) {
              positions[player.playerPosition].push({
                id: player.id,
                name: player.name,
                playerPosition: player.playerPosition,
                teamId: player.teamId,
              });
            }
          });

          continue;
        }
      }

      const response = await axios.get('https://v1.american-football.api-sports.io/players', {
        params: {
          team: parseInt(teamId),
          season: SEASON,
        },
        headers: {
          'x-rapidapi-host': 'v1.american-football.api-sports.io',
          'x-rapidapi-key': process.env.APIFOOTBALL,
        },
      });

      const players = response.data.response;

      if (players.length === 0) {
        console.warn(`Nenhum jogador retornado para o time ${teamId}`);
        continue;
      }

      const bulkInserts = [];

      players.forEach(player => {
        const position = player.position;
        if (positions[position]) {
          const playerData = {
            id: player.id,
            name: player.name,
            playerPosition: player.position,
            teamId: teamId,
          };

          positions[position].push(playerData);

          bulkInserts.push({
            updateOne: {
              filter: { id: player.id },
              update: { $set: { ...playerData, lastUpdated: new Date() } },
              upsert: true,
            },
          });
        }
      });

      if (bulkInserts.length > 0) {
        await Player.bulkWrite(bulkInserts);
        console.log(`Jogadores do time ${teamId} salvos no banco.`);
      }

      await delay(DELAY_BETWEEN_REQUESTS);
    }

    console.log('Jogadores atualizados com sucesso!');
  } catch (error) {
    console.error('Erro ao atualizar jogadores:', error.message);
  }
};

// Agendamento das atualizações para ocorrerem à meia-noite todos os dias
cron.schedule('0 0 * * 3', async () => {
  console.log('Iniciando atualização dos dados...');
  await updateTeamsData();
  await updatePlayersData();
  console.log('Atualização dos dados concluída.');
});

/*cron.schedule('0 0 * * 0,1,2,4,5,6', async () => {  // Executa à meia-noite nos outros dias
    console.log('Requisições de jogadores e resultados...');
    
  });*/
  

// Rota para consultar os times
router.get('/teams', async (req, res) => {
  try {
    const allTeams = await Team.find();
    res.json(allTeams);
  } catch (error) {
    console.error('Erro ao buscar dados dos times:', error.message);
    res.status(500).json({ error: 'Erro ao buscar dados dos times.' });
  }
});

// Rota para consultar jogadores por posição
router.get('/players-by-position', async (req, res) => {
  const positions = {
    QB: [],
    WR: [],
    RB: [],
    FB: [],
    HB: [],
    TE: [],
    C: [],
    OT: [],
    G: [],
    DE: [],
    DT: [],
    LB: [],
    CB: [],
    S: [],
    SS: [],
    FS: [],
    P: [],
    PK: [],
  };

  try {
    for (const teamId of TEAM_IDS) {
      const cachedPlayers = await Player.find({ teamId });

      if (cachedPlayers.length > 0) {
        const lastUpdated = cachedPlayers[0].lastUpdated;
        const now = new Date();
        const hoursDifference = Math.abs(now - lastUpdated) / 36e5;

        if (hoursDifference < 24) {
          console.log(`Jogadores do time ${teamId} carregados do cache.`);

          cachedPlayers.forEach(player => {
            if (positions[player.playerPosition]) {
              positions[player.playerPosition].push({
                id: player.id,
                name: player.name,
                playerPosition: player.playerPosition,
                teamId: player.teamId,
              });
            }
          });

          continue;
        }
      }

      const response = await axios.get('https://v1.american-football.api-sports.io/players', {
        params: {
          team: parseInt(teamId),
          season: SEASON,
        },
        headers: {
          'x-rapidapi-host': 'v1.american-football.api-sports.io',
          'x-rapidapi-key': process.env.APIFOOTBALL,
        },
      });

      const players = response.data.response;

      if (players.length === 0) {
        console.warn(`Nenhum jogador retornado para o time ${teamId}`);
        continue;
      }

      const bulkInserts = [];

      players.forEach(player => {
        const position = player.position;
        if (positions[position]) {
          const playerData = {
            id: player.id,
            name: player.name,
            playerPosition: player.position,
            teamId: teamId,
          };

          positions[position].push(playerData);

          bulkInserts.push({
            updateOne: {
              filter: { id: player.id },
              update: { $set: { ...playerData, lastUpdated: new Date() } },
              upsert: true,
            },
          });
        }
      });

      if (bulkInserts.length > 0) {
        await Player.bulkWrite(bulkInserts);
        console.log(`Jogadores do time ${teamId} salvos no banco.`);
      }

      await delay(DELAY_BETWEEN_REQUESTS);
    }

    res.json(positions);
  } catch (error) {
    console.error('Erro ao buscar jogadores:', error.message);
    res.status(500).json({ error: 'Erro ao buscar jogadores.' });
  }
});

module.exports = router;
