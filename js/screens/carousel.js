// screens/carousel.js — offseason job carousel: firings, offers, or staying put.
// Rendered after resolveSeason(); the buttons below lead into beginOffseason().
import { getState, getUserTeam } from '../store.js';
import { showScreen } from '../router.js';
import { beginOffseason, changeTeam } from '../actions.js';
import { esc } from '../ui.js';

const RESULT_LABEL = {
    exceeded: 'Exceeded expectations',
    met: 'Met expectations',
    missed: 'Missed expectations'
};

export function render(container) {
    const s = getState();
    const res = s.seasonResolution;
    if (!res) { showScreen('season-recap'); return; }
    const team = getUserTeam();

    const goOffseason = () => { beginOffseason(); showScreen('recruiting'); };

    if (res.fired) {
        const openings = res.openings
            .map(id => s.leagueTeams.find(t => t.id === id))
            .filter(Boolean);
        container.innerHTML = `
            <div class="dashboard-panel text-center" style="max-width: 640px; margin: 0 auto;">
                <h2>You've been fired</h2>
                <p>The ${esc(team.name)} athletic department has relieved you of your duties after ${esc(RESULT_LABEL[res.grade.result].toLowerCase())} (${esc(res.grade.expectation)}).</p>
                <p style="color:#aaa;">Your agent has lined up the following openings:</p>
                <ul>${openings.map(t => `
                    <li class="job-item">
                        <div><strong>${esc(t.name)}</strong><br><small>Prestige: ${t.prestige} / 100</small></div>
                        <button data-team="${t.id}" style="width:auto;margin:0;padding:8px 12px;background:${t.color}">Accept Offer</button>
                    </li>`).join('')}</ul>
            </div>`;
        container.querySelectorAll('[data-team]').forEach(btn => {
            btn.addEventListener('click', () => {
                changeTeam(btn.getAttribute('data-team'));
                goOffseason();
            });
        });
        return;
    }

    const offers = res.offers
        .map(id => s.leagueTeams.find(t => t.id === id))
        .filter(Boolean);

    const resultColor = res.grade.result === 'exceeded' ? '#4ade80' : res.grade.result === 'met' ? 'var(--accent)' : '#f87171';

    container.innerHTML = `
        <div class="dashboard-panel" style="max-width: 640px; margin: 0 auto;">
            <h2>Season Review</h2>
            <p>Expectation: <strong>${esc(res.grade.expectation)}</strong></p>
            <p>Result: <strong style="color:${resultColor};">${RESULT_LABEL[res.grade.result]}</strong></p>
            <p style="color:#aaa;">+${res.xpGained} XP earned.</p>
            <hr style="margin: 1rem 0; border-color: #333;">
            ${offers.length ? `
                <h3>Job Offers</h3>
                <p style="color:#aaa;">Bigger programs have come calling:</p>
                <ul>${offers.map(t => `
                    <li class="job-item">
                        <div><strong>${esc(t.name)}</strong><br><small>Prestige: ${t.prestige} / 100</small></div>
                        <button data-team="${t.id}" style="width:auto;margin:0;padding:8px 12px;background:${t.color}">Accept Offer</button>
                    </li>`).join('')}</ul>
            ` : `<p style="color:#aaa;">No new offers this offseason.</p>`}
            <button id="car-stay" class="primary" style="width:100%;margin-top:15px;">Stay at ${esc(team.name)}</button>
        </div>`;

    container.querySelectorAll('[data-team]').forEach(btn => {
        btn.addEventListener('click', () => {
            changeTeam(btn.getAttribute('data-team'));
            goOffseason();
        });
    });
    container.querySelector('#car-stay').onclick = goOffseason;
}
