// screens/gameDay.js — period-by-period replay of the user's game.
// The week was already simmed (every league game sims instantly); the event
// log recorded at sim time lets the user watch their game unfold.
import { getState, getUserTeam } from '../store.js';
import { showScreen } from '../router.js';
import { esc, scheduleLabel } from '../ui.js';
import { calculateTeamRatings } from '../engine.js';
import { conferences } from '../data.js';

const PERIOD_LABEL = { 1: '1st Period', 2: '2nd Period', 3: '3rd Period', 4: 'Overtime' };

function fmtTime(e) {
    return `${e.minute}:${String(e.second).padStart(2, '0')}`;
}

function record(t) {
    return `${t.wins || 0}-${t.losses || 0}-${t.otl || 0}`;
}

function ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Completed games before weekIndex involving teamId.
function pastGames(teamId, weekIndex, s) {
    const out = [];
    for (let w = 0; w < weekIndex; w++) {
        for (const g of (s.schedule[w] || [])) {
            if (g.homeScore == null || g.awayScore == null) continue;
            if (g.homeTeamId === teamId || g.awayTeamId === teamId) out.push(g);
        }
    }
    return out;
}

function formChips(games, teamId) {
    const last5 = games.slice(-5);
    if (!last5.length) return '<span style="color:#666;">—</span>';
    return last5.map(g => {
        const mine = g.homeTeamId === teamId ? g.homeScore : g.awayScore;
        const theirs = g.homeTeamId === teamId ? g.awayScore : g.homeScore;
        const r = mine > theirs ? 'W' : (g.ot ? 'O' : 'L');
        const bg = r === 'W' ? '#1d5c2e' : r === 'O' ? '#6b5b1e' : '#5c1d1d';
        return `<span style="display:inline-block;min-width:22px;text-align:center;background:${bg};border-radius:4px;padding:1px 4px;font-size:0.8em;font-weight:bold;margin-right:3px;">${r}</span>`;
    }).join('');
}

function gfga(games, teamId) {
    if (!games.length) return { gf: '–', ga: '–' };
    let gf = 0, ga = 0;
    for (const g of games) {
        gf += g.homeTeamId === teamId ? g.homeScore : g.awayScore;
        ga += g.homeTeamId === teamId ? g.awayScore : g.homeScore;
    }
    return { gf: (gf / games.length).toFixed(1), ga: (ga / games.length).toFixed(1) };
}

