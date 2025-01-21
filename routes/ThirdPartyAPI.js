const express = require('express');
const router = express.Router();
const axios = require('axios');
const dotenv = require('dotenv');
const Player = require('../models/PlayerModel');
const Team = require('../models/TeamModel');
const Game = require('../models/GameModel')
const PlayerStatistics = require('../models/PlayerStatisticsModel')
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
                group: player.group,
                image: player.image,
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
            group: player.group,
            image: player.image
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

const updateGamesData = async () => {
  try {
    const now = new Date();

    // Verificar se existe algum jogo no banco de dados
    const cachedGame = await Game.findOne();

    if (cachedGame) {
      const hoursDifference = Math.abs(now - cachedGame.lastUpdated) / 36e5; // Diferença em horas

      if (hoursDifference <= 24) {
        console.log('Dados dos jogos carregados do cache.');
        return await Game.find(); // Retorna os jogos já armazenados no banco
      }
    }

    // Fazer a requisição à API caso os dados estejam desatualizados
    const response = await axios.get('https://v1.american-football.api-sports.io/games', {
      params: { league: LEAGUE_ID, season: SEASON },
      headers: {
        'x-rapidapi-host': 'v1.american-football.api-sports.io',
        'x-rapidapi-key': process.env.APIFOOTBALL,
      },
    });

    const games = response.data.response;

    if (games.length === 0) {
      console.warn('Nenhum jogo retornado pela API.');
      return [];
    }

    const bulkInserts = games.map((game) => ({
      updateOne: {
        filter: { id: game.game.id },
        update: {
          $set: {
            id: game.game.id,
            stage: game.game.stage,
            week: game.game.week,
            date: game.game.date,
            venue: game.game.venue,
            status: game.game.status,
            league: game.league,
            teams: game.teams,
            scores: game.scores,
            lastUpdated: now,
          },
        },
        upsert: true,
      },
    }));

    // Salvar os dados no banco
    if (bulkInserts.length > 0) {
      await Game.bulkWrite(bulkInserts);
      console.log('Jogos atualizados com sucesso!');
    }

    return games;
  } catch (error) {
    console.error('Erro ao atualizar os jogos:', error.message);
    throw error;
  }
};

