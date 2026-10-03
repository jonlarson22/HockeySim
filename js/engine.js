import { getRandomFirstName, getRandomLastName, conferences } from './data.js';
import { autoFormLines, teamForwardOvr, getLines, lineEffectiveOvr, getRole } from './lines.js';

import { 
    generateConferenceQuarterfinals, 
    generateConferenceSemifinals, 
    generateConferenceFinals,
    generateNationalTournament,
    generateNationalRound16,
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
    const isForward = position === 'F';
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

    // Potential is always higher than starting OVR (except at the 99 cap,
    // where there's nothing left to grow into).
    let potential = Math.min(99, Math.max(randomInt(55, 99), overall + 1));

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
        seasonAssists: 0,
        roleWeeks: { active: 0, practice: 0, redshirt: 0 },
        // Forwards: natural position (C/LW/RW) and home line slot (L1C..L4RW).
        // lineSlot is the player's "home" — kept through injuries, reclaimed on return.
        ...(isForward ? { linePos: ['C', 'LW', 'RW'][Math.floor(Math.random() * 3)], lineSlot: null } : {})
    };
}

// Generate a full initial roster for a newly accepted team
export function generateTeamRoster(teamPrestige) {
    const forwards = Array.from({ length: 15 }, () => generatePlayer('F', teamPrestige));
    autoFormLines(forwards);
    return {
        goalies: Array.from({ length: 3 }, () => generatePlayer('G', teamPrestige)),
        defensemen: Array.from({ length: 8 }, () => generatePlayer('D', teamPrestige)),
        forwards
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
    // Line-based OVR with chemistry: L1 40%, L2 30%, L3 20%, L4 10%.
    // Each line's effective OVR includes its chemistry bonus (±5%).
    const fwdLines = getLines(activeForwards);
    const lineW = [0.40, 0.30, 0.20, 0.10];
    let wSum = 0;
    for (let l = 1; l <= 4; l++) {
        const { C, LW, RW } = fwdLines[l];
        if (C && LW && RW) {
            offOvr += lineEffectiveOvr(C, LW, RW) * lineW[l - 1];
            wSum += lineW[l - 1];
        }
    }
    if (wSum > 0) offOvr /= wSum;
    else offOvr = activeForwards.reduce((sum, p) => sum + p.overall, 0) / (activeForwards.length || 1);

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
            assistIds: [a1, a2].filter(Boolean).map(a => a.id),
            // ~25% of regulation goals come on the power play. Pure label —
            // the final score was drawn before this runs. No PP in OT (3v3).
            isPP: period < 4 && Math.random() < 0.25
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
        if (scorer) {
            scorer.seasonGoals = (scorer.seasonGoals || 0) + 1;
            if (e.isPP) scorer.seasonPPG = (scorer.seasonPPG || 0) + 1;
        }
        for (const aid of e.assistIds || []) {
            const a = find(team, aid);
            if (a) a.seasonAssists = (a.seasonAssists || 0) + 1;
        }
    }

    const activeSkaters = (team) => [
        ...team.roster.forwards.filter(p => p.status === 'Active Roster' && !p.injuryWeeks),
        ...team.roster.defensemen.filter(p => p.status === 'Active Roster' && !p.injuryWeeks)
    ];

    // Plus/minus: even-strength goals only (real hockey skips +/- on power plays).
    for (const e of events) {
        if (!e.scorerId || e.scorerId === 'none' || e.isPP) continue;
        const scored = e.teamId === homeTeam.id ? homeTeam : awayTeam;
        const conceded = scored === homeTeam ? awayTeam : homeTeam;
        for (const p of activeSkaters(scored)) p.seasonPlusMinus = (p.seasonPlusMinus || 0) + 1;
        for (const p of activeSkaters(conceded)) p.seasonPlusMinus = (p.seasonPlusMinus || 0) - 1;
    }

    // Penalties: 3-7 minors per team per game, Power Forwards take more.
    // Pure annotation — does not affect the final score.
    for (const team of [homeTeam, awayTeam]) {
        const skaters = activeSkaters(team);
        if (!skaters.length) continue;
        const weights = skaters.map(p => getRole(p) === 'Power Forward' ? 2 : 1);
        const totalW = weights.reduce((a, b) => a + b, 0);
        for (let i = 0, minors = randomInt(3, 7); i < minors; i++) {
            let r = Math.random() * totalW;
            for (let j = 0; j < skaters.length; j++) {
                r -= weights[j];
                if (r <= 0) { skaters[j].seasonPIM = (skaters[j].seasonPIM || 0) + 2; break; }
            }
        }
    }

    // Goalie saves: shots faced minus goals allowed. Same shot formula as
    // buildGameShots (goals*7 + 3-8 per period, ~4 periods per game).
    const getActive = (roster) => roster.filter(p => p.status === 'Active Roster' && !p.injuryWeeks);
    const homeGoalie = getActive(homeTeam.roster.goalies)[0];
    const awayGoalie = getActive(awayTeam.roster.goalies)[0];
    const homeGoals = events.filter(e => e.teamId === homeTeam.id && e.scorerId && e.scorerId !== 'none').length;
    const awayGoals = events.filter(e => e.teamId === awayTeam.id && e.scorerId && e.scorerId !== 'none').length;
    if (homeGoalie) {
        const sa = awayGoals * 7 + randomInt(12, 32);
        homeGoalie.seasonSaves = (homeGoalie.seasonSaves || 0) + Math.max(0, sa - awayGoals);
        homeGoalie.seasonShotsAgainst = (homeGoalie.seasonShotsAgainst || 0) + sa;
        if (awayGoals === 0) homeGoalie.seasonShutouts = (homeGoalie.seasonShutouts || 0) + 1;
        if (homeGoals > awayGoals) homeGoalie.seasonWins = (homeGoalie.seasonWins || 0) + 1;
        else if (awayGoals > homeGoals) homeGoalie.seasonLosses = (homeGoalie.seasonLosses || 0) + 1;
    }
    if (awayGoalie) {
        const sa = homeGoals * 7 + randomInt(12, 32);
        awayGoalie.seasonSaves = (awayGoalie.seasonSaves || 0) + Math.max(0, sa - homeGoals);
        awayGoalie.seasonShotsAgainst = (awayGoalie.seasonShotsAgainst || 0) + sa;
        if (homeGoals === 0) awayGoalie.seasonShutouts = (awayGoalie.seasonShutouts || 0) + 1;
        if (awayGoals > homeGoals) awayGoalie.seasonWins = (awayGoalie.seasonWins || 0) + 1;
        else if (homeGoals > awayGoals) awayGoalie.seasonLosses = (awayGoalie.seasonLosses || 0) + 1;
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
                    // Reclaim home line slot: evict the temp fill-in if there is one.
                    // If the user deliberately moved someone into the slot, wait
                    // as a healthy scratch (lineSlot cleared for manual placement).
                    if (player.lineSlot) {
                        const occupant = userRoster.forwards.find(p =>
                            p.id !== player.id && p.lineSlot === player.lineSlot &&
                            p.status === 'Active Roster' && p.injuryWeeks === 0);
                        if (occupant && occupant.tempFill) {
                            occupant.lineSlot = null;
                            occupant.tempFill = false;
                            occupant.status = 'Practice Squad';
                        } else if (occupant) {
                            player.lineSlot = null;
                        }
                    }
                }
            } else if (player.status === 'Active Roster' && Math.random() < 0.02) {
                player.injuryWeeks = Math.floor(Math.random() * 4) + 1;
                player.status = 'Practice Squad';
                // lineSlot is the player's home — kept through the injury.
                // Auto-replace with best available practice squad player
                const allPracticeSquad = [...userRoster.forwards, ...userRoster.defensemen, ...userRoster.goalies]
                    .filter(p => p.status === 'Practice Squad' && p.id !== player.id)
                    .sort((a, b) => b.overall - a.overall);
                if (allPracticeSquad.length > 0) {
                    const sub = allPracticeSquad[0];
                    sub.status = 'Active Roster';
                    // Forward line slot: temp fill-in holds the home slot.
                    if (player.lineSlot && sub.position === 'F' && !sub.lineSlot) {
                        sub.lineSlot = player.lineSlot;
                        sub.tempFill = true;
                    }
                }
            }

            // Track which role the player filled this week (drives offseason math).
            if (!player.roleWeeks) player.roleWeeks = { active: 0, practice: 0, redshirt: 0 };
            if (player.status === 'Active Roster') player.roleWeeks.active++;
            else if (player.status === 'Practice Squad') player.roleWeeks.practice++;
            else if (player.status === 'Redshirt') player.roleWeeks.redshirt++;

            const gap = player.potential - player.overall;
            if (gap > 0) {
                // Weekly growth scales with role: actives play, practice squad
                // trains, redshirts develop — mirroring the offseason ratios.
                // Gap coefficient is generous: high-ceiling players close on
                // their potential instead of stalling halfway.
                const roleFactor = player.status === 'Active Roster' ? 1.0
                    : player.status === 'Practice Squad' ? 0.5 : 0.33;
                const progressionChance = (0.15 + ((coachDev / 30) * 0.20) + (gap * 0.010)) * roleFactor;
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
    if (gameState.currentWeek === 43) generateNationalRound16(gameState);
    if (gameState.currentWeek === 44) generateNationalQuarterfinals(gameState);
    if (gameState.currentWeek === 45) generateNationalSemifinals(gameState);
    if (gameState.currentWeek === 46) generateNationalChampionship(gameState);

    return true;
}

