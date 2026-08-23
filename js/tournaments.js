import { conferences } from './data.js';

// Helper to sort teams by conference points, then overall points
function getConferenceStandings(leagueTeams, confId) {
    return leagueTeams
        .filter(t => t.confId === confId)
        .sort((a, b) => {
            const aConfPts = (a.confWins * 2) + a.confOtl;
            const bConfPts = (b.confWins * 2) + b.confOtl;
            if (bConfPts !== aConfPts) return bConfPts - aConfPts;
            
            const aOvrPts = (a.wins * 2) + a.otl;
            const bOvrPts = (b.wins * 2) + b.otl;
            return bOvrPts - aOvrPts;
        });
}

// Generate the initial round of conference tournaments
export function generateConferenceQuarterfinals(gameState) {
    let quarterfinalGames = [];

    conferences.forEach(conf => {
        const standings = getConferenceStandings(gameState.leagueTeams, conf.id);
        const top8 = standings.slice(0, 8);

        // Seeds: 1v8, 2v7, 3v6, 4v5
        const matchups = [
            { home: top8[0], away: top8[7], seed1: 1, seed2: 8 },
            { home: top8[1], away: top8[6], seed1: 2, seed2: 7 },
            { home: top8[2], away: top8[5], seed1: 3, seed2: 6 },
            { home: top8[3], away: top8[4], seed1: 4, seed2: 5 }
        ];

        matchups.forEach(match => {
            if(match.home && match.away) {
                quarterfinalGames.push({
                    week: 39, type: 'conf_tourney', confId: conf.id,
                    homeTeamId: match.home.id, awayTeamId: match.away.id,
                    homeSeed: match.seed1, awaySeed: match.seed2,
                    played: false, homeScore: null, awayScore: null, ot: false
                });
            }
        });
    });
    gameState.schedule.push(quarterfinalGames);
}

// Read week 39 results and generate Semifinals
export function generateConferenceSemifinals(gameState) {
    let semiGames = [];
    const quarterGames = gameState.schedule[38]; // Index 38 is Week 39

    conferences.forEach(conf => {
        const confQuarters = quarterGames.filter(g => g.confId === conf.id);
        if(confQuarters.length !== 4) return;

        // Sort by seed to maintain bracket structure
        confQuarters.sort((a, b) => a.homeSeed - b.homeSeed);

        // Get the winners of the 4 games
        const winners = confQuarters.map(g => ({
            teamId: g.homeScore > g.awayScore ? g.homeTeamId : g.awayTeamId,
            seed: g.homeScore > g.awayScore ? g.homeSeed : g.awaySeed
        }));

        // Pair them up: Winner 1v8 vs Winner 4v5, Winner 2v7 vs Winner 3v6
        semiGames.push({
            week: 40, type: 'conf_tourney', confId: conf.id,
            homeTeamId: winners[0].teamId, awayTeamId: winners[3].teamId,
            homeSeed: winners[0].seed, awaySeed: winners[3].seed,
            played: false, homeScore: null, awayScore: null, ot: false
        });
        semiGames.push({
            week: 40, type: 'conf_tourney', confId: conf.id,
            homeTeamId: winners[1].teamId, awayTeamId: winners[2].teamId,
            homeSeed: winners[1].seed, awaySeed: winners[2].seed,
            played: false, homeScore: null, awayScore: null, ot: false
        });
    });
    gameState.schedule.push(semiGames);
}

// Read week 40 results and generate Finals
export function generateConferenceFinals(gameState) {
    let finalGames = [];
    const semiGames = gameState.schedule[39]; // Index 39 is Week 40

    conferences.forEach(conf => {
        const confSemis = semiGames.filter(g => g.confId === conf.id);
        if(confSemis.length !== 2) return;

        const winners = confSemis.map(g => ({
            teamId: g.homeScore > g.awayScore ? g.homeTeamId : g.awayTeamId,
            seed: g.homeScore > g.awayScore ? g.homeSeed : g.awaySeed
        }));

        finalGames.push({
            week: 41, type: 'conf_tourney', confId: conf.id,
            homeTeamId: winners[0].teamId, awayTeamId: winners[1].teamId,
            homeSeed: winners[0].seed, awaySeed: winners[1].seed,
            played: false, homeScore: null, awayScore: null, ot: false
        });
    });
    gameState.schedule.push(finalGames);
}

// Determine the top 16 teams and build the bracket
export function generateNationalTournament(gameState) {
    const finalGames = gameState.schedule[40]; // Index 40 is Week 41
    let nationalTeams = [];
    
    // 1. Auto-Bids: Get Conference Champions
    finalGames.forEach(game => {
        const winnerId = game.homeScore > game.awayScore ? game.homeTeamId : game.awayTeamId;
        const winnerTeam = gameState.leagueTeams.find(t => t.id === winnerId);
        nationalTeams.push(winnerTeam);
    });

    // 2. Calculate pseudo-poll score for all teams
    const getPollScore = (t) => {
        const overallPts = ((t.wins || 0) * 2) + ((t.otl || 0) * 1);
        const totalGames = (t.wins || 0) + (t.losses || 0) + (t.otl || 0);
        const winPct = totalGames > 0 ? (overallPts / (totalGames * 2)) : 0;
        return (overallPts * 12) + (winPct * 50) + (t.prestige * 0.5) - ((t.losses || 0) * 2);
    };

    // 3. At-Large Bids: Fill the rest of the 16 slots
    let sortedLeague = [...gameState.leagueTeams].sort((a, b) => getPollScore(b) - getPollScore(a));
    
    for (let i = 0; i < sortedLeague.length; i++) {
        if (nationalTeams.length >= 16) break;
        if (!nationalTeams.some(t => t.id === sortedLeague[i].id)) {
            nationalTeams.push(sortedLeague[i]);
        }
    }

    // Re-sort the final 16 teams purely by poll score to seed them 1 through 16
    nationalTeams.sort((a, b) => getPollScore(b) - getPollScore(a));

    // Seed matchups (1v16, 2v15, 3v14, 4v13, 5v12, 6v11, 7v10, 8v9)
    let natTourneyGames = [];
    for (let i = 0; i < 8; i++) {
        natTourneyGames.push({
            week: 42, type: 'national_tourney', isNational: true,
            homeTeamId: nationalTeams[i].id, 
            awayTeamId: nationalTeams[15 - i].id,
            homeSeed: i + 1,
            awaySeed: 16 - i,
            played: false, homeScore: null, awayScore: null, ot: false
        });
    }
    
    gameState.schedule.push(natTourneyGames);
}

