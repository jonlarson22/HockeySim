// events.js — weekly Team News events.
//
// 33% of regular-season weeks (never in tournaments) the user gets an event:
// a decision card with 2 choices, or a news item. Effects are small and
// temporary: eventBoost {ovr, weeks} on players, recruiting point bonuses,
// 1-point prestige bumps (capped), short sidelines, or a coaching skill point.
// No event repeats within a season.
const pick = a => a[Math.floor(Math.random() * a.length)];
const sample = (a, n) => [...a].sort(() => Math.random() - 0.5).slice(0, n);
const pname = p => `${p.firstName} ${p.lastName}`;

function userSkaters(team) {
    return [...(team.roster.forwards || []), ...(team.roster.defensemen || [])]
        .filter(p => p.status === 'Active Roster' && !p.injuryWeeks && !p.suspWeeks);
}
function userGoalies(team) {
    return (team.roster.goalies || [])
        .filter(p => p.status === 'Active Roster' && !p.injuryWeeks && !p.suspWeeks);
}
function allActive(team) {
    return [...userSkaters(team), ...userGoalies(team)];
}
function boost(p, ovr, weeks) {
    p.eventBoost = { ovr, weeks };
}

// Sideline a player for `weeks` (rest/suspension): mirrors the injury path —
// status drops, home line slot kept, best practice-squader temp-fills.
export function sidelinePlayer(team, player, weeks) {
    player.suspWeeks = weeks;
    player.status = 'Practice Squad';
    const subs = [...team.roster.forwards, ...team.roster.defensemen, ...team.roster.goalies]
        .filter(p => p.status === 'Practice Squad' && p.id !== player.id && !p.injuryWeeks && !p.suspWeeks)
        .sort((a, b) => b.overall - a.overall);
    if (subs.length && player.lineSlot) {
        const sub = subs[0];
        if ((player.position === 'F' && sub.position === 'F') || (player.position === 'D' && sub.position === 'D')) {
            sub.status = 'Active Roster';
            if (!sub.lineSlot && !sub.pairSlot) {
                if (player.lineSlot) { sub.lineSlot = player.lineSlot; sub.tempFill = true; }
                else if (player.pairSlot) { sub.pairSlot = player.pairSlot; sub.tempFill = true; }
            }
        }
    }
}

function injurePlayer(team, player, weeks) {
    player.injuryWeeks = weeks;
    player.status = 'Practice Squad';
    const subs = [...team.roster.forwards, ...team.roster.defensemen, ...team.roster.goalies]
        .filter(p => p.status === 'Practice Squad' && p.id !== player.id && !p.injuryWeeks && !p.suspWeeks)
        .sort((a, b) => b.overall - a.overall);
    if (subs.length && player.lineSlot && subs[0].position === 'F' && !subs[0].lineSlot) {
        subs[0].status = 'Active Roster';
        subs[0].lineSlot = player.lineSlot;
        subs[0].tempFill = true;
    }
}

const findP = (team, id) => {
    for (const k of ['forwards', 'defensemen', 'goalies']) {
        const p = (team.roster[k] || []).find(x => x.id === id);
        if (p) return p;
    }
    return null;
};

