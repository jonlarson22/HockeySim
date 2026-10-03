// recruiting.js — offseason recruiting (user-only prospect pool).
//
// Only the user's program is simulated in detail. Every prospect attracts
// phantom rival interest that grows weekly (hotter prospects draw more), so
// recruiting keeps real signing battles without simulating 31 AI programs.
// AI teams refill their own rosters with generated freshmen behind the scenes.
import { getRandomFirstName, getRandomLastName } from './data.js';

export const PROSPECT_POOL_SIZE = 200;

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
        // Recruiting-specific
        userPoints: 0,                              // points the user has spent
        rivalInterest: 0,                           // phantom competing interest
        rivalGrowth: randomInt(18, 30) + Math.floor(overall / 12),
        commitThreshold: randomInt(120, 180),
        isUserTarget: false,
        signedBy: null                              // teamId, 'rival', or null
    };
}

export function generateProspectPool() {
    const pool = [];
    for (let i = 0; i < PROSPECT_POOL_SIZE; i++) {
        const roll = Math.random();
        const position = roll > 0.60 ? (roll > 0.90 ? 'G' : 'D') : 'F';
        pool.push(generateProspect(position, Math.floor(Math.random() * 80) + 10));
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

// One week of recruiting: user allocations land, rival interest grows,
// commitments resolve. Returns the week's activity log.
export function processRecruitingWeek(state, userAllocations) {
    const week = state.recruitingWeek || 1;
    const pool = state.prospectPool || [];
    const userTeamId = state.teamId;
    const userTeam = state.leagueTeams.find(t => t.id === userTeamId);
    const recap = [];

    for (const [id, pts] of Object.entries(userAllocations || {})) {
        if (pts <= 0) continue;
        const p = pool.find(x => x.id === id);
        if (!p || p.signedBy) continue;
        p.userPoints += pts;
        p.isUserTarget = true;
    }

    pool.filter(p => !p.signedBy).forEach(p => {
        p.rivalInterest += p.rivalGrowth + randomInt(-5, 5);
        const finalWeek = week === 5;

        if (p.userPoints >= p.commitThreshold && p.userPoints >= p.rivalInterest) {
            p.signedBy = userTeamId;
            if (p.isUserTarget) {
                recap.push({ prospect: p, status: 'SIGNED', schoolName: userTeam ? userTeam.name : 'your program' });
            }
        } else if (p.rivalInterest >= p.commitThreshold || (finalWeek && p.rivalInterest > p.userPoints)) {
            p.signedBy = 'rival';
            if (p.isUserTarget) recap.push({ prospect: p, status: 'LOST' });
        } else if (p.isUserTarget) {
            recap.push({ prospect: p, status: 'UNDECIDED', rivalInterest: Math.max(0, Math.round(p.rivalInterest)) });
        }
    });

    return recap;
}

// ---- In-season recruiting ----
// The same 200-prospect pool persists all season. Windows + the target-board
// drip bank early interest (userPoints); nothing signs in-season — this is
// positioning for the offseason battle, which reuses the pool (with turnover).

// 1-based weeks when a recruiting window opens (regular season runs 1-38).
export const INSEASON_WINDOW_WEEKS = [10, 22, 34];
export const MAX_RECRUIT_TARGETS = 5;
// Share of the pool turned over when the offseason begins (>=85% retained).
export const POOL_TURNOVER_FRACTION = 0.15;

// One window's point budget: deliberately smaller than an offseason week.
export function calculateWindowPoints(team, coach) {
    let points = 50;
    points += ((coach.skills?.recruiting || 3) * 2);
    points += ((team.prestige || 50) * 0.5);
    return Math.floor(points);
}

// Weekly drip per starred target.
export function dripPerWeek(coach) {
    return 1 + Math.floor((coach.skills?.recruiting || 3) / 12);
}

// Weekly background: starred targets accrue interest, phantom rivals creep.
// No commitments resolve in-season.
export function processInseasonWeek(state) {
    const pool = state.prospectPool || [];
    if (!pool.length) return;
    const drip = dripPerWeek(state.coach);
    const targets = state.recruitTargets || [];
    // Prune dead target ids.
    state.recruitTargets = targets.filter(id => {
        const p = pool.find(x => x.id === id);
        return p && !p.signedBy;
    });
    state.recruitTargets.forEach(id => {
        const p = pool.find(x => x.id === id);
        if (p && !p.signedBy) {
            p.userPoints += drip;
            p.isUserTarget = true;
        }
    });
    pool.forEach(p => {
        if (p.signedBy) return;
        p.rivalInterest += Math.max(0, Math.round(p.rivalGrowth * 0.08 + randomInt(-1, 1)));
    });
}

// A window's allocations bank as early interest. No signings resolve here.
export function processRecruitWindow(state, allocations) {
    const pool = state.prospectPool || [];
    let touched = 0;
    for (const [id, pts] of Object.entries(allocations || {})) {
        if (pts <= 0) continue;
        const p = pool.find(x => x.id === id);
        if (!p || p.signedBy) continue;
        p.userPoints += pts;
        p.isUserTarget = true;
        touched++;
    }
    return { touched };
}

// Offseason turnover: replace ~15% of the pool, but never a prospect the
// user has shown interest in. Coldest (lowest rival interest) go first.
export function applyPoolTurnover(pool) {
    const target = Math.round(pool.length * POOL_TURNOVER_FRACTION);
    const candidates = pool
        .filter(p => !p.signedBy && (p.userPoints || 0) === 0 && !p.isUserTarget)
        .sort((a, b) => a.rivalInterest - b.rivalInterest);
    let replaced = 0;
    for (const old of candidates.slice(0, target)) {
        const idx = pool.indexOf(old);
        if (idx >= 0) {
            pool[idx] = generateProspect(old.position, Math.floor(Math.random() * 80) + 10);
            replaced++;
        }
    }
    return replaced;
}