// Which role a player actually filled most of the season, based on tracked
// weekly status. A 44-game starter who finishes the year hurt on the practice
// squad still counts as active — the offseason shouldn't punish the last week.
// Falls back to current status when nothing was tracked (AI teams, legacy saves).
export function majorityRole(player) {
    const rw = player.roleWeeks || { active: 0, practice: 0, redshirt: 0 };
    const a = rw.active || 0, p = rw.practice || 0, r = rw.redshirt || 0;
    if (a + p + r === 0) return player.status || 'Active Roster';
    if (r >= a && r >= p) return 'Redshirt';
    if (p > a) return 'Practice Squad';
    return 'Active Roster';
}

// End-of-season player awards. Computes winners, applies +1 OVR each
// (capped at 99), and stores the list for the season recap screen.
// Idempotent — safe to call from the recap render.
export function computeSeasonAwards(gameState) {
    if (gameState.seasonAwards) return gameState.seasonAwards;
    const awards = [];
    const give = (player, team, type, label) => {
        player.overall = Math.min(99, (player.overall || 0) + 1);
        const isGoalie = type === 'all-american' && label.includes('(G)');
        const sa = player.seasonShotsAgainst || 0;
        const savePct = sa > 0 ? ((player.seasonSaves || 0) / sa * 100).toFixed(1) + '%' : '—';
        awards.push({
            type, label,
            name: `${player.firstName} ${player.lastName}`,
            team: team.name,
            position: player.position,
            overall: player.overall,
            points: (player.seasonGoals || 0) + (player.seasonAssists || 0),
            stat: isGoalie ? `${savePct} SV%` : `${(player.seasonGoals || 0) + (player.seasonAssists || 0)} pts`,
        });
    };

    const forwards = [];
    const defensemen = [];
    const goalies = [];
    gameState.leagueTeams.forEach(team => {
        team.roster.forwards.forEach(p =>
            forwards.push({ p, team, pts: (p.seasonGoals || 0) + (p.seasonAssists || 0) }));
        team.roster.defensemen.forEach(p =>
            defensemen.push({ p, team, pts: (p.seasonGoals || 0) + (p.seasonAssists || 0) }));
        team.roster.goalies.forEach(p => goalies.push({ p, team }));
    });

    // All-Americans by position: 6 forwards, 4 defensemen (by points within
    // position — defenders would never make it on raw points alone),
    // 2 goalies by save% (min 200 shots against, to avoid small-sample flukes).
    forwards.sort((a, b) => b.pts - a.pts).slice(0, 6)
        .forEach(({ p, team }) => give(p, team, 'all-american', 'All-American'));
    defensemen.sort((a, b) => b.pts - a.pts).slice(0, 4)
        .forEach(({ p, team }) => give(p, team, 'all-american', 'All-American'));
    const goalieSavePct = g => {
        const sa = g.p.seasonShotsAgainst || 0;
        return sa >= 200 ? (g.p.seasonSaves || 0) / sa : -1;
    };
    goalies.sort((a, b) => goalieSavePct(b) - goalieSavePct(a)).slice(0, 2)
        .forEach(({ p, team }) => give(p, team, 'all-american', 'All-American (G)'));

    // Per-conference: Player of the Year and Rookie of the Year by points.
    const skaters = forwards.concat(defensemen);
    const confIds = [...new Set(gameState.leagueTeams.map(t => t.confId))];
    confIds.forEach(confId => {
        const conf = skaters.filter(s => s.team.confId === confId);
        if (!conf.length) return;
        const poy = [...conf].sort((a, b) => b.pts - a.pts)[0];
        give(poy.p, poy.team, 'poy', 'Conference Player of the Year');
        const rookies = conf.filter(s => s.p.year === 'Fr');
        if (rookies.length) {
            const roy = [...rookies].sort((a, b) => b.pts - a.pts)[0];
            give(roy.p, roy.team, 'roy', 'Conference Rookie of the Year');
        }
    });

    gameState.seasonAwards = awards;
    return awards;
}

