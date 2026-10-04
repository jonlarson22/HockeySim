// screens/schedule.js — the user's full season schedule.
import { getState, getUserTeam } from '../store.js';
import { showScreen } from '../router.js';
import { esc } from '../ui.js';
import { nationalRank } from '../engine.js';

export function render(container) {
    const s = getState();
    const team = getUserTeam();

    const rows = [];
    let lastSection = '';
    s.schedule.forEach((weekGames, idx) => {
        const weekNum = idx + 1;
        const section = weekNum <= 10 ? 'Non-Conference' : weekNum <= 38 ? 'Conference' : 'Postseason';
        const num = weekNum <= 10 ? weekNum : weekNum <= 38 ? weekNum - 10 : weekNum - 38;
        if (section !== lastSection) {
            rows.push(`<div style="padding:12px 10px 4px;color:#888;font-size:0.78em;font-weight:bold;letter-spacing:1.5px;">${section.toUpperCase()}</div>`);
            lastSection = section;
        }
        const myGame = (weekGames || []).find(g => g.homeTeamId === team.id || g.awayTeamId === team.id);
        let left, right;
        if (!myGame) {
            left = `<span style="color:#555;font-size:0.85em;width:22px;">${num}</span><span style="color:#555;font-size:0.85em;">Bye week</span>`;
            right = '';
        } else {
            const isHome = myGame.homeTeamId === team.id;
            const opp = s.leagueTeams.find(t => t.id === (isHome ? myGame.awayTeamId : myGame.homeTeamId));
            // Played games show the rank stamped at game time; upcoming games
            // show the opponent's current rank.
            const oppRank = myGame.played
                ? (isHome ? myGame.awayRank : myGame.homeRank)
                : (opp ? nationalRank(s.leagueTeams, opp.id, s.schedule) : 99);
            const rankTxt = oppRank && oppRank <= 25 ? ` #${oppRank}` : '';
            left = `<span style="color:#888;font-size:0.85em;width:22px;flex-shrink:0;">${num}</span><span>${isHome ? 'vs' : '@'}${rankTxt} ${esc(opp ? opp.name : '')}</span>`;
            if (myGame.played) {
                const myScore = isHome ? myGame.homeScore : myGame.awayScore;
                const oppScore = isHome ? myGame.awayScore : myGame.homeScore;
                const won = myScore > oppScore;
                right = `<span style="color:${won ? '#4ade80' : '#f87171'};font-weight:bold;white-space:nowrap;">${won ? 'W' : 'L'}${myGame.ot ? ' (OT)' : ''} ${myScore}–${oppScore}</span>`;
            } else {
                right = `<span style="color:#555;">—</span>`;
            }
        }
        rows.push(`<div style="padding:8px 10px;border-bottom:1px solid #333;display:flex;justify-content:space-between;align-items:center;gap:8px;"><div style="display:flex;gap:8px;align-items:center;min-width:0;">${left}</div><div>${right}</div></div>`);
    });
    const rowsHtml = rows.join('');

    container.innerHTML = `
        <div class="dashboard-panel">
            <h2>Team Schedule</h2>
            <button id="sched-back" class="secondary" style="margin-bottom:15px;">Back to Dashboard</button>
            <div style="background:#222;padding:15px;border-radius:8px;">${rowsHtml}</div>
        </div>`;

    container.querySelector('#sched-back').onclick = () => showScreen('dashboard');
}