const updatePlayerStatistics = async () => {
  try {
    const fixedDate = "2025-01-18";
    console.log(`Data fixa utilizada: ${fixedDate}`);

    const games = await Game.find({ "date.date": { $gt: fixedDate } });
    console.log(`Jogos encontrados: ${games.length}`);

    const gameIds = games.map(game => game.id);
    console.log(gameIds);

    if (gameIds.length === 0) {
      console.warn("Nenhum jogo futuro encontrado.");
      return null;
    }

    const statistics = [];

    function calculatePlayerPoints(statistics) {
      let points = 0;

      statistics.forEach(stat => {
        const value = parseFloat(stat.value) || 0;
        const valueStr = String(value)

        switch (stat.name.toLowerCase()) {
          case "yards":
            points += value * 0.1;
            break;
          case "passing touch downs":
            points += value * 6;
            break;
          case "interceptions":
            points -= value * 2;
            break;
          case "two pt":
            points += value * 2;
            break;
          case "comp att":

            if (valueStr.includes("/")) {
              const [comp, att] = valueStr.split("/").map(Number);
              points += (comp / att) * 10;
            }
            break;
          case "sacks":
            if (valueStr.includes("-")) {
              const [sacks, ydslost] = valueStr.split("-").map(Number);
              points -= (sacks * 2 + ydslost * 0.1);
            } else {
              points += value * 2
            }
            break;
          case "tackles":
            points += value * 1;
            break;
          case "unassisted tackles":
            points += value * 0.5;
            break;
          case "tfl":
            points += value * 1;
            break;
          case "passes defended":
            points += value * 1;
            break;
          case "qb hts":
            points += value * 0.5;
            break;
          case "interceptions for touch downs":
            points += value * 6;
            break;
          case "blocked kickk":
            points += value * 2;
            break;
          case "kick return td":
            points += value * 6;
            break;
          case "exp return td":
            points += value * 6;
            break;
          case "ff":
            points += value * 2;
            break;
          case "total rushes":
            points += value * 0.1;
            break;
          case "rushing touch downs":
            points += value * 6;
            break;
          case "targets":
            points += value * 0.1;
            break;
          case "total receptions":
            points += value * 1;
            break;
          case "receiving touch downs":
            points += value * 6;
            break;
          case "total":
            points -= value * 2;
            break;
          case "lost":
            points -= value * 2;
            break;
          case "field goals":
            if (valueStr.includes("/")) {
              const [made, attempts] = valueStr.split("/").map(Number);
              points += made * 3;
            }
            break;
          case "field goals from 1 19 yards":
            points += value * 3;
            break;
          case "field goals from 20 29 yards":
            points += value * 3;
            break;
          case "field goals from 30 39 yards":
            points += value * 3;
            break;
          case "field goals from 40 49 yards":
            points += value * 4;
            break;
          case "field goals from 50 yards":
            points += value * 5;
            break;
          case "extra point":
            if (valueStr.includes("/")) {
              const [made, attempts] = valueStr.split("/").map(Number);
              points += made * 1;
            }
            break;
          case "touchbacks":
            points += value * 0.5;
            break;
          case "in20":
            points += value * 0.5;
            break;

          case "in20":
            points += value * 2
            break;


          default:
            // Caso a estatística não tenha um cálculo definido
            break;
        }
      });

      return points.toFixed(2);
    }

    for (const gameId of gameIds) {
      const cachedStatistics = await PlayerStatistics.findOne({ gameId });

      if (cachedStatistics) {
        console.log(`Estatísticas para o jogo ${gameId} carregadas do cache.`);
        statistics.push(cachedStatistics);
        continue;
      }

      const response = await axios.get("https://v1.american-football.api-sports.io/games/statistics/players", {
        params: { id: gameId },
        headers: {
          "x-rapidapi-host": "v1.american-football.api-sports.io",
          "x-rapidapi-key": process.env.APIFOOTBALL,
        },
      });

      const stats = response.data.response;

      if (!stats || stats.length === 0) {
        console.warn(`Estatísticas não encontradas para o jogo ${gameId}`);
        continue;
      }

      const bulkInserts = [];

      // Processa cada time no jogo (um por vez)
      stats.forEach(game => {
        // Cria o documento para o time atual
        const teamData = {
          gameId: gameId,
          teamId: game.team.id,
          teamName: game.team.name,
          teamLogo: game.team.logo,
          groups: game.groups.map(group => ({
            groupName: group.name,
            players: group.players.map(player => {
              // Calcula a pontuação do jogador
              const points = calculatePlayerPoints(player.statistics);


              return {
                playerId: player.player.id,
                playerName: player.player.name,
                playerImage: player.player.image,
                points,
                statistics: player.statistics.map(stat => ({
                  name: stat.name,
                  value: stat.value || 0, // Garante um valor padrão para evitar problemas
                })),
              };
            }),
          })),
          lastUpdated: new Date(),
        };

        // Adiciona o time ao bulk insert
        bulkInserts.push({
          updateOne: {
            filter: { gameId: teamData.gameId, teamId: teamData.teamId },
            update: { $set: teamData },
            upsert: true,
          },
        });
      });

      if (bulkInserts.length > 0) {
        await PlayerStatistics.bulkWrite(bulkInserts);
        statistics.push(...bulkInserts.map(item => item.updateOne.update.$set));
        console.log(`Estatísticas do jogo ${gameId} salvas no banco.`);
      }

      await delay(DELAY_BETWEEN_REQUESTS);
    }

    return statistics.length > 0 ? statistics : null;
  } catch (error) {
    console.error(`Erro ao atualizar as estatísticas do jogo:`, error.message);
    return null;
  }
};







cron.schedule('00 00 00 * * 3', async () => {
  console.log('Iniciando atualização dos dados...');
  await updateTeamsData();
  await updatePlayersData();
  console.log('Atualização dos dados concluída.');
}, {
  timezone: 'UTC'
});

