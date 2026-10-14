// screens/selectionSunday.js — Selection Sunday reveal of the national finals field.
//
// Shown once, right after the week-41 conference finals sim. The 32-team field
// (10 AQ + 16 at-large locks + 6 bubble picks, seeded 1-32) was already selected
// by generateNationalTournament during the sim; this screen is the reveal.
// Generic language only — "nationals" / "national finals", never "dancing".
import { getState, getUserTeam } from '../store.js';
import { showScreen } from '../router.js';
import { conferences } from '../data.js';
import { esc } from '../ui.js';

const record = t => `${t.wins || 0}-${t.losses || 0}-${t.otl || 0}`;

const bidBadge = f => {
    if (f.bid === 'AQ') return '<span style="background:#8a6d1b;color:#ffe9a8;padding:1px 7px;border-radius:4px;font-size:0.75em;font-weight:bold;">AQ</span>';
    if (f.bubble) return '<span style="background:#7c2d12;color:#fdba74;padding:1px 7px;border-radius:4px;font-size:0.75em;font-weight:bold;">BUBBLE</span>';
    return '<span style="background:#333;color:#aaa;padding:1px 7px;border-radius:4px;font-size:0.75em;font-weight:bold;">AT-LARGE</span>';
};

export function render(container, params) {
    const s = getState();
    const team = getUserTeam();
    const field = (s.nationalField || [])
        .map(f => ({ ...f, t: s.leagueTeams.find(x => x.id === f.teamId) }))
        .filter(f => f.t);
    const snubs = s.tourneySnubs || [];
    const weekIndex = params.weekIndex;

    // The user's conference final, if they played in one (week 31).
    const myGame = (s.schedule[weekIndex] || []).find(g => g.homeTeamId === team.id || g.awayTeamId === team.id);
    let finalCard = '';
    if (myGame && myGame.played) {
        const mine = myGame.homeTeamId === team.id;
        const myScore = mine ? myGame.homeScore : myGame.awayScore;
        const oppScore = mine ? myGame.awayScore : myGame.homeScore;
        const opp = s.leagueTeams.find(t => t.id === (mine ? myGame.awayTeamId : myGame.homeTeamId));
        const won = myScore > oppScore;
        const confName = conferences.find(c => c.id === team.confId).name;
        finalCard = `<div class="dashboard-panel" style="text-align:center;margin-bottom:12px;">
            <div style="color:#888;font-size:0.85em;">${esc(confName)} Championship</div>
            <div style="font-size:1.2em;font-weight:bold;margin:4px 0;">${esc(team.name)} ${myScore} – ${oppScore} ${esc(opp ? opp.name : '')}</div>
            <div style="color:${won ? '#4ade80' : '#f87171'};font-weight:bold;">${won ? 'Conference champions — automatic bid to nationals.' : 'Season over — awaiting the committee.'}</div>
            <div style="margin-top:8px;"><button id="ss-replay" class="secondary">Full game replay</button></div>
        </div>`;
    }

    // The user's moment.
    const me = field.find(f => f.teamId === team.id);
    const snubbed = !me && snubs.includes(team.name);
    let banner;
    if (me && me.bid === 'AQ') {
        banner = `<div style="background:#0c2a1a;border:2px solid #4ade80;padding:12px;border-radius:8px;margin-bottom:12px;text-align:center;font-size:1.1em;">🏆 Conference champions — you're heading to nationals as the <strong>#${me.seed} seed</strong>!</div>`;
    } else if (me && me.bubble) {
        banner = `<div style="background:#0c2a1a;border:2px solid #4ade80;padding:12px;border-radius:8px;margin-bottom:12px;text-align:center;font-size:1.1em;">✅ You're in! One of the last at-large picks — <strong>#${me.seed} seed</strong> heading to nationals.</div>`;
    } else if (me) {
        banner = `<div style="background:#0c2a1a;border:2px solid #4ade80;padding:12px;border-radius:8px;margin-bottom:12px;text-align:center;font-size:1.1em;">✅ You're heading to nationals — <strong>#${me.seed} seed</strong>!</div>`;
    } else if (snubbed) {
        banner = `<div style="background:#2a0c0c;border:2px solid #f87171;padding:12px;border-radius:8px;margin-bottom:12px;text-align:center;font-size:1.1em;">❌ Snubbed — one of the first four out. Your season ends here.</div>`;
    } else {
        banner = `<div style="background:#1a1a1a;border:1px solid #444;padding:12px;border-radius:8px;margin-bottom:12px;text-align:center;">Your season ends here. The road to the national finals goes on without you.</div>`;
    }

    // Four reveal groups.
    const groups = [[1, 8], [9, 16], [17, 24], [25, 32]];
    const groupsHtml = groups.map(([lo, hi], gi) => {
        const rows = field.filter(f => f.seed >= lo && f.seed <= hi).map(f => {
            const mine = f.teamId === team.id ? ' style="background:#0c2a1a;border:1px solid #4ade80;"' : '';
            return `<div class="event-row"${mine}>
                <span style="color:#888;min-width:36px;font-weight:bold;">#${f.seed}</span>
                <span style="flex:1;"><strong>${esc(f.t.name)}</strong> <span style="color:#888;font-size:0.85em;">${record(f.t)}</span></span>
                ${bidBadge(f)}
            </div>`;
        }).join('');
        return `<div class="dashboard-panel" style="margin-bottom:10px;">
            <button id="ss-reveal-${gi}" class="secondary" style="width:100%;">Reveal seeds ${lo}–${hi}</button>
            <div id="ss-group-${gi}" style="display:none;margin-top:8px;">${rows}</div>
        </div>`;
    }).join('');

    const snubHtml = snubs.length
        ? `<div class="dashboard-panel" style="margin-bottom:10px;">
            <h3 style="margin-top:0;">First Four Out</h3>
            ${snubs.map(n => `<div style="color:#888;padding:4px 0;">${esc(n)}</div>`).join('')}
        </div>`
        : '';

    container.innerHTML = `<div style="max-width:720px;margin:0 auto;">
        <h2 style="text-align:center;">Selection Sunday</h2>
        <p style="text-align:center;color:#888;margin-top:-8px;">The 32-team national finals field is set.</p>
        ${finalCard}
        ${banner}
        ${groupsHtml}
        ${snubHtml}
        <button id="ss-continue" class="primary" style="width:100%;margin:10px 0 20px;">See the national bracket</button>
    </div>`;

    groups.forEach((_, gi) => {
        container.querySelector(`#ss-reveal-${gi}`).onclick = e => {
            const g = container.querySelector(`#ss-group-${gi}`);
            const open = g.style.display !== 'none';
            g.style.display = open ? 'none' : 'block';
            e.target.textContent = open ? `Reveal seeds ${groups[gi][0]}–${groups[gi][1]}` : `Hide seeds ${groups[gi][0]}–${groups[gi][1]}`;
        };
    });
    const replay = container.querySelector('#ss-replay');
    if (replay) replay.onclick = () => showScreen('game-day', { weekIndex, confId: team.confId });
    container.querySelector('#ss-continue').onclick = () => showScreen('bracket');
}
