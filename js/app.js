import { teams, conferences, getRandomName } from './data.js';
import { generateTeamRoster } from './engine.js';

// --- GAME STATE ---
// This object will eventually be saved to localStorage
let gameState = {
    coach: {
        firstName: "",
        lastName: "",
        age: 35,
        skills: {},
        history: [] // New array to store past season results
    },
    teamId: null,
    year: 2026
};

// --- DOM ELEMENTS ---
const header = document.getElementById('main-header');
const teamInfoDiv = document.getElementById('team-info');
const allViews = document.querySelectorAll('.view');

// --- COACH CREATION LOGIC ---
const STARTING_POINTS = 20; // 15 base points + 5 allocatable points
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
    
    // Generate the roster based on the team's prestige rating
    gameState.roster = generateTeamRoster(team.prestige);
    
    // Update Header
    teamInfoDiv.textContent = `${gameState.coach.lastName} | ${team.name} HC`;
    teamInfoDiv.style.color = team.color;

    initDashboard(); 
    switchView('view-dashboard');
}

// --- DASHBOARD LOGIC ---
function initDashboard() {
    populateConferenceDropdown();
    updateStandingsTable(conferences[0].id); // Default to the first conference
    updateTop25();
}

function populateConferenceDropdown() {
    const select = document.getElementById('conference-select');
    select.innerHTML = "";
    
    conferences.forEach(conf => {
        const option = document.createElement('option');
        option.value = conf.id;
        option.textContent = conf.name;
        select.appendChild(option);
    });

    // Listen for dropdown changes
    select.addEventListener('change', (e) => {
        updateStandingsTable(e.target.value);
    });
}

function updateStandingsTable(confId) {
    const tbody = document.getElementById('standings-body');
    tbody.innerHTML = "";

    // Sort by points eventually, but prestige is fine for preseason
    const confTeams = teams.filter(t => t.confId === confId)
                           .sort((a, b) => b.prestige - a.prestige);

    confTeams.forEach(team => {
        // Safe fallbacks before the sim starts generating stats
        const w = team.wins || 0;
        const l = team.losses || 0;
        const otl = team.otl || 0;
        const pts = (w * 2) + (otl * 1); // Hockey point system

        const row = document.createElement('tr');
        if(team.id === gameState.teamId) {
            row.style.fontWeight = "bold";
            row.style.color = team.color;
        }
        
        row.innerHTML = `
            <td>${team.name}</td>
            <td>${w}</td>
            <td>${l}</td>
            <td>${otl}</td>
            <td>${pts}</td>
        `;
        tbody.appendChild(row);
    });
}

function updateTop25() {
    const rankingList = document.getElementById('national-rankings');
    rankingList.innerHTML = "";

    // Preseason sort by prestige
    const topTeams = [...teams].sort((a, b) => b.prestige - a.prestige).slice(0, 25);

    topTeams.forEach((team, index) => {
        const li = document.createElement('li');
        if(team.id === gameState.teamId) {
            li.style.color = team.color;
            li.style.fontWeight = "bold";
        }
        
        const w = team.wins || 0;
        const l = team.losses || 0;
        const otl = team.otl || 0;
        
        li.innerHTML = `<span>#${index + 1} ${team.abbr}</span> <span style="float:right; color:#888;">${w}-${l}-${otl}</span>`;
        rankingList.appendChild(li);
    });
}

// --- TEAM MANAGEMENT BUTTONS ---
const btnViewRoster = document.getElementById('btn-view-roster');
const btnCoachTree = document.getElementById('btn-coach-tree'); 

// 1. Render Roster
// Helper to open the modal
function openPlayerModal(player) {
    document.getElementById('modal-name').textContent = `${player.firstName} ${player.lastName}`;
    document.getElementById('modal-bio').textContent = `${player.year} | Position: ${player.position} | Potential: ${player.potential}`;
    
    let statsHTML = "<ul>";
    for (const [stat, val] of Object.entries(player.stats)) {
        statsHTML += `<li><strong>${stat.toUpperCase()}:</strong> ${val}</li>`;
    }
    statsHTML += "</ul>";
    
    document.getElementById('modal-stats').innerHTML = statsHTML;
    document.getElementById('player-modal').classList.remove('hidden');
}

// Close Modal Listener
document.getElementById('btn-close-modal').addEventListener('click', () => {
    document.getElementById('player-modal').classList.add('hidden');
});