function confRank(team, s) {
    const sorted = s.leagueTeams.filter(t => t.confId === team.confId).sort((a, b) => {
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

function playerToWatch(team) {
    const skaters = [...(team.roster.forwards || []), ...(team.roster.defensemen || [])]
        .filter(p => p.status === 'Active Roster' && !p.injuryWeeks);
    if (!skaters.length) return null;
    skaters.sort((a, b) =>
        ((b.seasonGoals || 0) + (b.seasonAssists || 0)) - ((a.seasonGoals || 0) + (a.seasonAssists || 0))
        || b.overall - a.overall);
    return skaters[0];
}

function injuryList(team) {
    const out = [];
    for (const key of ['forwards', 'defensemen', 'goalies'])
        for (const p of (team.roster[key] || []))
            if (p.injuryWeeks > 0) out.push(p);
    return out;
}

export function render(container, params) {
    const s = getState();
    const team = getUserTeam();
    const weekIndex = params.weekIndex || 0;
    const game = (s.schedule[weekIndex] || []).find(g => g.homeTeamId === team.id || g.awayTeamId === team.id);
    if (!game || !game.events) {
        showScreen('weekly-recap', { weekIndex, confId: params.confId || team.confId });
        return;
    }

    const home = s.leagueTeams.find(t => t.id === game.homeTeamId);
    const away = s.leagueTeams.find(t => t.id === game.awayTeamId);
    const events = game.events;
    const hasOT = game.ot && events.some(e => e.period === 4);
    const steps = ['pregame', 1, 2, 3, ...(hasOT ? [4] : []), 'final'];
    let stepIdx = 0;

    const scoreLine = (a, h) => `${esc(away.abbr)} ${a} – ${h} ${esc(home.abbr)}`;

    const paint = () => {
        const step = steps[stepIdx];

        if (step === 'pregame') {
            // Tale of the tape.
            const ar = calculateTeamRatings(away.id, s);
            const hr = calculateTeamRatings(home.id, s);
            const eff = r => ({
                off: Math.round(r.offense + r.coachOffBoost),
                def: Math.round(r.defense + r.coachDefBoost),
                goal: Math.round(r.goalie),
            });
            const ae = eff(ar), he = eff(hr);
            const ovr = e => Math.round((e.off + e.def + e.goal) / 3);
            const aGames = pastGames(away.id, weekIndex, s);
            const hGames = pastGames(home.id, weekIndex, s);
            const aGF = gfga(aGames, away.id), hGF = gfga(hGames, home.id);
            const confName = cid => conferences.find(c => c.id === cid)?.name || '';
            const shortConf = cid => confName(cid).replace(' Conference', '').replace(' League', '');

            const h2h = aGames.filter(g => g.homeTeamId === home.id || g.awayTeamId === home.id);
            let h2hLine = 'First meeting this season';
            if (h2h.length) {
                let w = 0, l = 0;
                const bits = h2h.map(g => {
                    const mine = g.homeTeamId === away.id ? g.awayScore : g.homeScore;
                    const theirs = g.homeTeamId === away.id ? g.homeScore : g.awayScore;
                    const res = mine > theirs ? 'W' : 'L';
                    if (res === 'W') w++; else l++;
                    return `${res} ${mine}–${theirs}`;
                });
                const who = w > l ? esc(away.name) + ' leads' : l > w ? esc(home.name) + ' leads' : 'Split';
                h2hLine = `${who} ${w}–${l} (${bits.join(', ')})`;
            }

            const tapeRow = (label, a, h, higherBetter = true) => {
                const an = parseFloat(a), hn = parseFloat(h);
                const aWin = !isNaN(an) && !isNaN(hn) && (higherBetter ? an > hn : hn > an);
                const hWin = !isNaN(an) && !isNaN(hn) && (higherBetter ? hn > an : an > hn);
                const cell = (v, win) => `<td style="text-align:center;padding:5px 8px;${win ? 'color:#7CFC00;font-weight:bold;' : ''}">${v}</td>`;
                return `<tr style="border-top:1px solid #333;"><td style="padding:5px 8px;color:#888;">${label}</td>${cell(a, aWin)}${cell(h, hWin)}</tr>`;
            };

            const ptw = (team) => {
                const p = playerToWatch(team);
                if (!p) return '–';
                const pts = (p.seasonGoals || 0) + (p.seasonAssists || 0);
                const line = pts > 0 ? `${p.seasonGoals || 0}G ${p.seasonAssists || 0}A` : `OVR ${p.overall}`;
                return `★ ${esc(p.firstName || '')} ${esc(p.lastName || p.name || '')} <span style="color:#888;">(${line})</span>`;
            };
            const injLine = (team) => {
                const inj = injuryList(team);
                if (!inj.length) return '<span style="color:#666;">No injuries reported</span>';
                return inj.slice(0, 3).map(p => `${esc(p.firstName || '')} ${esc(p.lastName || p.name || '')} <span style="color:#f87171;">(${p.injuryWeeks}W)</span>`).join(', ')
                    + (inj.length > 3 ? ` <span style="color:#888;">+${inj.length - 3} more</span>` : '');
            };

            container.innerHTML = `
                <div class="dashboard-panel" style="max-width: 720px; margin: 0 auto;">
                    <p style="color:#888;margin:0;text-align:center;">${scheduleLabel(weekIndex + 1)}</p>
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin:12px 0;">
                        <div style="flex:1;text-align:center;">
                            <div style="font-size:1.3em;font-weight:bold;">${esc(away.name)}</div>
                            <div style="color:#888;">${record(away)} · ${ordinal(confRank(away, s))}, ${esc(shortConf(away.confId))}</div>
                            <div style="margin-top:6px;">${formChips(aGames, away.id)}</div>
                        </div>
                        <div style="color:#666;font-weight:bold;padding-top:4px;">at</div>
                        <div style="flex:1;text-align:center;">
                            <div style="font-size:1.3em;font-weight:bold;">${esc(home.name)}</div>
                            <div style="color:#888;">${record(home)} · ${ordinal(confRank(home, s))}, ${esc(shortConf(home.confId))}</div>
                            <div style="margin-top:6px;">${formChips(hGames, home.id)}</div>
                        </div>
                    </div>
                    <h3 style="margin:16px 0 4px;text-align:center;">Tale of the Tape</h3>
                    <table style="width:100%;border-collapse:collapse;font-size:0.95em;">
                        <tr style="color:#888;"><td></td><td style="text-align:center;font-weight:bold;color:#fff;">${esc(away.abbr)}</td><td style="text-align:center;font-weight:bold;color:#fff;">${esc(home.abbr)}</td></tr>
                        ${tapeRow('OVR', ovr(ae), ovr(he))}
                        ${tapeRow('Offense', ae.off, he.off)}
                        ${tapeRow('Defense', ae.def, he.def)}
                        ${tapeRow('Goalie', ae.goal, he.goal)}
                        ${tapeRow('GF/GP', aGF.gf, hGF.gf)}
                        ${tapeRow('GA/GP', aGF.ga, hGF.ga, false)}
                    </table>
                    <div style="margin-top:14px;font-size:0.92em;color:#aaa;">
                        <div style="margin-bottom:6px;"><strong style="color:#fff;">Head-to-head:</strong> ${h2hLine}</div>
                        <div style="margin-bottom:6px;"><strong style="color:#fff;">Players to watch:</strong><br>${ptw(away)} (${esc(away.abbr)})<br>${ptw(home)} (${esc(home.abbr)})</div>
                        <div><strong style="color:#fff;">Injuries:</strong> ${esc(away.abbr)}: ${injLine(away)} · ${esc(home.abbr)}: ${injLine(home)}</div>
                    </div>
                    <div style="display:flex;gap:10px;justify-content:center;margin-top:20px;">
                        <button id="gd-start" class="primary" style="width:auto;">Drop the Puck</button>
                        <button id="gd-skip" class="secondary" style="width:auto;">Sim to End</button>
                    </div>
                </div>`;
            container.querySelector('#gd-start').onclick = () => { stepIdx++; paint(); };
            container.querySelector('#gd-skip').onclick = () => { stepIdx = steps.indexOf('final'); paint(); };
            return;
        }

        if (step === 'final') {
            const tot = a => a.reduce((x, y) => x + y, 0);
            const finalShots = game.shots ? `
                <p style="color:#888;margin:10px 0 0;">Shots: ${esc(away.abbr)} ${tot(game.shots.shots.away)} – ${tot(game.shots.shots.home)} ${esc(home.abbr)}
                <span style="margin:0 8px;">·</span>Saves: ${tot(game.shots.saves.away)} – ${tot(game.shots.saves.home)}</p>` : '';
            container.innerHTML = `
                <div class="dashboard-panel text-center" style="max-width: 640px; margin: 0 auto;">
                    <p style="color:#888;margin:0;">FINAL${game.ot ? ' (OT)' : ''}</p>
                    <h2 style="margin: 15px 0; font-size: 2em;">${scoreLine(game.awayScore, game.homeScore)}</h2>
                    ${finalShots}
                    <button id="gd-continue" class="primary" style="width:auto;">Continue</button>
                </div>`;
            container.querySelector('#gd-continue').onclick = () =>
                showScreen('weekly-recap', { weekIndex, confId: params.confId || team.confId });
            return;
        }

        // A period.
        const evs = events.filter(e => e.period === step);
        const last = evs[evs.length - 1];
        const endScore = last ? scoreLine(last.awayScore, last.homeScore) : scoreLine(0, 0);
        const rows = evs.length ? evs.map((e, i) => {
            const t = e.teamId === home.id ? home : away;
            const assists = e.assists.length
                ? `<div style="color:#888;font-size:0.85em;">${e.assists.map(esc).join(', ')}</div>` : '';
            return `
                <div class="event-row" style="animation-delay:${(i * 0.45).toFixed(2)}s;">
                    <span style="color:#888;min-width:44px;">${fmtTime(e)}</span>
                    <span style="background:${t.color};color:#fff;padding:2px 6px;border-radius:4px;font-size:0.75em;font-weight:bold;">${esc(t.abbr)}</span>
                    <span style="flex:1;"><strong>${esc(e.scorer)}</strong>${assists}</span>
                    <span style="font-weight:bold;white-space:nowrap;">${e.awayScore} – ${e.homeScore}</span>
                </div>`;
        }).join('') : '<p style="color:#888;">No scoring.</p>';

        const nextStep = steps[stepIdx + 1];
        const nextLabel = nextStep === 'final' ? 'Final' : PERIOD_LABEL[nextStep];
        const perShots = game.shots ? `
            <div style="color:#888;font-size:0.9em;margin:-8px 0 12px;">
                Shots: ${esc(away.abbr)} ${game.shots.shots.away[step - 1]} – ${game.shots.shots.home[step - 1]} ${esc(home.abbr)}
                <span style="margin:0 8px;">·</span>Saves: ${game.shots.saves.away[step - 1]} – ${game.shots.saves.home[step - 1]}
            </div>` : '';

        container.innerHTML = `
            <div class="dashboard-panel" style="max-width: 760px; margin: 0 auto;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
                    <h2 style="margin:0;">${PERIOD_LABEL[step]}</h2>
                    <span style="color:var(--accent);font-weight:bold;">${endScore}</span>
                </div>
                ${perShots}
                ${rows}
                <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:15px;">
                    <button id="gd-skip" class="secondary" style="width:auto;">Sim to End</button>
                    <button id="gd-next" class="primary" style="width:auto;">${nextLabel} →</button>
                </div>
            </div>`;
        container.querySelector('#gd-next').onclick = () => { stepIdx++; paint(); };
        container.querySelector('#gd-skip').onclick = () => { stepIdx = steps.indexOf('final'); paint(); };
    };

    paint();
}
