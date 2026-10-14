// screens/reportCard.js — midseason report card, auto-shown after the
// week-14 sim. Grades each line/pair against the team's own averages and
// nudges the user to shuffle underperforming units.

import { getState, getUserTeam } from '../store.js';
import { showScreen } from '../router.js';
import { getLines, getDPairs, lineEffectiveOvr, dPairEffectiveOvr, effOvr } from '../lines.js';
import { esc } from '../ui.js';

const gradeFor = (diff) => {
    if (diff >= 2) return { g: 'A', c: '#4ade80' };
    if (diff >= 1) return { g: 'B', c: '#a3e635' };
    if (diff > -1) return { g: 'C', c: '#fbbf24' };
    if (diff > -2) return { g: 'D', c: '#fb923c' };
    return { g: 'F', c: '#f87171' };
};

const pname = p => p ? esc(`${p.firstName} ${p.lastName}`) : '<span style="color:#666;">—</span>';

export function render(container, params) {
    const team = getUserTeam();
    const act = p => p.status === 'Active Roster' && !p.injuryWeeks && !p.suspWeeks;
    const lines = getLines(team.roster.forwards.filter(act));
    const pairs = getDPairs(team.roster.defensemen.filter(act));

    const lineOvrs = [1, 2, 3, 4].map(n => {
        const L = lines[n] || {};
        return { n, ovr: lineEffectiveOvr(L.C, L.LW, L.RW), L };
    });
    const avgF = lineOvrs.reduce((a, l) => a + l.ovr, 0) / 4;
    const pairOvrs = [1, 2, 3].map(n => {
        const P = pairs[n] || {};
        return { n, ovr: dPairEffectiveOvr(P.A, P.B), P };
    });
    const avgD = pairOvrs.reduce((a, l) => a + l.ovr, 0) / 3;

    const allUnits = [
        ...lineOvrs.map(l => ({ label: `Line ${l.n}`, ...gradeFor(l.ovr - avgF), diff: l.ovr - avgF })),
        ...pairOvrs.map(l => ({ label: `Pair ${l.n}`, ...gradeFor(l.ovr - avgD), diff: l.ovr - avgD })),
    ];
    const worst = allUnits.slice().sort((a, b) => a.diff - b.diff)[0];

    const row = (label, members, ovr, avg) => {
        const { g, c } = gradeFor(ovr - avg);
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #222;">
            <div><b>${label}</b> <span style="color:#888;font-size:0.85em;">${members}</span></div>
            <div><span style="font-weight:bold;color:${c};font-size:1.2em;">${g}</span> <span style="color:#888;font-size:0.85em;">${ovr.toFixed(1)}</span></div>
        </div>`;
    };

    container.innerHTML = `
        <div class="dashboard-panel" style="max-width:640px;margin:0 auto;">
            <h2>📋 Midseason Report Card</h2>
            <p style="color:#aaa;">Halfway home. Grades are vs. your own team average — a D means that unit is dragging you down.</p>
            <h3>Forwards <span style="color:#888;font-size:0.8em;">(avg ${avgF.toFixed(1)})</span></h3>
            ${lineOvrs.map(l => row(`Line ${l.n}`, [pname(l.L.LW), pname(l.L.C), pname(l.L.RW)].join(' · '), l.ovr, avgF)).join('')}
            <h3 style="margin-top:16px;">Defense <span style="color:#888;font-size:0.8em;">(avg ${avgD.toFixed(1)})</span></h3>
            ${pairOvrs.map(l => row(`Pair ${l.n}`, [pname(l.P.A), pname(l.P.B)].join(' · '), l.ovr, avgD)).join('')}
            ${worst && worst.diff <= -1 ? `<p style="margin-top:16px;color:#fb923c;">💡 ${worst.label} grades ${worst.g} — consider shuffling personnel on the Lines screen.</p>` : ''}
            <button id="rc-continue" class="primary" style="width:100%;margin-top:12px;">Continue</button>
        </div>`;
    container.querySelector('#rc-continue').onclick = () => {
        const next = params && params.next;
        if (next === 'game-day' || next === 'weekly-recap') showScreen(next, params);
        else showScreen('dashboard');
    };
}

export function destroy() {}