// Render the Advanced Roster
btnViewRoster.addEventListener('click', () => {
    const rosterDiv = document.getElementById('roster-list');
    const { goalies, defensemen, forwards } = gameState.roster;
    
    // Helper to generate a row for a player with a role dropdown
    const renderPlayerRow = (p, roleOptions) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: #2a2a2a; margin-bottom: 5px;">
            <a href="#" class="player-link" data-id="${p.id}" style="color: var(--accent); text-decoration: none;">
                ${p.firstName} ${p.lastName} (${p.year})
            </a>
            <select class="role-select" data-id="${p.id}">
                ${roleOptions.map(opt => `<option value="${opt}" ${p.status === opt ? 'selected' : ''}>${opt}</option>`).join('')}
            </select>
        </div>
    `;

    const forwardRoles = ['Line 1', 'Line 2', 'Line 3', 'Line 4', 'Scratched', 'Redshirt'];
    const defenseRoles = ['Pair 1', 'Pair 2', 'Pair 3', 'Scratched', 'Redshirt'];
    const goalieRoles = ['Starter', 'Backup', 'Scratched', 'Redshirt'];

    let html = `<h3>Forwards</h3>`;
    forwards.forEach(p => html += renderPlayerRow(p, forwardRoles));
    
    html += `<h3 style="margin-top:15px;">Defensemen</h3>`;
    defensemen.forEach(p => html += renderPlayerRow(p, defenseRoles));
    
    html += `<h3 style="margin-top:15px;">Goalies</h3>`;
    goalies.forEach(p => html += renderPlayerRow(p, goalieRoles));
    
    rosterDiv.innerHTML = html;
    
    // Attach click listeners to all the new player links
    document.querySelectorAll('.player-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const playerId = e.target.getAttribute('data-id');
            // Find the player across all groups
            const player = [...forwards, ...defensemen, ...goalies].find(p => p.id === playerId);
            if(player) openPlayerModal(player);
        });
    });

    // Attach change listeners to save line combinations to game state
    document.querySelectorAll('.role-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const playerId = e.target.getAttribute('data-id');
            const newRole = e.target.value;
            const player = [...forwards, ...defensemen, ...goalies].find(p => p.id === playerId);
            if(player) player.status = newRole; 
            // In a real app, we'd validate here (e.g., ensuring only 3 forwards are on "Line 1")
        });
    });
    
    document.getElementById('btn-back-roster').onclick = () => switchView('view-dashboard');
    switchView('view-roster');
});

// 2. Render Coach Profile
btnCoachTree.addEventListener('click', () => {
    const coachDiv = document.getElementById('coach-details');
    const c = gameState.coach;
    
    // Generate the history table
    let historyHTML = `
        <table class="standings-table" style="margin-top: 1rem;">
            <thead>
                <tr><th>Year</th><th>Team</th><th>W-L-OTL</th><th>Nat. Rank</th></tr>
            </thead>
            <tbody>
    `;
    
    if (c.history.length === 0) {
        historyHTML += `<tr><td colspan="4" style="text-align:center;">No completed seasons.</td></tr>`;
    } else {
        c.history.forEach(season => {
            historyHTML += `
                <tr>
                    <td>${season.year}</td>
                    <td>${season.teamName}</td>
                    <td>${season.wins}-${season.losses}-${season.otl}</td>
                    <td>${season.rank <= 25 ? '#' + season.rank : 'Unranked'}</td>
                </tr>
            `;
        });
    }
    historyHTML += `</tbody></table>`;

    coachDiv.innerHTML = `
        <p><strong>Name:</strong> ${c.firstName} ${c.lastName}</p>
        <p><strong>Age:</strong> ${c.age}</p>
        <hr style="margin: 1rem 0; border-color: #333;">
        <h3>Attribute Ratings</h3>
        <ul>
            <li>Offense: ${c.skills.offense}</li>
            <li>Defense: ${c.skills.defense}</li>
            <li>Development: ${c.skills.development}</li>
            <li>Recruiting: ${c.skills.recruiting}</li>
            <li>Scouting: ${c.skills.scouting}</li>
        </ul>
        <hr style="margin: 1rem 0; border-color: #333;">
        <h3>Career History</h3>
        ${historyHTML}
    `;
    
    document.getElementById('btn-back-coach').onclick = () => switchView('view-dashboard');
    switchView('view-coach-profile');
});

// Boot up app on the Main Menu
switchView('view-main-menu');
