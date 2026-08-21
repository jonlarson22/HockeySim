// Helper to mask numerical attributes with Letter Grades
export function getScoutedGrade(rating) {
    if (rating >= 90) return 'A';
    if (rating >= 80) return 'B';
    if (rating >= 70) return 'C';
    if (rating >= 60) return 'D';
    return 'F';
}

// Helper to mask numerical potential with qualitative descriptions
export function getPotentialDescriptor(potential) {
    if (potential >= 90) return 'Elite / Franchise';
    if (potential >= 80) return 'Top-Line Starter';
    if (potential >= 70) return 'Solid Contributor';
    return 'Depth / Project';
}

// Generate the incoming freshman class
export function generateProspectPool(gameState) {
    // 8 graduating slots per team * 2.5 buffer
    const targetPoolSize = gameState.leagueTeams.length * 8 * 2.5; 
    let pool = [];

    // Distribute positions roughly to match roster needs (12F, 6D, 2G)
    for (let i = 0; i < targetPoolSize; i++) {
        let posRoll = Math.random();
        let position = 'F';
        if (posRoll > 0.60 && posRoll <= 0.90) position = 'D';
        else if (posRoll > 0.90) position = 'G';

        // We use a base prestige of 50 for generation to ensure a wide bell curve of talent
        let prospect = generatePlayer(position, Math.floor(Math.random() * 90) + 10);
        
        // Ensure they are freshmen and append recruiting-specific properties
        prospect.year = 'Fr';
        prospect.scoutLevel = { [gameState.teamId]: 0 }; // Track how much the user has scouted them
        prospect.teamPitches = {}; // Track which AI/User teams spend points on them
        
        pool.push(prospect);
    }

    return pool;
}

export function calculateRecruitingPoints(gameState) {
    const userTeam = gameState.leagueTeams.find(t => t.id === gameState.teamId);
    const coachRecruiting = gameState.coach.skills.recruiting || 5;

    let points = 200; // Base floor so terrible teams can still recruit
    points += (coachRecruiting * 15); // Up to 450 extra points from a maxed coach
    points += (userTeam.prestige * 3); // Up to 297 extra points for blue-bloods
    points += ((userTeam.wins || 0) * 10); // Reward for on-ice performance
    
    // Bonus for tournament success
    if (gameState.awards && gameState.awards.nationalChamp === userTeam.id) {
        points += 150;
    }

    return Math.floor(points);
}
