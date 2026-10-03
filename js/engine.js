import { getRandomFirstName, getRandomLastName } from './data.js';

import { 
    generateConferenceQuarterfinals, 
    generateConferenceSemifinals, 
    generateConferenceFinals,
    generateNationalTournament,
    generateNationalQuarterfinals,
    generateNationalSemifinals,
    generateNationalChampionship
} from './tournaments.js';

import { generateProspectPool, calculateRecruitingPoints } from './recruiting.js';

// Helper to generate a random number within a range
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Training focus groups. 'balanced' (or unset) = no focus.
const FOCUS_STATS = {
    offense: ['shooting', 'passing'],
    defense: ['defense'],
    physical: ['physicality', 'skating'],
    goaltending: ['reflexes', 'positioning']
};

export const TRAINING_FOCUSES = [
    { key: 'balanced', label: 'Balanced' },
    { key: 'offense', label: 'Offense (shooting, passing)' },
    { key: 'defense', label: 'Defense' },
    { key: 'physical', label: 'Physical (hitting, skating)' },
    { key: 'goaltending', label: 'Goaltending' }
];

function focusStatPool(focus, statKeys) {
    if (!focus || focus === 'balanced' || !FOCUS_STATS[focus]) return [];
    return statKeys.filter(k => FOCUS_STATS[focus].includes(k));
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
export function generatePlayer(position, teamPrestige) {
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

    let potential = randomInt(55, 95);
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
        status: 'Active Roster',
        eligibilityYears: 4,
        redshirtUsed: false,
        injuryWeeks: 0,
        seasonGoals: 0,
        seasonAssists: 0
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

// --- ENFORCE 20-PLAYER ACTIVE ROSTER LIMIT ---
export function enforceRosterLimits(roster) {
    const ACTIVE_FORWARDS = 12;
    const ACTIVE_DEFENSE = 6;
    const ACTIVE_GOALIES = 2;
    const TOTAL_ACTIVE = 20;

    // Separate players by status
    const active = {
        forwards: roster.forwards.filter(p => p.status === 'Active Roster').sort((a, b) => b.overall - a.overall),
        defensemen: roster.defensemen.filter(p => p.status === 'Active Roster').sort((a, b) => b.overall - a.overall),
        goalies: roster.goalies.filter(p => p.status === 'Active Roster').sort((a, b) => b.overall - a.overall)
    };

    // Trim to limits
    const excess = {
        forwards: active.forwards.splice(ACTIVE_FORWARDS),
        defensemen: active.defensemen.splice(ACTIVE_DEFENSE),
        goalies: active.goalies.splice(ACTIVE_GOALIES)
    };

    // Move excess to practice squad
    [...excess.forwards, ...excess.defensemen, ...excess.goalies].forEach(p => {
        p.status = 'Practice Squad';
    });
}

// --- 38-WEEK SCHEDULE GENERATOR (FULLY SCALABLE) ---
export function generateSeasonSchedule(leagueTeams, conferences) {
    let schedule = [];

    // Helper to shuffle an array
    function shuffle(array) {
        return [...array].sort(() => 0.5 - Math.random());
    }

    // --- PHASE 1: NON-CONFERENCE GAMES (Weeks 1 - 10) ---
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

                let teamANeedsHome = homeCounts[teamA.id] < 5;
                let teamBNeedsHome = homeCounts[teamB.id] < 5;
                
                let homeTeam, awayTeam;
                if (teamANeedsHome && !teamBNeedsHome) {
                    homeTeam = teamA; awayTeam = teamB;
                } else if (teamBNeedsHome && !teamANeedsHome) {
                    homeTeam = teamB; awayTeam = teamA;
                } else {
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
    let conferenceWeeks = {};
    for (let w = 11; w <= 38; w++) {
        conferenceWeeks[w] = [];
    }

    conferences.forEach(conf => {
        let confTeams = leagueTeams.filter(t => t.confId === conf.id);
        let n = confTeams.length;
        if (n < 2) return;

        let teamsList = [...confTeams];
        if (n % 2 !== 0) {
            teamsList.push({ id: 'BYE', name: 'BYE' });
            n++;
        }

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
            rotatingTeams.unshift(rotatingTeams.pop());
        }

        let fullConferenceMatchups = [];
        rounds.forEach(round => round.forEach(p => fullConferenceMatchups.push({ home: p.home, away: p.away })));
        rounds.forEach(round => round.forEach(p => fullConferenceMatchups.push({ home: p.away, away: p.home })));
        rounds.forEach(round => round.forEach(p => fullConferenceMatchups.push({ home: p.home, away: p.away })));
        rounds.forEach(round => round.forEach(p => fullConferenceMatchups.push({ home: p.away, away: p.home })));

        let currentWeekOffset = 11;
        fullConferenceMatchups.forEach((matchup, idx) => {
            let roundIndex = Math.floor(idx / (n / 2));
            let assignedWeek = 11 + roundIndex; 
            
            if (assignedWeek <= 38) {
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

    let offOvr = 0;
    if (activeForwards.length >= 12) {
        const g1 = (activeForwards[0].overall + activeForwards[1].overall + activeForwards[2].overall) / 3;
        const g2 = (activeForwards[3].overall + activeForwards[4].overall + activeForwards[5].overall) / 3;
        const g3 = (activeForwards[6].overall + activeForwards[7].overall + activeForwards[8].overall) / 3;
        const g4 = (activeForwards[9].overall + activeForwards[10].overall + activeForwards[11].overall) / 3;
        offOvr = (g1 * 0.40) + (g2 * 0.30) + (g3 * 0.20) + (g4 * 0.10);
    } else {
        offOvr = activeForwards.reduce((sum, p) => sum + p.overall, 0) / (activeForwards.length || 1);
    }

    let defOvr = 0;
    if (activeDefense.length >= 6) {
        const g1 = (activeDefense[0].overall + activeDefense[1].overall) / 2;
        const g2 = (activeDefense[2].overall + activeDefense[3].overall) / 2;
        const g3 = (activeDefense[4].overall + activeDefense[5].overall) / 2;
        defOvr = (g1 * 0.40) + (g2 * 0.35) + (g3 * 0.25);
    } else {
        defOvr = activeDefense.reduce((sum, p) => sum + p.overall, 0) / (activeDefense.length || 1);
    }

    let goalieOvr = activeGoalies.length > 0 ? activeGoalies[0].overall : 50;

    let coachOffBoost = 0;
    let coachDefBoost = 0;
    
    if (teamId === gameState.teamId) {
        coachOffBoost = 3 * ((gameState.coach.skills.offense || 3) / 30);
        coachDefBoost = 3 * ((gameState.coach.skills.defense || 3) / 30);
    } else {
        // Compressed range: good programs hire better coaches, but prestige
        // already pays through talent — this is a nudge, not a second tax.
        const estimatedSkill = 10 + (team.prestige / 100) * 10;
        coachOffBoost = 3 * (estimatedSkill / 30);
        coachDefBoost = 3 * (estimatedSkill / 30);
    }

    return { offense: offOvr, defense: defOvr, goalie: goalieOvr, coachOffBoost, coachDefBoost };
}

// Weighted random forward: top-line players score more often.
function weightedForward(forwards, excludeIds = []) {
    const pool = forwards.filter(p => !excludeIds.includes(p.id));
    if (pool.length === 0) return null;
    const weights = pool.map(p => Math.pow(p.overall, 2));
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pool.length; i++) {
        r -= weights[i];
        if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
}

// Builds a period-by-period goal log for an already-simmed game. The final
// score is drawn exactly as before; this only distributes those goals across
// periods and attaches scorer/assist names so the game-day screen can replay
// the game. Regulation goals go to periods 1-3; the OT winner gets period 4.
export function buildGameEvents(homeTeam, awayTeam, homeGoals, awayGoals, wentOT) {
    const periodWeights = [0.32, 0.34, 0.34];
    // Forwards drive the offense; defensemen chip in at a reduced weight.
    // Final scores are drawn before this runs — this only assigns credit.
    const skaterPool = (team) => [
        ...getActivePlayers(team.roster.forwards).map(p => ({ p, w: p.overall * p.overall })),
        ...getActivePlayers(team.roster.defensemen).map(p => ({ p, w: p.overall * p.overall * 0.25 }))
    ];
    const homeSkaters = skaterPool(homeTeam);
    const awaySkaters = skaterPool(awayTeam);
    const events = [];

    const weightedScorer = (skaters, excludeIds = []) => {
        const pool = skaters.filter(s => !excludeIds.includes(s.p.id));
        if (!pool.length) return null;
        let r = Math.random() * pool.reduce((a, s) => a + s.w, 0);
        for (const s of pool) {
            r -= s.w;
            if (r <= 0) return s.p;
        }
        return pool[pool.length - 1].p;
    };

    const makeGoal = (team, skaters, period) => {
        const scorer = weightedScorer(skaters) || { id: 'none', firstName: 'Unknown', lastName: 'Player' };
        const a1 = Math.random() < 0.85 ? weightedScorer(skaters, [scorer.id]) : null;
        const a2 = a1 && Math.random() < 0.6 ? weightedScorer(skaters, [scorer.id, a1.id]) : null;
        events.push({
            period,
            minute: Math.floor(Math.random() * 20) + 1,
            second: Math.floor(Math.random() * 60),
            teamId: team.id,
            scorer: `${scorer.firstName} ${scorer.lastName}`,
            scorerId: scorer.id,
            assists: [a1, a2].filter(Boolean).map(a => `${a.firstName} ${a.lastName}`),
            assistIds: [a1, a2].filter(Boolean).map(a => a.id)
        });
    };

    const dealGoals = (team, skaters, count) => {
        for (let i = 0; i < count; i++) {
            const roll = Math.random();
            let period = 3, acc = 0;
            for (let p = 0; p < 3; p++) {
                acc += periodWeights[p];
                if (roll <= acc) { period = p + 1; break; }
            }
            makeGoal(team, skaters, period);
        }
    };

    // The OT goal was already counted in the final score; re-deal it as period 4.
    const homeOT = wentOT && homeGoals > awayGoals ? 1 : 0;
    const awayOT = wentOT && awayGoals > homeGoals ? 1 : 0;
    dealGoals(homeTeam, homeSkaters, homeGoals - homeOT);
    dealGoals(awayTeam, awaySkaters, awayGoals - awayOT);

    if (wentOT) {
        const winner = homeGoals > awayGoals ? homeTeam : awayTeam;
        makeGoal(winner, winner === homeTeam ? homeSkaters : awaySkaters, 4);
    }

    // Chronological order, then attach the running score to each event.
    events.sort((a, b) => a.period - b.period || a.minute - b.minute || a.second - b.second);
    let hs = 0, as = 0;
    events.forEach(e => {
        if (e.teamId === homeTeam.id) hs++; else as++;
        e.homeScore = hs;
        e.awayScore = as;
    });

    return events;
}

// Adds G/A from a game's events to the roster players' season totals.
// Runs for every league game (only the user's game keeps the event objects).
export function accumulateGameStats(homeTeam, awayTeam, events) {
    const find = (team, id) => {
        for (const key of ['forwards', 'defensemen', 'goalies']) {
            const p = team.roster[key].find(x => x.id === id);
            if (p) return p;
        }
        return null;
    };
    for (const e of events) {
        if (!e.scorerId || e.scorerId === 'none') continue;
        const team = e.teamId === homeTeam.id ? homeTeam : awayTeam;
        const scorer = find(team, e.scorerId);
        if (scorer) scorer.seasonGoals = (scorer.seasonGoals || 0) + 1;
        for (const aid of e.assistIds || []) {
            const a = find(team, aid);
            if (a) a.seasonAssists = (a.seasonAssists || 0) + 1;
        }
    }
}

// Derives per-period shots and saves from a game's goal events.
// Pure annotation: the final score was drawn before this runs.
// saves.home[p] = home goalie's saves in period p (1-based index p-1).
export function buildGameShots(homeTeam, awayTeam, events) {
    const shots = { home: [0, 0, 0, 0], away: [0, 0, 0, 0] };
    const goals = { home: [0, 0, 0, 0], away: [0, 0, 0, 0] };
    for (const e of events) {
        const side = e.teamId === homeTeam.id ? 'home' : 'away';
        if (e.period >= 1 && e.period <= 4) goals[side][e.period - 1]++;
    }
    for (const side of ['home', 'away']) {
        for (let p = 0; p < 4; p++) shots[side][p] = goals[side][p] * 7 + randomInt(3, 8);
    }
    const saves = { home: [0, 0, 0, 0], away: [0, 0, 0, 0] };
    for (let p = 0; p < 4; p++) {
        saves.home[p] = Math.max(0, shots.away[p] - goals.away[p]);
        saves.away[p] = Math.max(0, shots.home[p] - goals.home[p]);
    }
    return { shots, saves };
}

// --- SIMULATION ENGINE ---
export function simulateWeek(gameState) {
    const currentWeekIndex = gameState.currentWeek - 1;
    
    if (currentWeekIndex >= gameState.schedule.length) {
        return false; 
    }

    const weekGames = gameState.schedule[currentWeekIndex];

    weekGames.forEach(game => {
        if (game.played) return;

        const homeTeam = gameState.leagueTeams.find(t => t.id === game.homeTeamId);
        const awayTeam = gameState.leagueTeams.find(t => t.id === game.awayTeamId);
        const isConfGame = game.type === 'conf' || game.type === 'conf_tourney';

        const homeRatings = calculateTeamRatings(homeTeam.id, gameState);
        const awayRatings = calculateTeamRatings(awayTeam.id, gameState);

        const homeOffenseScore = homeRatings.offense + homeRatings.coachOffBoost + 2; 
        const homeDefenseScore = (homeRatings.defense * 0.5) + (homeRatings.goalie * 0.5) + homeRatings.coachDefBoost + 2;

        const awayOffenseScore = awayRatings.offense + awayRatings.coachOffBoost;
        const awayDefenseScore = (awayRatings.defense * 0.5) + (awayRatings.goalie * 0.5) + awayRatings.coachDefBoost;

        const SCALING_FACTOR = 8;
        let homeExpectedGoals = 2.5 + ((homeOffenseScore - awayDefenseScore) / SCALING_FACTOR);
        let awayExpectedGoals = 2.5 + ((awayOffenseScore - homeDefenseScore) / SCALING_FACTOR);

        let homeGoals = Math.max(0, Math.round(homeExpectedGoals + (Math.random() * 3 - 1.5)));
        let awayGoals = Math.max(0, Math.round(awayExpectedGoals + (Math.random() * 3 - 1.5)));

        let isOT = false;
        if (homeGoals === awayGoals) {
            isOT = true;
            // Weighted OT: the team that "deserved" it in regulation
            // (by expected-goals edge) wins more overtimes.
            const pHome = Math.min(0.8, Math.max(0.2, 0.5 + (homeExpectedGoals - awayExpectedGoals) * 0.15));
            if (Math.random() < pHome) homeGoals++;
            else awayGoals++;
        }

        game.homeScore = homeGoals;
        game.awayScore = awayGoals;
        game.ot = isOT;
        game.played = true;

        // Goal events feed season stats league-wide; the event objects are
        // kept only for the user's game (drives the game-day screen).
        const events = buildGameEvents(homeTeam, awayTeam, homeGoals, awayGoals, isOT);
        accumulateGameStats(homeTeam, awayTeam, events);
        if (game.homeTeamId === gameState.teamId || game.awayTeamId === gameState.teamId) {
            game.events = events;
            game.shots = buildGameShots(homeTeam, awayTeam, events);
        }

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
    // Roster lives on the user's team object (see store.js) — never a top-level duplicate.
    const userTeam = gameState.leagueTeams.find(t => t.id === gameState.teamId);
    const userRoster = userTeam ? userTeam.roster : null;
    if (userRoster) {
        const coachDev = gameState.coach.skills.development || 5;
        const allPlayers = [...userRoster.goalies, ...userRoster.defensemen, ...userRoster.forwards];
        
        allPlayers.forEach(player => {
            if (player.injuryWeeks > 0) {
                player.injuryWeeks--;
                if (player.injuryWeeks === 0 && player.status === 'Practice Squad') {
                    player.status = 'Active Roster';
                }
            } else if (player.status === 'Active Roster' && Math.random() < 0.02) {
                player.injuryWeeks = Math.floor(Math.random() * 4) + 1;
                player.status = 'Practice Squad';
                // Auto-replace with best available practice squad player
                const allPracticeSquad = [...userRoster.forwards, ...userRoster.defensemen, ...userRoster.goalies]
                    .filter(p => p.status === 'Practice Squad' && p.id !== player.id)
                    .sort((a, b) => b.overall - a.overall);
                if (allPracticeSquad.length > 0) {
                    allPracticeSquad[0].status = 'Active Roster';
                }
            }

            const gap = player.potential - player.overall;
            if (gap > 0) {
                const progressionChance = 0.15 + ((coachDev / 30) * 0.20) + (gap * 0.005); 
                if (Math.random() < progressionChance) {
                    const statKeys = Object.keys(player.stats);
                    const focusPool = focusStatPool(gameState.trainingFocus, statKeys);
                    const randomStat = (focusPool.length > 0 && Math.random() < 0.6)
                        ? focusPool[Math.floor(Math.random() * focusPool.length)]
                        : statKeys[Math.floor(Math.random() * statKeys.length)];
                    if (player.stats[randomStat] < 99) {
                        player.stats[randomStat]++;
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

    gameState.currentWeek++;

    // TRIGGER TOURNAMENTS
    if (gameState.currentWeek === 39) generateConferenceQuarterfinals(gameState);
    if (gameState.currentWeek === 40) generateConferenceSemifinals(gameState);
    if (gameState.currentWeek === 41) generateConferenceFinals(gameState);
    if (gameState.currentWeek === 42) generateNationalTournament(gameState);
    if (gameState.currentWeek === 43) generateNationalQuarterfinals(gameState);
    if (gameState.currentWeek === 44) generateNationalSemifinals(gameState);
    if (gameState.currentWeek === 45) generateNationalChampionship(gameState);

    return true;
}

export function processOffSeason(gameState) {
    const coachDev = gameState.coach.skills.development || 5;

    gameState.leagueTeams.forEach(team => {
        team.roster.forwards = team.roster.forwards.filter(p => p.year !== 'Sr');
        team.roster.defensemen = team.roster.defensemen.filter(p => p.year !== 'Sr');
        team.roster.goalies = team.roster.goalies.filter(p => p.year !== 'Sr');

        const allReturning = [...team.roster.forwards, ...team.roster.defensemen, ...team.roster.goalies];

        allReturning.forEach(player => {
            player.seasonGoals = 0;
            player.seasonAssists = 0;
            let boostChance = 0;
            if (player.status === 'Active Roster') boostChance = 0.60 + (coachDev * 0.01);
            else if (player.status === 'Practice Squad') boostChance = 0.30 + (coachDev * 0.01);
            else if (player.status === 'Redshirt') {
                boostChance = 0.20 + (coachDev * 0.01);
                player.redshirtUsed = true; 
            }

            if (Math.random() < boostChance) {
                const statKeys = Object.keys(player.stats);
                statKeys.forEach(stat => {
                    if (Math.random() < 0.50 && player.stats[stat] < 99) {
                        player.stats[stat] += Math.floor(Math.random() * 3) + 1;
                    }
                });
                
                let statTotal = 0;
                for (let key in player.stats) {
                    statTotal += player.stats[key];
                }
                player.overall = Math.round(statTotal / statKeys.length);
            }

            if (player.status !== 'Redshirt') {
                if (player.year === 'Jr') player.year = 'Sr';
                if (player.year === 'So') player.year = 'Jr';
                if (player.year === 'Fr') player.year = 'So';
                player.eligibilityYears--;
            } else {
                player.status = 'Practice Squad'; 
            }
            
            player.injuryWeeks = 0;
        });
    });

    return true;
}

// --- LEAGUE RANKING HELPERS ---

// Pseudo-poll score balancing points, win percentage, loss penalties, and prestige.
export function pollScore(t) {
    const w = t.wins || 0;
    const l = t.losses || 0;
    const otl = t.otl || 0;
    const pts = (w * 2) + otl;
    const gp = w + l + otl;
    const winPct = gp > 0 ? pts / (gp * 2) : 0;
    return (pts * 12) + (winPct * 50) + (t.prestige * 0.5) - (l * 2);
}

// National rank 1-25, or 99 when unranked.
export function nationalRank(leagueTeams, teamId) {
    const sorted = [...leagueTeams].sort((a, b) => pollScore(b) - pollScore(a));
    const idx = sorted.findIndex(t => t.id === teamId);
    return idx >= 0 && idx < 25 ? idx + 1 : 99;
}
