// screens/dashboard.js — in-season hub.
import { getState, getUserTeam } from '../store.js';
import { showScreen } from '../router.js';
import { simCurrentWeek, goAfterSimWeek } from '../actions.js';
import { pollScore } from '../engine.js';
import { conferences } from '../data.js';
import { esc, scheduleLabel } from '../ui.js';

function shortName(name) {
    if (name.startsWith('New ') || name.startsWith('Rhode ')) {
        return name.split(' ').slice(0, 2).join(' ');
    }
    return name.split(' ')[0];
}

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
            nextText = `${scheduleLabel(s.currentWeek)} — BYE WEEK`;
        }
    }

    const top25 = [...s.leagueTeams].sort((a, b) => pollScore(b) - pollScore(a)).slice(0, 25);
    const top25HTML = top25.map((t, i) => {
        const mine = t.id === team.id ? ` style="color:${t.color};font-weight:bold;"` : '';
        return `<li${mine}><span style="font-size:0.9em;">#${i + 1} ${esc(shortName(t.name))}</span> <span style="float:right;color:#888;font-size:0.9em;">${t.wins || 0}-${t.losses || 0}-${t.otl || 0}</span></li>`;
    }).join('');

    const confOptions = conferences.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');

    container.innerHTML = `
        <div class="dashboard-grid">
            <div class="dash-col">
                <div class="dashboard-panel">
                    <h2>Next Game</h2>
                    <p style="margin-bottom: 15px; color: #aaa;">${esc(nextText)}</p>
                    <button id="dash-sim" class="primary" style="width: 100%; margin-bottom: 10px;">Simulate Week</button>
                    <button id="dash-schedule" class="secondary" style="width: 100%;">Team Schedule</button>
                    <button id="dash-debug" class="secondary" style="background: #881111; color: white;">[Debug] Sim to Offseason</button>
                </div>
                <div class="dashboard-panel">
                    <h2>Team Management</h2>
                    <button id="dash-roster" class="primary" style="width: 100%; margin-bottom: 10px;">View Roster</button>
                    <button id="dash-coach" class="secondary" style="width: 100%;">Coach Profile</button>
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
                        <thead><tr><th style="text-align:left;">Team</th><th style="text-align:center;">CONF</th><th style="text-align:center;">CPTS</th><th style="text-align:center;">OVR</th><th style="text-align:center;">OPTS</th></tr></thead>
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

    container.querySelector('#dash-sim').onclick = () => {
        const { weekIndex, seasonActive } = simCurrentWeek();
        goAfterSimWeek(weekIndex, seasonActive);
    };

    container.querySelector('#dash-debug').onclick = () => {
        let guard = 0;
        while (getState().currentWeek <= 45 && guard++ < 60) simCurrentWeek();
        showScreen(getState().currentWeek > 45 ? 'season-recap' : 'dashboard');
    };

    container.querySelector('#dash-schedule').onclick = () => showScreen('schedule');
    container.querySelector('#dash-roster').onclick = () => showScreen('roster');
    container.querySelector('#dash-coach').onclick = () => showScreen('coach-profile');
    container.querySelector('#dash-bracket').onclick = () => showScreen('bracket');
}
