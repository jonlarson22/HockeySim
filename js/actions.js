// actions.js — shared game actions used by multiple screens.
// Each action mutates state through the store (which autosaves).

import { getState, update } from './store.js';
import { showScreen } from './router.js';
import { simulateWeek, processOffSeason, enforceRosterLimits, generateSeasonSchedule, generatePlayer, nationalRank } from './engine.js';
import { gradeSeason, applySeasonConsequences, awardCoachXP, jobOffers, firedOpenings } from './career.js';
import { generateProspectPool, processRecruitingWeek, processInseasonWeek, processRecruitWindow, applyPoolTurnover, INSEASON_WINDOW_WEEKS, MAX_RECRUIT_TARGETS } from './recruiting.js';
import { conferences } from './data.js';

// Simulates the current week for the whole league.
// Returns { weekIndex, seasonActive }.
export function simCurrentWeek() {
    const weekIndex = getState().currentWeek - 1;
    let seasonActive = false;
    update(state => {
        seasonActive = simulateWeek(state);
        // In-season recruiting background: lazy pool for migrated saves,
        // then the target-board drip + phantom rival creep.
        if (!state.prospectPool || !state.prospectPool.length) {
            state.prospectPool = generateProspectPool();
            state.recruitTargets = [];
        }
        processInseasonWeek(state);
    });
    return { weekIndex, seasonActive };
}

// Routes after a sim: season recap when the year is done, the recruiting
// window when one opens, the game-day replay when the user's team played,
// otherwise the weekly recap.
export function goAfterSimWeek(weekIndex, seasonActive) {
    const s = getState();
    const team = s.leagueTeams.find(t => t.id === s.teamId);
    if (!seasonActive) { showScreen('season-recap'); return; }
    const myGame = (s.schedule[weekIndex] || []).find(g => g.homeTeamId === team.id || g.awayTeamId === team.id);
    if (INSEASON_WINDOW_WEEKS.includes(weekIndex + 1)) {
        showScreen('recruit-window', { weekIndex, confId: team.confId, hadGame: !!(myGame && myGame.events) });
        return;
    }
    if (myGame && myGame.events) showScreen('game-day', { weekIndex, confId: team.confId });
    else showScreen('weekly-recap', { weekIndex, confId: team.confId });
}

// Records the finished season in coach history, runs offseason progression,
// and opens the 5-week recruiting period. Called from the season recap screen.
export function beginOffseason() {
    update(state => {
        processOffSeason(state);
        refillAIRosters(state);
        state.recruitingWeek = 1;
        state.recruitWeekAlloc = {};
        // Same pool the user courted all season, with light turnover —
        // never a prospect they showed interest in.
        if (state.prospectPool && state.prospectPool.length) applyPoolTurnover(state.prospectPool);
        else state.prospectPool = generateProspectPool();
        state.recruitTargets = [];
        state.seasonResolution = null;
    });
}

// AI programs refill their rosters with generated freshmen to cover graduates.
// (Their recruiting was never simulated — without this their rosters would
// shrink every season.)
function refillAIRosters(state) {
    state.leagueTeams.forEach(t => {
        if (t.id === state.teamId) return;
        const want = { G: 3, D: 8, F: 15 };
        const have = { G: t.roster.goalies.length, D: t.roster.defensemen.length, F: t.roster.forwards.length };
        ['G', 'D', 'F'].forEach(pos => {
            for (let i = have[pos]; i < want[pos]; i++) {
                const p = generatePlayer(pos, t.prestige);
                p.year = 'Fr';
                if (pos === 'G') t.roster.goalies.push(p);
                else if (pos === 'D') t.roster.defensemen.push(p);
                else t.roster.forwards.push(p);
            }
        });
    });
}

