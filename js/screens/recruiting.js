// screens/recruiting.js — 5-week offseason recruiting hub.
import { getState, getUserTeam, update } from '../store.js';
import { showScreen } from '../router.js';
import { submitRecruitingWeek } from '../actions.js';
import { calculateRecruitingPoints, getScoutedGrade, getPotentialDescriptor } from '../recruiting.js';
import { freshmanWeekBudget } from '../portal.js';
import { esc } from '../ui.js';

const STEP = 10;

export function render(container) {
    // Filter toggles are UI-only state; they reset if you leave and come back.
    let targetsOnly = false;
    let posFilter = 'ALL';

    const paint = () => {
        const s = getState();
        const team = getUserTeam();
        const pool = s.prospectPool || [];
        const alloc = s.recruitWeekAlloc || {};
        const budget = freshmanWeekBudget(s, s.recruitingWeek || 1);
        const spent = Object.values(alloc).reduce((a, b) => a + b, 0);
        const pointsLeft = budget - spent;

        // Scouting reveals exact numbers: OVR at 10+, potential at 20+.
        const scouting = s.coach.skills.scouting || 0;
        const showOVR = scouting >= 10;
        const showPOT = scouting >= 20;

        const visible = pool.filter(p => {
            if (p.signedBy) return false;
            if (targetsOnly && !p.isUserTarget) return false;
            if (posFilter !== 'ALL' && p.position !== posFilter) return false;
            return true;
        });

        const cards = visible.map(p => {
            const myAlloc = alloc[p.id] || 0;
            const interest = p.userPoints || 0;
            const badge = p.isUserTarget ? `<span style="background:var(--accent);color:#000;padding:2px 6px;border-radius:4px;font-size:0.75em;font-weight:bold;margin-right:5px;">TARGETED</span>` : '';
            const isFav = p.favorites && p.favorites.includes(s.teamId);
            const favBadge = isFav ? '<span style="background:#4ade80;color:#000;padding:2px 6px;border-radius:4px;font-size:0.75em;font-weight:bold;margin-right:5px;" title="Top school: +25% point effectiveness">TOP SCHOOL</span>' : '';
            const prefTags = (p.prefTags || []).map(t => {
                const label = t.type === 'home' ? 'Home: ' + t.confId : t.label;
                return '<span style="background:#333;color:#aaa;padding:1px 5px;border-radius:3px;font-size:0.75em;margin-right:4px;">' + esc(label) + '</span>';
            }).join('');
            return `
                <div style="background:#2a2a2a;padding:12px;border-radius:6px;display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <div>${badge}${favBadge}<strong>${esc(p.firstName)} ${esc(p.lastName)}</strong> (${p.position})</div>
                        <div style="font-size:0.85em;color:#aaa;margin-top:4px;">
                            Grade: <strong>${showOVR ? p.overall : getScoutedGrade(p.overall)}</strong> | Pot: <strong>${showPOT ? p.potential : getPotentialDescriptor(p.potential)}</strong> | Total Interest: <span style="color:#4ade80;">${interest} pts</span>
                        </div>
                        ${prefTags ? `<div style="margin-top:4px;">${prefTags}</div>` : ''}
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <button class="secondary" data-sub="${p.id}" style="width:30px;padding:4px;">-</button>
                        <input type="number" data-alloc="${p.id}" value="${myAlloc}" min="0" style="width:60px;text-align:center;padding:4px;">
                        <button class="secondary" data-add="${p.id}" style="width:30px;padding:4px;">+</button>
                    </div>
                </div>`;
        }).join('');

        container.innerHTML = `
            <div class="dashboard-panel">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
                    <div>
                        <h2>Offseason Recruiting — Week ${s.recruitingWeek}/5</h2>
                        <p style="color:#aaa;margin:0;">Points Available: <strong style="color:var(--accent);">${pointsLeft}</strong></p>
                        ${(s.draftDeclarations || []).length ? `
                        <div style="margin-top:10px;padding:10px;background:#2a1a1a;border:1px solid #8b0000;border-radius:6px;">
                            <strong style="color:#f87171;">NHL Draft Declarations:</strong>
                            <div style="font-size:0.85em;margin-top:5px;">${s.draftDeclarations.map(d =>
                                `<div>${esc(d.name)} <span style="color:#aaa;">(${esc(d.team)}, ${d.year}, OVR ${d.overall})</span> — left early</div>`
                            ).join('')}</div>
                        </div>` : ''}
                    </div>
                    <button id="rec-submit" class="primary" style="width:auto;">Submit Points & Advance Week</button>
                </div>
                <div style="display:flex;gap:10px;margin-bottom:15px;">
                    <button id="rec-targets" class="secondary" style="width:auto;padding:6px 12px;${targetsOnly ? 'background:#444;' : ''}">My Targets Only</button>
                    <button id="rec-all" class="secondary" style="width:auto;padding:6px 12px;${!targetsOnly ? 'background:#444;' : ''}">All Prospects</button>
                    <select id="rec-pos" class="input-field" style="width:auto;padding:6px;">
                        <option value="ALL">All Positions</option>
                        <option value="F" ${posFilter === 'F' ? 'selected' : ''}>Forwards</option>
                        <option value="D" ${posFilter === 'D' ? 'selected' : ''}>Defensemen</option>
                        <option value="G" ${posFilter === 'G' ? 'selected' : ''}>Goalies</option>
                    </select>
                </div>
                <div style="display:flex;flex-direction:column;gap:10px;max-height:550px;overflow-y:auto;">
                    ${cards || '<p style="color:#888;">No prospects match the selected filter.</p>'}
                </div>
            </div>`;

        container.querySelector('#rec-targets').onclick = () => { targetsOnly = true; paint(); };
        container.querySelector('#rec-all').onclick = () => { targetsOnly = false; paint(); };
        container.querySelector('#rec-pos').onchange = e => { posFilter = e.target.value; paint(); };

        const setAlloc = (id, value) => {
            update(st => {
                const a = st.recruitWeekAlloc || (st.recruitWeekAlloc = {});
                const prospect = (st.prospectPool || []).find(p => p.id === id);
                if (value > 0) {
                    a[id] = value;
                    if (prospect) prospect.isUserTarget = true;
                } else {
                    delete a[id];
                }
            });
            paint();
        };

        container.querySelectorAll('[data-add]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-add');
                const st = getState();
                const a = st.recruitWeekAlloc || {};
                const budgetNow = freshmanWeekBudget(st, st.recruitingWeek || 1);
                const spentNow = Object.values(a).reduce((x, y) => x + y, 0);
                if (budgetNow - spentNow >= STEP) setAlloc(id, (a[id] || 0) + STEP);
            });
        });

        container.querySelectorAll('[data-sub]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-sub');
                const cur = (getState().recruitWeekAlloc || {})[id] || 0;
                if (cur >= STEP) setAlloc(id, cur - STEP);
            });
        });

        // The old number input was decorative; this one actually works.
        container.querySelectorAll('[data-alloc]').forEach(input => {
            input.addEventListener('change', e => {
                const id = e.target.getAttribute('data-alloc');
                const st = getState();
                const a = st.recruitWeekAlloc || {};
                const budgetNow = freshmanWeekBudget(st, st.recruitingWeek || 1);
                const spentNow = Object.values(a).reduce((x, y) => x + y, 0);
                const cur = a[id] || 0;
                let v = Math.floor((parseInt(e.target.value, 10) || 0) / STEP) * STEP;
                if (v < 0) v = 0;
                const maxV = budgetNow - spentNow + cur;
                if (v > maxV) v = Math.floor(maxV / STEP) * STEP;
                setAlloc(id, v);
            });
        });

        container.querySelector('#rec-submit').onclick = () => {
            const { logs, done } = submitRecruitingWeek();
            if (done) {
                alert(`Recruiting complete! The ${getState().year} season is now underway.`);
                showScreen('dashboard');
            } else {
                showScreen('recruiting-recap', { logs });
            }
        };
    };

    paint();
}
