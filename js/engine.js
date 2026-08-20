import { getRandomFirstName, getRandomLastName } from './data.js';

// Helper to generate a random number within a range
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// NEW: Initialize the league with randomized prestige and zeroed records
export function initializeLeague(baseTeams) {
    return baseTeams.map(team => {
        // Randomize prestige by +/- 4 points
        const variance = Math.floor(Math.random() * 9) - 4; 
        let newPrestige = team.prestige + variance;
        
        // Keep prestige within 1-99
        if (newPrestige > 99) newPrestige = 99;
        if (newPrestige < 1) newPrestige = 1;

        return {
            ...team, // Copy all base team data (id, name, color, confId)
            prestige: newPrestige,
            wins: 0,
            losses: 0,
            otl: 0
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

    return {
        id: 'p_' + Math.random().toString(36).substring(2, 9),
        firstName: getRandomFirstName(), 
        lastName: getRandomLastName(),
        position: position,
        year: year,
        overall: overall, // NEW OVR PROPERTY
        potential: potential,
        stats: stats,
        status: 'Active' 
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
        let fixedTeam = rotatingTeam.shift();

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
