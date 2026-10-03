// portal.js — the transfer portal (offseason, before freshman recruiting).
//
// Phase 1 (planTransferPortal, BEFORE processOffSeason): decides who enters,
// using roleWeeks while they're still intact. Snapshots season stats.
// Phase 2 (buildTransferPortal, AFTER processOffSeason): removes AI entrants
// from rosters into state.transferPortal. User's flagged players stay put
// until the portal screen resolves (retain or let walk).
// Phase 3 (processPortalSubmit): user signs/retains, then AI picks up.

import { calculateRecruitingPoints } from './recruiting.js';
import { enforceRosterLimits } from './engine.js';

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Stars never transfer: top 6 F, top 4 D, starting G by OVR are protected.
function protectedIds(team) {
    const ids = new Set();
    [...team.roster.forwards].sort((a, b) => b.overall - a.overall).slice(0, 6).forEach(p => ids.add(p.id));
    [...team.roster.defensemen].sort((a, b) => b.overall - a.overall).slice(0, 4).forEach(p => ids.add(p.id));
    [...team.roster.goalies].sort((a, b) => b.overall - a.overall).slice(0, 1).forEach(p => ids.add(p.id));
    return ids;
}

function snapshotStats(p) {
    return {
        g: p.seasonGoals || 0, a: p.seasonAssists || 0, pim: p.seasonPIM || 0,
        pm: p.seasonPlusMinus || 0, ppg: p.seasonPPG || 0,
        w: p.seasonWins || 0, l: p.seasonLosses || 0, so: p.seasonShutouts || 0,
        svpct: p.seasonShotsAgainst ? (p.seasonSaves / p.seasonShotsAgainst * 100).toFixed(1) : null
    };
}

// Portal commit threshold: ~20 pts below a comparable freshman (transfers
// shop for playing time, they aren't being wooed). No rival bidding.
export function portalThreshold(player) {
    return Math.round(90 + Math.max(0, (player.overall || 60) - 60) * 2 + randomInt(0, 20));
}

export function retentionCost(player) {
    return Math.round(30 + Math.max(0, (player.overall || 65) - 65) * 1.5);
}

export function planTransferPortal(state) {
    const userTeamId = state.teamId;
    const decisions = []; // { playerId, teamId, reason, stats }
    const userConsidering = []; // playerIds on the user team

    state.leagueTeams.forEach(team => {
        const isUser = team.id === userTeamId;
        const prot = protectedIds(team);
        const candidates = [];
        for (const key of ['forwards', 'defensemen', 'goalies']) {
            team.roster[key].forEach(p => {
                if (p.year === 'Sr') return; // graduating anyway
                if (prot.has(p.id)) return; // stars never transfer
                candidates.push(p);
            });
        }
        // Most likely to leave: barely played, then lowest OVR.
        candidates.sort((a, b) => {
            const aa = (a.roleWeeks || {}).active || 0, bb = (b.roleWeeks || {}).active || 0;
            if (aa !== bb) return aa - bb;
            return a.overall - b.overall;
        });
        const count = isUser ? Math.min(2, candidates.length) : (candidates.length ? 1 + (Math.random() < 0.5 ? 1 : 0) : 0);
        for (let i = 0; i < count && i < candidates.length; i++) {
            const p = candidates[i];
            const active = (p.roleWeeks || {}).active || 0;
            const reason = active <= 8 ? 'Seeking playing time' : 'Change of scenery';
            if (isUser) {
                p.consideringTransfer = true;
                p.retentionCost = retentionCost(p);
                p.transferReason = active <= 8 ? 'Wants a bigger role' : 'Change of scenery';
                userConsidering.push(p.id);
            } else {
                decisions.push({ playerId: p.id, teamId: team.id, teamName: team.name, reason, stats: snapshotStats(p) });
            }
        }
    });

    state._portalDecisions = decisions;
    state._userConsidering = userConsidering;
}

export function buildTransferPortal(state) {
    const portal = [];
    for (const d of state._portalDecisions || []) {
        const team = state.leagueTeams.find(t => t.id === d.teamId);
        if (!team) continue;
        let player = null;
        for (const key of ['forwards', 'defensemen', 'goalies']) {
            const idx = team.roster[key].findIndex(p => p.id === d.playerId);
            if (idx >= 0) { player = team.roster[key].splice(idx, 1)[0]; break; }
        }
        if (!player) continue;
        player.portalFromId = d.teamId;
        player.portalFromName = d.teamName;
        player.transferReason = d.reason;
        player.portalStats = d.stats;
        player.portalThreshold = portalThreshold(player);
        player.portalUserPoints = 0;
        portal.push(player);
    }
    state.transferPortal = portal;
    state._portalDecisions = null;
}

