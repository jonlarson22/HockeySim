import { getRandomFirstName, getRandomLastName } from './data.js';

import { 
    generateConferenceQuarterfinals, 
    generateConferenceSemifinals, 
    generateConferenceFinals,
    generateNationalTournament 
} from './tournaments.js';

import { generateProspectPool, calculateRecruitingPoints } from './recruiting.js';

// Helper to generate a random number within a range
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// NEW: Initialize the league with randomized prestige and zeroed records
export function initializeLeague(baseTeams) {
    return baseTeams.map(team => {
        const variance = Math.floor(Math.random() * 9) - 4; 
        let newPrestige = team.prestige + variance;
        
        if (newPrestige > 99) newPrestige = 99;
        if (newPrestige < 1) newPrestige = 1;

        return {
            ...team,
            prestige: newPrestige,
            wins: 0,
            losses: 0,
            otl: 0,
            confWins: 0,
            confLosses: 0,
            confOtl: 0,
            roster: generateTeamRoster(newPrestige) 
        };
    });
}

// Generate a single player
function generatePlayer(position, teamPrestige) {
    const isGoalie = position === 'G';
    const yearRoll = Math.random();
    
    // Weight class years
    let year = 'Fr';
    if (yearRoll > 0.30) year = 'So';
    if (yearRoll > 0.55) year = 'Jr';
    if (yearRoll > 0.80) year = 'Sr';

    const prestigeBonus = Math.floor(teamPrestige / 10); 
    let stats = {};
    
    if (isGoalie) {
        stats = {
            reflexes: randomInt(50, 70) + prestigeBonus,
            positioning: randomInt(50, 70) + prestigeBonus,
            puckControl: randomInt(45, 65) + prestigeBonus,
            conditioning: randomInt(50, 75) + prestigeBonus,
            composure: randomInt(45, 70) + prestigeBonus
        };
    } else {
        stats = {
            skating: randomInt(50, 75) + prestigeBonus,
            shooting: randomInt(45, 70) + prestigeBonus,
            passing: randomInt(45, 70) + prestigeBonus,
            physicality: randomInt(45, 70) + prestigeBonus,
            defense: randomInt(45, 70) + prestigeBonus
        };
    }

    // Cap stats and calculate Overall (OVR)
    let statTotal = 0;
    let statCount = 0;
    for (let key in stats) {
        if (stats[key] > 99) stats[key] = 99;
        statTotal += stats[key];
        statCount++;
    }
    const overall = Math.round(statTotal / statCount);

    const potential = randomInt(55, 95);
    if (overall >= potential) {
        potential = overall + randomInt(1, 6); 
        if (potential > 99) potential = 99;
    }

    return {
        id: 'p_' + Math.random().toString(36).substring(2, 9),
        firstName: getRandomFirstName(), 
        lastName: getRandomLastName(),
        position: position,
        year: year,
        overall: overall, 
        potential: potential,
        stats: stats,
        status: 'Active Roster', // Updated from 'Active' to match dropdown exactly
        eligibilityYears: 4,     // NEW
        redshirtUsed: false,     // NEW
        injuryWeeks: 0           // NEW
    };
}

// Generate a full initial roster for a newly accepted team
export function generateTeamRoster(teamPrestige) {
    return {
        goalies: Array.from({ length: 3 }, () => generatePlayer('G', teamPrestige)),
        defensemen: Array.from({ length: 8 }, () => generatePlayer('D', teamPrestige)),
        forwards: Array.from({ length: 15 }, () => generatePlayer('F', teamPrestige))
    };
}

