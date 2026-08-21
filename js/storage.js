// storage.js
const SAVE_KEY = 'college_hockey_dynasty_save';

export function saveGameState(gameState) {
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
        return true;
    } catch (e) {
        console.error("Failed to save game state:", e);
        return false;
    }
}

export function loadGameState() {
    try {
        const savedData = localStorage.getItem(SAVE_KEY);
        return savedData ? JSON.parse(savedData) : null;
    } catch (e) {
        console.error("Failed to load game state:", e);
        return null;
    }
}

export function hasSavedGame() {
    return localStorage.getItem(SAVE_KEY) !== null;
}
