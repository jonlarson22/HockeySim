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

// --- COACH CREATION LOGIC ---
const STARTING_POINTS = 5;
const MAX_SKILL = 30;
const BASE_SKILL = 3;

// Temporary object to hold skills before submitting
const tempSkills = {
    scouting: BASE_SKILL,
    recruiting: BASE_SKILL,
    development: BASE_SKILL,
    offense: BASE_SKILL,
    defense: BASE_SKILL
};

// Grab skill UI elements
const pointsDisplay = document.getElementById('points-remaining');
const skillInputs = document.querySelectorAll('.skill-input');
const plusButtons = document.querySelectorAll('.btn-skill-plus');
const minusButtons = document.querySelectorAll('.btn-skill-minus');

// Helper function to calculate currently spent points
function getSpentPoints() {
    return Object.values(tempSkills).reduce((sum, val) => sum + val, 0);
}

// Function to update the screen numbers
function updateSkillUI() {
    const spent = getSpentPoints();
    const available = STARTING_POINTS - spent;
    
    pointsDisplay.textContent = available;
    
    // Sync the input boxes with our data object
    for (const [skill, val] of Object.entries(tempSkills)) {
        document.getElementById(`skill-val-${skill}`).value = val;
    }
}

// Handle Direct Typing into the Input Box
skillInputs.forEach(input => {
    input.addEventListener('change', (e) => {
        const skill = e.target.dataset.skill;
        let newValue = parseInt(e.target.value) || 0;
        
        // Prevent negative numbers
        if (newValue < 0) newValue = 0;
        
        // Temporarily set the skill to 0 to see how many points we have to spend
        const previousValue = tempSkills[skill];
        tempSkills[skill] = 0; 
        const availableNow = STARTING_POINTS - getSpentPoints();
        
        // Cap the input so they can't type 999 and break the limit
        if (newValue > availableNow) {
            newValue = availableNow;
        }
        if (newValue > MAX_SKILL) {
            newValue = MAX_SKILL;
        }
        
        tempSkills[skill] = newValue;
        updateSkillUI();
    });
});

// Plus Button Listeners
plusButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const skill = e.target.dataset.skill;
        if (getSpentPoints() < STARTING_POINTS && tempSkills[skill] < MAX_SKILL) {
            tempSkills[skill]++;
            updateSkillUI();
        }
    });
});

// Minus Button Listeners
minusButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const skill = e.target.dataset.skill;
        if (tempSkills[skill] > 0) {
            tempSkills[skill]--;
            updateSkillUI();
            }
    });
});

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
    gameState.coach.firstName = document.getElementById('coach-first').value || "Coach";
    gameState.coach.lastName = document.getElementById('coach-last').value || "Unknown";
    gameState.coach.age = parseInt(document.getElementById('coach-age').value);
    gameState.coach.skills = { ...tempSkills };

    generateJobBoard();
    switchView('view-job-board');
});

// 3. Generate Job Board
function generateJobBoard() {
    jobList.innerHTML = ""; // Clear list
    
    // 1. Filter for bottom tier teams (Tier 3 / Mountain West)
    let availableJobs = teams.filter(t => t.confId === "conf_mw");

    // 2. Shuffle the array to randomize (Fisher-Yates shuffle approach)
    availableJobs = availableJobs.sort(() => 0.5 - Math.random());

    // 3. Select 2 or 3 random open jobs
    // Randomly decide if there are 2 or 3 jobs open this year
    const numberOfJobs = Math.floor(Math.random() * 2) + 2; 
    const openJobs = availableJobs.slice(0, numberOfJobs);

    openJobs.forEach(team => {
        const li = document.createElement('li');
        li.className = 'job-item';
        li.innerHTML = `
            <div>
                <strong>${team.name}</strong><br>
                <small>Prestige: ${team.prestige} / 100</small>
            </div>
            <button style="width: auto; margin: 0; padding: 8px 12px; background: ${team.color}">Accept Offer</button>
        `;

        // Accept job click listener
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
