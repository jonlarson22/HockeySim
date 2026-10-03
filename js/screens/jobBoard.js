// screens/jobBoard.js — pick a starting program.
import { getState, update } from '../store.js';
import { showScreen } from '../router.js';
import { generateSeasonSchedule } from '../engine.js';
import { generateProspectPool } from '../recruiting.js';
import { conferences } from '../data.js';

export function render(container) {
    const s = getState();
    const jobs = s.leagueTeams
        .filter(t => t.prestige <= 59)
        .sort(() => 0.5 - Math.random())
        .slice(0, Math.floor(Math.random() * 2) + 2);

    const items = jobs.map(team => `
        <li class="job-item">
            <div><strong>${team.name}</strong><br><small>Prestige: ${team.prestige} / 100</small></div>
            <button data-team="${team.id}" style="width: auto; margin: 0; padding: 8px 12px; background: ${team.color}">Accept Offer</button>
        </li>`).join('');

    container.innerHTML = `
        <div class="dashboard-panel">
            <h2>Available Head Coach Positions</h2>
            <p>Select a program to begin your career.</p>
            <ul>${items || '<li>No openings this year.</li>'}</ul>
            <button id="jobs-back" class="secondary">Back</button>
        </div>`;

    container.querySelectorAll('[data-team]').forEach(btn => {
        btn.addEventListener('click', () => {
            const teamId = btn.getAttribute('data-team');
            update(st => {
                st.teamId = teamId;
                st.schedule = generateSeasonSchedule(st.leagueTeams, conferences);
                st.currentWeek = 1;
                // First season's recruiting class: same pool the offseason will use.
                st.prospectPool = generateProspectPool();
                st.recruitTargets = [];
                st.recruitWeekAlloc = {};
            });
            showScreen('dashboard');
        });
    });

    container.querySelector('#jobs-back').onclick = () => showScreen('coach-creation');
}
