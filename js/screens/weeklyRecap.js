// screens/weeklyRecap.js — results from the week just simmed.
import { getState, getUserTeam } from '../store.js';
import { showScreen } from '../router.js';
import { conferences } from '../data.js';
import { esc, scheduleLabel } from '../ui.js';

export function render(container, params) {
    const s = getState();
    const team = getUserTeam();
    const weekIndex = params.weekIndex || 0;
    const weekGames = s.schedule[weekIndex] || [];

    const paint = filterId => {
        const list = container.querySelector('#recap-list');
        const games = weekGames.filter(g => {
            if (filterId === 'all') return true;
            const home = s.leagueTeams.find(t => t.id === g.homeTeamId);
            const away = s.leagueTeams.find(t => t.id === g.awayTeamId);
            return home.confId === filterId || away.confId === filterId;
        });
        list.innerHTML = games.map(g => {
            const home = s.leagueTeams.find(t => t.id === g.homeTeamId);
            const away = s.leagueTeams.find(t => t.id === g.awayTeamId);
            const ot = g.ot ? " <span style='color:#888;font-size:0.8em;'>(OT)</span>" : '';
            const hc = home.id === team.id ? 'var(--accent)' : '#fff';
            const ac = away.id === team.id ? 'var(--accent)' : '#fff';
            return `<div style="background:#222;padding:10px;border-radius:4px;border-left:4px solid ${home.color};margin-bottom:5px;">
                <div style="display:flex;justify-content:space-between;color:${ac};"><span>${esc(away.name)}</span><span>${g.awayScore}</span></div>
                <div style="display:flex;justify-content:space-between;color:${hc};"><span>${esc(home.name)}</span><span>${g.homeScore}${ot}</span></div>
            </div>`;
        }).join('') || '<p style="color:#888;">No games this week.</p>';
    };

    container.innerHTML = `
        <div class="dashboard-panel" style="max-width: 1200px; margin: 0 auto;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
                <h2 style="margin:0;">${esc(scheduleLabel(weekIndex + 1))} Results</h2>
                <button id="recap-continue" class="primary" style="margin:0;width:auto;padding:8px 20px;">Continue</button>
            </div>
            <select id="recap-filter" class="input-field" style="width:100%;margin-bottom:15px;">
                <option value="all">National (All)</option>
                ${conferences.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
            </select>
            <div id="recap-list" style="display:flex;flex-direction:column;gap:10px;"></div>
        </div>`;

    const filter = container.querySelector('#recap-filter');
    const initial = params.confId || (team ? team.confId : 'all');
    filter.value = initial;
    paint(initial);
    filter.onchange = e => paint(e.target.value);
    container.querySelector('#recap-continue').onclick = () => showScreen('dashboard');

    // Mystery, Alaska: if the underdogs from Alaska knock off a giant,
    // it gets a headline.
    const alaska = s.leagueTeams.find(t => t.id === 'team_alaska');
    let biggest = null;
    weekGames.forEach(g => {
        if (g.homeScore == null) return;
        const home = s.leagueTeams.find(t => t.id === g.homeTeamId);
        const away = s.leagueTeams.find(t => t.id === g.awayTeamId);
        if (!home || !away) return;
        const winner = g.homeScore > g.awayScore ? home : away;
        const loser = winner === home ? away : home;
        if (winner.id === 'team_alaska' && alaska && (loser.prestige - alaska.prestige) >= 20) {
            const gap = loser.prestige - alaska.prestige;
            if (!biggest || gap > biggest.gap) biggest = { gap, loser, ws: Math.max(g.homeScore, g.awayScore), ls: Math.min(g.homeScore, g.awayScore) };
        }
    });
    if (biggest) {
        const banner = document.createElement('div');
        banner.innerHTML = `<div style="background:#0c2a4a;border:2px solid #1D5FA8;padding:12px;border-radius:8px;margin-bottom:15px;text-align:center;font-size:1.1em;">🏒 <strong>MYSTERY, ALASKA:</strong> Alaska stuns ${esc(biggest.loser.name)} ${biggest.ws}–${biggest.ls}!</div>`;
        container.querySelector('.dashboard-panel').insertBefore(banner, container.querySelector('#recap-filter'));
    }
}
