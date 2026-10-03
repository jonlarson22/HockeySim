// screens/seasonRecap.js — end-of-season summary, gateway to the offseason.
// Rendered BEFORE beginOffseason() runs, so record/graduates reflect the
// season that just ended.
import { getState, getUserTeam } from '../store.js';
import { showScreen } from '../router.js';
import { beginOffseason } from '../actions.js';
import { nationalRank } from '../engine.js';
import { tourneyRuns } from '../career.js';
import { conferences } from '../data.js';
import { esc } from '../ui.js';

function confFinish(state, team) {
    const sorted = [...state.leagueTeams]
        .filter(t => t.confId === team.confId)
        .sort((a, b) => {
            const acp = (a.confWins || 0) * 2 + (a.confOtl || 0);
            const bcp = (b.confWins || 0) * 2 + (b.confOtl || 0);
            if (bcp !== acp) return bcp - acp;
            const aop = (a.wins || 0) * 2 + (a.otl || 0);
            const bop = (b.wins || 0) * 2 + (b.otl || 0);
            if (bop !== aop) return bop - aop;
            return b.prestige - a.prestige;
        });
    return sorted.findIndex(t => t.id === team.id) + 1;
}

function ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function allPlayers(team) {
    return [...team.roster.forwards, ...team.roster.defensemen, ...team.roster.goalies];
}

export function render(container) {
    const s = getState();
    const team = getUserTeam();
    const rank = nationalRank(s.leagueTeams, team.id);
    const conf = conferences.find(c => c.id === team.confId);
    const grads = allPlayers(team).filter(p => p.year === 'Sr');
    const runs = tourneyRuns(s, team);
    const confRun = runs.conf.label;
    const natRun = runs.nat.label;

    container.innerHTML = `
        <div class="dashboard-panel" style="max-width: 1000px; margin: 0 auto;">
            <h2>Season Recap — ${s.year}</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
                <div>
                    <h3>Regular Season Record</h3>
                    <p style="font-size: 1.3em; color: var(--accent);">${team.wins || 0}-${team.losses || 0}-${team.otl || 0}</p>
                    <h3 style="margin-top: 20px;">Conference Finish</h3>
                    <p style="font-size: 1.1em;">${ordinal(confFinish(s, team))} in ${esc(conf.name)}</p>
                    <h3 style="margin-top: 20px;">National Ranking</h3>
                    <p style="font-size: 1.1em; color: var(--accent);">${rank <= 25 ? '#' + rank : 'Unranked'}</p>
                </div>
                <div>
                    <h3>Conference Tournament</h3>
                    <p style="font-size: 0.9em;">${esc(confRun)}</p>
                    <h3 style="margin-top: 20px;">National Tournament</h3>
                    <p style="font-size: 0.9em;">${esc(natRun)}</p>
                    <h3 style="margin-top: 20px;">Graduating Players</h3>
                    <div style="font-size: 0.9em; max-height: 150px; overflow-y: auto;">
                        ${grads.length ? grads.map(p => `<div>${esc(p.firstName)} ${esc(p.lastName)} <span style="color:#aaa;">(${p.position}, OVR ${p.overall})</span></div>`).join('') : '<span style="color:#888;">None</span>'}
                    </div>
                </div>
            </div>
            <button id="recap-offseason" class="primary" style="width: 100%; margin-top: 20px;">Proceed to Offseason Recruiting</button>
        </div>`;

    container.querySelector('#recap-offseason').onclick = () => {
        beginOffseason();
        showScreen('recruiting');
    };
}
