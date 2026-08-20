import { getRandomFirstName, getRandomLastName } from './data.js';

// Helper to generate a random number within a range
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Generate a single player
function generatePlayer(position, teamPrestige) {
    const isGoalie = position === 'G';
    const yearRoll = Math.random();
    
    // Weight class years (Freshmen and Sophomores are more common than Seniors)
    let year = 'Fr';
    if (yearRoll > 0.6) year = 'So';
    if (yearRoll > 0.85) year = 'Jr';
    if (yearRoll > 0.95) year = 'Sr';

    // Base attributes scale slightly with team prestige so better teams start with better players
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

    // Cap max stats at 99 for generation
    for (let key in stats) {
        if (stats[key] > 99) stats[key] = 99;
    }

    // Potential rating (determines growth speed later)
    // Scale from 50 to 99
    const potential = randomInt(55, 95);

    return {
        id: 'p_' + Math.random().toString(36).substring(2, 9),
        firstName: getRandomFirstName(), 
        lastName: getRandomLastName(),
        position: position,
        year: year,
        potential: potential,
        stats: stats,
        status: 'Active' // Added this to track Redshirt/Scratched later!
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
