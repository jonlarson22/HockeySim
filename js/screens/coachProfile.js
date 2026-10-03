// screens/coachProfile.js — coach details, skill allocation, career history.
import { getState, getUserTeam, update } from '../store.js';
import { showScreen } from '../router.js';
import { esc } from '../ui.js';

const SKILL_LABELS = {
    offense: 'Offense',
    defense: 'Defense',
    development: 'Development',
    recruiting: 'Recruiting',
    scouting: 'Scouting'
};

export function render(container) {
    const paint = () => {
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

        const skillRows = Object.entries(SKILL_LABELS).map(([key, label]) => {
            const canAdd = (c.unspentPoints || 0) > 0 && (c.skills[key] || 0) < 30;
            return `<li>${label}: ${c.skills[key] || 0}` +
                (canAdd ? ` <button data-add-skill="${key}" class="secondary" style="width:auto;padding:2px 10px;margin:0 0 0 8px;">+</button>` : '') +
                `</li>`;
        }).join('');

        const levelLine = `<p><strong>Level ${c.level || 1}</strong> <span style="color:#aaa;">(${c.xp || 0} XP)</span>` +
            ((c.unspentPoints || 0) > 0 ? ` — <span style="color:var(--accent);font-weight:bold;">${c.unspentPoints} skill points to spend</span>` : '') +
            `</p>`;

        container.innerHTML = `
            <div class="dashboard-panel">
                <h2>Coach Profile</h2>
                <button id="coach-back" class="secondary">Back to Dashboard</button>
                <div style="margin-top: 1rem;">
                    <p><strong>Name:</strong> ${esc(c.firstName)} ${esc(c.lastName)}</p>
                    <p><strong>Age:</strong> ${c.age}</p>
                    <p><strong>Team:</strong> ${team ? esc(team.name) : '—'}</p>
                    <p><strong>Coach Prestige:</strong> ${c.prestige ?? 15} / 100</p>
                    ${levelLine}
                    <hr style="margin: 1rem 0; border-color: #333;">
                    <h3>Attribute Ratings</h3>
                    <ul>${skillRows}</ul>
                    <hr style="margin: 1rem 0; border-color: #333;">
                    <h3>Career History</h3>
                    ${historyHTML}
                </div>
            </div>`;

        container.querySelector('#coach-back').onclick = () => showScreen('dashboard');
        container.querySelectorAll('[data-add-skill]').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.getAttribute('data-add-skill');
                update(st => {
                    if ((st.coach.unspentPoints || 0) > 0 && (st.coach.skills[key] || 0) < 30) {
                        st.coach.skills[key] = (st.coach.skills[key] || 0) + 1;
                        st.coach.unspentPoints--;
                    }
                });
                paint();
            });
        });
    };

    paint();
}
