// screens/schedule.js — the user's full season schedule.
import { getState, getUserTeam } from '../store.js';
import { showScreen } from '../router.js';
import { esc, scheduleLabel } from '../ui.js';

export function render(container) {
    const s = getState();
    const team = getUserTeam();

    const rows = s.schedule.map((weekGames, idx) => {
        const myGame = (weekGames || []).find(g => g.homeTeamId === team.id || g.awayTeamId === team.id);
        let right;
        if (!myGame) {
            right = '<span style="color:#888;">BYE WEEK</span>';
        } else {
            const isHome = myGame.homeTeamId === team.id;
            const opp = s.leagueTeams.find(t => t.id === (isHome ? myGame.awayTeamId : myGame.homeTeamId));
            const matchText = `${isHome ? 'vs.' : '@'} ${esc(opp.name)}`;
            if (myGame.played) {
                const myScore = isHome ? myGame.homeScore : myGame.awayScore;
                const oppScore = isHome ? myGame.awayScore : myGame.homeScore;
                let result = myScore > oppScore ? '<span style="color:#4ade80;">W</span>' : '<span style="color:#f87171;">L</span>';
                if (myGame.ot) result += ' (OT)';
                right = `<span>${matchText}</span> <span>${result} ${myScore} - ${oppScore}</span>`;
            } else {
                right = `<span>${matchText}</span> <span>--</span>`;
            }
        }
        return `<div style="padding:10px;border-bottom:1px solid #444;display:flex;justify-content:space-between;"><strong>${esc(scheduleLabel(idx + 1))}</strong>${right}</div>`;
    }).join('');

    container.innerHTML = `
        <div class="dashboard-panel">
            <h2>Season Schedule</h2>
            <button id="sched-back" class="secondary" style="margin-bottom:15px;">Back to Dashboard</button>
            <div style="background:#222;padding:15px;border-radius:8px;">${rows}</div>
        </div>`;

    container.querySelector('#sched-back').onclick = () => showScreen('dashboard');
}
