// screens/gameDay.js — period-by-period replay of the user's game.
// The week was already simmed (every league game sims instantly); the event
// log recorded at sim time lets the user watch their game unfold.
import { getState, getUserTeam } from '../store.js';
import { showScreen } from '../router.js';
import { esc, scheduleLabel } from '../ui.js';

const PERIOD_LABEL = { 1: '1st Period', 2: '2nd Period', 3: '3rd Period', 4: 'Overtime' };

function fmtTime(e) {
    return `${e.minute}:${String(e.second).padStart(2, '0')}`;
}

function record(t) {
    return `${t.wins || 0}-${t.losses || 0}-${t.otl || 0}`;
}

export function render(container, params) {
    const s = getState();
    const team = getUserTeam();
    const weekIndex = params.weekIndex || 0;
    const game = (s.schedule[weekIndex] || []).find(g => g.homeTeamId === team.id || g.awayTeamId === team.id);
    if (!game || !game.events) {
        showScreen('weekly-recap', { weekIndex, confId: params.confId || team.confId });
        return;
    }

    const home = s.leagueTeams.find(t => t.id === game.homeTeamId);
    const away = s.leagueTeams.find(t => t.id === game.awayTeamId);
    const events = game.events;
    const hasOT = game.ot && events.some(e => e.period === 4);
    const steps = ['pregame', 1, 2, 3, ...(hasOT ? [4] : []), 'final'];
    let stepIdx = 0;

    const scoreLine = (a, h) => `${esc(away.abbr)} ${a} – ${h} ${esc(home.abbr)}`;

    const paint = () => {
        const step = steps[stepIdx];

        if (step === 'pregame') {
            container.innerHTML = `
                <div class="dashboard-panel text-center" style="max-width: 640px; margin: 0 auto;">
                    <p style="color:#888;margin:0;">${scheduleLabel(weekIndex + 1)}</p>
                    <h2 style="margin: 10px 0;">${esc(away.name)} <span style="color:#888;">(${record(away)})</span></h2>
                    <p style="color:#888;margin:0;">at</p>
                    <h2 style="margin: 10px 0;">${esc(home.name)} <span style="color:#888;">(${record(home)})</span></h2>
                    <div style="display:flex;gap:10px;justify-content:center;margin-top:20px;">
                        <button id="gd-start" class="primary" style="width:auto;">Drop the Puck</button>
                        <button id="gd-skip" class="secondary" style="width:auto;">Sim to End</button>
                    </div>
                </div>`;
            container.querySelector('#gd-start').onclick = () => { stepIdx++; paint(); };
            container.querySelector('#gd-skip').onclick = () => { stepIdx = steps.indexOf('final'); paint(); };
            return;
        }

        if (step === 'final') {
            const tot = a => a.reduce((x, y) => x + y, 0);
            const finalShots = game.shots ? `
                <p style="color:#888;margin:10px 0 0;">Shots: ${esc(away.abbr)} ${tot(game.shots.shots.away)} – ${tot(game.shots.shots.home)} ${esc(home.abbr)}
                <span style="margin:0 8px;">·</span>Saves: ${tot(game.shots.saves.away)} – ${tot(game.shots.saves.home)}</p>` : '';
            container.innerHTML = `
                <div class="dashboard-panel text-center" style="max-width: 640px; margin: 0 auto;">
                    <p style="color:#888;margin:0;">FINAL${game.ot ? ' (OT)' : ''}</p>
                    <h2 style="margin: 15px 0; font-size: 2em;">${scoreLine(game.awayScore, game.homeScore)}</h2>
                    ${finalShots}
                    <button id="gd-continue" class="primary" style="width:auto;">Continue</button>
                </div>`;
            container.querySelector('#gd-continue').onclick = () =>
                showScreen('weekly-recap', { weekIndex, confId: params.confId || team.confId });
            return;
        }

        // A period.
        const evs = events.filter(e => e.period === step);
        const last = evs[evs.length - 1];
        const endScore = last ? scoreLine(last.awayScore, last.homeScore) : scoreLine(0, 0);
        const rows = evs.length ? evs.map((e, i) => {
            const t = e.teamId === home.id ? home : away;
            const assists = e.assists.length
                ? `<div style="color:#888;font-size:0.85em;">${e.assists.map(esc).join(', ')}</div>` : '';
            return `
                <div class="event-row" style="animation-delay:${(i * 0.45).toFixed(2)}s;">
                    <span style="color:#888;min-width:44px;">${fmtTime(e)}</span>
                    <span style="background:${t.color};color:#fff;padding:2px 6px;border-radius:4px;font-size:0.75em;font-weight:bold;">${esc(t.abbr)}</span>
                    <span style="flex:1;"><strong>${esc(e.scorer)}</strong>${assists}</span>
                    <span style="font-weight:bold;white-space:nowrap;">${e.awayScore} – ${e.homeScore}</span>
                </div>`;
        }).join('') : '<p style="color:#888;">No scoring.</p>';

        const nextStep = steps[stepIdx + 1];
        const nextLabel = nextStep === 'final' ? 'Final' : PERIOD_LABEL[nextStep];
        const perShots = game.shots ? `
            <div style="color:#888;font-size:0.9em;margin:-8px 0 12px;">
                Shots: ${esc(away.abbr)} ${game.shots.shots.away[step - 1]} – ${game.shots.shots.home[step - 1]} ${esc(home.abbr)}
                <span style="margin:0 8px;">·</span>Saves: ${game.shots.saves.away[step - 1]} – ${game.shots.saves.home[step - 1]}
            </div>` : '';

        container.innerHTML = `
            <div class="dashboard-panel" style="max-width: 760px; margin: 0 auto;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
                    <h2 style="margin:0;">${PERIOD_LABEL[step]}</h2>
                    <span style="color:var(--accent);font-weight:bold;">${endScore}</span>
                </div>
                ${perShots}
                ${rows}
                <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:15px;">
                    <button id="gd-skip" class="secondary" style="width:auto;">Sim to End</button>
                    <button id="gd-next" class="primary" style="width:auto;">${nextLabel} →</button>
                </div>
            </div>`;
        container.querySelector('#gd-next').onclick = () => { stepIdx++; paint(); };
        container.querySelector('#gd-skip').onclick = () => { stepIdx = steps.indexOf('final'); paint(); };
    };

    paint();
}