// --- 38-WEEK SCHEDULE GENERATOR (FULLY SCALABLE) ---
export function generateSeasonSchedule(leagueTeams, conferences) {
    let schedule = []; // Array of weeks, where each week is an array of games

    // Helper to shuffle an array
    function shuffle(array) {
        return [...array].sort(() => 0.5 - Math.random());
    }

    // --- PHASE 1: NON-CONFERENCE GAMES (Weeks 1 - 10) ---
    // Goal: 10 games per team (5 Home, 5 Away) against teams from OTHER conferences.
    
    // Track home/away counts for non-conf games
    let homeCounts = {};
    let awayCounts = {};
    leagueTeams.forEach(t => {
        homeCounts[t.id] = 0;
        awayCounts[t.id] = 0;
    });

    for (let week = 1; week <= 10; week++) {
        let weeklyGames = [];
        let availableTeams = shuffle([...leagueTeams]);
        let pairedThisWeek = new Set();

        for (let i = 0; i < availableTeams.length; i++) {
            let teamA = availableTeams[i];
            if (pairedThisWeek.has(teamA.id)) continue;

            // Find a valid opponent from a DIFFERENT conference who hasn't played this week
            let opponentIndex = -1;
            for (let j = i + 1; j < availableTeams.length; j++) {
                let teamB = availableTeams[j];
                if (!pairedThisWeek.has(teamB.id) && teamB.confId !== teamA.confId) {
                    opponentIndex = j;
                    break;
                }
            }

            if (opponentIndex !== -1) {
                let teamB = availableTeams[opponentIndex];
                pairedThisWeek.add(teamA.id);
                pairedThisWeek.add(teamB.id);

                // Determine Home/Away based on who needs home games more to hit 5/5
                let teamANeedsHome = homeCounts[teamA.id] < 5;
                let teamBNeedsHome = homeCounts[teamB.id] < 5;
                
                let homeTeam, awayTeam;
                if (teamANeedsHome && !teamBNeedsHome) {
                    homeTeam = teamA; awayTeam = teamB;
                } else if (teamBNeedsHome && !teamANeedsHome) {
                    homeTeam = teamB; awayTeam = teamA;
                } else {
                    // Fallback to random if both equal
                    if (Math.random() > 0.5) {
                        homeTeam = teamA; awayTeam = teamB;
                    } else {
                        homeTeam = teamB; awayTeam = teamA;
                    }
                }

                homeCounts[homeTeam.id]++;
                awayCounts[awayTeam.id]++;

                weeklyGames.push({
                    week: week,
                    type: 'non-conf',
                    homeTeamId: homeTeam.id,
                    awayTeamId: awayTeam.id,
                    played: false,
                    homeScore: null,
                    awayScore: null,
                    ot: false
                });
            }
        }
        schedule.push(weeklyGames);
    }

    // --- PHASE 2: CONFERENCE GAMES (Weeks 11 - 38) ---
    // Goal: Play each conference opponent 4 times (2 Home, 2 Away) -> 28 weeks for 8-team conf.
    
    let conferenceWeeks = {}; // weekIndex -> array of games
    for (let w = 11; w <= 38; w++) {
        conferenceWeeks[w] = [];
    }

    conferences.forEach(conf => {
        let confTeams = leagueTeams.filter(t => t.confId === conf.id);
        let n = confTeams.length;
        if (n < 2) return;

        // If odd number of teams, add a dummy bye team
        let teamsList = [...confTeams];
        if (n % 2 !== 0) {
            teamsList.push({ id: 'BYE', name: 'BYE' });
            n++;
        }

        // Generate a single round-robin set of pairings (n - 1 rounds)
        let rounds = [];
        let rotatingTeams = [...teamsList];
        let fixedTeam = rotatingTeams.shift();

        for (let r = 0; r < n - 1; r++) {
            let roundPairings = [];
            let currentRotation = [fixedTeam, ...rotatingTeams];

            for (let i = 0; i < n / 2; i++) {
                let t1 = currentRotation[i];
                let t2 = currentRotation[n - 1 - i];
                if (t1.id !== 'BYE' && t2.id !== 'BYE') {
                    roundPairings.push({ home: t1, away: t2 });
                }
            }
            rounds.push(roundPairings);

            // Rotate array clockwise for next round
            rotatingTeams.unshift(rotatingTeams.pop());
        }

        // We need 4 passes (Quadruple Round-Robin: 2 Home, 2 Away per opponent pair)
        // Pass 1 & 3: t1 hosts t2. Pass 2 & 4: t2 hosts t1.
        let fullConferenceMatchups = [];
        
        // Pass 1
        rounds.forEach(round => round.forEach(p => fullConferenceMatchups.push({ home: p.home, away: p.away })));
        // Pass 2 (Swapped Home/Away)
        rounds.forEach(round => round.forEach(p => fullConferenceMatchups.push({ home: p.away, away: p.home })));
        // Pass 3
        rounds.forEach(round => round.forEach(p => fullConferenceMatchups.push({ home: p.home, away: p.away })));
        // Pass 4 (Swapped Home/Away)
        rounds.forEach(round => round.forEach(p => fullConferenceMatchups.push({ home: p.away, away: p.home })));

        // Distribute these matchups across weeks 11 through 38
        let currentWeekOffset = 11;
        fullConferenceMatchups.forEach((matchup, idx) => {
            let targetWeek = currentWeekOffset + (idx % (n - 1));
            // Find the correct block of weeks for this conference
            // To prevent slot collisions if multiple conferences have different sizes, 
            // we map round index directly into weeks 11 to 38.
            
            // Simpler assignment: chunk by round index
            let roundIndex = Math.floor(idx / (n / 2));
            let assignedWeek = 11 + roundIndex; 
            
            if (assignedWeek <= 38) {
                // Check if this matchup is already added to this week to avoid duplicates
                let weekList = conferenceWeeks[assignedWeek];
                let alreadyScheduled = weekList.some(g => 
                    (g.homeTeamId === matchup.home.id && g.awayTeamId === matchup.away.id) ||
                    (g.homeTeamId === matchup.away.id && g.awayTeamId === matchup.home.id)
                );

                // If slot is taken for one of these teams, push to the next available week slot
                while (assignedWeek <= 38) {
                    let conflict = conferenceWeeks[assignedWeek].some(g => 
                        g.homeTeamId === matchup.home.id || g.awayTeamId === matchup.home.id ||
                        g.homeTeamId === matchup.away.id || g.awayTeamId === matchup.away.id
                    );
                    if (!conflict) break;
                    assignedWeek++;
                }

                if (assignedWeek <= 38) {
                    conferenceWeeks[assignedWeek].push({
                        week: assignedWeek,
                        type: 'conf',
                        homeTeamId: matchup.home.id,
                        awayTeamId: matchup.away.id,
                        played: false,
                        homeScore: null,
                        awayScore: null,
                        ot: false
                    });
                }
            }
        });
    });

    // Append conference weeks 11-38 to the main schedule array
    for (let w = 11; w <= 38; w++) {
        schedule.push(conferenceWeeks[w] || []);
    }

    return schedule;
}