// allocations: { playerId: points }. retainIds: playerIds to keep.
// Returns { signed: [], retained: [], walked: [], spent }.
export function processPortalSubmit(state, allocations, retainIds) {
    const userTeamId = state.teamId;
    const team = state.leagueTeams.find(t => t.id === userTeamId);
    const result = { signed: [], retained: [], walked: [], spent: 0 };
    if (!team) return result;

    // 1. Retention: user's flagged players.
    const considering = [];
    for (const key of ['forwards', 'defensemen', 'goalies']) {
        team.roster[key].forEach(p => { if (p.consideringTransfer) considering.push({ p, key }); });
    }
    for (const { p, key } of considering) {
        if ((retainIds || []).includes(p.id)) {
            result.spent += p.retentionCost || 0;
            p.consideringTransfer = false;
            delete p.retentionCost;
            delete p.transferReason;
            result.retained.push(p);
        } else {
            // Let walk: transfers out of the sim.
            const idx = team.roster[key].findIndex(x => x.id === p.id);
            if (idx >= 0) team.roster[key].splice(idx, 1);
            result.walked.push(p);
        }
    }

    // 2. Portal signings: single-shot, threshold clears.
    const portal = state.transferPortal || [];
    for (const [id, pts] of Object.entries(allocations || {})) {
        if (pts <= 0) continue;
        const p = portal.find(x => x.id === id);
        if (!p) continue;
        result.spent += pts;
        if (pts >= (p.portalThreshold || 9999)) {
            const idx = portal.findIndex(x => x.id === id);
            portal.splice(idx, 1)[0];
            p.status = 'Active Roster';
            delete p.portalFromId; delete p.portalFromName;
            delete p.transferReason; delete p.portalThreshold; delete p.portalUserPoints;
            if (p.position === 'G') team.roster.goalies.push(p);
            else if (p.position === 'D') team.roster.defensemen.push(p);
            else team.roster.forwards.push(p);
            result.signed.push(p);
        }
    }
    enforceRosterLimits(team.roster);

    // 3. AI pickup from what's left, then stragglers return home.
    aiPortalPickup(state);
    for (const p of state.transferPortal || []) {
        const home = state.leagueTeams.find(t => t.id === p.portalFromId);
        if (home) {
            p.status = 'Active Roster';
            delete p.portalFromId; delete p.portalFromName;
            delete p.transferReason; delete p.portalThreshold; delete p.portalUserPoints;
            delete p.portalStats;
            if (p.position === 'G') home.roster.goalies.push(p);
            else if (p.position === 'D') home.roster.defensemen.push(p);
            else home.roster.forwards.push(p);
            enforceRosterLimits(home.roster);
        }
    }
    state.transferPortal = [];
    state.portalSpent = (state.portalSpent || 0) + result.spent;
    return result;
}

// Each AI team takes up to 2 portal players at its thinnest position.
function aiPortalPickup(state) {
    const portal = state.transferPortal || [];
    if (!portal.length) return;
    state.leagueTeams.forEach(team => {
        if (team.id === state.teamId) return;
        const counts = {
            F: team.roster.forwards.length,
            D: team.roster.defensemen.length,
            G: team.roster.goalies.length
        };
        const need = counts.F < 12 ? 'F' : counts.D < 6 ? 'D' : counts.G < 2 ? 'G' : null;
        if (!need) return;
        const options = portal.filter(p => p.position === need || (need === 'F' && p.position !== 'G' && p.position !== 'D'))
            .sort((a, b) => b.overall - a.overall).slice(0, 2);
        for (const p of options) {
            const idx = portal.findIndex(x => x.id === p.id);
            if (idx < 0) continue;
            portal.splice(idx, 1)[0];
            p.status = 'Active Roster';
            delete p.portalFromId; delete p.portalFromName;
            delete p.transferReason; delete p.portalThreshold; delete p.portalUserPoints;
            delete p.portalStats;
            if (p.position === 'G') team.roster.goalies.push(p);
            else if (p.position === 'D') team.roster.defensemen.push(p);
            else team.roster.forwards.push(p);
        }
        enforceRosterLimits(team.roster);
    });
}

// One-week portal budget (same formula as a recruiting week).
export function portalBudget(state) {
    const team = state.leagueTeams.find(t => t.id === state.teamId);
    return calculateRecruitingPoints(team, state.coach);
}

// Freshman week budget: week 1 is reduced by portal spending (shared pool).
export function freshmanWeekBudget(state, week) {
    const base = portalBudget(state);
    if (week === 1) return Math.max(0, base - (state.portalSpent || 0));
    return base;
}
