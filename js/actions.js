// actions.js — shared game actions used by multiple screens.
// Each action mutates state through the store (which autosaves).

import { getState, update } from './store.js';
import { showScreen } from './router.js';
import { simulateWeek, processOffSeason, enforceRosterLimits, generateSeasonSchedule, generatePlayer, nationalRank } from './engine.js';
import { generateProspectPool, processRecruitingWeek } from './recruiting.js';
import { conferences } from './data.js';

// Simulates the current week for the whole league.
// Returns { weekIndex, seasonActive }.
export function simCurrentWeek() {
    const weekIndex = getState().currentWeek - 1;
    let seasonActive = false;
    update(state => {
        seasonActive = simulateWeek(state);
    });
    return { weekIndex, seasonActive };
}

// Routes after a sim: season recap when the year is done, the game-day
// replay when the user's team played, otherwise the weekly recap.
export function goAfterSimWeek(weekIndex, seasonActive) {
    const s = getState();
    const team = s.leagueTeams.find(t => t.id === s.teamId);
    if (!seasonActive) { showScreen('season-recap'); return; }
    const myGame = (s.schedule[weekIndex] || []).find(g => g.homeTeamId === team.id || g.awayTeamId === team.id);
    if (myGame && myGame.events) showScreen('game-day', { weekIndex, confId: team.confId });
    else showScreen('weekly-recap', { weekIndex, confId: team.confId });
}

// Records the finished season in coach history, runs offseason progression,
// and opens the 5-week recruiting period. Called from the season recap screen.
export function beginOffseason() {
    update(state => {
        const team = state.leagueTeams.find(t => t.id === state.teamId);
        state.coach.history.push({
            year: state.year,
            teamName: team ? team.name : '—',
            wins: team ? team.wins || 0 : 0,
            losses: team ? team.losses || 0 : 0,
            otl: team ? team.otl || 0 : 0,
            rank: nationalRank(state.leagueTeams, state.teamId)
        });
        processOffSeason(state);
        refillAIRosters(state);
        state.recruitingWeek = 1;
        state.recruitWeekAlloc = {};
        state.prospectPool = generateProspectPool();
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

function finalizeOffseason(state) {
    const team = state.leagueTeams.find(t => t.id === state.teamId);
    const pool = state.prospectPool || [];
    if (team) {
        pool.filter(p => p.signedBy === state.teamId).forEach(p => {
            if (p.position === 'G') team.roster.goalies.push(p);
            else if (p.position === 'D') team.roster.defensemen.push(p);
            else team.roster.forwards.push(p);
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
    state.prospectPool = [];
    state.recruitWeekAlloc = {};
}
