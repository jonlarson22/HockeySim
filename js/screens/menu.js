// screens/menu.js — main menu.
import { hasSave, loadSaved, exportSave, importSaveFile } from '../store.js';
import { showScreen } from '../router.js';

export function render(container) {
    container.innerHTML = `
        <div class="dashboard-panel text-center">
            <h2>College Hockey Dynasty</h2>
            <p>Build your legacy.</p>
            <button id="menu-new">New Career</button>
            <button id="menu-load" class="secondary">Load Game</button>
            <button id="menu-export" class="secondary">Export Save</button>
            <button id="menu-import" class="secondary">Import Save</button>
            <input type="file" id="menu-file" accept=".json" style="display: none;">
        </div>`;

    container.querySelector('#menu-new').onclick = () => showScreen('coach-creation');

    container.querySelector('#menu-load').onclick = () => {
        if (!hasSave()) {
            alert('No save data found.');
            return;
        }
        loadSaved();
        showScreen('dashboard');
    };

    container.querySelector('#menu-export').onclick = () => {
        if (!exportSave()) alert('No save data found to export.');
    };

    const fileInput = container.querySelector('#menu-file');
    container.querySelector('#menu-import').onclick = () => fileInput.click();
    fileInput.onchange = async e => {
        const file = e.target.files[0];
        if (!file) return;
        const ok = await importSaveFile(file);
        if (ok) {
            alert('Save imported successfully!');
            showScreen('dashboard');
        } else {
            alert('Invalid save file.');
        }
    };
}
