// Helper to sort teams by conference points, then overall points
function getConferenceStandings(leagueTeams, confId) {
    return leagueTeams
        .filter(t => t.confId === confId)
        .sort((a, b) => {
            const aConfPts = (a.confWins * 2) + a.confOtl;
            const bConfPts = (b.confWins * 2) + b.confOtl;
            if (bConfPts !== aConfPts) return bConfPts - aConfPts;
            
            // Tiebreaker: Overall Points
            const aOvrPts = (a.wins * 2) + a.otl;
            const bOvrPts = (b.wins * 2) + b.otl;
            return bOvrPts - aOvrPts;
        });
}

// Generate the initial round of conference tournaments
export function generateConferenceQuarterfinals(gameState) {
    let quarterfinalGames = [];

    gameState.conferences.forEach(conf => {
        // Get sorted standings for this specific conference
        const standings = getConferenceStandings(gameState.leagueTeams, conf.id);
        
        // Grab the top 8 teams (if a conference has fewer than 8, we can add bye logic later)
        const top8 = standings.slice(0, 8);

        // Standard 1v8, 2v7, 3v6, 4v5 seeding
        const matchups = [
            { home: top8[0], away: top8[7] }, // 1 vs 8
            { home: top8[1], away: top8[6] }, // 2 vs 7
            { home: top8[2], away: top8[5] }, // 3 vs 6
            { home: top8[3], away: top8[4] }  // 4 vs 5
        ];

        matchups.forEach(match => {
            quarterfinalGames.push({
                week: 39,
                type: 'conf_tourney',
                confId: conf.id,
                homeTeamId: match.home.id,
                awayTeamId: match.away.id,
                played: false,
                homeScore: null,
                awayScore: null,
                ot: false
            });
        });
    });

    // Push these games into the main schedule array as "Week 39"
    gameState.schedule.push(quarterfinalGames);
}
