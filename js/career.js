// career.js — expectations, prestige, coach XP, job carousel logic.

const CONF_WEEKS = [
    { idx: 38, label: 'Quarterfinals' },
    { idx: 39, label: 'Semifinals' },
    { idx: 40, label: 'Finals' }
];
const NAT_WEEKS = [
    { idx: 41, label: 'Round of 32' },
    { idx: 42, label: 'Round of 16' },
    { idx: 43, label: 'Quarterfinals' },
    { idx: 44, label: 'Semifinals' },
    { idx: 45, label: 'Championship' }
];

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function rand(lo, hi) { return Math.floor(Math.random() * (hi - lo + 1)) + lo; }

// How far the team went in each tournament: rounds won, whether they
// appeared at all, and a display label.
export function tourneyRuns(state, team) {
    const summarize = (weeks, filter) => {
        let won = 0, played = false;
        for (const { idx, label } of weeks) {
            const games = (state.schedule[idx] || []).filter(filter);
            const myGame = games.find(g => g.homeTeamId === team.id || g.awayTeamId === team.id);
            if (!myGame) break;
            played = true;
            const winnerId = myGame.homeScore > myGame.awayScore ? myGame.homeTeamId : myGame.awayTeamId;
            if (winnerId !== team.id) return { won, played, label: `Lost in ${label}` };
            won++;
        }
        if (!played) return { won: 0, played: false, label: 'Did not qualify' };
        return { won, played, label: 'Champions' };
    };
    return {
        conf: summarize(CONF_WEEKS, g => g.type === 'conf_tourney' && g.confId === team.confId),
        nat: summarize(NAT_WEEKS, g => g.type === 'national_tourney' || g.isNational)
    };
}

// Expectation tier from the prestige the team carried into the season.
export function expectationFor(prestige) {
    if (prestige >= 80) return { key: 'contend', label: 'Reach the National Semifinals' };
    if (prestige >= 65) return { key: 'tourney', label: 'Reach the National Tournament' };
    if (prestige >= 50) return { key: 'winning', label: 'Post a winning record' };
    return { key: 'modest', label: 'Win at least 10 games' };
}

export function gradeSeason(state, team) {
    const exp = expectationFor(team.prestige);
    const runs = tourneyRuns(state, team);
    const wins = team.wins || 0, losses = team.losses || 0;
    const nat = runs.nat;
    let result = 'missed';
    switch (exp.key) {
        case 'contend':
            if (nat.won >= 4) result = 'exceeded';
            else if (nat.won >= 3) result = 'met';
            break;
        case 'tourney':
            if (nat.won >= 2) result = 'exceeded';
            else if (nat.played) result = 'met';
            break;
        case 'winning':
            if (wins > losses && nat.played) result = 'exceeded';
            else if (wins > losses) result = 'met';
            break;
        case 'modest':
            if (wins > losses) result = 'exceeded';
            else if (wins >= 10) result = 'met';
            break;
    }
    return {
        expectation: exp.label,
        result,
        confRounds: runs.conf.won,
        natRounds: nat.won,
        champion: nat.won >= 5,
        confChampion: runs.conf.won >= 3,
        confLabel: runs.conf.label,
        natLabel: nat.label
    };
}

// Team prestige drift, coach prestige, and the consecutive-miss streak.
export function applySeasonConsequences(state, team, grade) {
    const coach = state.coach;
    coach.missStreak = grade.result === 'missed' ? (coach.missStreak || 0) + 1 : 0;

    const drift = grade.result === 'exceeded' ? 3 : grade.result === 'met' ? 1 : -2;
    team.prestige = clamp(team.prestige + drift + rand(-1, 1), 1, 99);

    let cDelta = grade.result === 'exceeded' ? 8 : grade.result === 'met' ? 3 : -5;
    if (grade.champion) cDelta += 10;
    else if (grade.confChampion) cDelta += 4;
    coach.prestige = clamp((coach.prestige ?? 15) + cDelta, 1, 99);
}

// XP for the season; every 150 XP is a level worth 2 spendable skill points.
export function awardCoachXP(state, team, grade) {
    const coach = state.coach;
    let xp = (team.wins || 0) * 10;
    if (grade.confRounds >= 3) xp += 75;
    else if (grade.confRounds >= 2) xp += 25;
    if (grade.natRounds >= 4) xp += 150;
    else if (grade.natRounds >= 3) xp += 75;
    else if (grade.natRounds >= 2) xp += 40;
    else if (grade.natRounds >= 1) xp += 15;
    coach.xp = (coach.xp || 0) + xp;
    const newLevel = Math.floor(coach.xp / 150) + 1;
    const oldLevel = coach.level || 1;
    if (newLevel > oldLevel) {
        coach.unspentPoints = (coach.unspentPoints || 0) + (newLevel - oldLevel) * 2;
        coach.level = newLevel;
    }
    return xp;
}

export function requiredPrestige(teamPrestige) {
    if (teamPrestige >= 80) return 55;
    if (teamPrestige >= 65) return 30;
    return 15;
}

// Programs a rung above the current one that would hire this coach.
export function jobOffers(state) {
    const coach = state.coach;
    const team = state.leagueTeams.find(t => t.id === state.teamId);
    return state.leagueTeams
        .filter(t => t.id !== team.id)
        .filter(t => t.prestige > team.prestige + 4)
        .filter(t => (coach.prestige ?? 15) >= requiredPrestige(t.prestige))
        .sort((a, b) => b.prestige - a.prestige)
        .slice(0, 3);
}

// Openings for a fired coach: back to the tier-3 board.
export function firedOpenings(state) {
    return state.leagueTeams
        .filter(t => t.prestige <= 59)
        .sort(() => 0.5 - Math.random())
        .slice(0, Math.floor(Math.random() * 2) + 2);
}