function getActivePlayers(players) {
    return players.filter(p => p.status === 'Active Roster').sort((a, b) => b.overall - a.overall);
}

function calculateTeamRatings(teamId, gameState) {
    const team = gameState.leagueTeams.find(t => t.id === teamId);
    
    const activeForwards = getActivePlayers(team.roster.forwards);
    const activeDefense = getActivePlayers(team.roster.defensemen);
    const activeGoalies = getActivePlayers(team.roster.goalies);

    // Forwards (Top 12) - 40/30/20/10 split
    let offOvr = 0;
    if (activeForwards.length >= 12) {
        const g1 = (activeForwards[0].overall + activeForwards[1].overall + activeForwards[2].overall) / 3;
        const g2 = (activeForwards[3].overall + activeForwards[4].overall + activeForwards[5].overall) / 3;
        const g3 = (activeForwards[6].overall + activeForwards[7].overall + activeForwards[8].overall) / 3;
        const g4 = (activeForwards[9].overall + activeForwards[10].overall + activeForwards[11].overall) / 3;
        offOvr = (g1 * 0.40) + (g2 * 0.30) + (g3 * 0.20) + (g4 * 0.10);
    } else {
        // Fallback just in case a team has massive injury issues
        offOvr = activeForwards.reduce((sum, p) => sum + p.overall, 0) / (activeForwards.length || 1);
    }

    // Defense (Top 6) - 40/35/25 split
    let defOvr = 0;
    if (activeDefense.length >= 6) {
        const g1 = (activeDefense[0].overall + activeDefense[1].overall) / 2;
        const g2 = (activeDefense[2].overall + activeDefense[3].overall) / 2;
        const g3 = (activeDefense[4].overall + activeDefense[5].overall) / 2;
        defOvr = (g1 * 0.40) + (g2 * 0.35) + (g3 * 0.25);
    } else {
        defOvr = activeDefense.reduce((sum, p) => sum + p.overall, 0) / (activeDefense.length || 1);
    }

    // Goalie (Top 1)
    let goalieOvr = activeGoalies.length > 0 ? activeGoalies[0].overall : 50;

    // Coach Boosts: Calculate 3 * (skill / 30)
    let coachOffBoost = 0;
    let coachDefBoost = 0;
    
    if (teamId === gameState.teamId) {
        coachOffBoost = 3 * ((gameState.coach.skills.offense || 3) / 30);
        coachDefBoost = 3 * ((gameState.coach.skills.defense || 3) / 30);
    } else {
        // AI coach skill scales roughly with prestige (e.g., 90 prestige = ~27 skill)
        const estimatedSkill = (team.prestige / 100) * 30;
        coachOffBoost = 3 * (estimatedSkill / 30);
        coachDefBoost = 3 * (estimatedSkill / 30);
    }

    return { offense: offOvr, defense: defOvr, goalie: goalieOvr, coachOffBoost, coachDefBoost };
}

