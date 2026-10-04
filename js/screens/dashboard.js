// screens/dashboard.js — in-season hub.
import { getState, getUserTeam, update } from '../store.js';
import { showScreen } from '../router.js';
import { simCurrentWeek, goAfterSimWeek } from '../actions.js';
import { pollScore, TRAINING_FOCUSES } from '../engine.js';
import { getLines, lineChemistry } from '../lines.js';
import { dripPerWeek, MAX_RECRUIT_TARGETS } from '../recruiting.js';
import { conferences } from '../data.js';
import { esc, scheduleLabel } from '../ui.js';


export function render(container) {
    const s = getState();
    const team = getUserTeam();

    let nextText;
    if (s.currentWeek > s.schedule.length) {
        nextText = 'Season Complete';
    } else {
        const weekGames = s.schedule[s.currentWeek - 1] || [];
        const myGame = weekGames.find(g => g.homeTeamId === team.id || g.awayTeamId === team.id);
        if (myGame) {
            const isHome = myGame.homeTeamId === team.id;
            const opp = s.leagueTeams.find(t => t.id === (isHome ? myGame.awayTeamId : myGame.homeTeamId));
            nextText = `${scheduleLabel(s.currentWeek)} ${isHome ? 'vs.' : '@'} ${opp.abbr || opp.name}`;
        } else {
            nextText = `${scheduleLabel(s.currentWeek)} — BYE`;
        }
    }

    const top25 = [...s.leagueTeams].sort((a, b) => pollScore(b, s.leagueTeams, s.schedule) - pollScore(a, s.leagueTeams, s.schedule)).slice(0, 25);
    const top25HTML = top25.map((t, i) => {
        const mine = t.id === team.id ? ` style="color:${t.color};font-weight:bold;"` : '';
        return `<li${mine}><span style="font-size:0.9em;">#${i + 1} ${esc(t.abbr || t.name)}</span> <span style="float:right;color:#888;font-size:0.9em;">${t.wins || 0}-${t.losses || 0}-${t.otl || 0}</span></li>`;
    }).join('');

    const confOptions = [...conferences].sort((a, b) => a.name.localeCompare(b.name)).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');

    container.innerHTML = `
        <div class="dashboard-grid">
            <div class="dash-col">
                <div class="dashboard-panel">
                    <h2>Next Game</h2>
                    <p style="margin-bottom: 15px; color: #aaa;">${esc(nextText)}</p>
                    <button id="dash-sim" class="primary" style="width: 100%; margin-bottom: 10px;">Simulate Week</button>
                    ${s.pendingRecruitWindow ? `<button id="dash-recruit-window" class="primary" style="width: 100%; margin-bottom: 10px; background: #4ade80; color: #000;">🎯 Recruiting Window (Week ${s.pendingRecruitWindow})</button>` : ''}
                    <button id="dash-schedule" class="secondary" style="width: 100%;">Team Schedule</button>
                </div>
                <div class="dashboard-panel">
                    <h2>Team Management</h2>
                    <button id="dash-roster" class="primary" style="width: 100%; margin-bottom: 10px;">View Roster</button>
                    <button id="dash-coach" class="secondary" style="width: 100%;">Coach Profile</button>
                    <div style="margin-top: 10px;">
                        <label for="dash-focus" style="font-size: 0.9em; color: #aaa;">Training Focus:</label>
                        <select id="dash-focus" class="input-field" style="margin-top: 5px;">
                            ${TRAINING_FOCUSES.map(f => `<option value="${f.key}">${esc(f.label)}</option>`).join('')}
                        </select>
                    </div>
                    <div style="margin-top: 10px; font-size: 0.9em; color: #aaa;">
                        🎯 Recruiting Board: <strong style="color:#fff;">${(s.recruitTargets || []).length}/${MAX_RECRUIT_TARGETS}</strong>
                        <span style="color:#666;">(+${dripPerWeek(s.coach)}/wk each)</span>
                    </div>
                    <div style="margin-top: 8px; font-size: 0.9em; color: #aaa;">
                        ${(() => {
                            const team = getUserTeam();
                            const lines = getLines(team.roster.forwards.filter(p => p.status === 'Active Roster'));
                            let tot = 0, n = 0;
                            for (let l = 1; l <= 4; l++) {
                                const { C, LW, RW } = lines[l];
                                if (C && LW && RW) { tot += lineChemistry(C, LW, RW); n++; }
                            }
                            const avg = n ? tot / n : 0;
                            const col = avg > 0 ? '#4ade80' : avg < 0 ? '#f87171' : '#888';
                            return `⚗️ Line Chemistry: <strong style="color:${col};">${avg > 0 ? '+' : ''}${(avg * 100).toFixed(1)}%</strong> <span style="color:#666;">(Roster → Lines)</span>`;
                        })()}
                    </div>
                </div>
                <div class="dashboard-panel">
                    <h2>Postseason</h2>
                    <button id="dash-bracket" class="primary" style="width: 100%;">Tournament Bracket</button>
                </div>
            </div>
            <div class="dash-col">
                <div class="dashboard-panel">
                    <h2>National Top 25</h2>
                    <ul class="ranking-list">${top25HTML}</ul>
                </div>
                <div class="dashboard-panel">
                    <h2>Conference Standings</h2>
                    <select id="dash-conf-select" class="input-field">${confOptions}</select>
                    <table class="standings-table">
                        <thead><tr><th style="text-align:left;">Team</th><th style="text-align:center;" title="Conference record">CONF</th><th style="text-align:center;" title="Conference points">CPTS</th><th style="text-align:center;" title="Overall record">OVR</th><th style="text-align:center;" title="Overall points">OPTS</th></tr></thead>
                        <tbody id="dash-standings"></tbody>
                    </table>
                </div>
            </div>
        </div>`;

    const paintStandings = confId => {
        const rows = s.leagueTeams
            .filter(t => t.confId === confId)
            .sort((a, b) => {
                const acp = (a.confWins || 0) * 2 + (a.confOtl || 0);
                const bcp = (b.confWins || 0) * 2 + (b.confOtl || 0);
                if (bcp !== acp) return bcp - acp;
                const aop = (a.wins || 0) * 2 + (a.otl || 0);
                const bop = (b.wins || 0) * 2 + (b.otl || 0);
                if (bop !== aop) return bop - aop;
                return b.prestige - a.prestige;
            })
            .map(t => {
                const cw = t.confWins || 0, cl = t.confLosses || 0, co = t.confOtl || 0;
                const w = t.wins || 0, l = t.losses || 0, o = t.otl || 0;
                const mine = t.id === team.id ? ` style="font-weight:bold;color:${t.color};"` : '';
                return `<tr${mine}><td style="white-space:nowrap;">${esc(t.name)}</td><td style="text-align:center;white-space:nowrap;">${cw}-${cl}-${co}</td><td style="text-align:center;">${cw * 2 + co}</td><td style="text-align:center;color:#aaa;white-space:nowrap;">${w}-${l}-${o}</td><td style="text-align:center;color:#aaa;">${w * 2 + o}</td></tr>`;
            }).join('');
        container.querySelector('#dash-standings').innerHTML = rows;
    };

    const confSelect = container.querySelector('#dash-conf-select');
    confSelect.value = team.confId;
    paintStandings(team.confId);
    confSelect.onchange = e => paintStandings(e.target.value);

    const focusSelect = container.querySelector('#dash-focus');
    focusSelect.value = s.trainingFocus || 'balanced';
    focusSelect.onchange = e => update(st => { st.trainingFocus = e.target.value; });

    container.querySelector('#dash-sim').onclick = () => {
        const { weekIndex, seasonActive } = simCurrentWeek();
        goAfterSimWeek(weekIndex, seasonActive);
    };

    const rwBtn = container.querySelector('#dash-recruit-window');
    if (rwBtn) rwBtn.onclick = () => showScreen('recruit-window');

    container.querySelector('#dash-schedule').onclick = () => showScreen('schedule');
    container.querySelector('#dash-roster').onclick = () => showScreen('roster');
    container.querySelector('#dash-coach').onclick = () => showScreen('coach-profile');
    container.querySelector('#dash-bracket').onclick = () => showScreen('bracket');
}