// Coach of the Year: best conference record per conference (lower prestige
// wins ties — did more with less), national champ's coach wins nationally.
// Returns [{ confId|null, teamName, coachName, type }]. The +1 skill point
// is applied via the season recap UI (user picks the skill).
export function computeCoachAwards(gameState) {
    if (gameState.seasonCoachAwards) return gameState.seasonCoachAwards;
    const awards = [];
    const confIds = [...new Set(gameState.leagueTeams.map(t => t.confId))];
    confIds.forEach(confId => {
        const teams = gameState.leagueTeams.filter(t => t.confId === confId);
        const sorted = [...teams].sort((a, b) => {
            const aw = (a.confWins || 0) * 2 + (a.confOtl || 0);
            const bw = (b.confWins || 0) * 2 + (b.confOtl || 0);
            if (bw !== aw) return bw - aw;
            return a.prestige - b.prestige; // did more with less
        });
        const winner = sorted[0];
        if (winner) awards.push({
            type: 'coty-conf', label: 'Conference Coach of the Year',
            confId, teamName: winner.name,
            isUser: winner.id === gameState.teamId,
        });
    });
    // National: the champion's coach (final game of the schedule).
    const champGame = (gameState.schedule[44] || [])[0];
    if (champGame && champGame.homeScore !== null) {
        const champId = champGame.homeScore > champGame.awayScore ? champGame.homeTeamId : champGame.awayTeamId;
        const champ = gameState.leagueTeams.find(t => t.id === champId);
        if (champ) awards.push({
            type: 'coty-nat', label: 'National Coach of the Year',
            confId: null, teamName: champ.name,
            isUser: champ.id === gameState.teamId,
        });
    }
    gameState.seasonCoachAwards = awards;
    return awards;
}

