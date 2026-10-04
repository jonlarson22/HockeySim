// screens/roster.js — roster management.
import { getState, getUserTeam, update } from '../store.js';
import { showScreen } from '../router.js';
import { enforceRosterLimits } from '../engine.js';
import { releasePlayer } from '../actions.js';
import { getLines, lineChemistry, lineEffectiveOvr, getRole } from '../lines.js';
import { esc, openModal, closeModal } from '../ui.js';

const YEAR_VAL = { Fr: 1, So: 2, Jr: 3, Sr: 4 };

function findPlayer(team, playerId) {
    return [...team.roster.forwards, ...team.roster.defensemen, ...team.roster.goalies]
        .find(p => p.id === playerId);
}

function openPlayerModal(player) {
    const g = player.seasonGoals || 0, a = player.seasonAssists || 0;
    const pim = player.seasonPIM || 0, pm = player.seasonPlusMinus || 0, ppg = player.seasonPPG || 0;
    const pmStr = (pm >= 0 ? '+' : '') + pm;
    let seasonHTML;
    if (player.position === 'G') {
        const w = player.seasonWins || 0, l = player.seasonLosses || 0, so = player.seasonShutouts || 0;
        const svpct = player.seasonShotsAgainst ? (player.seasonSaves / player.seasonShotsAgainst * 100).toFixed(1) + '%' : '—';
        seasonHTML = `<p style="margin-top:0;"><strong>Season:</strong> <span style="color:#4ade80;">${w}W-${l}L, ${so}SO, ${svpct} SV%</span></p>`;
    } else {
        seasonHTML = `<p style="margin-top:0;"><strong>Season:</strong> <span style="color:#4ade80;">${g}G ${a}A ${g + a}P, ${pmStr}, ${pim} PIM (${ppg} PPG)</span></p>`;
    }
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
    const paint = (sortBy = 'overall', view = 'roster') => {
        const s = getState();
        const team = getUserTeam();
        const { goalies, defensemen, forwards } = team.roster;

        if (view === 'lines') { paintLines(container, team, () => paint(sortBy, 'roster')); return; }

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
            const posTag = p.linePos ? `<span style="color:#93c5fd;font-size:0.85em;margin-left:8px;">${p.linePos} · ${getRole(p)}</span>` : '';
            return `
                <div class="roster-row" style="display:flex;justify-content:space-between;align-items:center;padding:8px;background:#2a2a2a;margin-bottom:5px;border-radius:4px;">
                    <a href="#" class="player-link" data-id="${p.id}" style="color:var(--accent);text-decoration:none;display:flex;align-items:center;flex-wrap:wrap;row-gap:4px;min-width:0;">
                        <span style="background:#444;color:#fff;padding:2px 6px;border-radius:4px;font-size:0.8em;margin-right:5px;border:1px solid #555;">OVR: ${p.overall}</span>
                        <span style="background:#1e3a8a;color:#93c5fd;padding:2px 6px;border-radius:4px;font-size:0.8em;margin-right:10px;border:1px solid #3b82f6;">POT: ${p.potential}</span>
                        ${injuryTag}
                        ${esc(p.firstName)} ${esc(p.lastName)} <span style="color:#aaa;font-size:0.9em;margin-left:5px;">(${p.year})</span>${posTag}
                        <span class="player-stats" style="color:#4ade80;font-size:0.85em;margin-left:8px;white-space:nowrap;" title="Season stats">${p.position === 'G'
                            ? `${p.seasonWins || 0}W ${p.seasonLosses || 0}L ${p.seasonShutouts || 0}SO`
                            : `${p.seasonGoals || 0}G ${p.seasonAssists || 0}A ${(p.seasonGoals || 0) + (p.seasonAssists || 0)}P ${((p.seasonPlusMinus || 0) >= 0 ? '+' : '') + (p.seasonPlusMinus || 0)} ${p.seasonPIM || 0}PIM`}</span>
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
                    <div style="display:flex;gap:8px;align-items:center;">
                        <button id="roster-back" class="secondary" style="margin:0;">Back to Dashboard</button>
                        <button id="view-lines" class="secondary" style="margin:0;">Lines</button>
                    </div>
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
        container.querySelector('#view-lines').onclick = () => paint(sortBy, 'lines');
        container.querySelector('#roster-sort').onchange = e => paint(e.target.value, view);

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
                paint(container.querySelector('#roster-sort').value, view);
            });
        });
    };

    paint('overall', 'roster');
}

// Lines view: 4 forward lines with chemistry and effective OVR, click-to-swap.
function paintLines(container, team, backToRoster) {
    const forwards = team.roster.forwards;
    const lines = getLines(forwards);
    let selectedId = null;

    const renderLines = () => {
        const linesHtml = [1, 2, 3, 4].map(l => {
            const line = lines[l] || {};
            const C = line.C, LW = line.LW, RW = line.RW;
            const chem = lineChemistry(C, LW, RW);
            const eff = lineEffectiveOvr(C, LW, RW);
            const chemColor = chem > 0 ? '#4ade80' : chem < 0 ? '#f87171' : '#888';
            const chemSign = chem > 0 ? '+' : '';
            const chemTxt = chemSign + (chem * 100).toFixed(0) + '%';
            const card = (p, slot) => {
                if (!p) return '<div style="flex:1;padding:10px;background:#1a1a1a;border-radius:4px;text-align:center;color:#666;">- ' + slot + ' (vacant) -</div>';
                const sel = p.id === selectedId ? 'border:2px solid var(--accent);' : 'border:1px solid #444;';
                const inj = p.injuryWeeks > 0 ? ' <span style="color:#f87171;">(INJ)</span>' : '';
                const oop = p.linePos !== slot ? ' <span style="color:#fbbf24;" title="Out of position">!</span>' : '';
                return '<div data-pid="' + p.id + '" class="line-player" style="flex:1;padding:10px;background:#2a2a2a;border-radius:4px;cursor:pointer;' + sel + '">' +
                    '<div style="font-size:0.75em;color:#888;">' + slot + '</div>' +
                    '<div><strong>' + esc(p.firstName) + ' ' + esc(p.lastName) + '</strong>' + inj + oop + '</div>' +
                    '<div style="font-size:0.8em;color:#aaa;">' + (p.linePos || '?') + ' - ' + getRole(p) + ' - OVR ' + p.overall + '</div>' +
                    '</div>';
            };
            return '<div style="margin-bottom:12px;background:#1e1e1e;border-radius:6px;padding:10px;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
                '<strong>Line ' + l + '</strong>' +
                '<span style="font-size:0.9em;">Eff OVR <strong>' + eff.toFixed(1) + '</strong> <span style="color:' + chemColor + ';">(' + chemTxt + ' chem)</span></span>' +
                '</div>' +
                '<div style="display:flex;gap:8px;">' + card(LW, 'LW') + card(C, 'C') + card(RW, 'RW') + '</div>' +
                '</div>';
        }).join('');

        const reserves = forwards.filter(p => !p.lineSlot && p.status === 'Active Roster');
        let resHtml = '';
        if (reserves.length) {
            resHtml = '<h3 style="margin-top:15px;">Reserves (click to swap into a line)</h3>';
            reserves.forEach(p => {
                const sel = p.id === selectedId ? 'border:2px solid var(--accent);' : 'border:1px solid #444;';
                resHtml += '<div data-pid="' + p.id + '" class="line-player" style="padding:8px;background:#2a2a2a;margin-bottom:5px;border-radius:4px;cursor:pointer;' + sel + '">' +
                    '<strong>' + esc(p.firstName) + ' ' + esc(p.lastName) + '</strong>' +
                    '<span style="font-size:0.85em;color:#aaa;margin-left:8px;">' + (p.linePos || '?') + ' - ' + getRole(p) + ' - OVR ' + p.overall + '</span>' +
                    '</div>';
            });
        }

        container.innerHTML =
            '<div class="dashboard-panel">' +
            '<h2>Forward Lines</h2>' +
            '<p style="color:#888;font-size:0.9em;">Click two players to swap them. Chemistry adjusts each line\'s effective OVR (+/-5%).</p>' +
            '<div style="margin-bottom:15px;"><button id="lines-back" class="secondary">Back to Roster</button></div>' +
            linesHtml + resHtml +
            '</div>';

        container.querySelector('#lines-back').onclick = backToRoster;
        container.querySelectorAll('.line-player').forEach(el => {
            el.onclick = () => {
                const pid = el.dataset.pid;
                if (!selectedId) { selectedId = pid; renderLines(); return; }
                if (selectedId === pid) { selectedId = null; renderLines(); return; }
                update(st => {
                    const t = st.leagueTeams.find(x => x.id === st.teamId);
                    const a = findPlayer(t, selectedId), b = findPlayer(t, pid);
                    if (a && b) {
                        const tmp = a.lineSlot;
                        a.lineSlot = b.lineSlot;
                        b.lineSlot = tmp;
                        a.tempFill = false; b.tempFill = false;
                    }
                });
                selectedId = null;
                const t2 = getUserTeam();
                const fresh = getLines(t2.roster.forwards);
                for (let k = 1; k <= 4; k++) lines[k] = fresh[k];
                renderLines();
            };
        });
    };
    renderLines();
}
