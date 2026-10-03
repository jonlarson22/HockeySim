// screens/portal.js — transfer portal (offseason, before freshman recruiting).
// Single-shot: retain your own flagged players, bid on portal entrants.
// Spending here reduces freshman recruiting week 1's budget (shared pool).
import { getState, getUserTeam, update } from '../store.js';
import { showScreen } from '../router.js';
import { submitPortal, respondToRealignmentInvite } from '../actions.js';
import { portalBudget } from '../portal.js';
import { getScoutedGrade, getPotentialDescriptor } from '../recruiting.js';
import { conferences } from '../data.js';
import { esc } from '../ui.js';

export function render(container) {
    let alloc = {};       // { portalPlayerId: points }
    let retain = new Set(); // playerIds to retain
    let submitted = false;

    const paint = () => {
        const s = getState();
        const team = getUserTeam();
        const portal = (s.transferPortal || []).filter(p => true);
        const budget = portalBudget(s);
        const scouting = s.coach.skills.scouting || 0;
        const showPOT = scouting >= 20;

        // User's players considering transfer.
        const considering = [];
        for (const key of ['forwards', 'defensemen', 'goalies']) {
            (team.roster[key] || []).forEach(p => { if (p.consideringTransfer) considering.push(p); });
        }

        const spentRetain = [...retain].reduce((sum, id) => {
            const p = considering.find(x => x.id === id);
            return sum + (p ? (p.retentionCost || 0) : 0);
        }, 0);
        const spentPortal = Object.values(alloc).reduce((a, b) => a + b, 0);
        const pointsLeft = budget - spentRetain - spentPortal;

        const statLine = (p) => {
            const st = p.portalStats || {};
            if (p.position === 'G') {
                const sv = st.svpct ? ` ${st.svpct}% SV` : '';
                return `${st.w || 0}W-${st.l || 0}L, ${st.so || 0}SO${sv}`;
            }
            const pm = (st.pm || 0) >= 0 ? '+' + (st.pm || 0) : '' + (st.pm || 0);
            return `${st.g || 0}G ${st.a || 0}A, ${pm}, ${st.pim || 0} PIM`;
        };

        const retainCards = considering.map(p => {
            const cost = p.retentionCost || 0;
            const checked = retain.has(p.id) ? 'checked' : '';
            const dis = submitted ? 'disabled' : '';
            return `
                <div style="background:#2a2a2a;padding:12px;border-radius:6px;display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <strong>${esc(p.firstName)} ${esc(p.lastName)}</strong> (${p.position}, ${p.year}, OVR ${p.overall})
                        <div style="font-size:0.85em;color:#fbbf24;margin-top:4px;">⚠ ${esc(p.transferReason || 'Considering transfer')}</div>
                    </div>
                    <label style="display:flex;align-items:center;gap:8px;white-space:nowrap;">
                        <input type="checkbox" data-retain="${p.id}" ${checked} ${dis} style="width:18px;height:18px;">
                        Retain (${cost} pts)
                    </label>
                </div>`;
        }).join('');

        const portalCards = portal.map(p => {
            const myAlloc = alloc[p.id] || 0;
            const clears = myAlloc >= (p.portalThreshold || 9999);
            const dis = submitted ? 'disabled' : '';
            return `
                <div style="background:#2a2a2a;padding:12px;border-radius:6px;display:flex;justify-content:space-between;align-items:center;${clears ? 'border:1px solid #4ade80;' : ''}">
                    <div>
                        <div><strong>${esc(p.firstName)} ${esc(p.lastName)}</strong> (${p.position}, ${p.year}) — <span style="color:#4ade80;">OVR ${p.overall}</span> <span style="color:#aaa;">| Pot: ${showPOT ? p.potential : getPotentialDescriptor(p.potential)}</span></div>
                        <div style="font-size:0.85em;color:#aaa;margin-top:4px;">${statLine(p)} · from ${esc(p.portalFromName || '—')} · <em>${esc(p.transferReason || '')}</em> · signs at <strong>${p.portalThreshold} pts</strong></div>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <button class="secondary" data-sub="${p.id}" ${dis} style="width:30px;padding:4px;">-</button>
                        <input type="number" data-alloc="${p.id}" value="${myAlloc}" min="0" ${dis} style="width:60px;text-align:center;padding:4px;">
                        <button class="secondary" data-add="${p.id}" ${dis} style="width:30px;padding:4px;">+</button>
                    </div>
                </div>`;
        }).join('');

        // Conference realignment invite (if the user's team earned one).
        const invite = (s.realignmentInvites || []).find(i => i.teamId === s.teamId);
        let inviteHTML = '';
        if (invite && !submitted) {
            const toName = conferences.find(c => c.id === invite.toConf)?.name || invite.toConf;
            const fromName = conferences.find(c => c.id === invite.fromConf)?.name || invite.fromConf;
            inviteHTML = `
                <div style="background:#1e3a5f;border:2px solid #3b82f6;padding:14px;border-radius:8px;margin-bottom:16px;">
                    <h3 style="margin-top:0;">📨 Conference Realignment Invite</h3>
                    <p>The <strong>${esc(toName)}</strong> has invited ${esc(team.name)} to join, replacing ${esc(invite.downTeamName)} (relegated to the ${esc(fromName)}).</p>
                    <div style="display:flex;gap:8px;">
                        <button id="realign-accept" style="padding:8px 20px;">Accept Invite</button>
                        <button id="realign-decline" class="secondary" style="padding:8px 20px;">Decline</button>
                    </div>
                </div>`;
        }
        // Realignment results from around the league.
        const realignLog = (s.realignmentLog || []).map(l => `<div>🔄 ${esc(l)}</div>`).join('');

        container.innerHTML = `
            <h2>Transfer Portal</h2>
            ${inviteHTML}
            ${realignLog ? `<div style="margin-bottom:12px;color:#aaa;">${realignLog}</div>` : ''}
            <p style="color:#aaa;">Portal spending comes out of your recruiting budget — freshman week 1 will have <strong>${Math.max(0, pointsLeft)} pts</strong> left.</p>
            <p><strong>Budget:</strong> <span style="color:#4ade80;">${pointsLeft} / ${budget} pts</span> remaining</p>
            ${considering.length ? `<h3>Your players considering transfer</h3><div style="display:grid;gap:8px;margin-bottom:16px;">${retainCards}</div>` : ''}
            <h3>In the portal (${portal.length})</h3>
            ${portal.length ? `<div style="display:grid;gap:8px;">${portalCards}</div>` : '<p style="color:#aaa;">No players in the portal this year.</p>'}
            <div style="margin-top:16px;display:flex;gap:8px;">
                <button id="portal-submit" ${submitted ? 'disabled' : ''} style="padding:10px 24px;">${submitted ? 'Submitted' : 'Submit Portal Moves'}</button>
            </div>
            <div id="portal-result" style="margin-top:12px;"></div>`;

        if (submitted) return;

        const clampAlloc = () => {
            // Keep total spend within budget.
            let total = spentRetain + Object.values(alloc).reduce((a, b) => a + b, 0);
            if (total > budget) {
                // Trim portal allocations (retain is all-or-nothing via checkbox).
                for (const id of Object.keys(alloc)) {
                    while (total > budget && alloc[id] > 0) { alloc[id] -= 10; total -= 10; }
                    if (alloc[id] <= 0) delete alloc[id];
                }
            }
        };

        container.querySelectorAll('[data-add]').forEach(b => b.onclick = () => {
            const id = b.getAttribute('data-add');
            alloc[id] = (alloc[id] || 0) + 10;
            clampAlloc(); paint();
        });
        container.querySelectorAll('[data-sub]').forEach(b => b.onclick = () => {
            const id = b.getAttribute('data-sub');
            alloc[id] = Math.max(0, (alloc[id] || 0) - 10);
            if (!alloc[id]) delete alloc[id];
            paint();
        });
        container.querySelectorAll('[data-alloc]').forEach(inp => inp.onchange = () => {
            const id = inp.getAttribute('data-alloc');
            alloc[id] = Math.max(0, parseInt(inp.value, 10) || 0);
            if (!alloc[id]) delete alloc[id];
            clampAlloc(); paint();
        });
        container.querySelectorAll('[data-retain]').forEach(cb => cb.onchange = () => {
            const id = cb.getAttribute('data-retain');
            const p = considering.find(x => x.id === id);
            const cost = p ? (p.retentionCost || 0) : 0;
            if (cb.checked) {
                if (spentRetain + spentPortal + cost <= budget) retain.add(id);
                else { cb.checked = false; return; }
            } else retain.delete(id);
            paint();
        });
        const acceptBtn = container.querySelector('#realign-accept');
        if (acceptBtn) {
            acceptBtn.onclick = () => { respondToRealignmentInvite(true); paint(); };
            container.querySelector('#realign-decline').onclick = () => { respondToRealignmentInvite(false); paint(); };
        }
        container.querySelector('#portal-submit').onclick = () => {
            const res = submitPortal(alloc, [...retain]);
            submitted = true;
            const bits = [];
            if (res.signed.length) bits.push(`Signed: ${res.signed.map(p => esc(p.firstName) + ' ' + esc(p.lastName)).join(', ')}`);
            if (res.retained.length) bits.push(`Retained: ${res.retained.map(p => esc(p.firstName) + ' ' + esc(p.lastName)).join(', ')}`);
            if (res.walked.length) bits.push(`Left: ${res.walked.map(p => esc(p.firstName) + ' ' + esc(p.lastName)).join(', ')}`);
            if (!bits.length) bits.push('No portal moves made.');
            container.querySelector('#portal-result').innerHTML =
                `<p style="color:#4ade80;">${bits.join('<br>')}</p>
                 <button id="portal-continue" style="padding:10px 24px;margin-top:8px;">Continue to Freshman Recruiting</button>`;
            container.querySelector('#portal-continue').onclick = () => showScreen('recruiting');
            paint();
        };
    };

    paint();
}
