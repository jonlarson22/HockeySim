// recruiting.js
import { getRandomFirstName, getRandomLastName } from './data.js';

export function getScoutedGrade(rating) {
    if (rating >= 90) return 'A';
    if (rating >= 80) return 'B';
    if (rating >= 70) return 'C';
    if (rating >= 60) return 'D';
    return 'F';
}

export function getPotentialDescriptor(potential) {
    if (potential >= 90) return 'Elite / Franchise';
    if (potential >= 80) return 'Top-Line Starter';
    if (potential >= 70) return 'Solid Contributor';
    return 'Depth / Project';
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateProspect(position, targetPrestige) {
    const isGoalie = position === 'G';
    const prestigeBonus = Math.floor(targetPrestige / 10);
    let stats = {};

    if (isGoalie) {
        stats = {
            reflexes: randomInt(45, 68) + prestigeBonus,
            positioning: randomInt(45, 68) + prestigeBonus,
            puckControl: randomInt(40, 65) + prestigeBonus,
            conditioning: randomInt(45, 70) + prestigeBonus,
            composure: randomInt(40, 68) + prestigeBonus
        };
    } else {
        stats = {
            skating: randomInt(45, 70) + prestigeBonus,
            shooting: randomInt(40, 68) + prestigeBonus,
            passing: randomInt(40, 68) + prestigeBonus,
            physicality: randomInt(40, 68) + prestigeBonus,
            defense: randomInt(40, 68) + prestigeBonus
        };
    }

    let statTotal = 0, statCount = 0;
    for (let key in stats) {
        if (stats[key] > 99) stats[key] = 99;
        statTotal += stats[key];
        statCount++;
    }
    const overall = Math.round(statTotal / statCount);
    let potential = randomInt(55, 95);
    if (overall >= potential) potential = Math.min(99, overall + randomInt(1, 6));

    return {
        id: 'rec_' + Math.random().toString(36).substring(2, 9),
        firstName: getRandomFirstName(),
        lastName: getRandomLastName(),
        position: position,
        year: 'Fr',
        overall: overall,
        potential: potential,
        stats: stats,
        status: 'Active Roster',
        eligibilityYears: 4,
        redshirtUsed: false,
        injuryWeeks: 0,
        // Recruiting Specific Properties
        interest: {},          // { teamId: totalAccumulatedPoints }
        committedTeamId: null, // null until committed
        scoutedBy: {},         // { teamId: scoutLevel (0-2) }
        commitThreshold: randomInt(120, 180) // Total points needed to trigger early commit
    };
}

export function generateProspectPool(gameState) {
    const targetPoolSize = gameState.leagueTeams.length * 8 * 2;
    let pool = [];

    for (let i = 0; i < targetPoolSize; i++) {
        let posRoll = Math.random();
        let position = posRoll > 0.60 ? (posRoll > 0.90 ? 'G' : 'D') : 'F';
        let qualityTier = Math.floor(Math.random() * 80) + 10;
        pool.push(generateProspect(position, qualityTier));
    }
    return pool;
}

export function calculateRecruitingPoints(team, coach) {
    let points = 200;
    points += ((coach.skills?.recruiting || 3) * 15);
    points += (team.prestige * 3);
    points += ((team.wins || 0) * 10);
    return Math.floor(points);
}

// Simulates 1 week of recruiting for AI and calculates user pitches
export function processRecruitingWeek(gameState, userAllocations) {
    const currentWeek = gameState.recruitingWeek || 1;
    const pool = gameState.prospectPool || [];
    const userTeamId = gameState.teamId;
    const weeklyRecap = [];

    // 1. Process User Point Allocations
    for (const [prospectId, points] of Object.entries(userAllocations)) {
        if (points <= 0) continue;
        const prospect = pool.find(p => p.id === prospectId);
        if (!prospect || prospect.committedTeamId) continue;

        prospect.interest[userTeamId] = (prospect.interest[userTeamId] || 0) + points;
        
        // Auto-mark as target for quick filtering UI
        prospect.isUserTarget = true;
    }

    // 2. Process AI Team Recruiting Allocations
    gameState.leagueTeams.forEach(team => {
        if (team.id === userTeamId) return; // Skip user

        const aiBudget = calculateRecruitingPoints(team, { skills: { recruiting: Math.floor(team.prestige / 3.3) } });
        // AI targets prospects matched to their prestige level
        const availableProspects = pool.filter(p => !p.committedTeamId);
        
        // Select 3 to 5 targets
        const numTargets = Math.min(availableProspects.length, 4);
        const targetSlice = availableProspects
            .sort((a, b) => Math.abs(b.overall - (team.prestige * 0.8)) - Math.abs(a.overall - (team.prestige * 0.8)))
            .slice(0, numTargets);

        const pointsPerTarget = Math.floor(aiBudget / (numTargets || 1));
        targetSlice.forEach(prospect => {
            prospect.interest[team.id] = (prospect.interest[team.id] || 0) + pointsPerTarget;
        });
    });

    // 3. Resolve Commitments
    pool.filter(p => !p.committedTeamId).forEach(prospect => {
        // Find top interested team
        let topTeamId = null;
        let maxPoints = 0;

        for (const [teamId, pts] of Object.entries(prospect.interest)) {
            if (pts > maxPoints) {
                maxPoints = pts;
                topTeamId = teamId;
            }
        }

        if (!topTeamId) return;

        // Commit logic: Exceeds threshold or final week (Week 5)
        const commitTriggered = maxPoints >= prospect.commitThreshold || currentWeek === 5;

        if (commitTriggered) {
            prospect.committedTeamId = topTeamId;
            const committedTeam = gameState.leagueTeams.find(t => t.id === topTeamId);
            
            // Add to weekly recap if relevant to user or high profile
            if (prospect.isUserTarget || topTeamId === userTeamId) {
                weeklyRecap.push({
                    prospect,
                    status: topTeamId === userTeamId ? 'SIGNED' : 'LOST',
                    schoolName: committedTeam ? committedTeam.name : 'Unknown'
                });
            }
        } else if (prospect.isUserTarget) {
            weeklyRecap.push({
                prospect,
                status: 'UNDECIDED',
                topSchool: gameState.leagueTeams.find(t => t.id === topTeamId)?.name || 'None',
                userInterest: prospect.interest[userTeamId] || 0
            });
        }
    });

    return weeklyRecap;
}
