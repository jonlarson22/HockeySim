// screens/menu.js — main menu with 3 save slots.
import { SAVE_SLOTS, getSlotInfo, loadSaved, exportSave, importSaveFile, clearSave, setActiveSlot, getActiveSlot } from '../store.js';
import { showScreen } from '../router.js';
import { esc } from '../ui.js';

export function render(container) {
    const paint = () => {
        const cards = SAVE_SLOTS.map(slot => {
            const info = getSlotInfo(slot);
            const isActive = slot === getActiveSlot();
            const saved = info && info.savedAt ? new Date(info.savedAt).toLocaleDateString() : '';
            const body = info ? `
                <div><strong>${esc(info.coachName)}</strong></div>
                <div style="color:#aaa;font-size:0.9em;">${esc(info.teamName)} · Year ${info.year}, Game ${info.week}</div>
                <div style="color:#666;font-size:0.8em;">${saved ? 'Saved ' + esc(saved) : ''}</div>
                <div style="margin-top:8px;display:flex;gap:6px;">
                    <button data-load="${slot}">Load</button>
                    <button data-export="${slot}" class="secondary">Export</button>
                    <button data-delete="${slot}" class="secondary" style="color:#f87171;">Delete</button>
                </div>` : `
                <div style="color:#666;font-style:italic;">Empty slot</div>
                <div style="margin-top:8px;display:flex;gap:6px;">
                    <button data-new="${slot}">New Career</button>
                    <button data-import="${slot}" class="secondary">Import</button>
                </div>`;
            return `
                <div data-slot="${slot}" style="background:#2a2a2a;padding:14px;border-radius:8px;border:2px solid ${isActive ? 'var(--accent)' : '#444'};cursor:pointer;">
                    <div style="font-size:0.8em;color:#888;margin-bottom:6px;">SLOT ${slot}${isActive ? ' · ACTIVE' : ''}</div>
                    ${body}
                </div>`;
        }).join('');

        container.innerHTML = `
            <div class="dashboard-panel text-center" style="max-width:640px;margin:0 auto;">
                <h2>College Hockey Dynasty</h2>
                <p>Build your legacy.</p>
                <div style="display:grid;gap:10px;text-align:left;margin-top:16px;">${cards}</div>
                <input type="file" id="menu-file" accept=".json" style="display:none;">
            </div>`;

        // Clicking a slot (not a button) marks it active.
        container.querySelectorAll('[data-slot]').forEach(card => {
            card.onclick = (e) => {
                if (e.target.closest('button')) return;
                setActiveSlot(parseInt(card.getAttribute('data-slot'), 10));
                paint();
            };
        });
        container.querySelectorAll('[data-load]').forEach(b => b.onclick = (e) => {
            e.stopPropagation();
            const slot = parseInt(b.getAttribute('data-load'), 10);
            if (loadSaved(slot)) showScreen('dashboard');
        });
        container.querySelectorAll('[data-new]').forEach(b => b.onclick = (e) => {
            e.stopPropagation();
            setActiveSlot(parseInt(b.getAttribute('data-new'), 10));
            showScreen('coach-creation');
        });
        container.querySelectorAll('[data-delete]').forEach(b => b.onclick = (e) => {
            e.stopPropagation();
            const slot = parseInt(b.getAttribute('data-delete'), 10);
            if (confirm(`Delete save in slot ${slot}? This cannot be undone.`)) {
                clearSave(slot);
                paint();
            }
        });
        container.querySelectorAll('[data-export]').forEach(b => b.onclick = (e) => {
            e.stopPropagation();
            if (!exportSave(parseInt(b.getAttribute('data-export'), 10))) alert('No save data found.');
        });
        const fileInput = container.querySelector('#menu-file');
        let importSlot = 1;
        container.querySelectorAll('[data-import]').forEach(b => b.onclick = (e) => {
            e.stopPropagation();
            importSlot = parseInt(b.getAttribute('data-import'), 10);
            fileInput.click();
        });
        fileInput.onchange = async e => {
            const file = e.target.files[0];
            if (!file) return;
            if (await importSaveFile(file, importSlot)) {
                alert(`Save imported to slot ${importSlot}!`);
                showScreen('dashboard');
            } else {
                alert('Invalid save file.');
            }
            fileInput.value = '';
        };
    };
    paint();
}
