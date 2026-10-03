// screens/coachProfile.js — coach details + career history.
import { getState, getUserTeam } from '../store.js';
import { showScreen } from '../router.js';
import { esc } from '../ui.js';

export function render(container) {
    const s = getState();
    const c = s.coach;
    const team = getUserTeam();

    let historyHTML = `
        <table class="standings-table" style="margin-top: 1rem;">
            <thead><tr><th>Year</th><th>Team</th><th>W-L-OTL</th><th>Nat. Rank</th></tr></thead>
            <tbody>`;
    if (c.history.length === 0) {
        historyHTML += `<tr><td colspan="4" style="text-align:center;">No completed seasons.</td></tr>`;
    } else {
        c.history.forEach(season => {
            historyHTML += `<tr><td>${season.year}</td><td>${esc(season.teamName)}</td><td>${season.wins}-${season.losses}-${season.otl}</td><td>${season.rank <= 25 ? '#' + season.rank : 'Unranked'}</td></tr>`;
        });
    }
    historyHTML += `</tbody></table>`;

    container.innerHTML = `
        <div class="dashboard-panel">
            <h2>Coach Profile</h2>
            <button id="coach-back" class="secondary">Back to Dashboard</button>
            <div style="margin-top: 1rem;">
                <p><strong>Name:</strong> ${esc(c.firstName)} ${esc(c.lastName)}</p>
                <p><strong>Age:</strong> ${c.age}</p>
                <p><strong>Team:</strong> ${team ? esc(team.name) : '—'}</p>
                <hr style="margin: 1rem 0; border-color: #333;">
                <h3>Attribute Ratings</h3>
                <ul>
                    <li>Offense: ${c.skills.offense}</li>
                    <li>Defense: ${c.skills.defense}</li>
                    <li>Development: ${c.skills.development}</li>
                    <li>Recruiting: ${c.skills.recruiting}</li>
                    <li>Scouting: ${c.skills.scouting}</li>
                </ul>
                <hr style="margin: 1rem 0; border-color: #333;">
                <h3>Career History</h3>
                ${historyHTML}
            </div>
        </div>`;

    container.querySelector('#coach-back').onclick = () => showScreen('dashboard');
}
