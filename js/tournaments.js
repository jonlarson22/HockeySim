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

        const matchups = [
            { home: top8[0], away: top8[7] }, // 1 vs 8
            { home: top8[1], away: top8[6] }, // 2 vs 7
            { home: top8[2], away: top8[5] }, // 3 vs 6
            { home: top8[3], away: top8[4] }  // 4 vs 5
        ];

        matchups.forEach(match => {
            if(match.home && match.away) {
                quarterfinalGames.push({
                    week: 39, type: 'conf_tourney', confId: conf.id,
                    homeTeamId: match.home.id, awayTeamId: match.away.id,
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

        // Get the winners of the 4 games
        const winners = confQuarters.map(g => g.homeScore > g.awayScore ? g.homeTeamId : g.awayTeamId);

        // Pair them up: Winner 1v8 [0] vs Winner 4v5 [3], Winner 2v7 [1] vs Winner 3v6 [2]
        semiGames.push({
            week: 40, type: 'conf_tourney', confId: conf.id,
            homeTeamId: winners[0], awayTeamId: winners[3],
            played: false, homeScore: null, awayScore: null, ot: false
        });
        semiGames.push({
            week: 40, type: 'conf_tourney', confId: conf.id,
            homeTeamId: winners[1], awayTeamId: winners[2],
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

        const winners = confSemis.map(g => g.homeScore > g.awayScore ? g.homeTeamId : g.awayTeamId);

        finalGames.push({
            week: 41, type: 'conf_tourney', confId: conf.id,
            homeTeamId: winners[0], awayTeamId: winners[1],
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

    // 2. Calculate pseudo-poll score for all teams (copied from app.js logic)
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

    // Seed matchups (1v16, 2v15, etc.)
    let natTourneyGames = [];
    for (let i = 0; i < 8; i++) {
        natTourneyGames.push({
            week: 42, type: 'nat_tourney',
            homeTeamId: nationalTeams[i].id, 
            awayTeamId: nationalTeams[15 - i].id,
            played: false, homeScore: null, awayScore: null, ot: false
        });
    }
    
    gameState.schedule.push(natTourneyGames);
}
