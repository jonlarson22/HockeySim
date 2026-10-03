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

    // Recruiting-specific: stars cost more and draw real competition.
    // Heat = what the market thinks: mostly current ability, with a nod to
    // upside. A raw 56/95 (heat 63.8) draws real attention but stays a clear
    // tier below a polished 71/72 (heat 71.2).
    const heat = overall + (potential - overall) * 0.2;
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
        seasonGoals: 0,
        seasonAssists: 0,
        // Forwards: natural line position. lineSlot assigned when they join a roster.
        ...(position === 'F' ? { linePos: ['C', 'LW', 'RW'][Math.floor(Math.random() * 3)], lineSlot: null } : {}),
        userPoints: 0,                              // points the user has spent
        rivalInterest: Math.max(0, Math.round((heat - 55) * 3)),
        rivalGrowth: randomInt(15, 25) + Math.floor((heat - 55) * 1.2),
        commitThreshold: Math.round(110 + (heat - 55) * 2.5 + randomInt(0, 30)),
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

// Recruit preferences: each prospect gets 2-3 favorite teams (their "top
// schools" list) derived from home conference, prestige tier, and coach
// style. Favorites get 25% more effective points from the user.
// Tags are shown on the prospect card; the bump is the strategic hook.
export function assignPreferences(pool, leagueTeams, userTeamId, userCoach) {
    const confIds = [...new Set(leagueTeams.map(t => t.confId))];
    const byConf = {};
    confIds.forEach(id => byConf[id] = leagueTeams.filter(t => t.confId === id));
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];

    pool.forEach(p => {
        if (p.favorites) return; // already assigned
        const favorites = [];
        const tags = [];

        // 1. Home conference (hometown kid).
        const homeConf = pick(confIds);
        const homeTeam = pick(byConf[homeConf]);
        if (homeTeam) {
            favorites.push(homeTeam.id);
            const confName = homeTeam.confId; // tag uses conf id; UI resolves name
            tags.push({ type: 'home', confId: homeConf });
        }

        // 2. Prestige tier: Spotlight (80+), Contender (60-79), Playing time (<60).
        const tierRoll = Math.random();
        let tierTeams, tierTag;
        if (tierRoll < 0.33) { tierTeams = leagueTeams.filter(t => (t.prestige || 0) >= 80); tierTag = 'Spotlight seeker'; }
        else if (tierRoll < 0.66) { tierTeams = leagueTeams.filter(t => (t.prestige || 0) >= 60 && (t.prestige || 0) < 80); tierTag = 'Wants a contender'; }
        else { tierTeams = leagueTeams.filter(t => (t.prestige || 0) < 60); tierTag = 'Wants playing time'; }
        if (tierTeams.length) {
            const t = pick(tierTeams);
            if (!favorites.includes(t.id)) favorites.push(t.id);
            tags.push({ type: 'prestige', label: tierTag });
        }

        // 3. Coach style (50%): Development / Offense / Defense. Only the
        // user's coach has meaningful skills — invest in a skill, win these kids.
        if (Math.random() < 0.5 && userCoach) {
            const styles = [
                { key: 'development', label: 'Wants development', thresh: 8 },
                { key: 'offense', label: 'Wants offense', thresh: 8 },
                { key: 'defense', label: 'Wants defense', thresh: 8 },
            ];
            const style = pick(styles);
            const skill = (userCoach.skills || {})[style.key] || 0;
            tags.push({ type: 'coach', label: style.label });
            if (skill >= style.thresh && userTeamId && !favorites.includes(userTeamId)) {
                favorites.push(userTeamId);
            } else if (homeTeam && favorites.length < 3 && !favorites.includes(homeTeam.id)) {
                favorites.push(homeTeam.id); // fallback: another home team
            }
        }

        // Ensure 2-3 favorites.
        while (favorites.length < 2) {
            const t = pick(leagueTeams);
            if (!favorites.includes(t.id)) favorites.push(t.id);
        }

        p.favorites = favorites.slice(0, 3);
        p.prefTags = tags;
    });
    return pool;
}

// 25% point effectiveness when the user's team is a favorite.
export function preferenceMultiplier(p, userTeamId) {
    return (p.favorites && userTeamId && p.favorites.includes(userTeamId)) ? 1.25 : 1.0;
}

export function calculateRecruitingPoints(team, coach) {
    let points = 60;
    points += ((coach.skills?.recruiting || 3) * 8);
    points += ((team.prestige || 50) * 1.5);
    points += ((team.wins || 0) * 3);
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
        p.userPoints += Math.round(pts * preferenceMultiplier(p, userTeamId));
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
    let points = 35;
    points += ((coach.skills?.recruiting || 3) * 1.5);
    points += ((team.prestige || 50) * 0.35);
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
            p.userPoints += Math.round(drip * preferenceMultiplier(p, state.teamId));
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
        p.userPoints += Math.round(pts * preferenceMultiplier(p, state.teamId));
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