export const TEAM_EVENTS = [
    // ---------- DECISIONS ----------
    {
        id: 'hot-hand', kind: 'decision', title: 'Hot Hand',
        eligible: t => userGoalies(t).length >= 2,
        ctx: t => {
            const gs = userGoalies(t);
            const starter = gs.find(g => g.id === t.starterGoalieId) || gs[0];
            const backup = gs.find(g => g.id !== starter.id);
            return { backupId: backup.id, starterId: starter.id };
        },
        text: (t, c) => `${pname(findP(t, c.backupId))} has been unbeatable in practice — three straight shutout periods in drills. The starter's job is his to lose.`,
        choices: [
            { label: 'Ride the hot hand (+2 next game)', apply: (s, t, c) => { const p = findP(t, c.backupId); if (p) boost(p, 2, 1); t.starterGoalieId = c.backupId; return `${pname(p)} gets the start.`; } },
            { label: 'Stick with the starter', apply: (s, t, c) => `No change in net — ${pname(findP(t, c.starterId))} keeps the crease.` },
        ],
    },
    {
        id: 'flu-bug', kind: 'decision', title: 'Flu Bug',
        eligible: t => userSkaters(t).length >= 4,
        ctx: t => ({ ids: sample(userSkaters(t), 2).map(p => p.id) }),
        text: (t, c) => `${c.ids.map(id => pname(findP(t, id))).join(' and ')} are sick — questionable for this week.`,
        choices: [
            { label: 'Rest them (they sit out)', apply: (s, t, c) => { c.ids.forEach(id => { const p = findP(t, id); if (p) sidelinePlayer(t, p, 1); }); return 'They rest up. Replacements fill in.'; } },
            { label: 'Play them sick (−1 OVR)', apply: (s, t, c) => { c.ids.forEach(id => { const p = findP(t, id); if (p) boost(p, -1, 1); }); return 'They gut it out at less than 100%.'; } },
        ],
    },
    {
        id: 'booster', kind: 'decision', title: 'Booster Check',
        eligible: () => true,
        text: () => 'A wealthy alum wants to write a check. Where should it go?',
        choices: [
            { label: '+40 recruiting points', apply: s => { s.recruitBonusPoints = (s.recruitBonusPoints || 0) + 40; return '+40 recruiting points banked for the next window.'; } },
            { label: '+1 prestige (facilities)', apply: (s, t) => { t.prestige = Math.min(100, (t.prestige || 50) + 1); return 'New weight room. Prestige +1.'; } },
        ],
    },
    {
        id: 'poached', kind: 'decision', title: 'Poached Prospect',
        eligible: (t, s) => (s.recruitTargets || []).length > 0,
        ctx: (t, s) => { const id = pick(s.recruitTargets); const p = (s.prospectPool || []).find(x => x.id === id); return { pid: id, name: p ? `${p.firstName} ${p.lastName}` : 'a target' }; },
        text: (t, c) => `A rival program is circling ${c.name}. His phone hasn't stopped buzzing.`,
        choices: [
            { label: 'Fight for him (−30 pts)', apply: s => { s.recruitBonusPoints = (s.recruitBonusPoints || 0) - 30; return 'You match the attention. He stays on your board (−30 pts).'; } },
            { label: 'Let him walk', apply: (s, t, c) => { s.recruitTargets = (s.recruitTargets || []).filter(id => id !== c.pid); return `${c.name} commits elsewhere. Off your board.`; } },
        ],
    },
    {
        id: 'transfer', kind: 'decision', title: 'Transfer Rumblings',
        eligible: t => [...(t.roster.forwards || []), ...(t.roster.defensemen || [])].some(p => p.status === 'Practice Squad' && !p.injuryWeeks),
        ctx: t => { const p = pick([...t.roster.forwards, ...t.roster.defensemen].filter(p => p.status === 'Practice Squad' && !p.injuryWeeks)); return { pid: p.id }; },
        text: (t, c) => `${pname(findP(t, c.pid))} is frustrated with his ice time and eyeing the transfer portal.`,
        choices: [
            { label: 'Promise him ice time', apply: (s, t, c) => { const p = findP(t, c.pid); if (p) { p.status = 'Active Roster'; boost(p, 1, 4); } return `${pname(p)} is staying — dressed and motivated for a month.`; } },
{ label: 'Let him go', apply: (s, t, c) => { const nm = pname(findP(t, c.pid) || { firstName: 'The', lastName: 'player' }); for (const k of ['forwards', 'defensemen', 'goalies']) { const i = (t.roster[k] || []).findIndex(x => x.id === c.pid); if (i >= 0) t.roster[k].splice(i, 1); } return `${nm} enters the portal. Roster spot opens.`; } },
        ],
    },
    {
        id: 'phenom', kind: 'decision', title: 'Rookie Phenom',
        eligible: t => userSkaters(t).some(p => (p.overall || 99) < 65),
        ctx: t => { const p = pick(userSkaters(t).filter(p => (p.overall || 99) < 65)); return { pid: p.id }; },
        text: (t, c) => `${pname(findP(t, c.pid))} is dominating practice — veterans are noticing.`,
        choices: [
            { label: 'Play him top-6 (+2, 3 weeks)', apply: (s, t, c) => { const p = findP(t, c.pid); if (p) boost(p, 2, 3); return `${pname(p)} gets his shot.`; } },
            { label: 'Keep him buried', apply: () => 'The lineup stays as is.' },
        ],
    },
    {
        id: 'speech', kind: 'decision', title: "Captain's Speech",
        eligible: () => true,
        text: () => 'The room is flat after a tough stretch. Someone needs to say something.',
        choices: [
            { label: 'Your speech (+1 OVR, guaranteed)', apply: (s, t) => { allActive(t).forEach(p => boost(p, 1, 1)); return 'You light a fire. Whole roster +1 this week.'; } },
            { label: "Let the captain try (50/50: +2 or nothing)", apply: (s, t) => { if (Math.random() < 0.5) { allActive(t).forEach(p => boost(p, 2, 1)); return 'The captain brings the house down. +2 this week!'; } return 'Falls flat. No effect.'; } },
        ],
    },
    {
        id: 'studyhall', kind: 'decision', title: 'Study Hall',
        eligible: t => userSkaters(t).length >= 3,
        ctx: t => ({ ids: sample(userSkaters(t), 3).map(p => p.id) }),
        text: (t, c) => `Three players are shaky in class: ${c.ids.map(id => pname(findP(t, id))).join(', ')}. Midterms are coming.`,
        choices: [
            { label: 'Mandatory study hall (−1 OVR, no risk)', apply: (s, t, c) => { c.ids.forEach(id => { const p = findP(t, id); if (p) boost(p, -1, 1); }); return 'Grades safe. They miss practice time (−1 this week).'; } },
            { label: 'Roll the dice', apply: (s, t, c) => { if (Math.random() < 0.5) return 'They pass. Crisis averted.'; const p = findP(t, pick(c.ids)); sidelinePlayer(t, p, 1); return `${pname(p)} is academically ineligible this week.`; } },
        ],
    },
    {
        id: 'equipment', kind: 'decision', title: 'Equipment Fiasco',
        eligible: () => true,
        text: () => 'The gear truck broke down two states away. Game is in three days.',
        choices: [
            { label: 'Rush replacements (−25 pts)', apply: s => { s.recruitBonusPoints = (s.recruitBonusPoints || 0) - 25; return 'New gear arrives just in time (−25 recruiting pts).'; } },
            { label: 'Borrow gear (−1 OVR)', apply: (s, t) => { userSkaters(t).forEach(p => boost(p, -1, 1)); return 'Ill-fitting borrowed gear. Skaters −1 this week.'; } },
        ],
    },
    {
        id: 'scout', kind: 'decision', title: 'Scout Visit',
        eligible: t => userSkaters(t).some(p => (p.overall || 99) < 68),
        ctx: t => { const p = pick(userSkaters(t).filter(p => (p.overall || 99) < 68)); return { pid: p.id }; },
        text: (t, c) => `An NHL scout is coming specifically to see ${pname(findP(t, c.pid))}.`,
        choices: [
            { label: 'Showcase him (+2 this week)', apply: (s, t, c) => { const p = findP(t, c.pid); if (p) boost(p, 2, 1); return `${pname(p)} rises to the occasion.`; } },
            { label: 'Play it normal', apply: () => 'No extra pressure.' },
        ],
    },
    {
        id: 'prank', kind: 'decision', title: 'Rivalry Prank',
        eligible: () => true,
        text: () => 'Night before the rivalry game. The freshmen want to prank the other dorm.',
        choices: [
            { label: 'Embrace it (+1 OVR, 25% suspension)', apply: (s, t) => { userSkaters(t).forEach(p => boost(p, 1, 1)); if (Math.random() < 0.25) { const p = pick(userSkaters(t)); sidelinePlayer(t, p, 1); return `Electric atmosphere (+1) — but ${pname(p)} got caught and sits this week.`; } return 'The room is electric (+1 this week). No casualties.'; } },
            { label: 'Shut it down', apply: () => 'Business as usual.' },
        ],
    },
    {
        id: 'training-fad', kind: 'decision', title: 'Training Fad',
        eligible: () => true,
        text: () => 'A sports-science startup is pitching biometric skate sensors. Unproven, but intriguing.',
        choices: [
            { label: 'Adopt it (60%: +2, 40%: −1, 2 weeks)', apply: (s, t) => { const good = Math.random() < 0.6; allActive(t).forEach(p => boost(p, good ? 2 : -1, 2)); return good ? 'The data is gold. +2 for two weeks!' : 'The sensors are junk. −1 for two weeks.'; } },
            { label: 'Stick to routine', apply: () => 'If it ain\'t broke.' },
        ],
    },
    {
        id: 'alumni', kind: 'decision', title: 'Alumni Weekend',
        eligible: () => true,
        text: () => 'The alumni association wants a full weekend: golf, banquet, old-timers game.',
        choices: [
            { label: 'Host it (+1 prestige, −1 OVR)', apply: (s, t) => { t.prestige = Math.min(100, (t.prestige || 50) + 1); allActive(t).forEach(p => boost(p, -1, 1)); return 'Great for the program (+1 prestige). The week is a distraction (−1).'; } },
            { label: 'Decline', apply: () => 'Focus stays on hockey.' },
        ],
    },
    {
        id: 'homesick', kind: 'decision', title: 'Homesick Freshman',
        eligible: t => userSkaters(t).some(p => (p.overall || 99) < 65),
        ctx: t => { const p = pick(userSkaters(t).filter(p => (p.overall || 99) < 65)); return { pid: p.id }; },
        text: (t, c) => `${pname(findP(t, c.pid))} is homesick and it's showing in practice.`,
        choices: [
            { label: 'Extra attention (+1, 2 weeks)', apply: (s, t, c) => { const p = findP(t, c.pid); if (p) boost(p, 1, 2); return `${pname(p)} settles in.`; } },
            { label: 'Tough love (25%: −1, 2 weeks)', apply: (s, t, c) => { const p = findP(t, c.pid); if (Math.random() < 0.25) { if (p) boost(p, -1, 2); return `${pname(p)} shuts down (−1, two weeks).`; } return `${pname(p)} toughs it out. No effect.`; } },
        ],
    },
    {
        id: 'clinic', kind: 'decision', title: 'Coaching Clinic',
        eligible: () => true,
        text: () => "You've been invited to a weekend coaching clinic with some of the best minds in the game.",
        choices: [
            { label: 'Attend (+1 random attribute)', apply: s => { const keys = ['offense', 'defense', 'development', 'recruiting', 'scouting']; const k = pick(keys); s.coach.skills[k] = (s.coach.skills[k] || 0) + 1; const label = { offense: 'Offensive Tactics', defense: 'Defensive Tactics', development: 'Development', recruiting: 'Recruiting Prowess', scouting: 'Scouting' }[k]; return `You pick up new ideas. ${label} +1.`; } },
            { label: 'Skip it', apply: () => 'A quiet weekend at home.' },
        ],
    },
    // ---------- NEWS ----------
    {
        id: 'practice-injury', kind: 'news', title: 'Practice Injury',
        eligible: t => userSkaters(t).length > 0,
        ctx: t => { const p = pick(userSkaters(t)); return { pid: p.id, weeks: 1 + Math.floor(Math.random() * 2) }; },
        text: () => 'A bad collision at practice.',
        apply: (s, t, c) => { const p = findP(t, c.pid); if (p) injurePlayer(t, p, c.weeks); return `${pname(p)} is hurt — out ${c.weeks} week${c.weeks > 1 ? 's' : ''}.`; },
    },
    {
        id: 'suspension', kind: 'news', title: 'Team Rules',
        eligible: t => userSkaters(t).length > 0,
        ctx: t => ({ pid: pick(userSkaters(t)).id }),
        text: () => 'A team rule was broken. There are consequences.',
        apply: (s, t, c) => { const p = findP(t, c.pid); if (p) sidelinePlayer(t, p, 1); return `${pname(p)} is suspended one game for violating team rules.`; },
    },
    {
        id: 'spotlight', kind: 'news', title: 'Media Spotlight',
        eligible: () => true,
        text: () => 'National media is featuring your program this week.',
        apply: (s, t) => { allActive(t).forEach(p => boost(p, 1, 1)); return 'The attention has the room buzzing (+1 OVR this week).'; },
    },
    {
        id: 'commit-boost', kind: 'news', title: 'Commitment Boost',
        eligible: (t, s) => (s.recruitTargets || []).length > 0,
        ctx: (t, s) => { const id = pick(s.recruitTargets); const p = (s.prospectPool || []).find(x => x.id === id); return { name: p ? `${p.firstName} ${p.lastName}` : 'A target' }; },
        text: () => 'The phone rings — good news on the recruiting trail.',
        apply: (s, t, c) => { s.recruitBonusPoints = (s.recruitBonusPoints || 0) + 25; return `${c.name}'s interest surges after a great call (+25 recruiting pts).`; },
    },
    {
        id: 'auction', kind: 'news', title: 'Jersey Auction',
        eligible: () => true,
        text: () => 'The annual charity jersey auction.',
        apply: (s, t) => { t.prestige = Math.min(100, (t.prestige || 50) + 1); const k = 20 + Math.floor(Math.random() * 60); return `Auction raises $${k}k for charity. Prestige +1.`; },
    },
    {
        id: 'storm', kind: 'news', title: 'Storm Travel', weight: 0.5,
        eligible: () => true,
        text: () => 'A blizzard turns the road trip into a nightmare.',
        apply: (s, t) => { allActive(t).forEach(p => boost(p, -1, 1)); return 'Delayed flights, bad hotels. Team is gassed (−1 OVR this week).'; },
    },
    {
        id: 'ironman', kind: 'news', title: 'Iron Man',
        eligible: t => userSkaters(t).length > 0,
        ctx: t => ({ pid: pick(userSkaters(t)).id }),
        text: () => 'A milestone game approaches.',
        apply: (s, t, c) => { const p = findP(t, c.pid); if (p) boost(p, 1, 1); return `${pname(p)} plays his 100th straight game — inspired (+1 this week).`; },
    },
    {
        id: 'legacy', kind: 'news', title: 'Legacy Visit',
        eligible: t => userSkaters(t).length >= 3,
        ctx: t => ({ ids: sample(userSkaters(t), 3).map(p => p.id) }),
        text: () => 'A program legend drops by practice.',
        apply: (s, t, c) => { c.ids.forEach(id => { const p = findP(t, id); if (p) boost(p, 1, 1); }); return 'The old stories have three players buzzing (+1 this week).'; },
    },
    // ——— Press conferences ———
    {
        id: 'press_trash', kind: 'decision', title: "Press Conference: Next Week's Matchup",
        eligible: () => true,
        ctx: (t, s) => {
            const g = (s.schedule[s.currentWeek - 1] || []).find(x => x.homeTeamId === t.id || x.awayTeamId === t.id);
            const oppId = g ? (g.homeTeamId === t.id ? g.awayTeamId : g.homeTeamId) : null;
            const opp = oppId ? s.leagueTeams.find(x => x.id === oppId) : null;
            return { oppId, oppName: opp ? opp.name : 'next week\'s opponent' };
        },
        text: c => `A reporter asks about ${c.oppName}. The room goes quiet, waiting for a quote.`,
        choices: ['Guarantee a win', 'Coach-speak: one game at a time', 'Play the underdog card'],
        apply: (s, t, c, i) => {
            const opp = c.oppId ? s.leagueTeams.find(x => x.id === c.oppId) : null;
            if (i === 0) {
                userSkaters(t).forEach(p => boost(p, 1, 1));
                if (opp) allActive(opp).forEach(p => boost(p, 1, 1));
                return `Bulletin-board material! Your team is fired up (+1) — but so is ${c.oppName} (+1).`;
            }
            if (i === 2) { userSkaters(t).forEach(p => boost(p, 1, 1)); return '"Nobody believes in us." Us-against-the-world (+1 this week).'; }
            return 'You say nothing quotable. The beat writers sigh.';
        },
    },
    {
        id: 'press_slump', kind: 'decision', title: 'Press Conference: The Slump',
        eligible: t => userSkaters(t).length > 0,
        ctx: t => { const p = pick(userSkaters(t)); return { pid: p.id, name: `${p.firstName} ${p.lastName}` }; },
        text: c => `A reporter asks point-blank: what's wrong with ${c.name}?`,
        choices: ['Back him publicly', 'Call him out', 'No comment'],
        apply: (s, t, c, i) => {
            const p = findP(t, c.pid);
            if (i === 0) { if (p) boost(p, 1, 2); return `${pname(p)} hears the vote of confidence (+1, 2 weeks).`; }
            if (i === 1) {
                if (p) boost(p, -1, 1);
                userSkaters(t).filter(x => x.id !== c.pid).forEach(x => boost(x, 1, 1));
                return `The message is sent: ${pname(p)} is benched in the court of public opinion (−1), the room gets the message (+1).`;
            }
            return '"We\'re evaluating everything." Nothing changes.';
        },
    },
    {
        id: 'press_rivalry', kind: 'decision', title: 'Press Conference: Rivalry Week',
        eligible: (t, s) => {
            const g = (s.schedule[s.currentWeek - 1] || []).find(x => x.homeTeamId === t.id || x.awayTeamId === t.id);
            if (!g) return false;
            const oppId = g.homeTeamId === t.id ? g.awayTeamId : g.homeTeamId;
            return (t.rivals || []).includes(oppId);
        },
        ctx: (t, s) => {
            const g = (s.schedule[s.currentWeek - 1] || []).find(x => x.homeTeamId === t.id || x.awayTeamId === t.id);
            const oppId = g ? (g.homeTeamId === t.id ? g.awayTeamId : g.homeTeamId) : null;
            const opp = oppId ? s.leagueTeams.find(x => x.id === oppId) : null;
            return { oppId, oppName: opp ? opp.name : 'your rival' };
        },
        text: c => `Rivalry week. The ${c.oppName} game. The whole town is asking about it.`,
        choices: ['Embrace the hate', 'Downplay it: just another game', 'Guarantee the win'],
        apply: (s, t, c, i) => {
            const opp = c.oppId ? s.leagueTeams.find(x => x.id === c.oppId) : null;
            if (i === 0) {
                userSkaters(t).forEach(p => boost(p, 1, 1));
                if (opp) allActive(opp).forEach(p => boost(p, 1, 1));
                return 'Both fanbases are frothing. Both teams skate harder (+1 each).';
            }
            if (i === 2) {
                userSkaters(t).forEach(p => boost(p, 2, 1));
                if (opp) allActive(opp).forEach(p => boost(p, 1, 1));
                return `Bold. Your room believes (+2) — and ${c.oppName} just found their speech (+1).`;
            }
            return 'You refuse the bait. Just another game, just another week.';
        },
    },
    {
        id: 'press_goalie', kind: 'decision', title: 'Press Conference: Goalie Question',
        eligible: t => t.roster.goalies.filter(g => g.status === 'Active Roster').length >= 2,
        ctx: t => {
            const gs = t.roster.goalies.filter(g => g.status === 'Active Roster');
            const hot = gs.slice().sort((a, b) => (b.seasonWins || 0) - (a.seasonWins || 0))[0];
            return { gid: hot.id, name: `${hot.firstName} ${hot.lastName}` };
        },
        text: c => `Goalie controversy season: a reporter demands to know who's starting. ${c.name} has the most wins.`,
        choices: ['Name him the starter', 'Keep it open competition', 'No comment'],
        apply: (s, t, c, i) => {
            if (i === 0) {
                const g = findP(t, c.gid);
                if (g) boost(g, 1, 2);
                t.roster.goalies.filter(x => x.status === 'Active Roster' && x.id !== c.gid)
                    .forEach(x => boost(x, -1, 1));
                return `${pname(g)} gets the net (+1, 2 weeks). The other goalies? Not thrilled (−1).`;
            }
            if (i === 1) { allActive(t).filter(p => p.position === 'G').forEach(p => boost(p, 1, 1)); return 'May the best man win. Both goalies sharpen up (+1).'; }
            return 'You stare the reporter down until he moves on.';
        },
    },
];

