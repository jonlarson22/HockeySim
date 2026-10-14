// screens/seasonGoals.js — pick 2 season goals at season start.
// Shown from the dashboard in week 1 when no goals are set yet.

import { getState, getUserTeam, update } from '../store.js';
import { showScreen } from '../router.js';
import { SEASON_GOALS, suggestedTier } from '../goals.js';
import { esc } from '../ui.js';

const TIER_META = {
    rebuild: { label: '🔨 Rebuild', color: '#8a6d1b' },
    competitive: { label: '⚔️ Competitive', color: '#1d4ed8' },
    contender: { label: '👑 Contender', color: '#7c2d12' },
};

export function render(container) {
    const team = getUserTeam();
    const suggest = suggestedTier(team.prestige);
    const picked = [];

    const goalsByTier = ['rebuild', 'competitive', 'contender'].map(tier => ({
        tier,
        goals: SEASON_GOALS.filter(g => g.tier === tier && !(g.needsHistory && !getState().lastSeasonWins && getState().year === 1))
    }));

    container.innerHTML = `
        <div style="max-width:640px;margin:0 auto;padding:16px;">
            <h2>🎯 Set Your Season Goals</h2>
            <p style="color:#aaa;">Pick <b>2</b>. Hit them and your season grade climbs — miss them and it slips.
            Based on ${esc(team.name)}'s prestige, the <b>${TIER_META[suggest].label}</b> tier fits you best.</p>
            ${goalsByTier.map(({ tier, goals }) => `
                <h3 style="color:${TIER_META[tier].color};margin:18px 0 8px;">${TIER_META[tier].label}
                    ${tier === suggest ? '<span style="font-size:0.7em;color:#aaa;"> ← suggested</span>' : ''}</h3>
                ${goals.map(g => `
                    <label class="goal-pick" data-id="${g.id}" style="display:block;padding:10px 12px;margin:6px 0;border:1px solid #444;border-radius:8px;cursor:pointer;">
                        <input type="checkbox" value="${g.id}" style="margin-right:10px;transform:scale(1.2);">
                        ${esc(g.label)}
                    </label>`).join('')}
            `).join('')}
            <div id="goals-err" style="color:#f87171;min-height:1.4em;margin-top:8px;"></div>
            <button id="goals-confirm" style="margin-top:8px;padding:10px 22px;font-size:1em;">Lock In Goals</button>
        </div>`;

    container.querySelectorAll('.goal-pick input').forEach(box => {
        box.addEventListener('change', () => {
            const checked = container.querySelectorAll('.goal-pick input:checked');
            if (checked.length > 2) { box.checked = false; return; }
            container.querySelectorAll('.goal-pick').forEach(l => {
                const on = l.querySelector('input').checked;
                l.style.borderColor = on ? '#4ade80' : '#444';
                l.style.background = on ? 'rgba(74,222,128,0.08)' : 'transparent';
            });
        });
    });

    container.querySelector('#goals-confirm').addEventListener('click', () => {
        const ids = [...container.querySelectorAll('.goal-pick input:checked')].map(b => b.value);
        if (ids.length !== 2) {
            container.querySelector('#goals-err').textContent = 'Pick exactly 2 goals.';
            return;
        }
        update(state => { state.seasonGoals = ids; });
        showScreen('dashboard');
    });
}

export function destroy() {}
