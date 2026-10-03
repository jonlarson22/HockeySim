// screens/recruitWindow.js — in-season recruiting window.
//
// Opens after simming weeks 10, 22, and 34 (see INSEASON_WINDOW_WEEKS).
// Same prospect pool as the offseason; points allocated here bank as early
// interest and nothing signs mid-season — pure positioning. Also hosts the
// target board: up to 5 starred prospects who drip interest every week.
import { getState, getUserTeam, update } from '../store.js';
import { showScreen } from '../router.js';
import { submitRecruitWindow, toggleRecruitTarget } from '../actions.js';
import {
    calculateWindowPoints, dripPerWeek, getScoutedGrade, getPotentialDescriptor,
    INSEASON_WINDOW_WEEKS, MAX_RECRUIT_TARGETS
} from '../recruiting.js';
import { esc } from '../ui.js';

const STEP = 10;

export function render(container, params) {
    const weekNum = (params.weekIndex || 0) + 1;
    const windowNum = INSEASON_WINDOW_WEEKS.indexOf(weekNum) + 1;
    // Filter toggles are UI-only state; they reset if you leave and come back.
    let targetsOnly = false;
    let posFilter = 'ALL';

    const paint = () => {
        const s = getState();
        const team = getUserTeam();
        const pool = s.prospectPool || [];
        const alloc = s.recruitWeekAlloc || {};
        const budget = calculateWindowPoints(team, s.coach);
        const spent = Object.values(alloc).reduce((a, b) => a + b, 0);
        const pointsLeft = budget - spent;
        const targets = s.recruitTargets || [];
        const drip = dripPerWeek(s.coach);

        // Scouting reveals exact numbers: OVR at 10+, potential at 20+.
        const scouting = s.coach.skills.scouting || 0;
        const showOVR = scouting >= 10;
        const showPOT = scouting >= 20;

        const targetChips = targets.map(id => {
            const p = pool.find(x => x.id === id);
            if (!p) return '';
            return `<span style="background:#333;padding:4px 8px;border-radius:12px;font-size:0.85em;margin:2px;display:inline-block;">
                <strong>★</strong> ${esc(p.firstName)} ${esc(p.lastName)} (${p.position})
                <button data-untarget="${p.id}" class="secondary" style="width:auto;padding:0 6px;margin-left:4px;">×</button>
            </span>`;
        }).join('');

        const visible = pool.filter(p => {
            if (p.signedBy) return false;
            if (targetsOnly && !p.isUserTarget) return false;
            if (posFilter !== 'ALL' && p.position !== posFilter) return false;
            return true;
        });

        const cards = visible.map(p => {
            const myAlloc = alloc[p.id] || 0;
            const interest = p.userPoints || 0;
            const starred = targets.includes(p.id);
            const badge = p.isUserTarget ? `<span style="background:var(--accent);color:#000;padding:2px 6px;border-radius:4px;font-size:0.75em;font-weight:bold;margin-right:5px;">TARGETED</span>` : '';
            return `
                <div style="background:#2a2a2a;padding:12px;border-radius:6px;display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <div>${badge}<strong>${esc(p.firstName)} ${esc(p.lastName)}</strong> (${p.position})
                            <button data-star="${p.id}" class="secondary" title="${starred ? 'Remove from target board' : 'Star as a season-long target'}" style="width:auto;padding:2px 8px;margin-left:8px;color:${starred ? '#ffd700' : '#888'};">${starred ? '★' : '☆'}</button>
                        </div>
                        <div style="font-size:0.85em;color:#aaa;margin-top:4px;">
                            Grade: <strong>${showOVR ? p.overall : getScoutedGrade(p.overall)}</strong> | Pot: <strong>${showPOT ? p.potential : getPotentialDescriptor(p.potential)}</strong> | Total Interest: <span style="color:#4ade80;">${interest} pts</span>
                        </div>
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
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <div>
                        <h2>In-Season Recruiting — Window ${windowNum > 0 ? windowNum : '?'} of ${INSEASON_WINDOW_WEEKS.length} <span style="color:#888;font-size:0.6em;">(Week ${weekNum})</span></h2>
                        <p style="color:#aaa;margin:0;">Points Available: <strong style="color:var(--accent);">${pointsLeft}</strong></p>
                        <p style="color:#888;margin:4px 0 0;font-size:0.9em;">Points bank as early interest for the offseason. Nothing signs mid-season — this is positioning.</p>
                    </div>
                    <button id="win-submit" class="primary" style="width:auto;">Bank Points & Continue</button>
                </div>
                <div style="background:#222;padding:10px;border-radius:6px;margin-bottom:15px;">
                    <div style="font-size:0.9em;color:#aaa;">🎯 Target Board (${targets.length}/${MAX_RECRUIT_TARGETS}) — starred prospects gain <strong style="color:#4ade80;">+${drip} interest/week</strong> automatically.</div>
                    <div style="margin-top:6px;">${targetChips || '<span style="color:#666;font-size:0.85em;">No targets yet — star prospects below with ☆.</span>'}</div>
                </div>
                <div style="display:flex;gap:10px;margin-bottom:15px;">
                    <button id="win-targets" class="secondary" style="width:auto;padding:6px 12px;${targetsOnly ? 'background:#444;' : ''}">My Targets Only</button>
                    <button id="win-all" class="secondary" style="width:auto;padding:6px 12px;${!targetsOnly ? 'background:#444;' : ''}">All Prospects</button>
                    <select id="win-pos" class="input-field" style="width:auto;padding:6px;">
                        <option value="ALL">All Positions</option>
                        <option value="F" ${posFilter === 'F' ? 'selected' : ''}>Forwards</option>
                        <option value="D" ${posFilter === 'D' ? 'selected' : ''}>Defensemen</option>
                        <option value="G" ${posFilter === 'G' ? 'selected' : ''}>Goalies</option>
                    </select>
                </div>
                <div style="display:flex;flex-direction:column;gap:10px;max-height:450px;overflow-y:auto;">
                    ${cards || '<p style="color:#888;">No prospects match the selected filter.</p>'}
                </div>
            </div>`;

        container.querySelector('#win-targets').onclick = () => { targetsOnly = true; paint(); };
        container.querySelector('#win-all').onclick = () => { targetsOnly = false; paint(); };
        container.querySelector('#win-pos').onchange = e => { posFilter = e.target.value; paint(); };

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
                const budgetNow = calculateWindowPoints(getUserTeam(), st.coach);
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

        container.querySelectorAll('[data-alloc]').forEach(input => {
            input.addEventListener('change', e => {
                const id = e.target.getAttribute('data-alloc');
                const st = getState();
                const a = st.recruitWeekAlloc || {};
                const budgetNow = calculateWindowPoints(getUserTeam(), st.coach);
                const spentNow = Object.values(a).reduce((x, y) => x + y, 0);
                const cur = a[id] || 0;
                let v = Math.floor((parseInt(e.target.value, 10) || 0) / STEP) * STEP;
                if (v < 0) v = 0;
                const maxV = budgetNow - spentNow + cur;
                if (v > maxV) v = Math.floor(maxV / STEP) * STEP;
                setAlloc(id, v);
            });
        });

        container.querySelectorAll('[data-star]').forEach(btn => {
            btn.addEventListener('click', () => {
                const res = toggleRecruitTarget(btn.getAttribute('data-star'));
                if (res === 'full') alert(`Target board is full (${MAX_RECRUIT_TARGETS}). Remove one first.`);
                paint();
            });
        });

        container.querySelectorAll('[data-untarget]').forEach(btn => {
            btn.addEventListener('click', () => {
                toggleRecruitTarget(btn.getAttribute('data-untarget'));
                paint();
            });
        });

        container.querySelector('#win-submit').onclick = () => {
            submitRecruitWindow();
            // Continue to the post-week screen this window interrupted.
            const s = getState();
            const team = getUserTeam();
            const confId = params.confId || (team && team.confId);
            if (params.hadGame) showScreen('game-day', { weekIndex: params.weekIndex || 0, confId });
            else showScreen('weekly-recap', { weekIndex: params.weekIndex || 0, confId });
        };
    };

    paint();
}
