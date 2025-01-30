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

const TEAM_IDS = [1800, 1854, 46439, 46456, 46461, 46485, 46492, 46494, 46500, 46511, 46522, 46523, 46530, 46540, 46546, 46547, 46568, 46576, 46578, 46582, 46590, 46591, 46592, 46593, 46613, 46620, 46624, 46628, 46638, 46643, 46644, 46647, ]; //129433, 129445
const REQUESTS_LIMIT = 10;
const DELAY_BETWEEN_REQUESTS = 60 * 1000 / REQUESTS_LIMIT;
const API_URL = 'https://american-football.sportdevs.com/matches';
const MAX_RESULTS = 50; // A API retorna no máximo 50 jogos por requisição

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Função para atualizar os dados dos times
const updateTeamsData = async () => {
  try {
    const now = new Date();
    
    const response = await axios.get('https://american-football.sportdevs.com/teams-by-season?season_id=eq.44510', {
      headers: {
        Authorization: `Bearer ${process.env.API_TOKEN}`,
      },
    });
    
    const data = response.data;
    if (!Array.isArray(data) || data.length === 0) {
      console.warn('Nenhum dado de time retornado pela API.');
      return;
    }

    const seasonData = data[0];
    const seasonId = seasonData.season_id;
    const seasonName = seasonData.season_name;
    
    for (const team of seasonData.teams) {
      const cachedTeam = await Team.findOne({ id: team.team_id });

      if (cachedTeam) {
        const lastUpdated = cachedTeam.lastUpdated;
        const hoursDifference = Math.abs(now - lastUpdated) / 36e5; // Diferença em horas
        
        if (hoursDifference <= 24) {
          console.log(`Dados do time ${team.team_name} carregados do cache.`);
          continue;
        }
      }

      await Team.updateOne(
        { id: team.team_id },
        {
          $set: {
            id: team.team_id,
            name: team.team_name,
            logoHash: team.team_hash_image,
            seasonId,
            seasonName,
            lastUpdated: new Date(),
          },
        },
        { upsert: true }
      );
      
      console.log(`Dados do time ${team.team_name} salvos/atualizados no banco.`);
    }
  } catch (error) {
    console.error('Erro ao atualizar dados dos times:', error.message);
  }
};

