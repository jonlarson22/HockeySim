// screens/coachCreation.js — create-a-coach.
import { setState, newCareerState } from '../store.js';
import { showScreen } from '../router.js';
import { teams as baseTeams } from '../data.js';
import { initializeLeague } from '../engine.js';

const STARTING_POINTS = 20; // 15 base (3 x 5 skills) + 5 allocatable
const MAX_SKILL = 30;
const SKILLS = [
    { key: 'offense', label: 'Offensive Tactics' },
    { key: 'defense', label: 'Defensive Tactics' },
    { key: 'development', label: 'Player Development' },
    { key: 'recruiting', label: 'Recruiting Prowess' },
    { key: 'scouting', label: 'Scouting Network' }
];

export function render(container) {
    // Fresh skill state on every visit — nothing stale carries over.
    const tempSkills = { offense: 3, defense: 3, development: 3, recruiting: 3, scouting: 3 };

    const skillRows = SKILLS.map(s => `
        <div class="skill-row">
            <span>${s.label}</span>
            <div class="skill-controls">
                <button class="btn-skill-minus secondary" data-skill="${s.key}">-</button>
                <input type="number" id="skill-val-${s.key}" class="skill-input" data-skill="${s.key}" value="3" min="0" max="30">
                <button class="btn-skill-plus secondary" data-skill="${s.key}">+</button>
            </div>
        </div>`).join('');

    container.innerHTML = `
        <div class="dashboard-panel">
            <h2>Create Your Coach</h2>
            <label>First Name:</label>
            <input type="text" id="coach-first" placeholder="e.g. Herb" class="input-field">
            <label>Last Name:</label>
            <input type="text" id="coach-last" placeholder="e.g. Brooks" class="input-field">
            <label>Starting Age (25 - 65):</label>
            <input type="number" id="coach-age" value="35" min="25" max="65" class="input-field">
            <div class="skills-container">
                <div class="skills-header">
                    <h3>Coaching Skills (0-30)</h3>
                    <p>Unassigned Points: <span id="points-remaining" style="color: var(--accent); font-weight: bold;">5</span></p>
                </div>
                ${skillRows}
            </div>
            <button id="coach-submit">View Job Offers</button>
            <button id="coach-back" class="secondary">Back</button>
        </div>`;

    const pointsDisplay = container.querySelector('#points-remaining');
    const spent = () => Object.values(tempSkills).reduce((a, b) => a + b, 0);
    const refresh = () => {
        pointsDisplay.textContent = STARTING_POINTS - spent();
        SKILLS.forEach(s => { container.querySelector(`#skill-val-${s.key}`).value = tempSkills[s.key]; });
    };

    container.querySelectorAll('.skill-input').forEach(input => {
        input.addEventListener('change', e => {
            const skill = e.target.dataset.skill;
            let v = parseInt(e.target.value, 10) || 0;
            if (v < 0) v = 0;
            const prev = tempSkills[skill];
            tempSkills[skill] = 0;
            const avail = STARTING_POINTS - spent();
            tempSkills[skill] = prev;
            if (v > avail) v = avail;
            if (v > MAX_SKILL) v = MAX_SKILL;
            tempSkills[skill] = v;
            refresh();
        });
    });

    container.querySelectorAll('.btn-skill-plus').forEach(btn => {
        btn.addEventListener('click', e => {
            const skill = e.target.dataset.skill;
            if (spent() < STARTING_POINTS && tempSkills[skill] < MAX_SKILL) {
                tempSkills[skill]++;
                refresh();
            }
        });
    });

    container.querySelectorAll('.btn-skill-minus').forEach(btn => {
        btn.addEventListener('click', e => {
            const skill = e.target.dataset.skill;
            if (tempSkills[skill] > 0) {
                tempSkills[skill]--;
                refresh();
            }
        });
    });

    container.querySelector('#coach-back').onclick = () => showScreen('menu');

    container.querySelector('#coach-submit').onclick = () => {
        const firstName = container.querySelector('#coach-first').value.trim() || 'Coach';
        const lastName = container.querySelector('#coach-last').value.trim() || 'Unknown';
        let age = parseInt(container.querySelector('#coach-age').value, 10) || 35;
        if (age < 25) age = 25;
        if (age > 65) age = 65;

        const fresh = newCareerState();
        fresh.coach = { firstName, lastName, age, skills: { ...tempSkills }, history: [] };
        fresh.leagueTeams = initializeLeague(baseTeams);
        setState(fresh);
        showScreen('job-board');
    };
}
