// ui.js — tiny shared UI helpers for screens. No game logic here.

// Escape user-provided strings before injecting into HTML.
export function esc(str) {
    return String(str === undefined || str === null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function scheduleLabel(weekNumber) {
    if (weekNumber <= 10) return `Non-Conference Game ${weekNumber}`;
    if (weekNumber <= 38) return `Conference Game ${weekNumber - 10}`;
    if (weekNumber === 39) return 'Conference Quarterfinals';
    if (weekNumber === 40) return 'Conference Semifinals';
    if (weekNumber === 41) return 'Conference Finals';
    if (weekNumber === 42) return 'National Round of 32';
    if (weekNumber === 43) return 'National Round of 16';
    if (weekNumber === 44) return 'National Quarterfinals';
    if (weekNumber === 45) return 'National Semifinals';
    if (weekNumber === 46) return 'National Championship';
    return 'Offseason';
}

export function openModal({ title, subtitle, bodyHTML }) {
    const root = document.getElementById('modal-root');
    if (!root) return;
    root.innerHTML = `
        <div class="modal-backdrop">
            <div class="modal-card">
                <h2>${title}</h2>
                ${subtitle ? `<p>${subtitle}</p>` : ''}
                <div style="margin: 15px 0;">${bodyHTML || ''}</div>
                <button id="modal-close" class="secondary">Close</button>
            </div>
        </div>`;
    root.querySelector('#modal-close').onclick = closeModal;
    root.querySelector('.modal-backdrop').onclick = e => {
        if (e.target.classList && e.target.classList.contains('modal-backdrop')) closeModal();
    };
}

export function closeModal() {
    const root = document.getElementById('modal-root');
    if (root) root.innerHTML = '';
}
