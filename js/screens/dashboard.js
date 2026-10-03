// screens/dashboard.js — in-season hub.
// Minimal v1: proves the store + router + engine wiring end to end.
// Full panels (standings, Top 25, roster, schedule, recap, bracket) port next.

import { getState, getUserTeam } from '../store.js';

function scheduleLabel(weekNumber) {
    if (weekNumber <= 10) return `Non-Conference Game ${weekNumber}`;
    if (weekNumber <= 38) return `Conference Game ${weekNumber - 10}`;
    if (weekNumber === 39) return 'Conference Quarterfinals';
    if (weekNumber === 40) return 'Conference Semifinals';
    if (weekNumber === 41) return 'Conference Finals';
    if (weekNumber === 42) return 'National Round of 16';
    if (weekNumber === 43) return 'National Quarterfinals';
    if (weekNumber === 44) return 'National Semifinals';
    if (weekNumber === 45) return 'National Championship';
    return 'Offseason';
}

export function render(container) {
    const s = getState();
    const team = getUserTeam();

    let nextText = 'Season complete';
    if (s.currentWeek <= s.schedule.length) {
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

    container.innerHTML = `
        <div class="dashboard-grid">
            <div class="dash-col">
                <div class="dashboard-panel">
                    <h2>Next Game</h2>
                    <p style="margin-bottom: 15px; color: #aaa;">${nextText}</p>
                    <button class="primary" style="width: 100%;" disabled title="Porting next">Simulate Week (coming soon)</button>
                </div>
                <div class="dashboard-panel">
                    <h2>${team.name}</h2>
                    <p>Year ${s.year} — Week ${s.currentWeek}</p>
                    <p>Record: ${team.wins || 0}-${team.losses || 0}-${team.otl || 0}</p>
                </div>
            </div>
            <div class="dash-col">
                <div class="dashboard-panel">
                    <h2>Rebuild in progress</h2>
                    <p>Standings, Top 25, roster, schedule, recap, and bracket screens are being ported to the new screen system next.</p>
                </div>
            </div>
        </div>`;
}