// Função para atualizar os jogadores
const updatePlayersData = async () => {
  const positions = { QB: [], WR: [], RB: [], TE: [], OT: [], CB: [], DT: [], DE: [], LB: [], P: [], C: [], G: [], HB: [], FB: [], SS: [], FS: [], K: [], OL: [], OG: [], T: [], SAF: [], LS: [],  };

  try {
    for (const teamId of TEAM_IDS) {
      const cachedPlayers = await Player.find({ teamId });
      if (cachedPlayers.length > 0) {
        const lastUpdated = cachedPlayers[0].lastUpdated;
        const now = new Date();
        const hoursDifference = Math.abs(now - lastUpdated) / 36e5;

        if (hoursDifference < 24) {
          console.log(`Jogadores do time ${teamId} carregados do cache.`);
          continue;
        }
      }

      const response = await axios.get(`https://american-football.sportdevs.com/players-by-team?team_id=eq.${teamId}`, {
        headers: {
          Authorization: `Bearer ${process.env.API_TOKEN}`,
        },
      });

      const teamData = response.data;
      if (!Array.isArray(teamData) || teamData.length === 0 || !teamData[0].players) {
        console.warn(`Nenhum jogador retornado para o time ${teamId}`);
        continue;
      }

      const players = teamData[0].players;
      const bulkInserts = [];
      const now = new Date();

      players.forEach(player => {
        const position = player.position;
        if (positions[position]) {
          const playerData = {
            id: player.id,
            name: player.name,
            nickname: player.short_name, // Mapeando short_name para nickname
            playerPosition: player.position,
            playerJerseyNumber: player.player_jersey_number, // Mapeando player_jersey_number
            playerHeight: player.player_height, // Mapeando player_height
            shirtNumber: player.shirt_number, // Mapeando shirt_number
            imageHash: player.hash_image, // Mapeando hash_image
            teamId: teamId,
            teamName: teamData[0].team_name, // Mapeando team_name
            teamImageHash: teamData[0].team_hash_image || null, // Adicione team_hash_image se disponível
            lastUpdated: now
          };

          positions[position].push(playerData);

          bulkInserts.push({
            updateOne: {
              filter: { id: player.id },
              update: { $set: playerData },
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

    // Verificar se já existem jogos no banco
    const cachedGame = await Game.findOne();
    if (cachedGame) {
      const hoursDifference = Math.abs(now - cachedGame.lastUpdated) / 36e5; // Diferença em horas
      if (hoursDifference <= 24) {
        console.log('Dados dos jogos carregados do cache.');
        return await Game.find(); // Retorna os jogos já armazenados no banco
      }
    }

    let allGames = [];
    let offset = 0;
    let moreGames = true;

    while (moreGames) {
      // Fazer requisição à API com paginação
      const response = await axios.get(API_URL, {
        params: {
          season_id: 'eq.44510',
          limit: MAX_RESULTS,
          offset, // Paginação
        },
        headers: {
          Authorization: `Bearer ${process.env.API_TOKEN}`,
        },
      });

      const games = response.data;

      if (!games || games.length === 0) {
        moreGames = false;
        break;
      }

      console.log(`Buscando jogos do offset ${offset}, retornados: ${games.length}`);

      allGames = [...allGames, ...games];
      offset += MAX_RESULTS;
    }

    if (allGames.length === 0) {
      console.warn('Nenhum jogo retornado pela API.');
      return [];
    }

    console.log(`Total de jogos coletados: ${allGames.length}`);

    const gameIds = allGames.map(game => game.id);
    const existingGames = await Game.find({ id: { $in: gameIds } });
    const existingIds = new Set(existingGames.map(game => game.id));

    const newGames = allGames.filter(game => !existingIds.has(game.id));

    if (newGames.length === 0) {
      console.log('Nenhum jogo novo para adicionar.');
      return await Game.find();
    }

    const bulkInserts = newGames.map((game) => ({
      updateOne: {
        filter: { id: game.id },
        update: {
          $set: {
            id: game.id,
            name: game.name,

            // Torneio
            tournament: {
              id: game.tournament_id || null,
              name: game.tournament_name || null,
              importance: game.tournament_importance || null,
            },

            // Temporada
            season: {
              id: game.season_id || null,
              name: game.season_name || null,
              statisticsType: game.season_statistics_type || null,
            },

            // Status do jogo
            status: {
              type: game.status?.type || null,
              reason: game.status?.reason || null,
            },

            // Arena
            arena: {
              id: game.arena_id || null,
              name: game.arena_name || null,
              imageHash: game.arena_hash_image || null,
            },

            // Times
            teams: {
              home: {
                id: game.home_team_id || null,
                name: game.home_team_name || null,
                logoHash: game.home_team_hash_image || null,
                score: game.home_team_score
                  ? {
                      current: game.home_team_score.current || 0,
                      display: game.home_team_score.display || 0,
                      period_1: game.home_team_score.period_1 || 0,
                      period_2: game.home_team_score.period_2 || 0,
                      period_3: game.home_team_score.period_3 || 0,
                      period_4: game.home_team_score.period_4 || 0,
                      defaultTime: game.home_team_score.default_time || 0,
                    }
                  : {},
              },
              away: {
                id: game.away_team_id || null,
                name: game.away_team_name || null,
                logoHash: game.away_team_hash_image || null,
                score: game.away_team_score
                  ? {
                      current: game.away_team_score.current || 0,
                      display: game.away_team_score.display || 0,
                      period_1: game.away_team_score.period_1 || 0,
                      period_2: game.away_team_score.period_2 || 0,
                      period_3: game.away_team_score.period_3 || 0,
                      period_4: game.away_team_score.period_4 || 0,
                      defaultTime: game.away_team_score.default_time || 0,
                    }
                  : {},
              },
            },

            // Tempo
            times: {
              specificStartTime: game.start_time || null,
              startTime: game.start_time ? new Date(game.start_time).toISOString() : null,
              duration: game.duration || null,
            },

            // Treinadores
            coaches: {
              home: {
                id: game.coaches?.home_coach_id || null,
                name: game.coaches?.home_coach_name || null,
                imageHash: game.coaches?.home_coach_hash_image || null,
              },
              away: {
                id: game.coaches?.away_coach_id || null,
                name: game.coaches?.away_coach_name || null,
                imageHash: game.coaches?.away_coach_hash_image || null,
              },
            },

            // Liga
            league: {
              id: game.league_id || null,
              name: game.league_name || null,
              logoHash: game.league_hash_image || null,
            },

            // Classe (País)
            class: {
              id: game.class_id || null,
              name: game.class_name || null,
              imageHash: game.class_hash_image || null,
            },

            lastUpdated: now, // Atualizar o tempo da última atualização
          },
        },
        upsert: true, // Atualiza se existir, insere se não existir
      },
    }));

    // Salvar os dados no banco
    if (bulkInserts.length > 0) {
      await Game.bulkWrite(bulkInserts);
      console.log(`Foram adicionados ${newGames.length} novos jogos ao banco.`);
    }

    return await Game.find(); // Retorna os jogos atualizados do banco
  } catch (error) {
    console.error('Erro ao atualizar os jogos:', error.message);
    throw error;
  }
};

const calculatePlayerPoints = (statistics) => {
  let points = 0;

  // Converte o objeto de estatísticas em um array de { name, value }
  const statsArray = Object.entries(statistics).flatMap(([category, stats]) =>
    Object.entries(stats).map(([name, value]) => ({ name: `${category}_${name}`, value }))
  );

  statsArray.forEach(stat => {
    const value = parseFloat(stat.value) || 0;

    switch (stat.name) {
      // Defensive
      case "defensive_combine_tackles":
        points += value * 1; // Exemplo: 1 ponto por tackle combinado
        break;
      case "defensive_assist_tackles":
        points += value * 0.5; // Exemplo: 0.5 ponto por tackle assistido
        break;
      case "defensive_sacks":
        points += value * 2; // 2 pontos por sack
        break;
      case "defensive_forced_fumbles":
        points += value * 2; // 2 pontos por fumble forçado
        break;
      case "defensive_interceptions":
        points += value * 3; // 3 pontos por interceptação
        break;
      case "defensive_passes_defensed":
        points += value * 1; // 1 ponto por passe defendido
        break;

      // Receiving
      case "receiving_touchdowns":
        points += value * 6; // 6 pontos por touchdown de recepção
        break;
      case "receiving_receptions":
        points += value * 0.5; // 0.5 ponto por recepção
        break;
      case "receiving_yards":
        points += value * 0.1; // 0.1 ponto por jarda recebida
        break;

      // Punt Returns
      case "punt_returns_total":
        points += value * 0.5; // 0.5 ponto por retorno de punt
        break;
      case "punt_returns_yards":
        points += value * 0.1; // 0.1 ponto por jarda de retorno de punt
        break;
      case "punt_returns_long":
        points += value * 0.1; // 0.1 ponto por jarda do retorno mais longo
        break;

      // Passing
      case "passing_attempts":
        points += value * 0.1; // 0.1 ponto por tentativa de passe
        break;
      case "passing_completions":
        points += value * 0.5; // 0.5 ponto por passe completo
        break;
      case "passing_yards":
        points += value * 0.04; // 0.04 ponto por jarda de passe
        break;
      case "passing_interceptions":
        points -= value * 2; // -2 pontos por interceptação
        break;
      case "passing_sacked":
        points -= value * 1; // -1 ponto por sack sofrido
        break;
      case "passing_touchdowns":
        points += value * 6; // 6 pontos por touchdown de passe
        break;

      // Rushing
      case "rushing_attempts":
        points += value * 0.1; // 0.1 ponto por tentativa de corrida
        break;
      case "rushing_yards":
        points += value * 0.1; // 0.1 ponto por jarda de corrida
        break;
      case "rushing_touchdowns":
        points += value * 6; // 6 pontos por touchdown de corrida
        break;

      // Kicking
      case "kicking_extra_made":
        points += value * 1; // 1 ponto por ponto extra convertido
        break;
      case "kicking_extra_attempts":
        points += value * 0; // 0 pontos por tentativa de ponto extra (não conta se não converter)
        break;
      case "kicking_fg_attempts":
        points += value * 0; // 0 pontos por tentativa de field goal (não conta se não converter)
        break;
      case "kicking_fg_made":
        points += value * 3; // 3 pontos por field goal convertido
        break;
      case "kicking_fg_long":
        points += value * 0.1; // 0.1 ponto por jarda do field goal mais longo
        break;

      default:
        break;
    }
  });

  return parseFloat(points.toFixed(2));
};

const updatePlayerStatistics = async () => {
  try {
    console.log("Buscando gameIds da API interna...");
    const gameIdsResponse = await axios.get("http://localhost:3000/ThirdPartyAPI/games/ids");
    const { gameIds } = gameIdsResponse.data;

    if (!gameIds || gameIds.length === 0) {
      console.warn("Nenhum jogo encontrado no intervalo especificado.");
      return null;
    }

    console.log(`Game IDs obtidos: ${gameIds}`);

    const statistics = [];

    for (const gameId of gameIds) {
      const cachedStatistics = await PlayerStatistics.findOne({ match_id: gameId });

      if (cachedStatistics) {
        console.log(`Estatísticas para o jogo ${gameId} carregadas do cache.`);
        statistics.push(cachedStatistics);
        continue;
      }

      const response = await axios.get(`https://american-football.sportdevs.com/matches-players-statistics?match_id=eq.${gameId}`, {
        headers: {
          Authorization: `Bearer ${process.env.API_TOKEN}`,
        },
      });

      const stats = response.data;
      console.log(stats);
      console.log(response.data);

      if (!stats || stats.length === 0) {
        console.warn(`Estatísticas não encontradas para o jogo ${gameId}`);
        continue;
      }

      const bulkInserts = [];

      stats.forEach(playerStat => {
        if (!playerStat.match_id || !playerStat.player_id || !playerStat.team_id) {
          console.warn(`Dados ausentes para jogador, ignorando:`, playerStat);
          return;
        }

        // Mapeando as estatísticas para o novo formato
        const statisticsData = {
          defensive: {
            combine_tackles: playerStat.defensive_combine_tackles || 0,
            assist_tackles: playerStat.defensive_assist_tackles || 0,
            sacks: playerStat.defensive_sacks || 0,
            forced_fumbles: playerStat.defensive_forced_fumbles || 0,
            interceptions: playerStat.defensive_interceptions || 0,
            passes_defensed: playerStat.defensive_passes_defensed || 0
          },
          receiving: {
            touchdowns: playerStat.receiving_touchdowns || 0,
            receptions: playerStat.receiving_receptions || 0,
            yards: playerStat.receiving_yards || 0,
            longest: playerStat.receiving_longest || 0,
            yards_per_reception: playerStat.receiving_yards_per_reception || 0
          },
          punt_returns: {
            total: playerStat.punt_returns_total || 0,
            yards: playerStat.punt_returns_yards || 0,
            longest: playerStat.punt_returns_long || 0
          },
          passing: {
            attempts: playerStat.passing_attempts || 0,
            completions: playerStat.passing_completions || 0,
            yards: playerStat.passing_yards || 0,
            net_yards: playerStat.passing_net_yards || 0,
            interceptions: playerStat.passing_interceptions || 0,
            longest: playerStat.passing_longest || 0,
            sacked: playerStat.passing_sacked || 0,
            touchdowns: playerStat.passing_touchdowns || 0
          },
          rushing: {
            attempts: playerStat.rushing_attempts || 0,
            yards: playerStat.rushing_yards || 0,
            touchdowns: playerStat.rushing_touchdowns || 0,
            longest: playerStat.rushing_longest || 0,
            yards_per_attempt: playerStat.rushing_yards_per_attempt || 0
          },
          kicking: {
            extra_made: playerStat.kicking_extra_made || 0,
            extra_attempts: playerStat.kicking_extra_attempts || 0,
            fg_attempts: playerStat.kicking_fg_attempts || 0,
            fg_made: playerStat.kicking_fg_made || 0,
            fg_long: playerStat.kicking_fg_long || 0
          }
        };

        // Calcula a pontuação do jogador
        const points = calculatePlayerPoints(statisticsData);

        const playerData = {
          match_id: playerStat.match_id,
          playerId: playerStat.player_id,
          teamId: playerStat.team_id,
          position: playerStat.position || "Unknown",
          statistics: statisticsData,
          points: points, // Adiciona a pontuação calculada
          lastUpdated: new Date(),
        };

        bulkInserts.push({
          updateOne: {
            filter: { match_id: playerData.match_id, playerId: playerData.playerId },
            update: { $set: playerData },
            upsert: true,
          },
        });
      });

      if (bulkInserts.length > 0) {
        await PlayerStatistics.bulkWrite(bulkInserts);
        statistics.push(...bulkInserts.map(item => item.updateOne.update.$set));
        console.log(`Estatísticas do jogo ${gameId} salvas no banco.`);
      }
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

router.get('/playersAdd', async (req, res) => {
  try {
    const allPlayers = await updatePlayersData()
    res.json(allPlayers);
  } catch (error) {
    console.error('Erro ao buscar dados dos times:', error.message);
    res.status(500).json({ error: 'Erro ao buscar dados dos times.' });
  }
});

// Rota para consultar jogadores por posição
router.get('/players-by-position', async (req, res) => {
  const positions = { QB: [], WR: [], RB: [], TE: [], OT: [], OL: [],  C: [], CB: [], DT: [], DE: [], LB: [], P: [], G: [], HB: [], FB: [], SS: [], FS: [], K: [],  OG: [], T: [], SAF: [], LS: [],  };

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

      const response = await axios.get('https://american-football.sportdevs.com/players', {
        headers: {
          Authorization: `Bearer ${process.env.API_TOKEN}`,
        }
      });

      const players = response.data;

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
    res.json({ games });
  } catch (error) {
    console.error('Erro ao atualizar os jogos:', error.message);
    res.status(500).json({ error: 'Erro ao atualizar os jogos.' });
  }
});

router.get("/games/statistics/player", async (req, res) => {
  const { gameId, playerId } = req.query;

  try {
    // Monta a query base dinamicamente
    const query = {};
    if (gameId) query.gameId = gameId;
    if (playerId) query.playerId = playerId;

    // Busca as estatísticas no banco de dados
    const statistics = await PlayerStatistics.find(query).lean();

    if (!statistics || statistics.length === 0) {
      return res.status(404).json({ error: "Nenhuma estatística encontrada com os critérios fornecidos." });
    }

    // Retorna os dados filtrados
    res.json(statistics);
  } catch (error) {
    console.error("Erro ao buscar estatísticas dos jogos:", error.message);
    res.status(500).json({ error: "Erro interno ao buscar estatísticas dos jogos." });
  }
});

router.get('/statistics-by-match', async (req, res) => {
  try {
    const { match_ids } = req.query;

    if (!match_ids) {
      return res.status(400).json({ message: "O parâmetro match_ids é obrigatório." });
    }

    // Converte os match_ids para um array de números
    const matchIdsArray = match_ids.split(',').map(id => parseInt(id.trim()));

    // Busca todas as estatísticas para os match_ids fornecidos
    const stats = await PlayerStatistics.find({ match_id: { $in: matchIdsArray } });

    if (!stats || stats.length === 0) {
      return res.status(404).json({ message: "Nenhuma estatística encontrada para os match_ids fornecidos." });
    }

    // Agrupa as estatísticas por match_id, teamId e players
    const result = [];

    const matchMap = new Map();

    stats.forEach(playerStat => {
      const { match_id, teamId, playerId, position, statistics } = playerStat;

      // Verifica se o match_id já foi mapeado
      if (!matchMap.has(match_id)) {
        matchMap.set(match_id, {
          match_id,
          teams: new Map()
        });
      }

      const matchData = matchMap.get(match_id);

      // Verifica se o teamId já foi mapeado para este match_id
      if (!matchData.teams.has(teamId)) {
        matchData.teams.set(teamId, {
          teamId,
          players: []
        });
      }

      // Adiciona o jogador ao teamId correspondente
      matchData.teams.get(teamId).players.push({
        playerId,
        position,
        statistics
      });
    });

    // Converte o Map para o formato de resposta
    matchMap.forEach(matchData => {
      const teamsArray = Array.from(matchData.teams.values());
      result.push({
        match_id: matchData.match_id,
        teams: teamsArray
      });
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Erro ao recuperar estatísticas:", error.message);
    return res.status(500).json({ message: "Erro interno do servidor." });
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

router.get('/games/ids', async (req, res) => {
  try {
    // Definir data inicial para o intervalo (10 de janeiro de 2025 à meia-noite UTC)
    const startDate = new Date(Date.UTC(2025, 0, 10, 0, 0, 0));
    const endDate = new Date(startDate);
    endDate.setUTCDate(startDate.getUTCDate() + 5); // Adiciona 5 dias ao intervalo

    console.log(`Buscando jogos entre ${startDate.toISOString()} e ${endDate.toISOString()}`);

    // Buscar todos os jogos
    const allGames = await Game.find();

    if (!allGames.length) {
      console.log('Nenhum jogo encontrado no banco de dados.');
      return res.status(404).json({ message: 'Nenhum jogo encontrado no banco de dados.' });
    }

  
    const filteredGames = allGames.filter(game => {
      if (game.times && game.times.startTime) {
        const gameStartTime = new Date(game.times.startTime);
        console.log(`Verificando jogo ${game.id}:`, gameStartTime.toISOString());

        return gameStartTime >= startDate && gameStartTime < endDate;
      }
      return false;
    });

    if (!filteredGames.length) {
      console.log('Nenhum jogo encontrado dentro do intervalo.');
      return res.status(404).json({ message: 'Nenhum jogo encontrado nesse intervalo.' });
    }

    // Extrair IDs dos jogos encontrados
    const gameIds = filteredGames.map(game => game.id);
    console.log(`IDs dos jogos encontrados: ${gameIds}`);

    res.json({ gameIds });
  } catch (error) {
    console.error('Erro ao buscar jogos:', error.message);
    res.status(500).json({ error: 'Erro ao buscar jogos.' });
  }
});




module.exports = router;
