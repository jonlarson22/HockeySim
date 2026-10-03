// screens/roster.js — roster management.
import { getState, getUserTeam, update } from '../store.js';
import { showScreen } from '../router.js';
import { enforceRosterLimits } from '../engine.js';
import { releasePlayer } from '../actions.js';
import { esc, openModal, closeModal } from '../ui.js';

const YEAR_VAL = { Fr: 1, So: 2, Jr: 3, Sr: 4 };

function findPlayer(team, playerId) {
    return [...team.roster.forwards, ...team.roster.defensemen, ...team.roster.goalies]
        .find(p => p.id === playerId);
}

function openPlayerModal(player) {
    const g = player.seasonGoals || 0, a = player.seasonAssists || 0;
    const seasonHTML = `<p style="margin-top:0;"><strong>Season:</strong> <span style="color:#4ade80;">${g}G ${a}A ${g + a}P</span></p>`;
    const statsHTML = '<ul>' + Object.entries(player.stats)
        .map(([stat, val]) => `<li><strong>${esc(stat.toUpperCase())}:</strong> ${val}</li>`)
        .join('') + '</ul>';
    openModal({
        title: esc(`${player.firstName} ${player.lastName}`),
        subtitle: esc(`${player.year} | Position: ${player.position} | OVR: ${player.overall} | POT: ${player.potential}`),
        bodyHTML: seasonHTML + statsHTML +
            `<button id="player-release" style="margin-top:10px;background:#8b0000;color:#fff;border:1px solid #ff0000;">Release Player</button>` +
            `<div id="release-confirm" style="margin-top:10px;"></div>`
    });
    document.querySelector('#player-release').onclick = () => {
        const c = document.querySelector('#release-confirm');
        c.innerHTML = `<p>Release ${esc(player.firstName)} ${esc(player.lastName)}? They will leave the program immediately.</p>
            <button id="release-yes" style="background:#8b0000;color:#fff;border:1px solid #ff0000;">Yes, release</button>
            <button id="release-no" class="secondary" style="margin-left:8px;">Keep</button>`;
        c.querySelector('#release-yes').onclick = () => {
            releasePlayer(player.id);
            closeModal();
            showScreen('roster');
        };
        c.querySelector('#release-no').onclick = () => { c.innerHTML = ''; };
    };
}

export function render(container) {
    const paint = (sortBy = 'overall') => {
        const s = getState();
        const team = getUserTeam();
        const { goalies, defensemen, forwards } = team.roster;

        const sorted = arr => [...arr].sort((a, b) => {
            if (sortBy === 'potential') return b.potential - a.potential;
            if (sortBy === 'age') return YEAR_VAL[b.year] - YEAR_VAL[a.year];
            if (sortBy === 'points') return ((b.seasonGoals || 0) + (b.seasonAssists || 0)) - ((a.seasonGoals || 0) + (a.seasonAssists || 0));
            return b.overall - a.overall;
        });

        const row = p => {
            const pastWeek10 = s.currentWeek > 10;
            const isRedshirt = p.status === 'Redshirt';
            const lockAttr = (pastWeek10 && isRedshirt) ? 'disabled title="Redshirt locked"' : '';
            const noRedshirt = (pastWeek10 || p.redshirtUsed) ? 'disabled' : '';
            const injuryTag = p.injuryWeeks > 0
                ? `<span style="background:#8b0000;color:#fff;padding:2px 6px;border-radius:4px;font-size:0.8em;margin-right:5px;border:1px solid #ff0000;">INJ (${p.injuryWeeks}W)</span>` : '';
            return `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:8px;background:#2a2a2a;margin-bottom:5px;border-radius:4px;">
                    <a href="#" class="player-link" data-id="${p.id}" style="color:var(--accent);text-decoration:none;display:flex;align-items:center;">
                        <span style="background:#444;color:#fff;padding:2px 6px;border-radius:4px;font-size:0.8em;margin-right:5px;border:1px solid #555;">OVR: ${p.overall}</span>
                        <span style="background:#1e3a8a;color:#93c5fd;padding:2px 6px;border-radius:4px;font-size:0.8em;margin-right:10px;border:1px solid #3b82f6;">POT: ${p.potential}</span>
                        ${injuryTag}
                        ${esc(p.firstName)} ${esc(p.lastName)} <span style="color:#aaa;font-size:0.9em;margin-left:5px;">(${p.year})</span>
                        <span style="color:#4ade80;font-size:0.85em;margin-left:8px;white-space:nowrap;" title="Season goals / assists / points">${p.seasonGoals || 0}G ${p.seasonAssists || 0}A ${(p.seasonGoals || 0) + (p.seasonAssists || 0)}P</span>
                    </a>
                    <select class="role-select" data-id="${p.id}" ${lockAttr} style="${(pastWeek10 && isRedshirt) ? 'background:#444;cursor:not-allowed;' : ''}">
                        <option value="Active Roster" ${p.status === 'Active Roster' ? 'selected' : ''}>Active Roster</option>
                        <option value="Practice Squad" ${p.status === 'Practice Squad' ? 'selected' : ''}>Practice Squad</option>
                        <option value="Redshirt" ${p.status === 'Redshirt' ? 'selected' : ''} ${noRedshirt}>Redshirt</option>
                    </select>
                </div>`;
        };

        let html = `
            <div class="dashboard-panel">
                <h2>Team Roster</h2>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
                    <button id="roster-back" class="secondary" style="margin:0;">Back to Dashboard</button>
                    <div>
                        <label for="roster-sort">Sort By: </label>
                        <select id="roster-sort" class="input-field" style="width:auto;display:inline-block;padding:5px;">
                            <option value="overall" ${sortBy === 'overall' ? 'selected' : ''}>Overall Rating</option>
                            <option value="potential" ${sortBy === 'potential' ? 'selected' : ''}>Potential</option>
                            <option value="age" ${sortBy === 'age' ? 'selected' : ''}>Class Year</option>
                            <option value="points" ${sortBy === 'points' ? 'selected' : ''}>Points</option>
                        </select>
                    </div>
                </div>
                <div style="margin-top:1rem;">
                    <h3>Forwards</h3>${sorted(forwards).map(row).join('')}
                    <h3 style="margin-top:15px;">Defensemen</h3>${sorted(defensemen).map(row).join('')}
                    <h3 style="margin-top:15px;">Goalies</h3>${sorted(goalies).map(row).join('')}
                </div>
            </div>`;

        container.innerHTML = html;

        container.querySelector('#roster-back').onclick = () => showScreen('dashboard');
        container.querySelector('#roster-sort').onchange = e => paint(e.target.value);

        container.querySelectorAll('.player-link').forEach(link => {
            link.addEventListener('click', e => {
                e.preventDefault();
                const playerId = e.target.closest('a').getAttribute('data-id');
                const player = findPlayer(getUserTeam(), playerId);
                if (player) openPlayerModal(player);
            });
        });

        container.querySelectorAll('.role-select').forEach(select => {
            select.addEventListener('change', e => {
                const playerId = e.target.getAttribute('data-id');
                update(st => {
                    const t = st.leagueTeams.find(x => x.id === st.teamId);
                    const player = findPlayer(t, playerId);
                    if (player) {
                        player.status = e.target.value;
                        enforceRosterLimits(t.roster);
                    }
                });
                paint(container.querySelector('#roster-sort').value);
            });
        });
    };

    paint('overall');
}
