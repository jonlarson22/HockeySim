// actions.js — shared game actions used by multiple screens.
// Each action mutates state through the store (which autosaves).

import { getState, update } from './store.js';
import { simulateWeek } from './engine.js';

// Simulates the current week for the whole league.
// Returns { weekIndex, seasonActive }.
export function simCurrentWeek() {
    const weekIndex = getState().currentWeek - 1;
    let seasonActive = false;
    update(state => {
        seasonActive = simulateWeek(state);
    });
    return { weekIndex, seasonActive };
}
