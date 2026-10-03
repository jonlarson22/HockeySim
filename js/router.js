// router.js — tiny screen router.
//
// One screen lives in the DOM at a time. Each screen module exports:
//   render(container, params) — build DOM + bind events
//   destroy() (optional)      — unbind document/window-level listeners
// Navigating tears down the old screen before rendering the new one, so there
// is no hide/show juggling and no listeners leaking across screens.

import { getState, getUserTeam } from './store.js';

const screens = new Map();
let currentName = null;
let currentModule = null;

export function registerScreen(name, screenModule) {
    screens.set(name, screenModule);
}

export function showScreen(name, params) {
    const mod = screens.get(name);
    if (!mod) throw new Error(`router.showScreen: unknown screen "${name}"`);
    const app = document.getElementById('app');
    if (!app) throw new Error('router.showScreen: #app container missing');

    if (currentModule && typeof currentModule.destroy === 'function') {
        try {
            currentModule.destroy();
        } catch (e) {
            console.error(`router: destroy failed for "${currentName}":`, e);
        }
    }

    app.innerHTML = '';
    currentName = name;
    currentModule = mod;
    mod.render(app, params || {});
    updateChrome();
    if (typeof window !== 'undefined' && window.scrollTo) window.scrollTo(0, 0);
}

export function currentScreen() {
    return currentName;
}

// Persistent header: hidden until the career has a team.
function updateChrome() {
    const header = document.getElementById('main-header');
    const badge = document.getElementById('team-info');
    if (!header || !badge) return;

    const s = getState();
    const team = getUserTeam();
    if (s && s.teamId && team) {
        header.classList.remove('hidden');
        badge.textContent = `${s.coach.lastName || 'Coach'} | ${team.name} HC`;
        badge.style.color = team.color;
    } else {
        header.classList.add('hidden');
    }
}