export function getEvent(id) {
    return TEAM_EVENTS.find(e => e.id === id);
}

// 33% of regular-season weeks (1-28): stage an event the user hasn't seen
// this season. Never during tournaments, never while one is pending.
export function maybeRollEvent(state, weekNum) {
    if (weekNum < 1 || weekNum > 28) return;
    if (state.pendingEvent) return;
    if (Math.random() > 0.33) return;
    const team = state.leagueTeams.find(t => t.id === state.teamId);
    if (!team) return;
    state.eventsFired = state.eventsFired || [];
    let pool = TEAM_EVENTS.filter(e => !state.eventsFired.includes(e.id) && (!e.eligible || e.eligible(team, state)));
    if (!pool.length) {
        state.eventsFired = [];
        pool = TEAM_EVENTS.filter(e => !e.eligible || e.eligible(team, state));
    }
    if (!pool.length) return;
    let ev = pool[0], total = 0;
    const weights = pool.map(e => e.weight || 1);
    total = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * total, idx = 0;
    while (roll > weights[idx]) { roll -= weights[idx]; idx++; }
    ev = pool[idx];
    state.eventsFired.push(ev.id);
    state.lastEventResult = null;
    state.pendingEvent = { id: ev.id, ctx: ev.ctx ? ev.ctx(team, state) : {} };
}
