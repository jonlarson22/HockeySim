// screens/gameDay.js — period-by-period replay of the user's game.
// The week was already simmed (every league game sims instantly); the event
// log recorded at sim time lets the user watch their game unfold.
import { getState, getUserTeam, update } from '../store.js';
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
    return `<span style="white-space:nowrap;">${last5.map(g => {
        const mine = g.homeTeamId === teamId ? g.homeScore : g.awayScore;
        const theirs = g.homeTeamId === teamId ? g.awayScore : g.homeScore;
        const r = mine > theirs ? 'W' : (g.ot ? 'O' : 'L');
        const bg = r === 'W' ? '#1d5c2e' : r === 'O' ? '#6b5b1e' : '#5c1d1d';
        return `<span style="display:inline-block;min-width:20px;text-align:center;background:${bg};border-radius:4px;padding:1px 3px;font-size:0.78em;font-weight:bold;margin-right:2px;">${r}</span>`;
    }).join('')}</span>`;
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

// The week sims instantly, so the pregame replays a game that's already in
// the books. Rewind a team to its pre-game snapshot (taken at sim time) for
// a true pre-game view. Falls back to the live team when there's no snapshot.
function rewoundTeam(team, snap) {
    if (!snap) return team;
    const rw = (p) => {
        const ps = snap.players[p.id];
        return ps ? { ...p, seasonGoals: ps.g, seasonAssists: ps.a, injuryWeeks: ps.inj, status: ps.st } : p;
    };
    return {
        ...team,
        wins: snap.w, losses: snap.l, otl: snap.o,
        confWins: snap.cw, confLosses: snap.cl, confOtl: snap.co,
        roster: {
            forwards: (team.roster.forwards || []).map(rw),
            defensemen: (team.roster.defensemen || []).map(rw),
            goalies: (team.roster.goalies || []).map(rw),
        }
    };
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

    const pregameInner = () => {
            // Pre-game view: records, ranks, players and injuries are rewound
            // to the snapshot — the sim already played this game.
            const awayPre = rewoundTeam(away, game.preGame?.away);
            const homePre = rewoundTeam(home, game.preGame?.home);
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

            const inner = `
                <div class="dashboard-panel" style="max-width: 720px; margin: 0 auto;">
                    <p style="color:#888;margin:0;text-align:center;">${scheduleLabel(weekIndex + 1)}</p>
                    <div style="text-align:center;margin:12px 0;">
                        <div style="font-size:1.3em;font-weight:bold;">${esc(away.name)}</div>
                        <div style="color:#888;">${record(awayPre)} · ${ordinal(confRank(awayPre, s))}, ${esc(shortConf(away.confId))}</div>
                        <div style="margin-top:6px;">${formChips(aGames, away.id)}</div>
                    </div>
                    <div style="text-align:center;color:#666;font-weight:bold;margin:4px 0;">at</div>
                    <div style="text-align:center;margin:12px 0;">
                        <div style="font-size:1.3em;font-weight:bold;">${esc(home.name)}</div>
                        <div style="color:#888;">${record(homePre)} · ${ordinal(confRank(homePre, s))}, ${esc(shortConf(home.confId))}</div>
                        <div style="margin-top:6px;">${formChips(hGames, home.id)}</div>
                    </div>
                    <div style="margin:10px 0 12px;font-size:0.92em;color:#aaa;text-align:center;"><strong style="color:#fff;">Head-to-head</strong><br>${h2hLine}</div>
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
                        <div style="margin-bottom:6px;"><strong style="color:#fff;">Players to watch:</strong><br>${ptw(awayPre)} (${esc(away.abbr)})<br>${ptw(homePre)} (${esc(home.abbr)})</div>
                        <div><strong style="color:#fff;">Injuries:</strong> ${esc(away.abbr)}: ${injLine(awayPre)} · ${esc(home.abbr)}: ${injLine(homePre)}</div>
                    </div>
                </div>`;
            return inner;
        };

    const periodSteps = steps.filter(x => typeof x === 'number');

    // One event row: goals and penalties share the ticker, penalties in gold.
    const eventRow = (e, i, animate) => {
        const t = e.teamId === home.id ? home : away;
        const anim = animate ? `animation-delay:${(i * 0.45).toFixed(2)}s;` : 'animation:none;';
        const badge = `<span style="background:${t.color};color:#fff;padding:2px 6px;border-radius:4px;font-size:0.75em;font-weight:bold;min-width:42px;text-align:center;display:inline-block;">${esc(t.abbr)}</span>`;
        const score = `<span style="font-weight:bold;white-space:nowrap;min-width:52px;text-align:right;">${e.awayScore} – ${e.homeScore}</span>`;
        if (e.kind === 'penalty') {
            return `<div class="event-row" style="${anim}">
                <span style="color:#888;min-width:44px;">${fmtTime(e)}</span>${badge}
                <span style="flex:1;color:#f87171;"><strong>${esc(e.player)}</strong><div style="font-size:0.85em;">${esc(e.infraction)}, ${e.minutes} min</div></span>
            </div>`;
        }
        const assists = e.assists.length
            ? `<div style="color:#888;font-size:0.85em;">${e.assists.map(esc).join(', ')}</div>` : '';
        const pp = e.isPP ? ' <span style="color:#fbbf24;font-size:0.75em;font-weight:bold;">PP</span>' : e.isSH ? ' <span style="color:#f87171;font-size:0.75em;font-weight:bold;">SH</span>' : '';
        return `<div class="event-row" style="${anim}">
            <span style="color:#888;min-width:44px;">${fmtTime(e)}</span>${badge}
            <span style="flex:1;"><strong>${esc(e.scorer)}</strong>${pp}${assists}</span>${score}
        </div>`;
    };

    const periodHtml = (p, animate) => {
        const evs = events.filter(e => e.period === p);
        const last = evs[evs.length - 1];
        const endScore = last ? scoreLine(last.awayScore, last.homeScore) : scoreLine(0, 0);
        const perShots = game.shots ? `
            <div style="color:#888;font-size:0.9em;margin:-4px 0 10px;">
                Shots: ${esc(away.abbr)} ${game.shots.shots.away[p - 1]} – ${game.shots.shots.home[p - 1]} ${esc(home.abbr)}
            </div>` : '';
        return `<div id="gd-p${p}" style="margin-top:20px;padding-top:14px;border-top:1px solid #333;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <h2 style="margin:0;">${PERIOD_LABEL[p]}</h2>
                <span style="color:var(--accent);font-weight:bold;">${endScore}</span>
            </div>
            ${perShots}
            ${evs.length ? evs.map((e, i) => eventRow(e, i, animate)).join('') : '<p style="color:#888;">Nothing happened.</p>'}
        </div>`;
    };

    // Three stars: most impactful skaters by points (goals break ties).
    const starsHtml = () => {
        const tally = new Map();
        const add = (id, name, teamId, isGoal) => {
            if (!id || id === 'none') return;
            if (!tally.has(id)) tally.set(id, { name, teamId, g: 0, a: 0 });
            const r = tally.get(id);
            if (isGoal) r.g++; else r.a++;
        };
        for (const e of events) {
            if (e.kind === 'penalty') continue;
            add(e.scorerId, e.scorer, e.teamId, true);
            (e.assistIds || []).forEach((aid, i) => add(aid, (e.assists || [])[i] || '', e.teamId, false));
        }
        // Game +/- from even-strength and shorthanded goals (power-play goals excluded).
        const pm = new Map();
        const activeSkaters = team => [
            ...(team.roster.forwards || []), ...(team.roster.defensemen || [])
        ].filter(p => p.status === 'Active Roster' && !p.injuryWeeks);
        for (const e of events) {
            if (e.kind === 'penalty' || e.isPP || !e.scorerId || e.scorerId === 'none') continue;
            const scored = e.teamId === home.id ? home : away;
            const conceded = scored === home ? away : home;
            for (const p of activeSkaters(scored)) pm.set(p.id, (pm.get(p.id) || 0) + 1);
            for (const p of activeSkaters(conceded)) pm.set(p.id, (pm.get(p.id) || 0) - 1);
        }
        const candidates = [];
        for (const [id, r] of tally) {
            const plusMinus = pm.get(id) || 0;
            candidates.push({ ...r, plusMinus, score: (r.g + r.a) * 2 + Math.max(0, plusMinus), kind: 'skater' });
        }
        // Hot goalie: 30+ saves earns a star candidacy.
        if (game.shots) {
            const tot = a => (a || []).reduce((x, y) => x + y, 0);
            for (const [team, savesArr] of [[home, game.shots.saves.home], [away, game.shots.saves.away]]) {
                const saves = tot(savesArr);
                if (saves >= 30) {
                    const goalie = (team.roster.goalies || []).find(g => g.id === team.starterGoalieId)
                        || (team.roster.goalies || []).find(g => g.status === 'Active Roster' && !g.injuryWeeks);
                    if (goalie) {
                        candidates.push({
                            name: `${goalie.firstName} ${goalie.lastName}`, teamId: team.id,
                            g: 0, a: 0, plusMinus: 0, score: saves - 25, kind: 'goalie', saves
                        });
                    }
                }
            }
        }
        const ranked = candidates
            .filter(r => r.score > 0)
            .sort((a, b) => b.score - a.score || b.g - a.g)
            .slice(0, 3);
        if (!ranked.length) return '';
        const starIcons = ['★', '★★', '★★★'];
        const rows = ranked.map((r, i) => {
            const t = r.teamId === home.id ? home : away;
            const line = r.kind === 'goalie' ? `${r.saves} saves` : `${r.g}G ${r.a}A${r.plusMinus !== 0 ? ` (${r.plusMinus > 0 ? '+' : ''}${r.plusMinus})` : ''}`;
            return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid #333;">
                <span><span style="color:#fbbf24;">${starIcons[i]}</span> ${esc(r.name)} <span style="color:#888;font-size:0.85em;">(${esc(t.abbr)})</span></span>
                <span style="color:#888;white-space:nowrap;">${line}</span>
            </div>`;
        }).join('');
        return `<div style="margin-top:16px;text-align:left;"><h3 style="margin:0 0 6px;">Three Stars</h3>${rows}</div>`;
    };

    const finalHtml = () => {
        const tot = a => a.reduce((x, y) => x + y, 0);
        const perG = {};
        for (const e of events) {
            if (e.kind === 'penalty') continue;
            if (!perG[e.period]) perG[e.period] = { home: 0, away: 0 };
            if (e.teamId === home.id) perG[e.period].home++; else perG[e.period].away++;
        }
        const perRows = periodSteps.map(p => {
            const g = perG[p] || { home: 0, away: 0 };
            return `<tr style="border-top:1px solid #333;">
                <td style="padding:5px 8px;color:#888;">${PERIOD_LABEL[p]}</td>
                <td style="text-align:center;padding:5px 8px;">${g.away}</td>
                <td style="text-align:center;padding:5px 8px;">${g.home}</td>
            </tr>`;
        }).join('');
        const sh = game.shots ? {
            sa: tot(game.shots.shots.away), sh: tot(game.shots.shots.home),
            va: tot(game.shots.saves.away), vh: tot(game.shots.saves.home),
        } : null;
        const pimA = events.filter(e => e.kind === 'penalty' && e.teamId === away.id).reduce((a, e) => a + (e.minutes || 2), 0);
        const pimH = events.filter(e => e.kind === 'penalty' && e.teamId === home.id).reduce((a, e) => a + (e.minutes || 2), 0);
        const statRow = (label, a, h) => `
            <tr style="border-top:1px solid #333;">
                <td style="padding:5px 8px;color:#888;">${label}</td>
                <td style="text-align:center;padding:5px 8px;font-weight:bold;">${a}</td>
                <td style="text-align:center;padding:5px 8px;font-weight:bold;">${h}</td>
            </tr>`;
        return `<div id="gd-final" style="margin-top:20px;padding-top:14px;border-top:1px solid #333;text-align:center;">
            <p style="color:#888;margin:0;">FINAL${game.ot ? ' (OT)' : ''}</p>
            <h2 style="margin: 12px 0; font-size: 2em;">${scoreLine(game.awayScore, game.homeScore)}</h2>
            <table style="width:100%;border-collapse:collapse;font-size:0.9em;margin:0 auto;max-width:340px;">
                <tr style="color:#888;"><td></td><td style="text-align:center;font-weight:bold;color:#fff;">${esc(away.abbr)}</td><td style="text-align:center;font-weight:bold;color:#fff;">${esc(home.abbr)}</td></tr>
                ${perRows}
                <tr><td colspan="3" style="padding:10px 8px 2px;color:#fff;font-size:0.85em;font-weight:bold;text-align:left;border-top:1px solid #333;">Team Stats</td></tr>
                ${sh ? statRow('Shots', sh.sa, sh.sh) : ''}
                ${sh ? statRow('Saves', sh.va, sh.vh) : ''}
                ${statRow('PIM', pimA, pimH)}
            </table>
            ${starsHtml()}
            <button id="gd-continue" class="primary" style="width:auto;margin-top:16px;">Continue</button>
        </div>`;
    };

    const paint = () => {
        const step = steps[stepIdx];
        // Cumulative scroll: pregame stays on top, each period appends below,
        // final recap lands at the end. Only the newest block animates.
        let html = `<div class="dashboard-panel" style="max-width: 760px; margin: 0 auto;">${pregameInner()}`;
        for (const p of periodSteps) {
            if (steps.indexOf(p) > stepIdx) break;
            html += periodHtml(p, steps.indexOf(p) === stepIdx);
        }
        if (step === 'final') html += finalHtml();
        if (step !== 'final') {
            const nextStep = steps[stepIdx + 1];
            const label = step === 'pregame' ? 'Drop the Puck'
                : nextStep === 'final' ? 'Final →' : `${PERIOD_LABEL[nextStep]} →`;
            html += `<div style="display:flex;gap:10px;justify-content:center;margin-top:22px;">
                <button id="gd-skip" class="secondary" style="width:auto;">Sim to End</button>
                <button id="gd-next" class="primary" style="width:auto;">${label}</button>
            </div>`;
        }
        html += `</div>`;
        container.innerHTML = html;

        const goNext = () => { stepIdx++; paint(); scrollLatest(); };
        const goEnd = () => { stepIdx = steps.indexOf('final'); paint(); scrollLatest(); };
        const nx = container.querySelector('#gd-next');
        if (nx) nx.onclick = goNext;
        const sk = container.querySelector('#gd-skip');
        if (sk) sk.onclick = goEnd;
        const ct = container.querySelector('#gd-continue');
        if (ct) ct.onclick = () => {
            // The pre-game snapshot served its purpose; drop it to keep saves lean.
            update(st => {
                const g = (st.schedule[weekIndex] || []).find(x => x.homeTeamId === game.homeTeamId && x.awayTeamId === game.awayTeamId);
                if (g) delete g.preGame;
            });
            showScreen('weekly-recap', { weekIndex, confId: params.confId || team.confId });
        };
    };

    const scrollLatest = () => {
        const step = steps[stepIdx];
        const el = document.getElementById(step === 'final' ? 'gd-final' : `gd-p${step}`);
        if (el) el.scrollIntoView({ block: 'start' });
    };


    paint();
}
