// store.js — central game state store.
//
// Single source of truth for the whole app. Screens read state via getState()
// (or the getUserTeam() helper) and mutate it via update(), which autosaves.
// The roster lives ONLY on the team object inside leagueTeams — there is no
// separate state.roster duplicate.

const SAVE_KEY = 'college_hockey_dynasty_save';
const SAVE_VERSION = 1;

let state = null;
const listeners = new Set();

export function getState() {
    return state;
}

// Replace the entire state (e.g. new career, loaded game).
export function setState(newState, { save = true } = {}) {
    state = newState;
    if (save) persist();
    emit();
}

// Mutate the state, then autosave + notify subscribers.
export function update(mutator) {
    if (!state) throw new Error('store.update: no state loaded');
    mutator(state);
    persist();
    emit();
}

export function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

function emit() {
    listeners.forEach(fn => {
        try { fn(state); } catch (e) { console.error('store listener failed:', e); }
    });
}

// The user's team object. Roster lives only here.
export function getUserTeam() {
    if (!state || !state.teamId) return null;
    return state.leagueTeams.find(t => t.id === state.teamId) || null;
}

export function newCareerState() {
    return {
        coach: {
            firstName: '', lastName: '', age: 35, skills: {}, history: [],
            prestige: 15, xp: 0, level: 1, unspentPoints: 0, missStreak: 0
        },
        teamId: null,
        year: 2026,
        currentWeek: 1,
        trainingFocus: 'balanced',
        leagueTeams: [],
        schedule: [],
        prospectPool: [],
        recruitTargets: [],
        recruitWeekAlloc: {}
    };
}

export function hasSave() {
    try {
        return localStorage.getItem(SAVE_KEY) !== null;
    } catch (e) {
        return false;
    }
}

export function persist() {
    if (!state) return false;
    try {
        const payload = { version: SAVE_VERSION, savedAt: new Date().toISOString(), state };
        localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
        return true;
    } catch (e) {
        console.error('store.persist: save failed:', e);
        return false;
    }
}

// Best-effort load. Returns the state, or null when nothing usable is saved.
export function loadSaved() {
    let raw = null;
    try {
        raw = localStorage.getItem(SAVE_KEY);
    } catch (e) {
        console.error('store.loadSaved: read failed:', e);
        return null;
    }
    if (!raw) return null;
    try {
        const data = JSON.parse(raw);
        // v0 saves were the bare gameState object, not the versioned wrapper.
        const savedState = data && data.state ? data.state : data;
        state = migrate(savedState, data && data.version ? data.version : 0);
        emit();
        return state;
    } catch (e) {
        console.error('store.loadSaved: parse failed:', e);
        return null;
    }
}

export function clearSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    state = null;
    emit();
}

// Bring older saves up to the current shape.
function migrate(s, version) {
    if (!s || typeof s !== 'object') return newCareerState();
    if (!Array.isArray(s.leagueTeams)) s.leagueTeams = [];
    if (!Array.isArray(s.schedule)) s.schedule = [];
    if (!s.coach) s.coach = { firstName: '', lastName: '', age: 35, skills: {}, history: [] };
    s.coach.prestige = s.coach.prestige ?? 15;
    s.coach.xp = s.coach.xp ?? 0;
    s.coach.level = s.coach.level ?? 1;
    s.coach.unspentPoints = s.coach.unspentPoints ?? 0;
    s.coach.missStreak = s.coach.missStreak ?? 0;
    if (!s.trainingFocus) s.trainingFocus = 'balanced';
    // Pre-rebuild saves duplicated the roster at the top level; the team
    // object inside leagueTeams is the canonical copy now.
    if (s.roster) delete s.roster;
    if (typeof s.currentWeek !== 'number') s.currentWeek = 1;
    if (typeof s.year !== 'number') s.year = 2026;
    if (!Array.isArray(s.prospectPool)) s.prospectPool = [];
    if (!Array.isArray(s.recruitTargets)) s.recruitTargets = [];
    if (!s.recruitWeekAlloc || typeof s.recruitWeekAlloc !== 'object') s.recruitWeekAlloc = {};
    return s;
}

export function exportSave() {
    let raw = null;
    try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { /* ignore */ }
    if (!raw) return false;
    const blob = new Blob([raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dynasty_save_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    return true;
}

// Reads a user-picked .json file into the save slot. Resolves true on success.
export function importSaveFile(file) {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const data = JSON.parse(e.target.result);
                const savedState = data && data.state ? data.state : data;
                const migrated = migrate(savedState, data && data.version ? data.version : 0);
                try {
                    localStorage.setItem(SAVE_KEY, JSON.stringify({
                        version: SAVE_VERSION,
                        savedAt: new Date().toISOString(),
                        state: migrated
                    }));
                } catch (err) {
                    console.error('store.importSaveFile: save failed:', err);
                    resolve(false);
                    return;
                }
                state = migrated;
                emit();
                resolve(true);
            } catch (err) {
                console.error('store.importSaveFile: parse failed:', err);
                resolve(false);
            }
        };
        reader.onerror = () => resolve(false);
        reader.readAsText(file);
    });
}
