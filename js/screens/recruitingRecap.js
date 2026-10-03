// screens/recruitingRecap.js — weekly recruiting activity log.
import { showScreen } from '../router.js';
import { esc } from '../ui.js';

export function render(container, params) {
    const logs = params.logs || [];

    const items = logs.map(log => {
        let color = '#aaa', msg;
        if (log.status === 'SIGNED') {
            color = '#4ade80';
            msg = `<strong>${esc(log.prospect.firstName)} ${esc(log.prospect.lastName)}</strong> has committed to <strong>${esc(log.schoolName)}</strong>!`;
        } else if (log.status === 'LOST') {
            color = '#f87171';
            msg = `<strong>${esc(log.prospect.firstName)} ${esc(log.prospect.lastName)}</strong> signed with <strong>${esc(log.schoolName)}</strong>.`;
        } else {
            msg = `<strong>${esc(log.prospect.firstName)} ${esc(log.prospect.lastName)}</strong> remains undecided. Rival interest: ${log.rivalInterest} pts.`;
        }
        return `<div style="background:#222;padding:10px;border-radius:4px;border-left:4px solid ${color};">${msg}</div>`;
    }).join('');

    container.innerHTML = `
        <div class="dashboard-panel">
            <h2>Recruiting Activity Log</h2>
            <p>Results from this week's visits and pitches.</p>
            <div style="display:flex;flex-direction:column;gap:10px;margin:20px 0;">
                ${items || '<p style="color:#aaa;">No major commitment updates on your targets this week.</p>'}
            </div>
            <button id="recap-continue" class="primary">Continue Offseason</button>
        </div>`;

    container.querySelector('#recap-continue').onclick = () => showScreen('recruiting');
}
