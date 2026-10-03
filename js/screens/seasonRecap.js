// screens/seasonRecap.js — end-of-season summary, gateway to the offseason.
// Rendered BEFORE beginOffseason() runs, so record/graduates reflect the
// season that just ended.
import { getState, getUserTeam, update } from '../store.js';
import { showScreen } from '../router.js';
import { resolveSeason } from '../actions.js';
import { nationalRank, computeSeasonAwards, computeCoachAwards } from '../engine.js';
import { tourneyRuns } from '../career.js';
import { conferences } from '../data.js';
import { esc } from '../ui.js';

function confFinish(state, team) {
    const sorted = [...state.leagueTeams]
        .filter(t => t.confId === team.confId)
        .sort((a, b) => {
            const acp = (a.confWins || 0) * 2 + (a.confOtl || 0);
            const bcp = (b.confWins || 0) * 2 + (b.confOtl || 0);
            if (bcp !== acp) return bcp - acp;
            const aop = (a.wins || 0) * 2 + (a.otl || 0);
            const bop = (b.wins || 0) * 2 + (b.otl || 0);
            if (bop !== aop) return bop - aop;
            return b.prestige - a.prestige;
        });
    return sorted.findIndex(t => t.id === team.id) + 1;
}

function ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function allPlayers(team) {
    return [...team.roster.forwards, ...team.roster.defensemen, ...team.roster.goalies];
}

export function render(container) {
    const s = getState();
    const team = getUserTeam();
    const rank = nationalRank(s.leagueTeams, team.id);
    const conf = conferences.find(c => c.id === team.confId);
    const grads = allPlayers(team).filter(p => p.year === 'Sr');
    const runs = tourneyRuns(s, team);
    const confRun = runs.conf.label;
    const natRun = runs.nat.label;
    // Awards are computed (and +1 OVR applied) before the offseason runs.
    let awards;
    update(s => { awards = computeSeasonAwards(s); });
    const myAwards = awards.filter(a => a.team === team.name);
    const awardsHTML = awards.length ? awards.map(a =>
        `<div>${esc(a.name)} <span style="color:#aaa;">(${a.position}, ${esc(a.team)})</span> — <span style="color:var(--accent);">${esc(a.label)}</span> <span style="color:#4ade80;">+1 OVR</span></div>`
    ).join('') : '<span style="color:#888;">None</span>';

    // Coach of the Year. If the user won, they pick where the +1 skill point goes.
    let coachAwards;
    update(s => { coachAwards = computeCoachAwards(s); });
    const myCoty = coachAwards.filter(a => a.isUser);
    const cotyHTML = coachAwards.map(a => {
        const conf = a.confId ? conferences.find(c => c.id === a.confId) : null;
        const where = conf ? ` (${esc(conf.name)})` : '';
        const yours = a.isUser ? ' <span style="color:var(--accent);">— YOU</span>' : '';
        return `<div>${esc(a.label)}${where}: <strong>${esc(a.teamName)}</strong>${yours}</div>`;
    }).join('');
    const SKILL_LABELS = { offense: 'Offensive Tactics', defense: 'Defensive Tactics', development: 'Player Development', recruiting: 'Recruiting Prowess', scouting: 'Scouting Network' };

    container.innerHTML = `
        <div class="dashboard-panel" style="max-width: 1000px; margin: 0 auto;">
            <h2>Season Recap — ${s.year}</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
                <div>
                    <h3>Regular Season Record</h3>
                    <p style="font-size: 1.3em; color: var(--accent);">${team.wins || 0}-${team.losses || 0}-${team.otl || 0}</p>
                    <h3 style="margin-top: 20px;">Conference Finish</h3>
                    <p style="font-size: 1.1em;">${ordinal(confFinish(s, team))} in ${esc(conf.name)}</p>
                    <h3 style="margin-top: 20px;">National Ranking</h3>
                    <p style="font-size: 1.1em; color: var(--accent);">${rank <= 25 ? '#' + rank : 'Unranked'}</p>
                </div>
                <div>
                    <h3>Conference Tournament</h3>
                    <p style="font-size: 0.9em;">${esc(confRun)}</p>
                    <h3 style="margin-top: 20px;">National Tournament</h3>
                    <p style="font-size: 0.9em;">${esc(natRun)}</p>
                    <h3 style="margin-top: 20px;">Graduating Players</h3>
                    <div style="font-size: 0.9em; max-height: 150px; overflow-y: auto;">
                        ${grads.length ? grads.map(p => `<div>${esc(p.firstName)} ${esc(p.lastName)} <span style="color:#aaa;">(${p.position}, OVR ${p.overall})</span></div>`).join('') : '<span style="color:#888;">None</span>'}
                    </div>
                </div>
            </div>
            <h3>Season Awards ${myAwards.length ? `<span style="color:var(--accent);">(${myAwards.length} yours!)</span>` : ''}</h3>
            <div style="font-size: 0.9em; max-height: 180px; overflow-y: auto; margin-bottom: 10px;">
                ${awardsHTML}
            </div>
            <h3>Coach of the Year</h3>
            <div style="font-size: 0.9em; margin-bottom: 10px;">${cotyHTML}</div>
            ${myCoty.length ? `
            <div id="coty-bonus" style="background:#1a2e1a;border:1px solid #4ade80;border-radius:6px;padding:12px;margin-bottom:10px;">
                <div style="margin-bottom:8px;">🏆 You won <strong>${myCoty.map(a => esc(a.label)).join(' + ')}</strong>! Pick where your +${myCoty.length} skill point${myCoty.length > 1 ? 's go' : ' goes'}:</div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    ${Object.entries(SKILL_LABELS).map(([k, label]) => `<button class="secondary" data-skill="${k}" style="width:auto;">${label}</button>`).join('')}
                </div>
            </div>` : ''}
            <button id="recap-offseason" class="primary" style="width: 100%; margin-top: 20px;">Continue to Offseason</button>
        </div>`;

    container.querySelector('#recap-offseason').onclick = () => {
        resolveSeason();
        showScreen('carousel');
    };

    // COTY skill point picker (if the user won).
    const bonusBox = container.querySelector('#coty-bonus');
    if (bonusBox) {
        let remaining = myCoty.length;
        bonusBox.querySelectorAll('button[data-skill]').forEach(btn => {
            btn.onclick = () => {
                if (remaining <= 0) return;
                const key = btn.dataset.skill;
                update(s => {
                    s.coach.skills[key] = Math.min(30, (s.coach.skills[key] || 0) + 1);
                });
                remaining--;
                btn.disabled = true;
                btn.style.opacity = '0.4';
                if (remaining <= 0) {
                    bonusBox.querySelector('div').innerHTML = '✅ Skill point applied. Good luck next season!';
                }
            };
        });
    }
}