// Submits the user's point allocations for the current recruiting week.
// Returns { logs, done } — done when all 5 weeks are complete.
// Grades the finished season, applies prestige/XP consequences, and decides
// the coach's fate. Called once from the season recap screen; the carousel
// screen then presents the outcome.
export function resolveSeason() {
    update(state => {
        const team = state.leagueTeams.find(t => t.id === state.teamId);
        const grade = gradeSeason(state, team);
        state.coach.history.push({
            year: state.year,
            teamName: team ? team.name : '—',
            wins: team ? team.wins || 0 : 0,
            losses: team ? team.losses || 0 : 0,
            otl: team ? team.otl || 0 : 0,
            rank: nationalRank(state.leagueTeams, state.teamId),
            result: grade.result,
            expectation: grade.expectation
        });
        applySeasonConsequences(state, team, grade);
        const xpGained = awardCoachXP(state, team, grade);
        const fired = (state.coach.missStreak || 0) >= 2;
        if (fired) state.coach.prestige = Math.max(1, (state.coach.prestige ?? 15) - 10);
        state.seasonResolution = {
            grade,
            fired,
            xpGained,
            offers: fired ? [] : jobOffers(state).map(t => t.id),
            openings: fired ? firedOpenings(state).map(t => t.id) : []
        };
    });
}

export function changeTeam(teamId) {
    update(state => { state.teamId = teamId; });
}

export function submitRecruitingWeek() {
    let logs = [];
    let done = false;
    update(state => {
        logs = processRecruitingWeek(state, state.recruitWeekAlloc || {});
        state.recruitWeekAlloc = {};
        state.recruitingWeek = (state.recruitingWeek || 1) + 1;
        if (state.recruitingWeek > 5) {
            finalizeOffseason(state);
            done = true;
        }
    });
    return { logs, done };
}

// Submits an in-season recruiting window. Points bank as early interest;
// nothing signs in-season. Routing is left to the calling screen.
export function submitRecruitWindow() {
    let touched = 0;
    update(state => {
        const res = processRecruitWindow(state, state.recruitWeekAlloc || {});
        touched = res.touched;
        state.recruitWeekAlloc = {};
    });
    return { touched };
}

// Stars/unstars a prospect on the in-season target board (max 5).
// Returns 'added', 'removed', 'full', or 'invalid'.
export function toggleRecruitTarget(prospectId) {
    let result = 'invalid';
    update(state => {
        const pool = state.prospectPool || [];
        const p = pool.find(x => x.id === prospectId);
        if (!p || p.signedBy) { result = 'invalid'; return; }
        const targets = state.recruitTargets || (state.recruitTargets = []);
        const idx = targets.indexOf(prospectId);
        if (idx >= 0) { targets.splice(idx, 1); result = 'removed'; }
        else if (targets.length >= MAX_RECRUIT_TARGETS) { result = 'full'; }
        else { targets.push(prospectId); p.isUserTarget = true; result = 'added'; }
    });
    return result;
}

function finalizeOffseason(state) {
    const team = state.leagueTeams.find(t => t.id === state.teamId);
    const pool = state.prospectPool || [];
    if (team) {
        pool.filter(p => p.signedBy === state.teamId).forEach(p => {
            if (p.position === 'G') team.roster.goalies.push(p);
            else if (p.position === 'D') team.roster.defensemen.push(p);
            else team.roster.forwards.push(p);
        });
        // Walk-on safety net: a whiffed recruiting class can't leave the
        // program unable to ice a team. These are warm bodies, not prospects.
        [['G', 'goalies', 2], ['D', 'defensemen', 6], ['F', 'forwards', 12]].forEach(([pos, key, min]) => {
            while (team.roster[key].length < min) {
                const w = generatePlayer(pos, 20);
                w.year = 'Fr';
                team.roster[key].push(w);
            }
        });
        enforceRosterLimits(team.roster);
    }
    // Zero every record for the new season.
    state.leagueTeams.forEach(t => {
        t.wins = 0; t.losses = 0; t.otl = 0;
        t.confWins = 0; t.confLosses = 0; t.confOtl = 0;
    });
    state.year++;
    state.currentWeek = 1;
    state.schedule = generateSeasonSchedule(state.leagueTeams, conferences);
    state.recruitingWeek = 0;
    state.recruitWeekAlloc = {};
    state.recruitTargets = [];
    // Fresh class to court during the new season.
    state.prospectPool = generateProspectPool();
}
