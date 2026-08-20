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
