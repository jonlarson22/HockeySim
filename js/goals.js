// goals.js — season goals: user picks 2 at season start, graded at season end.
// Tiers keep every team in a sensible position: basement clubs get rebuild
// goals, powers get contender goals. Each met goal nudges the season grade
// up a step, each failed goal nudges it down.

import { tourneyRuns } from './career.js';
import { nationalRank } from './engine.js';

// check(state, team) -> true when the goal was met.
export const SEASON_GOALS = [
    // ——— Rebuild tier ———
    { id: 'avoid_last', tier: 'rebuild', label: 'Avoid last place in the conference', check(s, t) {
        const mates = s.leagueTeams.filter(o => o.confId === t.confId)
            .sort((a, b) => (a.confWins || 0) - (b.confWins || 0));
        return mates[0] && mates[0].id !== t.id;
    } },
    { id: 'win_10', tier: 'rebuild', label: 'Win 10+ games', check: (s, t) => (t.wins || 0) >= 10 },
    { id: 'conf_500', tier: 'rebuild', label: 'Finish .500 or better in conference play', check: (s, t) =>
        (t.confWins || 0) >= (t.confLosses || 0) },
    { id: 'improve_5', tier: 'rebuild', label: 'Improve by 5+ wins over last season', needsHistory: true, check: (s, t) =>
        (t.wins || 0) >= (s.lastSeasonWins || 0) + 5 },
    // ——— Competitive tier ———
    { id: 'conf_top4', tier: 'competitive', label: 'Finish top 4 in the conference', check(s, t) {
        const mates = s.leagueTeams.filter(o => o.confId === t.confId)
            .sort((a, b) => (b.confWins || 0) - (a.confWins || 0));
        return mates.slice(0, 4).some(o => o.id === t.id);
    } },
    { id: 'win_15', tier: 'competitive', label: 'Win 15+ games', check: (s, t) => (t.wins || 0) >= 15 },
    { id: 'conf_winning', tier: 'competitive', label: 'Post a winning conference record', check: (s, t) =>
        (t.confWins || 0) > (t.confLosses || 0) },
    { id: 'conf_semi', tier: 'competitive', label: 'Reach the conference semifinals', check: (s, t) =>
        tourneyRuns(s, t).conf.won >= 1 },
    { id: 'beat_rival', tier: 'competitive', label: 'Win the season series vs. your rivals', check(s, t) {
        if (!t.rivals || !t.rivals.length) return false;
        let w = 0, l = 0;
        for (const wk of s.schedule) for (const g of (wk || [])) {
            if (!g.played) continue;
            const mine = g.homeTeamId === t.id, theirs = g.awayTeamId === t.id;
            if (!mine && !theirs) continue;
            const opp = mine ? g.awayTeamId : g.homeTeamId;
            if (!t.rivals.includes(opp)) continue;
            const won = (mine && g.homeScore > g.awayScore) || (theirs && g.awayScore > g.homeScore);
            won ? w++ : l++;
        }
        return w > 0 && w >= l;
    } },
    // ——— Contender tier ———
    { id: 'conf_champ', tier: 'contender', label: 'Win the conference (best record)', check(s, t) {
        const mates = s.leagueTeams.filter(o => o.confId === t.confId)
            .sort((a, b) => (b.confWins || 0) - (a.confWins || 0));
        return mates[0] && mates[0].id === t.id;
    } },
    { id: 'conf_tourney', tier: 'contender', label: 'Win the conference tournament', check: (s, t) =>
        tourneyRuns(s, t).conf.won >= 3 },
    { id: 'make_nats', tier: 'contender', label: 'Earn a national tournament bid', check: (s, t) =>
        tourneyRuns(s, t).nat.played },
    { id: 'nat_semi', tier: 'contender', label: 'Reach the national semifinals', check: (s, t) =>
        tourneyRuns(s, t).nat.won >= 3 },
    { id: 'win_nats', tier: 'contender', label: 'Win the national championship', check: (s, t) =>
        tourneyRuns(s, t).nat.won >= 4 },
    { id: 'top10', tier: 'contender', label: 'Finish ranked in the national top 10', check: (s, t) =>
        nationalRank(s.leagueTeams, t.id, s.schedule) <= 10 },
];

export function getGoal(id) { return SEASON_GOALS.find(g => g.id === id); }

// Suggest a tier based on where the team starts the season.
export function suggestedTier(prestige) {
    if (prestige < 50) return 'rebuild';
    if (prestige < 70) return 'competitive';
    return 'contender';
}

// Evaluate the user's picked goals. Returns [{ id, label, tier, met }].
export function evaluateSeasonGoals(state, team) {
    return (state.seasonGoals || []).map(id => {
        const g = getGoal(id);
        if (!g) return null;
        let met = false;
        try { met = !!g.check(state, team); } catch (e) { met = false; }
        return { id: g.id, label: g.label, tier: g.tier, met };
    }).filter(Boolean);
}

// Nudge a grade result ('missed'|'met'|'exceeded') by net goal outcomes.
export function applyGoalOutcomes(result, evaluated) {
    const order = ['missed', 'met', 'exceeded'];
    let i = order.indexOf(result);
    if (i < 0) i = 0;
    for (const g of evaluated) i += g.met ? 1 : -1;
    return order[Math.max(0, Math.min(2, i))];
}
