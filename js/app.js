import { teams } from './data.js';

// --- GAME STATE ---
// This object will eventually be saved to localStorage
let gameState = {
    coach: {
        firstName: "",
        lastName: "",
        age: 35,
        skills: {}
    },
    teamId: null,
    year: 2026
};

// --- DOM ELEMENTS ---
const header = document.getElementById('main-header');
const teamInfoDiv = document.getElementById('team-info');
const allViews = document.querySelectorAll('.view');

// Buttons
const btnNewGame = document.getElementById('btn-new-game');
const btnSubmitCoach = document.getElementById('btn-submit-coach');
const jobList = document.getElementById('job-list');

// --- VIEW ROUTER ---
function switchView(viewId) {
    // 1. Hide all screens
    allViews.forEach(view => view.classList.add('hidden'));
    
    // 2. Show the requested screen
    document.getElementById(viewId).classList.remove('hidden');
    
    // 3. Special Header Logic (Hide header on main menu & creation screens)
    if (viewId === 'view-main-menu' || viewId === 'view-coach-creation') {
        header.classList.add('hidden');
    } else {
        header.classList.remove('hidden');
    }
}

// --- SCREEN LOGIC & EVENT LISTENERS ---

// 1. Main Menu -> Coach Creation
btnNewGame.addEventListener('click', () => {
    switchView('view-coach-creation');
});

// 2. Coach Creation -> Job Board
btnSubmitCoach.addEventListener('click', () => {
    // Save input values to state
    gameState.coach.firstName = document.getElementById('coach-first').value || "Coach";
    gameState.coach.lastName = document.getElementById('coach-last').value || "Unknown";
    gameState.coach.age = parseInt(document.getElementById('coach-age').value);

    generateJobBoard();
    switchView('view-job-board');
});

// 3. Generate Job Board
function generateJobBoard() {
    jobList.innerHTML = ""; // Clear list
    
    // For now, let's just filter for Tier 3 teams (Mountain West) as starting jobs
    const availableJobs = teams.filter(t => t.confId === "conf_mw");

    availableJobs.forEach(team => {
        const li = document.createElement('li');
        li.className = 'job-item';
        li.innerHTML = `
            <div>
                <strong>${team.name}</strong><br>
                <small>Prestige: ${team.prestige}</small>
            </div>
            <button style="width: auto; margin: 0; padding: 8px 12px; background: ${team.color}">Accept</button>
        `;

        // 4. Job Board -> In-Season Dashboard
        li.querySelector('button').addEventListener('click', () => {
            acceptJob(team);
        });

        jobList.appendChild(li);
    });
}

function acceptJob(team) {
    gameState.teamId = team.id;
    
    // Update Header
    teamInfoDiv.textContent = `${gameState.coach.lastName} | ${team.name} HC`;
    teamInfoDiv.style.color = team.color;

    // Move to dashboard
    switchView('view-dashboard');
}

// Boot up app on the Main Menu
switchView('view-main-menu');
