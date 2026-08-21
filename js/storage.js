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

export function exportGameState() {
    const savedData = localStorage.getItem(SAVE_KEY);
    if (!savedData) return false;

    const blob = new Blob([savedData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dynasty_save_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    return true;
}

export function importGameState(file, onComplete) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            localStorage.setItem(SAVE_KEY, JSON.stringify(data));
            if (onComplete) onComplete(true);
        } catch (err) {
            console.error("Failed to parse save file", err);
            if (onComplete) onComplete(false);
        }
    };
    reader.readAsText(file);
}