// --- SIMULATION ENGINE ---
export function simulateWeek(gameState) {
    const currentWeekIndex = gameState.currentWeek - 1;
    
    // Check if the season is over
    if (currentWeekIndex >= gameState.schedule.length) {
        return false; 
    }

    const weekGames = gameState.schedule[currentWeekIndex];

    weekGames.forEach(game => {
        if (game.played) return;

        const homeTeam = gameState.leagueTeams.find(t => t.id === game.homeTeamId);
        const awayTeam = gameState.leagueTeams.find(t => t.id === game.awayTeamId);
        const isConfGame = game.type === 'conf' || game.type === 'conf_tourney';

        // 1. Get Weighted Ratings
        const homeRatings = calculateTeamRatings(homeTeam.id, gameState);
        const awayRatings = calculateTeamRatings(awayTeam.id, gameState);

        // 2. Calculate Unit Scores 
        // Home ice grants a flat +2 to both Offense and Defense overall scores
        const homeOffenseScore = homeRatings.offense + homeRatings.coachOffBoost + 2; 
        // Defense is a 50/50 blend of the blueliners and the goalie
        const homeDefenseScore = (homeRatings.defense * 0.5) + (homeRatings.goalie * 0.5) + homeRatings.coachDefBoost + 2;

        const awayOffenseScore = awayRatings.offense + awayRatings.coachOffBoost;
        const awayDefenseScore = (awayRatings.defense * 0.5) + (awayRatings.goalie * 0.5) + awayRatings.coachDefBoost;

        // 3. Matchup Engine (Base Goals = 2, Scaling Factor = 8)
        const SCALING_FACTOR = 8;
        let homeExpectedGoals = 2 + ((homeOffenseScore - awayDefenseScore) / SCALING_FACTOR);
        let awayExpectedGoals = 2 + ((awayOffenseScore - homeDefenseScore) / SCALING_FACTOR);

        // Add variance (-1.5 to +1.5 goals) so games aren't entirely predictable
        let homeGoals = Math.max(0, Math.round(homeExpectedGoals + (Math.random() * 3 - 1.5)));
        let awayGoals = Math.max(0, Math.round(awayExpectedGoals + (Math.random() * 3 - 1.5)));

        // Handle Overtime
        let isOT = false;
        if (homeGoals === awayGoals) {
            isOT = true;
            if (Math.random() > 0.5) homeGoals++;
            else awayGoals++;
        }

        // Save results to the game object
        game.homeScore = homeGoals;
        game.awayScore = awayGoals;
        game.ot = isOT;
        game.played = true;

        // Update Team Records
    if (homeGoals > awayGoals) {
        homeTeam.wins = (homeTeam.wins || 0) + 1;
        if (isConfGame) homeTeam.confWins = (homeTeam.confWins || 0) + 1;

        if (isOT) {
            awayTeam.otl = (awayTeam.otl || 0) + 1;
            if (isConfGame) awayTeam.confOtl = (awayTeam.confOtl || 0) + 1;
        } else {
            awayTeam.losses = (awayTeam.losses || 0) + 1;
            if (isConfGame) awayTeam.confLosses = (awayTeam.confLosses || 0) + 1;
        }
    } else {
        awayTeam.wins = (awayTeam.wins || 0) + 1;
        if (isConfGame) awayTeam.confWins = (awayTeam.confWins || 0) + 1;

        if (isOT) {
            homeTeam.otl = (homeTeam.otl || 0) + 1;
            if (isConfGame) homeTeam.confOtl = (homeTeam.confOtl || 0) + 1;
        } else {
            homeTeam.losses = (homeTeam.losses || 0) + 1;
            if (isConfGame) homeTeam.confLosses = (homeTeam.confLosses || 0) + 1;
        }
    }
});
    
    // --- INJURY MANAGEMENT & PROGRESSION ---
    if (gameState.roster) {
        const coachDev = gameState.coach.skills.development || 5;
        const allPlayers = [...gameState.roster.goalies, ...gameState.roster.defensemen, ...gameState.roster.forwards];
        
        allPlayers.forEach(player => {
            // 1. INJURIES
            if (player.injuryWeeks > 0) {
                player.injuryWeeks--; // Heal over time
                // THE FIX: Put them back on the active roster when healed
                if (player.injuryWeeks === 0 && player.status === 'Practice Squad') {
                    player.status = 'Active Roster';
                }
            } else if (player.status === 'Active Roster' && Math.random() < 0.02) {
                player.injuryWeeks = Math.floor(Math.random() * 4) + 1;
                player.status = 'Practice Squad'; 
            }

            // 2. DYNAMIC IN-SEASON PROGRESSION
            // Calculate the gap between potential and overall
            const gap = player.potential - player.overall;
            
            // Only progress if they haven't hit their ceiling
            if (gap > 0) {
                // Progression scales based on the size of the gap and coach development skill
                const progressionChance = 0.15 + ((coachDev / 30) * 0.20) + (gap * 0.005); 
                
                if (Math.random() < progressionChance) {
                    const statKeys = Object.keys(player.stats);
                    const randomStat = statKeys[Math.floor(Math.random() * statKeys.length)];
                    
                    if (player.stats[randomStat] < 99) {
                        player.stats[randomStat]++;
                        
                        // Recalculate OVR
                        let statTotal = 0;
                        for (let key in player.stats) {
                            statTotal += player.stats[key];
                        }
                        player.overall = Math.round(statTotal / statKeys.length);
                    }
                }
            }
        });
    }

    // Advance the week counter
    gameState.currentWeek++;

    // TRIGGER TOURNAMENTS
    if (gameState.currentWeek === 39) generateConferenceQuarterfinals(gameState);
    if (gameState.currentWeek === 40) generateConferenceSemifinals(gameState);
    if (gameState.currentWeek === 41) generateConferenceFinals(gameState);
    if (gameState.currentWeek === 42) generateNationalTournament(gameState);

export function processOffSeason(gameState) {
    const coachDev = gameState.coach.skills.development || 5;

    gameState.leagueTeams.forEach(team => {
        // 1. Graduation: Filter out Seniors
        team.roster.forwards = team.roster.forwards.filter(p => p.year !== 'Sr');
        team.roster.defensemen = team.roster.defensemen.filter(p => p.year !== 'Sr');
        team.roster.goalies = team.roster.goalies.filter(p => p.year !== 'Sr');

        const allReturning = [...team.roster.forwards, ...team.roster.defensemen, ...team.roster.goalies];

        // 2. Progression & Year Advancement
        allReturning.forEach(player => {
            // Off-season progression scales with play time and coach development skill
            let boostChance = 0;
            if (player.status === 'Active Roster') boostChance = 0.60 + (coachDev * 0.01);
            else if (player.status === 'Practice Squad') boostChance = 0.30 + (coachDev * 0.01);
            else if (player.status === 'Redshirt') {
                boostChance = 0.20 + (coachDev * 0.01);
                player.redshirtUsed = true; 
            }

            // Apply a minor off-season attribute bump
            if (Math.random() < boostChance) {
                const statKeys = Object.keys(player.stats);
                const randomStat = statKeys[Math.floor(Math.random() * statKeys.length)];
                if (player.stats[randomStat] < 99) {
                    player.stats[randomStat] += Math.floor(Math.random() * 3) + 1;
                }
                
                // Recalculate OVR
                let statTotal = 0;
                for (let key in player.stats) {
                    statTotal += player.stats[key];
                }
                player.overall = Math.round(statTotal / statKeys.length);
            }

            // Advance Class Year
            if (player.status !== 'Redshirt') {
                if (player.year === 'Jr') player.year = 'Sr';
                if (player.year === 'So') player.year = 'Jr';
                if (player.year === 'Fr') player.year = 'So';
                player.eligibilityYears--;
            } else {
                // If they redshirted, they remain their current class year but lose the Redshirt status
                player.status = 'Practice Squad'; 
            }
            
            // Reset injury weeks for the new season
            player.injuryWeeks = 0;
        });
    });

    return true; // Signals cleanup is done
}
