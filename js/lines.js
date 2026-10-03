// js/lines.js — forward positions, roles, line chemistry, and line formation.
// Forwards have a natural linePos (C/LW/RW) and a lineSlot (L1C..L4RW) marking
// their "home" slot. Chemistry adjusts a line's effective OVR by up to ±5%.
// The sim's goal math is untouched — it just sees the adjusted OVR.

export const LINE_POS = ['C', 'LW', 'RW'];

export function assignLinePos() {
    return LINE_POS[Math.floor(Math.random() * 3)];
}

// Role is derived from the player's best stat — no new data to manage.
export function getRole(player) {
    const s = player.stats || {};
    const max = Math.max(s.passing || 0, s.shooting || 0, s.physicality || 0, s.defense || 0, s.skating || 0);
    if ((s.passing || 0) === max) return 'Playmaker';
    if ((s.shooting || 0) === max) return 'Scorer';
    if ((s.physicality || 0) === max) return 'Power Forward';
    if ((s.defense || 0) === max) return 'Two-Way';
    return 'Speedster';
}

// Slot string for line l (1-4) and position ('C'/'LW'/'RW'), e.g. "L2LW".
export function slotFor(line, pos) {
    return `L${line}${pos}`;
}

// All 12 forward slots in order.
export function allForwardSlots() {
    const slots = [];
    for (let l = 1; l <= 4; l++) for (const pos of LINE_POS) slots.push(slotFor(l, pos));
    return slots;
}

// Chemistry bonus (-0.05 to +0.05) for a line of 3 players.
// Each player is expected to fill the slot matching their natural linePos;
// pass players in slot order [C, LW, RW].
export function lineChemistry(c, lw, rw) {
    const line = [c, lw, rw];
    if (line.some(p => !p)) return 0;
    let bonus = 0;

    // Positional fit: all natural = +1%, each out of position = -2%.
    const expected = ['C', 'LW', 'RW'];
    let mismatches = 0;
    line.forEach((p, i) => { if ((p.linePos || expected[i]) !== expected[i]) mismatches++; });
    bonus += mismatches === 0 ? 0.01 : mismatches * -0.02;

    // Role complement.
    const roles = line.map(getRole);
    const cRole = roles[0];
    if (cRole === 'Playmaker' && (roles[1] === 'Scorer' || roles[2] === 'Scorer')) bonus += 0.02;
    if (roles[0] === roles[1] && roles[1] === roles[2]) bonus -= 0.01; // redundant
    if (roles.includes('Power Forward') && roles.includes('Playmaker')) bonus += 0.01;

    return Math.max(-0.05, Math.min(0.05, bonus));
}

// Effective OVR for a line (average OVR × chemistry).
export function lineEffectiveOvr(c, lw, rw) {
    const line = [c, lw, rw].filter(Boolean);
    if (!line.length) return 0;
    const avg = line.reduce((s, p) => s + (p.overall || 0), 0) / line.length;
    return avg * (1 + lineChemistry(c, lw, rw));
}

// Group slotted forwards by line number: { 1: {C, LW, RW}, ... }.
export function getLines(forwards) {
    const lines = { 1: {}, 2: {}, 3: {}, 4: {} };
    forwards.forEach(p => {
        if (!p.lineSlot) return;
        const m = /^L([1-4])(C|LW|RW)$/.exec(p.lineSlot);
        if (m) lines[m[1]][m[2]] = p;
    });
    return lines;
}

// Auto-form the best lines: sort by OVR, greedily build complementary lines.
// Assigns lineSlot on each player. Used for new rosters and as the default.
export function autoFormLines(forwards) {
    const pool = [...forwards].sort((a, b) => (b.overall || 0) - (a.overall || 0));
    const byPos = { C: [], LW: [], RW: [] };
    pool.forEach(p => {
        const pos = LINE_POS.includes(p.linePos) ? p.linePos : assignLinePos();
        p.linePos = pos;
        byPos[pos].push(p);
    });
    // Snake: best C with best available wings, balancing lines 1-4.
    for (let l = 1; l <= 4; l++) {
        for (const pos of LINE_POS) {
            const p = byPos[pos].shift();
            if (p) p.lineSlot = slotFor(l, pos);
        }
    }
    // If the random position split left a slot empty (e.g. only 3 natural
    // centers), fill with the best remaining forward — out of position,
    // like a real team playing someone off-wing.
    fillVacantSlots(forwards);
    return forwards;
}

// Fill vacant line slots with the best unslotted active forwards.
// Used after recruiting/graduation; never reshuffles existing assignments.
export function fillVacantSlots(forwards) {
    const taken = new Set(forwards.filter(p => p.lineSlot).map(p => p.lineSlot));
    const vacant = allForwardSlots().filter(s => !taken.has(s));
    const candidates = forwards
        .filter(p => !p.lineSlot && p.status === 'Active Roster' && !p.injuryWeeks && !p.tempFill)
        .sort((a, b) => (b.overall || 0) - (a.overall || 0));
    // Prefer natural position fits.
    for (const slot of vacant) {
        const pos = slot.slice(2);
        let idx = candidates.findIndex(p => p.linePos === pos);
        if (idx === -1) idx = 0;
        if (idx >= 0 && candidates[idx]) {
            const p = candidates.splice(idx, 1)[0];
            p.lineSlot = slot;
        }
    }
    return forwards;
}

// Team forward OVR for the sim: average of line effective OVRs when slots
// are assigned, otherwise a simple average (AI/legacy fallback).
export function teamForwardOvr(forwards) {
    const active = forwards.filter(p => p.status === 'Active Roster');
    if (!active.length) return 0;
    const lines = getLines(active);
    const lineOvrs = [];
    for (let l = 1; l <= 4; l++) {
        const { C, LW, RW } = lines[l];
        if (C && LW && RW) lineOvrs.push(lineEffectiveOvr(C, LW, RW));
    }
    if (lineOvrs.length === 4) return lineOvrs.reduce((s, x) => s + x, 0) / 4;
    return active.reduce((s, p) => s + (p.overall || 0), 0) / active.length;
}