export function processOffSeason(gameState) {
    const coachDev = gameState.coach.skills.development || 5;

    // Early NHL draft declarations: juniors/seniors only. Probability scales
    // with OVR — a 76 is ~4%, an 85 ~40%, capped at 60% (never guaranteed).
    // Hits AI contenders too, so the rich get churned.
    const declared = [];
    gameState.leagueTeams.forEach(team => {
        ['forwards', 'defensemen', 'goalies'].forEach(key => {
            team.roster[key] = team.roster[key].filter(p => {
                if ((p.year === 'Jr' || p.year === 'Sr') && p.injuryWeeks === 0) {
                    const prob = Math.min(0.6, Math.max(0, ((p.overall || 0) - 75) * 0.04));
                    if (Math.random() < prob) {
                        declared.push({ name: `${p.firstName} ${p.lastName}`, team: team.name, overall: p.overall, year: p.year });
                        return false;
                    }
                }
                return true;
            });
        });
    });
    if (declared.length) gameState.draftDeclarations = declared;

    gameState.leagueTeams.forEach(team => {
        team.roster.forwards = team.roster.forwards.filter(p => p.year !== 'Sr');
        team.roster.defensemen = team.roster.defensemen.filter(p => p.year !== 'Sr');
        team.roster.goalies = team.roster.goalies.filter(p => p.year !== 'Sr');

        const allReturning = [...team.roster.forwards, ...team.roster.defensemen, ...team.roster.goalies];

        allReturning.forEach(player => {
            player.seasonGoals = 0;
            player.seasonAssists = 0;
            player.seasonSaves = 0;
            player.seasonShotsAgainst = 0;
            // Offseason math keys off the role the player actually filled most
            // of the season — not whatever their status happens to be this week.
            const seasonRole = majorityRole(player);
            player.roleWeeks = { active: 0, practice: 0, redshirt: 0 };
            const gap = Math.max(0, (player.potential || 0) - (player.overall || 0));
            let boostChance = 0;
            if (seasonRole === 'Active Roster') boostChance = 0.60 + (coachDev * 0.01);
            else if (seasonRole === 'Practice Squad') boostChance = 0.30 + (coachDev * 0.01);
            else if (seasonRole === 'Redshirt') {
                boostChance = 0.20 + (coachDev * 0.01);
                player.redshirtUsed = true; 
            }
            // Higher-ceiling players develop faster in the offseason too —
            // same gap mechanic as weekly progression.
            boostChance = Math.min(0.95, boostChance + gap * 0.015);

            if (Math.random() < boostChance) {
                const statKeys = Object.keys(player.stats);
                // Close a fraction of the remaining gap: high-ceiling players
                // make big jumps, low-ceiling players get a nudge. Self-limiting
                // — you approach potential but never overshoot it.
                const ovrGain = (player.potential - player.overall) * 0.25;
                let pointsToDistribute = Math.max(1, Math.round(ovrGain * statKeys.length));
                let guard = 0;
                while (pointsToDistribute > 0 && guard++ < 500) {
                    const stat = statKeys[Math.floor(Math.random() * statKeys.length)];
                    if (player.stats[stat] < 99) { player.stats[stat]++; pointsToDistribute--; }
                }
                let statTotal = 0;
                for (let key in player.stats) {
                    statTotal += player.stats[key];
                }
                player.overall = Math.round(statTotal / statKeys.length);
            }

            // Breakout: high-ceiling players sometimes explode — closing 35%
            // of the gap in one offseason instead of 18%.
            const breakoutChance = seasonRole === 'Active Roster' ? 0.10
                : seasonRole === 'Practice Squad' ? 0.05 : 0;
            if (gap >= 15 && Math.random() < breakoutChance) {
                const statKeys = Object.keys(player.stats);
                const ovrGain = (player.potential - player.overall) * 0.45;
                let pointsToDistribute = Math.max(1, Math.round(ovrGain * statKeys.length));
                let guard = 0;
                while (pointsToDistribute > 0 && guard++ < 500) {
                    const stat = statKeys[Math.floor(Math.random() * statKeys.length)];
                    if (player.stats[stat] < 99) { player.stats[stat]++; pointsToDistribute--; }
                }
                let statTotal = 0;
                for (let key in player.stats) {
                    statTotal += player.stats[key];
                }
                player.overall = Math.round(statTotal / statKeys.length);
            }

            if (seasonRole !== 'Redshirt') {
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

    // League-wide prestige drift: AI programs rise and fall with results.
    // Whole conferences can shift over a decade — no permanent caste system.
    // (The user's team is handled separately by applySeasonConsequences.)
    const danced = new Set();
    (gameState.schedule || []).forEach(week => (week || []).forEach(g => {
        if (g.type === 'national_tourney') { danced.add(g.homeTeamId); danced.add(g.awayTeamId); }
    }));
    gameState.leagueTeams.forEach(team => {
        if (team.id === gameState.teamId) return;
        const gp = (team.wins || 0) + (team.losses || 0) + (team.otl || 0);
        if (!gp) return;
        const winPct = ((team.wins || 0) * 2 + (team.otl || 0)) / (gp * 2);
        const p = team.prestige || 50;
        let drift = 0;
        if (p >= 80) drift = winPct >= 0.65 ? 1 : winPct < 0.5 ? -3 : -1;
        else if (p >= 65) drift = winPct >= 0.6 ? 2 : winPct < 0.45 ? -2 : 0;
        else if (p >= 50) drift = winPct >= 0.55 ? 2 : winPct < 0.4 ? -1 : 1;
        else if (p >= 35) drift = winPct >= 0.5 ? 3 : winPct < 0.35 ? -1 : 1;
        else drift = winPct >= 0.45 ? 3 : 0;
        if (danced.has(team.id)) drift += 2;
        team.prestige = Math.max(1, Math.min(99, p + drift + randomInt(-1, 1)));
    });

    // Conference realignment: strong programs in weak leagues get invited up;
    // collapsing powers get sent down. Rare (max 2 swaps/year), and a moved
    // team must prove itself for 4 seasons before moving again. Not soccer —
    // this is deliberate, not automatic.
    conferenceRealignment(gameState);

    return true;
}

// Runs once per offseason. Returns a log of moves for the recap screen.
export function conferenceRealignment(gameState) {
    const log = [];
    const confAvg = {};
    const confTeams = {};
    gameState.leagueTeams.forEach(t => {
        (confTeams[t.confId] = confTeams[t.confId] || []).push(t);
    });
    Object.keys(confTeams).forEach(cid => {
        const ts = confTeams[cid];
        confAvg[cid] = ts.reduce((a, t) => a + (t.prestige || 50), 0) / ts.length;
    });
    // Conferences ranked strongest to weakest.
    const ranked = Object.keys(confTeams).sort((a, b) => confAvg[b] - confAvg[a]);

    let swaps = 0;
    // Try to move teams up from the bottom half into the top half.
    for (let i = ranked.length - 1; i >= Math.ceil(ranked.length / 2) && swaps < 2; i--) {
        const weakId = ranked[i];
        const weakTeams = confTeams[weakId].filter(t => (t.seasonsInConf ?? 4) >= 4);
        if (!weakTeams.length) continue;
        // Best team in the weak conference.
        const up = [...weakTeams].sort((a, b) => b.prestige - a.prestige)[0];
        // Find a stronger conference with a clear gap that would take them.
        for (let j = 0; j < Math.floor(ranked.length / 2) && swaps < 2; j++) {
            const strongId = ranked[j];
            if (confAvg[strongId] - confAvg[weakId] < 15) continue;
            // They need to be a proven power (65+) and competitive up there.
            if (up.prestige < 65 || up.prestige < confAvg[strongId] - 10) continue;
            const strongTeams = confTeams[strongId].filter(t => (t.seasonsInConf ?? 4) >= 4 && t.id !== gameState.teamId);
            if (!strongTeams.length) continue;
            // The weakest team in the strong conference goes down.
            const down = [...strongTeams].sort((a, b) => a.prestige - b.prestige)[0];
            if (down.prestige > confAvg[weakId] + 10) continue;
            // User's team: invite, don't force. AI teams move automatically.
            if (up.id === gameState.teamId) {
                (gameState.realignmentInvites = gameState.realignmentInvites || []).push({
                    teamId: up.id, fromConf: weakId, toConf: strongId,
                    downTeamId: down.id, downTeamName: down.name
                });
                continue;
            }
            const fromName = conferences.find(c => c.id === weakId)?.name || weakId;
            const toName = conferences.find(c => c.id === strongId)?.name || strongId;
            up.confId = strongId; up.seasonsInConf = 0;
            down.confId = weakId; down.seasonsInConf = 0;
            log.push(`${up.name} invited to the ${toName} (${down.name} relegated to the ${fromName})`);
            swaps++;
            // Refresh the groupings after a swap.
            confTeams[weakId] = confTeams[weakId].filter(t => t.id !== up.id).concat([down]);
            confTeams[strongId] = confTeams[strongId].filter(t => t.id !== down.id).concat([up]);
            break;
        }
    }
    // Age everyone's tenure (moved teams go 0 -> 1; everyone else +1).
    gameState.leagueTeams.forEach(t => { t.seasonsInConf = (t.seasonsInConf ?? 4) + 1; });
    if (log.length) gameState.realignmentLog = log;
    return log;
}

// --- LEAGUE RANKING HELPERS ---

// Pseudo-poll score balancing points, win percentage, loss penalties, prestige,
// and strength of schedule (average opponent win%).
export function pollScore(t, leagueTeams = null, schedule = null) {
    const w = t.wins || 0;
    const l = t.losses || 0;
    const otl = t.otl || 0;
    const pts = (w * 2) + otl;
    const gp = w + l + otl;
    const winPct = gp > 0 ? pts / (gp * 2) : 0;
    const sos = (leagueTeams && schedule) ? calcSOS(t, leagueTeams, schedule) : 0.5;
    return (pts * 12) + (winPct * 50) + (t.prestige * 0.5) - (l * 2) + (sos * 50);
}

// Average win% of a team's scheduled opponents (uses record, not pollScore,
// to avoid circularity). Neutral 0.5 when no schedule data.
function calcSOS(t, leagueTeams, schedule) {
    const oppIds = new Set();
    for (const week of schedule || []) {
        for (const g of week) {
            if (g.homeTeamId === t.id) oppIds.add(g.awayTeamId);
            else if (g.awayTeamId === t.id) oppIds.add(g.homeTeamId);
        }
    }
    if (!oppIds.size) return 0.5;
    let sum = 0;
    for (const id of oppIds) {
        const o = leagueTeams.find(x => x.id === id);
        if (!o) continue;
        const gw = (o.wins || 0) + (o.losses || 0) + (o.otl || 0);
        sum += gw ? (((o.wins || 0) * 2 + (o.otl || 0)) / (gw * 2)) : 0.5;
    }
    return sum / oppIds.size;
}

// National rank 1-25, or 99 when unranked.
export function nationalRank(leagueTeams, teamId, schedule = null) {
    const sorted = [...leagueTeams].sort((a, b) => pollScore(b, leagueTeams, schedule) - pollScore(a, leagueTeams, schedule));
    const idx = sorted.findIndex(t => t.id === teamId);
    return idx >= 0 && idx < 25 ? idx + 1 : 99;
}