cron.schedule('00 37 14 * * 0,1,4,5,6', async () => {
  console.log('Requisições de jogadores e resultados...');
  await updateGamesData();
  await updatePlayerStatistics();
}, {
  timezone: 'UTC'
});


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
    // Obtém todos os parâmetros de consulta (query string)
    const queryParams = req.query;
    const positionKeys = Object.keys(queryParams);

    // Log para verificar os parâmetros recebidos

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
                group: player.group,
                image: player.image
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
            group: player.group,
            image: player.image,
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

    // Filtra as posições solicitadas nos parâmetros
    const filteredPositions = {};
    if (positionKeys.length > 0) {
      positionKeys.forEach(key => {
        if (positions[key]) {
          filteredPositions[key] = positions[key];
        }
      });
    } else {
      // Se nenhum filtro foi enviado, retorna todas as posições
      Object.assign(filteredPositions, positions);
    }

    // Log para verificar o resultado final

    res.json(filteredPositions);
  } catch (error) {
    console.error('Erro ao buscar jogadores:', error.message);
    res.status(500).json({ error: 'Erro ao buscar jogadores.' });
  }
});


router.get('/games-info', async (req, res) => {
  try {
    const games = await updateGamesData();
    res.json({ data: games });
  } catch (error) {
    console.error('Erro ao atualizar os jogos:', error.message);
    res.status(500).json({ error: 'Erro ao atualizar os jogos.' });
  }
});

router.get("/games/statistics/player", async (req, res) => {
  const { gameId, playerId } = req.query; // Obtém gameId e playerId da URL

  try {
    // Monta a query base dinamicamente
    const query = {};

    if (gameId) {
      query.gameId = parseInt(gameId);
    }

    // Busca os documentos no banco de dados
    const statistics = await PlayerStatistics.find(query).lean();

    if (!statistics || statistics.length === 0) {
      return res.status(404).json({ error: "Nenhuma estatística encontrada com os critérios fornecidos." });
    }

    // Filtra os dados se playerId for fornecido
    let filteredStatistics = statistics;

    if (playerId) {
      const playerIdNumber = parseInt(playerId);

      // Filtramos os jogadores em cada grupo e removemos grupos vazios
      filteredStatistics = statistics.map(stat => ({
        ...stat,
        groups: stat.groups.map(group => ({
          ...group,
          players: group.players.filter(player => player.playerId === playerIdNumber), // Filtra jogadores pelo playerId
        })).filter(group => group.players.length > 0), // Remove grupos sem jogadores
      })).filter(stat => stat.groups.length > 0); // Remove documentos sem grupos válidos
    }

    // Remove duplicatas se, por algum motivo, a lógica acima ainda permitir repetições
    const uniqueResults = filteredStatistics.map(stat => ({
      ...stat,
      groups: stat.groups.map(group => ({
        ...group,
        players: Array.from(new Set(group.players.map(player => JSON.stringify(player)))).map(player => JSON.parse(player)), // Remove jogadores duplicados
      })),
    }));

    // Retorna os dados filtrados
    res.json(uniqueResults);
  } catch (error) {
    console.error(`Erro ao buscar estatísticas dos jogos:`, error.message);
    res.status(500).json({ error: "Erro ao buscar estatísticas dos jogos." });
  }
});


router.get("/games/statistics/update", async (req, res) => {
  try {
    // Chama a função de atualização das estatísticas sem precisar do playerId
    const statistics = await updatePlayerStatistics(); // A função agora não precisa de playerId

    if (!statistics) {
      return res.status(404).json({ error: "Nenhuma estatística encontrada para os jogos futuros." });
    }

    // Retorna as estatísticas atualizadas para os jogos futuros
    res.json(statistics);
  } catch (error) {
    console.error(`Erro ao buscar estatísticas dos jogos:`, error.message);
    res.status(500).json({ error: "Erro ao buscar estatísticas dos jogos." });
  }
});




module.exports = router;