// Generate National Quarterfinals (Week 43) from Round of 16 results (Week 42)
export function generateNationalQuarterfinals(gameState) {
    const round16Games = gameState.schedule[41]; // Index 41 is Week 42 (Round of 16)
    let qfGames = [];

    // Get the 8 winners from the Round of 16, maintaining their seed
    const winners = round16Games
        .filter(g => g.homeScore !== null && g.awayScore !== null)
        .map(g => ({
            teamId: g.homeScore > g.awayScore ? g.homeTeamId : g.awayTeamId,
            seed: g.homeScore > g.awayScore ? g.homeSeed : g.awaySeed
        }))
        .sort((a, b) => a.seed - b.seed);

    if (winners.length !== 8) return; // Wait until all games are played

    // Pair up: 1v8, 2v7, 3v6, 4v5 (from the 16 seeds)
    qfGames.push({
        week: 43, type: 'national_tourney', isNational: true,
        homeTeamId: winners[0].teamId, awayTeamId: winners[7].teamId,
        homeSeed: winners[0].seed, awaySeed: winners[7].seed,
        played: false, homeScore: null, awayScore: null, ot: false
    });
    qfGames.push({
        week: 43, type: 'national_tourney', isNational: true,
        homeTeamId: winners[1].teamId, awayTeamId: winners[6].teamId,
        homeSeed: winners[1].seed, awaySeed: winners[6].seed,
        played: false, homeScore: null, awayScore: null, ot: false
    });
    qfGames.push({
        week: 43, type: 'national_tourney', isNational: true,
        homeTeamId: winners[2].teamId, awayTeamId: winners[5].teamId,
        homeSeed: winners[2].seed, awaySeed: winners[5].seed,
        played: false, homeScore: null, awayScore: null, ot: false
    });
    qfGames.push({
        week: 43, type: 'national_tourney', isNational: true,
        homeTeamId: winners[3].teamId, awayTeamId: winners[4].teamId,
        homeSeed: winners[3].seed, awaySeed: winners[4].seed,
        played: false, homeScore: null, awayScore: null, ot: false
    });

    gameState.schedule.push(qfGames);
}

// Generate National Semifinals (Week 44) from Quarterfinals results (Week 43)
export function generateNationalSemifinals(gameState) {
    const qfGames = gameState.schedule[42]; // Index 42 is Week 43 (Quarterfinals)
    let sfGames = [];

    // Get the 4 winners from the Quarterfinals
    const winners = qfGames
        .filter(g => g.homeScore !== null && g.awayScore !== null)
        .map(g => ({
            teamId: g.homeScore > g.awayScore ? g.homeTeamId : g.awayTeamId,
            seed: g.homeScore > g.awayScore ? g.homeSeed : g.awaySeed
        }))
        .sort((a, b) => a.seed - b.seed);

    if (winners.length !== 4) return; // Wait until all games are played

    // Pair up: 1 seed vs 4 seed, 2 seed vs 3 seed
    sfGames.push({
        week: 44, type: 'national_tourney', isNational: true,
        homeTeamId: winners[0].teamId, awayTeamId: winners[3].teamId,
        homeSeed: winners[0].seed, awaySeed: winners[3].seed,
        played: false, homeScore: null, awayScore: null, ot: false
    });
    sfGames.push({
        week: 44, type: 'national_tourney', isNational: true,
        homeTeamId: winners[1].teamId, awayTeamId: winners[2].teamId,
        homeSeed: winners[1].seed, awaySeed: winners[2].seed,
        played: false, homeScore: null, awayScore: null, ot: false
    });

    gameState.schedule.push(sfGames);
}

// Generate National Championship (Week 45) from Semifinals results (Week 44)
export function generateNationalChampionship(gameState) {
    const sfGames = gameState.schedule[43]; // Index 43 is Week 44 (Semifinals)
    let champGames = [];

    // Get the 2 winners from the Semifinals
    const winners = sfGames
        .filter(g => g.homeScore !== null && g.awayScore !== null)
        .map(g => ({
            teamId: g.homeScore > g.awayScore ? g.homeTeamId : g.awayTeamId,
            seed: g.homeScore > g.awayScore ? g.homeSeed : g.awaySeed
        }))
        .sort((a, b) => a.seed - b.seed);

    if (winners.length !== 2) return; // Wait until all games are played

    // Championship game
    champGames.push({
        week: 45, type: 'national_tourney', isNational: true,
        homeTeamId: winners[0].teamId, awayTeamId: winners[1].teamId,
        homeSeed: winners[0].seed, awaySeed: winners[1].seed,
        played: false, homeScore: null, awayScore: null, ot: false
    });

    gameState.schedule.push(champGames);
}
