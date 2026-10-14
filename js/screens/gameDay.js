// screens/gameDay.js — LIVE period-by-period sim of the user's game.
//
// The week's other games sim instantly in simulateWeek; the user's game is
// simmed here as they watch. Between periods the user can adjust (swap lines,
// change goalie, call timeout), and late in the third they may pull the goalie.
import { getState, getUserTeam, update } from '../store.js';
import { showScreen } from '../router.js';
import { esc, scheduleLabel } from '../ui.js';
import { calculateTeamRatings, simLivePeriod, simLiveOT, finalizeLiveGame } from '../engine.js';
import { getLines, lineEffectiveOvr, effOvr } from '../lines.js';
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

// Pre-game snapshot rewind (old saves). The live sim needs no snapshot —
// the game hasn't been played yet, so the live team IS the pre-game team.
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
    const weekIndex = params.weekIndex || 0;
    const getGame = () => {
        const s = getState();
        const team = getUserTeam();
        const game = (s.schedule[weekIndex] || []).find(g => g.homeTeamId === team.id || g.awayTeamId === team.id);
        return { s, team, game };
    };
    {
        const { game, team } = getGame();
        if (!game || game.played) {
            showScreen('weekly-recap', { weekIndex, confId: params.confId || (team && team.confId) || 'all' });
            return;
        }
    }

    let step = getGame().game.liveStep || 'pregame';
    let swapPick = null;

    const scoreLine = (a, h, away, home) => `${esc(away.abbr)} ${a} – ${h} ${esc(home.abbr)}`;

    // --- state machine helpers ---

    // Run fn inside update() against the live game, then set liveStep and repaint.
    const advance = (newStep, simFn) => {
        update(st => {
            const tid = st.teamId;
            const g = (st.schedule[weekIndex] || []).find(x => x.homeTeamId === tid || x.awayTeamId === tid);
            if (!g || g.played) return;
            if (simFn) simFn(st, g);
            g.liveStep = newStep;
        });
        step = getGame().game.liveStep;
        paint();
        scrollLatest();
    };

    // Trailing-team info after P3a: who may pull the goalie.
    const pullInfo = () => {
        const { team, game } = getGame();
        const uh = game.homeTeamId === team.id;
        const us = uh ? game.homeScore : game.awayScore;
        const os = uh ? game.awayScore : game.homeScore;
        const diff = os - us; // >0: user trails
        return {
            userPull: diff >= 1 && diff <= 2,
            aiPull: diff <= -1 && diff >= -2,
            aiTeamId: uh ? game.awayTeamId : game.homeTeamId,
            userTeamId: team.id,
            us, os, diff,
        };
    };

    const simP3b = (st, g, emptyNetFor) => {
        simLivePeriod(st, g, 3, 18, 20, emptyNetFor ? { emptyNetFor } : {});
    };

    // Sim everything remaining with no further input (user keeps goalie in;
    // a trailing AI still pulls its goalie).
    const simToEnd = () => {
        update(st => {
            const tid = st.teamId;
            const g = (st.schedule[weekIndex] || []).find(x => x.homeTeamId === tid || x.awayTeamId === tid);
            if (!g || g.played) return;
            const has = (p, maxMin) => (g.events || []).some(e => e.period === p && (maxMin == null || e.minute < maxMin));
            if (!has(1)) simLivePeriod(st, g, 1);
            if (!has(2)) simLivePeriod(st, g, 2);
            if (!has(3, 18)) simLivePeriod(st, g, 3, 0, 18);
            const uh = g.homeTeamId === tid;
            const us = uh ? g.homeScore : g.awayScore, os = uh ? g.awayScore : g.homeScore;
            const aiDown12 = (us - os) >= 1 && (us - os) <= 2;
            simP3b(st, g, aiDown12 ? (uh ? g.awayTeamId : g.homeTeamId) : null);
            if (g.homeScore === g.awayScore) simLiveOT(st, g);
            finalizeLiveGame(st, g);
            g.liveStep = 'final';
        });
        step = 'final';
        paint();
        scrollLatest();
    };

    // --- intermission adjustments ---

    const swapLines = (a, b) => {
        if (a === b) return;
        update(st => {
            const t = st.leagueTeams.find(x => x.id === st.teamId);
            for (const p of (t.roster.forwards || [])) {
                if (!p.lineSlot) continue;
                const m = /^L([1-4])(C|LW|RW)$/.exec(p.lineSlot);
                if (!m) continue;
                const n = +m[1];
                if (n === a) p.lineSlot = `L${b}${m[2]}`;
                else if (n === b) p.lineSlot = `L${a}${m[2]}`;
            }
        });
        paint();
    };

    const setGoalie = (gid) => {
        update(st => {
            const t = st.leagueTeams.find(x => x.id === st.teamId);
            t.starterGoalieId = gid;
        });
        paint();
    };

    const callTimeout = () => {
        update(st => {
            const tid = st.teamId;
            const t = st.leagueTeams.find(x => x.id === tid);
            const g = (st.schedule[weekIndex] || []).find(x => x.homeTeamId === tid || x.awayTeamId === tid);
            if (g && !g.timeoutUsed) {
                g.timeoutUsed = true;
                t.liveBoost = 1;
            }
        });
        paint();
    };

    // --- presentational blocks ---

    const pregameInner = () => {
        const { s, team, game } = getGame();
        const home = s.leagueTeams.find(t => t.id === game.homeTeamId);
        const away = s.leagueTeams.find(t => t.id === game.awayTeamId);
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
        const shortConf = cid => { const c = conferences.find(x => x.id === cid); return c ? c.abbr || c.name : ''; };
        const ptw = t => { const p = playerToWatch(t); return p ? `${esc(p.firstName)} ${esc(p.lastName)} (${p.seasonGoals || 0}G, ${p.seasonAssists || 0}A)` : '—'; };
        const injLine = t => { const l = injuryList(t); return l.length ? l.map(p => esc(`${p.firstName} ${p.lastName}`)).join(', ') : 'None'; };
        const h2hLine = (() => {
            let hw = 0, aw = 0;
            for (let w = 0; w < weekIndex; w++) for (const g of (s.schedule[w] || [])) {
                const isH2H = (g.homeTeamId === home.id && g.awayTeamId === away.id) || (g.homeTeamId === away.id && g.awayTeamId === home.id);
                if (!isH2H || g.homeScore == null) continue;
                if (g.homeScore > g.awayScore) (g.homeTeamId === home.id ? hw++ : aw++);
                else (g.awayTeamId === home.id ? hw++ : aw++);
            }
            return hw + aw ? `${esc(home.abbr)} ${hw} – ${aw} ${esc(away.abbr)} this season` : 'First meeting this season';
        })();
        const tapeRow = (label, a, h, flip) => {
            const av = Math.round(a * 10) / 10, hv = Math.round(h * 10) / 10;
            return `<tr><td style="padding:5px 8px;color:#888;">${label}</td>
                <td style="text-align:center;padding:5px 8px;font-weight:bold;">${av}</td>
                <td style="text-align:center;padding:5px 8px;font-weight:bold;">${hv}</td></tr>`;
        };
        const inner = `
            <div class="dashboard-panel" style="max-width: 720px; margin: 0 auto;">
                <p style="color:#888;margin:0;text-align:center;">${scheduleLabel(weekIndex + 1)}</p>
                ${game.rivalry ? '<p style="text-align:center;color:#f87171;font-weight:bold;margin:6px 0;">🔥 RIVALRY GAME — winner takes +1 prestige</p>' : ''}
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

    // One event row: goals and penalties share the ticker, penalties in gold.
    const eventRow = (e, i, animate, home, away) => {
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
        const en = e.isEN ? ' <span style="color:#f87171;font-size:0.75em;font-weight:bold;">EN</span>' : '';
        return `<div class="event-row" style="${anim}">
            <span style="color:#888;min-width:44px;">${fmtTime(e)}</span>${badge}
            <span style="flex:1;"><strong>${esc(e.scorer)}</strong>${pp}${en}${assists}</span>${score}
        </div>`;
    };

    const periodHtml = (p, animate, maxMinute, home, away, events) => {
        const evs = events.filter(e => e.period === p && (maxMinute == null || e.minute < maxMinute));
        const last = evs[evs.length - 1];
        const endScore = last ? scoreLine(last.awayScore, last.homeScore, away, home) : scoreLine(0, 0, away, home);
        return `<div id="gd-p${p}" style="margin-top:20px;padding-top:14px;border-top:1px solid #333;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <h2 style="margin:0;">${PERIOD_LABEL[p]}${maxMinute != null ? ' <span style="font-size:0.6em;color:#888;">(to 18:00)</span>' : ''}</h2>
                <span style="color:var(--accent);font-weight:bold;">${endScore}</span>
            </div>
            ${evs.length ? evs.map((e, i) => eventRow(e, i, animate, home, away)).join('') : '<p style="color:#888;">Nothing happened.</p>'}
        </div>`;
    };

    const intermissionHtml = () => {
        const { team, game } = getGame();
        const fwds = (team.roster.forwards || []).filter(p => p.status === 'Active Roster' && !p.injuryWeeks && !p.suspWeeks);
        const lines = getLines(fwds);
        const lineBtns = [1, 2, 3, 4].map(n => {
            const L = lines[n] || {};
            const ovr = lineEffectiveOvr(L.C, L.LW, L.RW);
            const sel = swapPick === n ? 'border-color:#4ade80;background:rgba(74,222,128,0.1);' : '';
            return `<button class="secondary line-swap" data-line="${n}" style="width:auto;${sel}">L${n} (${ovr.toFixed(1)})</button>`;
        }).join('');
        const goalies = (team.roster.goalies || []).filter(p => p.status === 'Active Roster' && !p.injuryWeeks && !p.suspWeeks);
        const goalieBtns = goalies.map(gl =>
            `<button class="secondary goalie-pick" data-gid="${gl.id}" style="width:auto;${gl.id === team.starterGoalieId ? 'border-color:#4ade80;' : ''}">${esc(gl.firstName)} ${esc(gl.lastName)} (${effOvr(gl).toFixed(0)})</button>`
        ).join('');
        return `<div id="gd-inter" style="margin-top:20px;padding:14px;border:1px solid #4ade80;border-radius:8px;background:rgba(74,222,128,0.05);">
            <h2 style="margin:0 0 4px;">⏸️ Intermission — Make an Adjustment</h2>
            <p style="color:#aaa;font-size:0.9em;margin:0 0 10px;">Line order drives ice time (L1 skates the most). Pick one, or roll with what you have.</p>
            <div style="margin-bottom:10px;"><div style="color:#888;font-size:0.85em;margin-bottom:4px;">Swap two lines:</div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">${lineBtns}</div>
                ${swapPick ? '<div style="color:#4ade80;font-size:0.85em;margin-top:4px;">Now pick the line to swap with L' + swapPick + '…</div>' : ''}
            </div>
            <div style="margin-bottom:10px;"><div style="color:#888;font-size:0.85em;margin-bottom:4px;">Change goalie:</div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">${goalieBtns}</div>
            </div>
            <div><button id="gd-timeout" class="secondary" style="width:auto;" ${game.timeoutUsed ? 'disabled' : ''}>${game.timeoutUsed ? 'Timeout used' : '⏱️ Call timeout (+1 team OVR next period)'}</button></div>
        </div>`;
    };

    const pullHtml = () => {
        const info = pullInfo();
        return `<div id="gd-pull" style="margin-top:20px;padding:14px;border:1px solid #f87171;border-radius:8px;background:rgba(248,113,113,0.06);text-align:center;">
            <h2 style="margin:0 0 6px;">🥅 Empty Net?</h2>
            <p style="color:#aaa;">Down <b>${info.diff}</b> with 2:00 left. Pull the goalie for the extra attacker?<br>
            <span style="font-size:0.85em;">6v5 gives you a real look — but an empty-netter against probably ends it.</span></p>
            <div style="display:flex;gap:10px;justify-content:center;margin-top:10px;">
                <button id="gd-pull-yes" class="primary" style="width:auto;">Pull him!</button>
                <button id="gd-pull-no" class="secondary" style="width:auto;">Keep him in</button>
            </div>
        </div>`;
    };

    const starsHtml = (home, away, events, game) => {
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
        const pm = new Map();
        const activeSkaters = tm => [
            ...(tm.roster.forwards || []), ...(tm.roster.defensemen || [])
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
            for (const [tm, savesArr] of [[home, game.shots.saves.home], [away, game.shots.saves.away]]) {
                const saves = tot(savesArr);
                if (saves >= 30) {
                    const goalie = (tm.roster.goalies || []).find(g => g.id === tm.starterGoalieId)
                        || (tm.roster.goalies || []).find(g => g.status === 'Active Roster' && !g.injuryWeeks);
                    if (goalie) {
                        candidates.push({
                            name: `${goalie.firstName} ${goalie.lastName}`, teamId: tm.id,
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
        const { s, team, game } = getGame();
        const home = s.leagueTeams.find(t => t.id === game.homeTeamId);
        const away = s.leagueTeams.find(t => t.id === game.awayTeamId);
        const events = game.events || [];
        const sh = game.shots;
        const statRow = (label, a, h) => `<tr>
                <td style="padding:5px 8px;color:#888;">${label}</td>
                <td style="text-align:center;padding:5px 8px;font-weight:bold;">${a}</td>
                <td style="text-align:center;padding:5px 8px;font-weight:bold;">${h}</td>
            </tr>`;
        const perRows = [1, 2, 3, ...(game.ot ? [4] : [])].map(p => {
            const evs = events.filter(e => e.period === p);
            const last = evs[evs.length - 1];
            return statRow(PERIOD_LABEL[p],
                last ? last.awayScore : (p === 1 ? 0 : ''),
                last ? last.homeScore : (p === 1 ? 0 : ''));
        }).join('');
        return `<div id="gd-final" style="margin-top:20px;padding-top:14px;border-top:1px solid #333;text-align:center;">
            <p style="color:#888;margin:0;">FINAL${game.ot ? ' (OT)' : ''}</p>
            <h2 style="margin: 12px 0; font-size: 2em;">${scoreLine(game.awayScore, game.homeScore, away, home)}</h2>
            <table style="width:100%;border-collapse:collapse;font-size:0.9em;margin:0 auto;max-width:340px;">
                <tr style="color:#888;"><td></td><td style="text-align:center;font-weight:bold;color:#fff;">${esc(away.abbr)}</td><td style="text-align:center;font-weight:bold;color:#fff;">${esc(home.abbr)}</td></tr>
                ${perRows}
                <tr><td colspan="3" style="padding:10px 8px 2px;color:#fff;font-size:0.85em;font-weight:bold;text-align:left;border-top:1px solid #333;">Team Stats</td></tr>
                ${sh ? statRow('Shots', sh.shots.away.reduce((a, b) => a + b, 0), sh.shots.home.reduce((a, b) => a + b, 0)) : ''}
                ${sh ? statRow('Saves', sh.saves.away.reduce((a, b) => a + b, 0), sh.saves.home.reduce((a, b) => a + b, 0)) : ''}
                ${statRow('PIM', events.filter(e => e.kind === 'penalty' && e.teamId === away.id).reduce((a, e) => a + (e.minutes || 2), 0), events.filter(e => e.kind === 'penalty' && e.teamId === home.id).reduce((a, e) => a + (e.minutes || 2), 0))}
            </table>
            <div style="margin-top:10px;">${starsHtml(home, away, events, game)}</div>
            ${(s.lastVisit && s.lastVisitWeek === weekIndex + 1) ? `
            <p style="font-size:0.9em;color:#aaa;margin:12px 0 0;">🏟️ ${'⭐'.repeat(Math.min(5, s.lastVisit.stars || 0))} <strong>${esc(s.lastVisit.name)}</strong> (${esc(s.lastVisit.pos)}) was in the building — ${s.lastVisit.won ? `loved the win <span style="color:#4ade80;">(+${s.lastVisit.delta} interest)</span>` : `walked out on a loss <span style="color:#f87171;">(${s.lastVisit.delta} interest)</span>`}.</p>` : ''}
            <button id="gd-continue" class="primary" style="width:auto;margin-top:16px;">Continue</button>
        </div>`;
    };

    // --- render ---

    const paint = () => {
        const { s, team, game } = getGame();
        if (!game || game.played) {
            showScreen('weekly-recap', { weekIndex, confId: params.confId || team.confId });
            return;
        }
        const home = s.leagueTeams.find(t => t.id === game.homeTeamId);
        const away = s.leagueTeams.find(t => t.id === game.awayTeamId);
        const events = game.events || [];

        const order = ['pregame', 1, 'int1', 2, 'int2', '3a', 'pull', '3b', 'ot', 'final'];
        const idx = Math.max(0, order.indexOf(step));
        const seen = st => order.indexOf(st) <= idx;

        let html = `<div class="dashboard-panel" style="max-width: 760px; margin: 0 auto;">${pregameInner()}`;
        if (seen(1)) html += periodHtml(1, idx === order.indexOf(1), null, home, away, events);
        if (step === 'int1') html += intermissionHtml();
        if (seen(2)) html += periodHtml(2, idx === order.indexOf(2), null, home, away, events);
        if (step === 'int2') html += intermissionHtml();
        if (seen('3a')) {
            const only3a = (step === '3a' || step === 'pull');
            html += periodHtml(3, idx === order.indexOf('3a') || idx === order.indexOf('3b'), only3a ? 18 : null, home, away, events);
        }
        if (step === 'pull') html += pullHtml();
        if (game.aiPulledGoalie && seen('3b')) {
            const aiName = game.homeTeamId === team.id ? away.name : home.name;
            html += `<p style="color:#f87171;font-size:0.9em;margin-top:8px;">🥅 ${esc(aiName)} pulled their goalie in the final 2:00!</p>`;
        }
        if (seen('ot')) html += periodHtml(4, idx === order.indexOf('ot'), null, home, away, events);
        if (step === 'final') html += finalHtml();

        // Bottom controls per step.
        const btn = (id, label, cls) => `<button id="${id}" class="${cls}" style="width:auto;">${label}</button>`;
        if (step !== 'final') {
            let next = '';
            if (step === 'pregame') next = btn('gd-next', 'Drop the Puck', 'primary');
            else if (step === 1) next = btn('gd-next', 'Intermission →', 'primary');
            else if (step === 'int1') next = btn('gd-next', 'Start 2nd Period →', 'primary');
            else if (step === 2) next = btn('gd-next', 'Intermission →', 'primary');
            else if (step === 'int2') next = btn('gd-next', 'Start 3rd Period →', 'primary');
            else if (step === '3a') next = btn('gd-next', 'Final 2:00 →', 'primary');
            else if (step === '3b') {
                const tied = game.homeScore === game.awayScore;
                next = btn('gd-next', tied ? 'Overtime →' : 'Final →', 'primary');
            }
            else if (step === 'ot') next = btn('gd-next', 'Final →', 'primary');
            html += `<div style="display:flex;gap:10px;justify-content:center;margin-top:22px;">
                ${step === 'pull' ? '' : btn('gd-skip', 'Sim to End', 'secondary')}
                ${next}
            </div>`;
        }
        html += `</div>`;
        container.innerHTML = html;

        // Wire controls.
        const on = (id, fn) => { const el = container.querySelector('#' + id); if (el) el.onclick = fn; };
        on('gd-next', () => {
            if (step === 'pregame') advance(1, (st, g) => simLivePeriod(st, g, 1));
            else if (step === 1) advance('int1');
            else if (step === 'int1') advance(2, (st, g) => simLivePeriod(st, g, 2));
            else if (step === 2) advance('int2');
            else if (step === 'int2') advance('3a', (st, g) => simLivePeriod(st, g, 3, 0, 18));
            else if (step === '3a') {
                const info = pullInfo();
                if (info.userPull) advance('pull');
                else if (info.aiPull) {
                    update(st => {
                        const tid = st.teamId;
                        const g = (st.schedule[weekIndex] || []).find(x => x.homeTeamId === tid || x.awayTeamId === tid);
                        if (g) g.aiPulledGoalie = true;
                    });
                    advance('3b', (st, g) => simP3b(st, g, info.aiTeamId));
                }
                else advance('3b', (st, g) => simP3b(st, g, null));
            }
            else if (step === '3b') {
                const { game: g } = getGame();
                if (g.homeScore === g.awayScore) advance('ot', (st, gg) => simLiveOT(st, gg));
                else advance('final', (st, gg) => finalizeLiveGame(st, gg));
            }
            else if (step === 'ot') advance('final', (st, g) => finalizeLiveGame(st, g));
        });
        on('gd-skip', simToEnd);
        on('gd-continue', () => {
            update(st => {
                const g = (st.schedule[weekIndex] || []).find(x => x.homeTeamId === game.homeTeamId && x.awayTeamId === game.awayTeamId);
                if (g) { delete g.preGame; delete g.liveStep; }
            });
            showScreen('weekly-recap', { weekIndex, confId: params.confId || team.confId });
        });
        // Pull decision.
        on('gd-pull-yes', () => {
            const info = pullInfo();
            advance('3b', (st, g) => { g.pulledGoalie = true; simP3b(st, g, info.userTeamId); });
        });
        on('gd-pull-no', () => advance('3b', (st, g) => simP3b(st, g, null)));
        // Intermission: line swaps.
        container.querySelectorAll('.line-swap').forEach(b => {
            b.onclick = () => {
                const n = +b.dataset.line;
                if (swapPick == null) { swapPick = n; paint(); }
                else { const a = swapPick; swapPick = null; swapLines(a, n); }
            };
        });
        container.querySelectorAll('.goalie-pick').forEach(b => {
            b.onclick = () => setGoalie(b.dataset.gid);
        });
        on('gd-timeout', callTimeout);
    };

    const scrollLatest = () => {
        const el = document.getElementById(
            step === 'final' ? 'gd-final'
            : step === 'pull' ? 'gd-pull'
            : (step === 'int1' || step === 'int2') ? 'gd-inter'
            : `gd-p${step === '3a' || step === '3b' ? 3 : step}`);
        if (el) el.scrollIntoView({ block: 'start' });
    };

    paint();
}

export function destroy() {}
