import { teams as baseTeams, conferences } from './data.js';
import { generateTeamRoster, initializeLeague, generateSeasonSchedule, simulateWeek } from './engine.js';

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
    year: 2026,
    leagueTeams: [] // NEW: Will hold the randomized teams
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

function getScheduleLabel(weekNumber) {
    if (weekNumber <= 10) {
        return `Non-Conference Game ${weekNumber}`;
    } else if (weekNumber <= 38) {
        return `Conference Game ${weekNumber - 10}`;
    } else if (weekNumber === 39) {
        return `Conference Quarterfinals`;
    } else if (weekNumber === 40) {
        return `Conference Semifinals`;
    } else if (weekNumber === 41) {
        return `Conference Finals`;
    } else if (weekNumber === 42) {
        return `National Round of 16`;
    } else if (weekNumber === 43) {
        return `National Quarterfinals`;
    } else if (weekNumber === 44) {
        return `National Semifinals`;
    } else if (weekNumber === 45) {
        return `National Championship`;
    } else {
        return `Offseason`;
    }
}

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

    // NEW: Initialize the league with randomized prestige
    gameState.leagueTeams = initializeLeague(baseTeams);

    generateJobBoard();
    switchView('view-job-board');
});

// 3. Generate Job Board
function generateJobBoard() {
    jobList.innerHTML = ""; // Clear list
    
    // 1. Filter for bottom tier teams (Tier 3 / Mountain West)
    let availableJobs = gameState.leagueTeams.filter(t => t.prestige <= 59);

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
    
    // Generate the roster based on team prestige
    gameState.roster = team.roster;
    
    // NEW: Generate the full 38-week schedule for the league!
    gameState.schedule = generateSeasonSchedule(gameState.leagueTeams, conferences);
    gameState.currentWeek = 1; // Track where we are in the season

    // Update Header
    teamInfoDiv.textContent = `${gameState.coach.lastName} | ${team.name} HC`;
    teamInfoDiv.style.color = team.color;

    initDashboard(); 
    switchView('view-dashboard');
}

// --- DASHBOARD LOGIC ---
function initDashboard() {
    updateNextGameText(); // Fixes "Week 1 vs. TBA" bug
    
    populateConferenceDropdown();
    
    const myTeam = gameState.leagueTeams.find(t => t.id === gameState.teamId);
    const startConfId = myTeam ? myTeam.confId : conferences[0].id;
    
    const select = document.getElementById('conference-select');
    if (select) select.value = startConfId;
    
    updateStandingsTable(startConfId);
    updateTop25();
}

function updateNextGameText() {
    const nextGameText = document.getElementById('next-game-text');
    if (!nextGameText) return;

    // Check if the season is over
    if (gameState.currentWeek > gameState.schedule.length) {
        nextGameText.textContent = "Regular Season Complete";
        return;
    }

    const weekGames = gameState.schedule[gameState.currentWeek - 1];
    const myTeam = gameState.leagueTeams.find(t => t.id === gameState.teamId);
    const myGame = weekGames.find(g => g.homeTeamId === myTeam.id || g.awayTeamId === myTeam.id);

if (myGame) {
        const isHome = myGame.homeTeamId === myTeam.id;
        const opponentId = isHome ? myGame.awayTeamId : myGame.homeTeamId;
        const opponent = gameState.leagueTeams.find(t => t.id === opponentId);
        // UPDATED LABEL
        nextGameText.textContent = `${getScheduleLabel(gameState.currentWeek)} ${isHome ? 'vs.' : '@'} ${opponent.abbr || opponent.name}`;
    } else {
        // UPDATED LABEL
        nextGameText.textContent = `${getScheduleLabel(gameState.currentWeek)} - BYE WEEK`;
    }
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

    const confTeams = gameState.leagueTeams
        .filter(t => t.confId === confId)
        .sort((a, b) => {
            const aConfPts = ((a.confWins || 0) * 2) + ((a.confOtl || 0) * 1);
            const bConfPts = ((b.confWins || 0) * 2) + ((b.confOtl || 0) * 1);
            if (bConfPts !== aConfPts) return bConfPts - aConfPts; // Primary: Conf Points

            const aOvrPts = ((a.wins || 0) * 2) + ((a.otl || 0) * 1);
            const bOvrPts = ((b.wins || 0) * 2) + ((b.otl || 0) * 1);
            if (bOvrPts !== aOvrPts) return bOvrPts - aOvrPts;   // Tiebreaker 1: Overall Points

            return b.prestige - a.prestige;                        // Tiebreaker 2: Prestige
        });

    confTeams.forEach(team => {
        const confW = team.confWins || 0;
        const confL = team.confLosses || 0;
        const confOtl = team.confOtl || 0;
        const confPts = (confW * 2) + (confOtl * 1);
        
        const w = team.wins || 0;
        const l = team.losses || 0;
        const otl = team.otl || 0;
        const ovrPts = (w * 2) + (otl * 1);

        const row = document.createElement('tr');
        if(team.id === gameState.teamId) {
            row.style.fontWeight = "bold";
            row.style.color = team.color;
        }
        
        row.innerHTML = `
            <td style="white-space: nowrap;">${team.name}</td>
            <td style="text-align: center; white-space: nowrap;">${confW}-${confL}-${confOtl}</td>
            <td style="text-align: center;">${confPts}</td>
            <td style="text-align: center; color: #aaa; white-space: nowrap;">${w}-${l}-${otl}</td>
            <td style="text-align: center; color: #aaa;">${ovrPts}</td>
        `;
        tbody.appendChild(row);
    });
}

function updateTop25() {
    const rankingList = document.getElementById('national-rankings');
    rankingList.innerHTML = "";

    // Pseudo-poll calculation balancing points, win percentage, loss penalties, and prestige
    const getPollScore = (t) => {
        const w = t.wins || 0;
        const l = t.losses || 0;
        const otl = t.otl || 0;
        const overallPts = (w * 2) + (otl * 1);
        const totalGames = w + l + otl;
        const winPct = totalGames > 0 ? (overallPts / (totalGames * 2)) : 0;
        
        return (overallPts * 12) + (winPct * 50) + (t.prestige * 0.5) - (l * 2);
    };

    const topTeams = [...gameState.leagueTeams].sort((a, b) => getPollScore(b) - getPollScore(a)).slice(0, 25);

    topTeams.forEach((team, index) => {
        const li = document.createElement('li');
        if(team.id === gameState.teamId) {
            li.style.color = team.color;
            li.style.fontWeight = "bold";
        }
        
        const w = team.wins || 0;
        const l = team.losses || 0;
        const otl = team.otl || 0;
        
        // Extract location name, accounting for two-word places
        let locationName = team.name.split(' ')[0];
        if (team.name.startsWith("New ") || team.name.startsWith("Rhode ")) {
            const parts = team.name.split(' ');
            locationName = parts[0] + " " + parts[1];
        }

        // Added font-size: 0.9em to shrink the text
        li.innerHTML = `<span style="font-size: 0.9em;">#${index + 1} ${locationName}</span> <span style="float:right; color:#888; font-size: 0.9em;">${w}-${l}-${otl}</span>`;
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
    // NEW: Added OVR to the bio line
    document.getElementById('modal-bio').textContent = `${player.year} | Position: ${player.position} | OVR: ${player.overall} | POT: ${player.potential}`;
    
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
// --- ROSTER LOGIC ---
const rosterSortSelect = document.getElementById('roster-sort');

function renderRoster(sortBy = 'overall') {
    const rosterDiv = document.getElementById('roster-list');
    const { goalies, defensemen, forwards } = gameState.roster;
    
    // Convert year string to number for sorting (Sr first)
    const yearVal = { 'Fr': 1, 'So': 2, 'Jr': 3, 'Sr': 4 };

    // Helper to sort player arrays
    const sortPlayers = (players) => {
        return [...players].sort((a, b) => {
            if (sortBy === 'overall') return b.overall - a.overall;
            if (sortBy === 'potential') return b.potential - a.potential;
            if (sortBy === 'age') return yearVal[b.year] - yearVal[a.year]; 
            return 0;
        });
    };

    const renderPlayerRow = (p) => {
        const isPastWeek10 = gameState.currentWeek > 10;
        const isCurrentlyRedshirt = p.status === 'Redshirt';
        
        // Completely lock the dropdown if they are a redshirt past week 10
        const lockDropdownAttr = (isPastWeek10 && isCurrentlyRedshirt) ? 'disabled title="Redshirt locked"' : '';
        
        // Disable the redshirt option if past week 10 OR if they've used it before
        const disableRedshirt = (isPastWeek10 || p.redshirtUsed) ? 'disabled' : '';

        // Display injury tag if hurt
        const injuryTag = p.injuryWeeks > 0 ? `<span style="background: #8b0000; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 0.8em; margin-right: 5px; border: 1px solid #ff0000;">INJ (${p.injuryWeeks}W)</span>` : '';

        return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: #2a2a2a; margin-bottom: 5px; border-radius: 4px;">
                <a href="#" class="player-link" data-id="${p.id}" style="color: var(--accent); text-decoration: none; display: flex; align-items: center;">
                    <span style="background: #444; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 0.8em; margin-right: 5px; border: 1px solid #555;">OVR: ${p.overall}</span> 
                    <span style="background: #1e3a8a; color: #93c5fd; padding: 2px 6px; border-radius: 4px; font-size: 0.8em; margin-right: 10px; border: 1px solid #3b82f6;">POT: ${p.potential}</span>
                    ${injuryTag}
                    ${p.firstName} ${p.lastName} <span style="color:#aaa; font-size:0.9em; margin-left: 5px;">(${p.year})</span>
                </a>
                <select class="role-select" data-id="${p.id}" ${lockDropdownAttr} style="${(isPastWeek10 && isCurrentlyRedshirt) ? 'background: #444; cursor: not-allowed;' : ''}">
                    <option value="Active Roster" ${p.status === 'Active Roster' ? 'selected' : ''}>Active Roster</option>
                    <option value="Practice Squad" ${p.status === 'Practice Squad' ? 'selected' : ''}>Practice Squad</option>
                    <option value="Redshirt" ${p.status === 'Redshirt' ? 'selected' : ''} ${disableRedshirt}>Redshirt</option>
                </select>
            </div>
        `;
    };

    let html = `<h3>Forwards</h3>`;
    sortPlayers(forwards).forEach(p => html += renderPlayerRow(p));
    
    html += `<h3 style="margin-top:15px;">Defensemen</h3>`;
    sortPlayers(defensemen).forEach(p => html += renderPlayerRow(p));
    
    html += `<h3 style="margin-top:15px;">Goalies</h3>`;
    sortPlayers(goalies).forEach(p => html += renderPlayerRow(p));
    
    rosterDiv.innerHTML = html;
    
    // Attach Listeners
    document.querySelectorAll('.player-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const anchor = e.target.closest('a'); 
            const playerId = anchor.getAttribute('data-id');
            const player = [...forwards, ...defensemen, ...goalies].find(p => p.id === playerId);
            if(player) openPlayerModal(player);
        });
    });

    document.querySelectorAll('.role-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const playerId = e.target.getAttribute('data-id');
            const player = [...forwards, ...defensemen, ...goalies].find(p => p.id === playerId);
            if(player) player.status = e.target.value; 
        });
    });
}

// Initial Roster Button Hook
btnViewRoster.addEventListener('click', () => {
    renderRoster(rosterSortSelect.value);
    switchView('view-roster');
});

// Roster Sort Change Listener
rosterSortSelect.addEventListener('change', (e) => {
    renderRoster(e.target.value);
});

document.getElementById('btn-back-roster').onclick = () => switchView('view-dashboard');

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

    // --- SIMULATION & WEEKLY RECAP LOGIC ---
const btnSimWeek = document.getElementById('btn-sim-week');
let lastSimulatedWeekIndex = 0;

// Remove the old filter button listeners and replace with this function
function populateRecapDropdown() {
    const select = document.getElementById('recap-filter-select');
    select.innerHTML = `<option value="all">National (All)</option>`;
    
    conferences.forEach(conf => {
        select.innerHTML += `<option value="${conf.id}">${conf.name}</option>`;
    });

    select.onchange = (e) => {
        renderWeeklyRecap(lastSimulatedWeekIndex, e.target.value);
    };
}

function renderWeeklyRecap(weekIndex, filterId) {
    const recapContainer = document.getElementById('recap-results-list');
    document.getElementById('recap-header').textContent = `${getScheduleLabel(weekIndex + 1)} Results`;
    recapContainer.innerHTML = "";

    const weekGames = gameState.schedule[weekIndex];
    const myTeam = gameState.leagueTeams.find(t => t.id === gameState.teamId);

    if (document.getElementById('recap-filter-select').options.length === 0) {
        populateRecapDropdown();
    }

    // Set filter ID to player's conference by default
    const activeFilter = (filterId && filterId !== 'conference') ? filterId : (myTeam ? myTeam.confId : 'all');
    document.getElementById('recap-filter-select').value = activeFilter;

    const gamesToShow = weekGames.filter(game => {
        if (activeFilter === 'all') return true;
        const homeTeam = gameState.leagueTeams.find(t => t.id === game.homeTeamId);
        const awayTeam = gameState.leagueTeams.find(t => t.id === game.awayTeamId);
        return homeTeam.confId === activeFilter || awayTeam.confId === activeFilter;
    });

    gamesToShow.forEach(game => {
        const homeTeam = gameState.leagueTeams.find(t => t.id === game.homeTeamId);
        const awayTeam = gameState.leagueTeams.find(t => t.id === game.awayTeamId);
        const otText = game.ot ? " <span style='color:#888; font-size:0.8em;'>(OT)</span>" : "";
        
        const homeColor = homeTeam.id === myTeam.id ? 'var(--accent)' : '#fff';
        const awayColor = awayTeam.id === myTeam.id ? 'var(--accent)' : '#fff';

        recapContainer.innerHTML += `
            <div style="background: #222; padding: 10px; border-radius: 4px; border-left: 4px solid ${homeTeam.color}; margin-bottom: 5px;">
                <div style="display:flex; justify-content: space-between; color: ${awayColor}">
                    <span>${awayTeam.name}</span> <span>${game.awayScore}</span>
                </div>
                <div style="display:flex; justify-content: space-between; color: ${homeColor}">
                    <span>${homeTeam.name}</span> <span>${game.homeScore}${otText}</span>
                </div>
            </div>
        `;
    });
}

// Continue button returns to dashboard and updates standings
document.getElementById('btn-recap-continue').addEventListener('click', () => {
    initDashboard(); // Refresh standings and Top 25 with the new data
    switchView('view-dashboard');
});

// Single Unified Simulate Button Listener
if (btnSimWeek) {
    btnSimWeek.addEventListener('click', () => {
        lastSimulatedWeekIndex = gameState.currentWeek - 1;
        
        const seasonActive = simulateWeek(gameState);
        
        if (seasonActive) {
            const myTeam = gameState.leagueTeams.find(t => t.id === gameState.teamId);
            const userConfId = myTeam ? myTeam.confId : conferences[0].id;
            
            renderWeeklyRecap(lastSimulatedWeekIndex, userConfId);
            switchView('view-weekly-recap');
        } else {
            alert("The regular season is over! Time for the postseason.");
        }
    });
}

// --- SCHEDULE LOGIC ---
const btnViewSchedule = document.getElementById('btn-view-schedule');

function generateTeamSchedule() {
    const scheduleContainer = document.getElementById('schedule-list');
    scheduleContainer.innerHTML = "";
    
    const myTeam = gameState.leagueTeams.find(t => t.id === gameState.teamId);

    gameState.schedule.forEach((weekGames, index) => {
        const weekNum = index + 1;
        // Find the game my team plays this week
        const myGame = weekGames.find(g => g.homeTeamId === myTeam.id || g.awayTeamId === myTeam.id);
        
        let rowHtml = `<div style="padding: 10px; border-bottom: 1px solid #444; display: flex; justify-content: space-between;">`;
        rowHtml += `<strong>${getScheduleLabel(weekNum)}</strong>`;
        
        if (!myGame) {
            rowHtml += `<span style="color: #888;">BYE WEEK</span></div>`;
        } else {
            const isHome = myGame.homeTeamId === myTeam.id;
            const opponentId = isHome ? myGame.awayTeamId : myGame.homeTeamId;
            const opponent = gameState.leagueTeams.find(t => t.id === opponentId);
            
            const matchText = isHome ? `vs. ${opponent.name}` : `@ ${opponent.name}`;
            
            if (myGame.played) {
                // Determine if we won
                const myScore = isHome ? myGame.homeScore : myGame.awayScore;
                const oppScore = isHome ? myGame.awayScore : myGame.homeScore;
                let result = myScore > oppScore ? '<span style="color: #4ade80;">W</span>' : '<span style="color: #f87171;">L</span>';
                if (myGame.ot) result += ' (OT)';
                
                rowHtml += `<span>${matchText}</span> <span>${result} ${myScore} - ${oppScore}</span>`;
            } else {
                rowHtml += `<span>${matchText}</span> <span>--</span>`;
            }
            rowHtml += `</div>`;
        }
        scheduleContainer.innerHTML += rowHtml;
    });
}

btnViewSchedule.addEventListener('click', () => {
    generateTeamSchedule();
    switchView('view-schedule');
});

// --- TOURNAMENT BRACKET LOGIC ---
const btnViewBracket = document.getElementById('btn-view-bracket');

function renderBracket() {
    const container = document.getElementById('bracket-container');
    container.innerHTML = "";

    const myTeam = gameState.leagueTeams.find(t => t.id === gameState.teamId);
    const confId = myTeam ? myTeam.confId : conferences[0].id;
    const confName = conferences.find(c => c.id === confId).name;

    let html = `<h3>${confName} Championship Bracket</h3>`;

    // The weeks the conference tournament takes place
    const tournamentRounds = [
        { week: 39, name: "Quarterfinals" },
        { week: 40, name: "Semifinals" },
        { week: 41, name: "Finals" }
    ];

    let tournamentStarted = false;

    tournamentRounds.forEach(round => {
        const roundGames = gameState.schedule[round.week - 1]; 
        if (!roundGames) return; 

        // Find games matching this conference and the tournament tag we set in tournaments.js
        const confGames = roundGames.filter(g => g.confId === confId && g.type === 'conf_tourney');
        if (confGames.length === 0) return;

        tournamentStarted = true;
        html += `<h4 style="margin-top: 15px; border-bottom: 1px solid #444; padding-bottom: 5px; color: var(--accent);">${round.name}</h4>`;

        confGames.forEach(game => {
            const homeTeam = gameState.leagueTeams.find(t => t.id === game.homeTeamId);
            const awayTeam = gameState.leagueTeams.find(t => t.id === game.awayTeamId);

            if (game.played) {
                // Determine winner logic
                const winner = game.homeScore > game.awayScore ? homeTeam.name : awayTeam.name;
                const otText = game.ot ? " (OT)" : "";
                
                html += `
                    <div style="padding: 10px; background: #333; margin-bottom: 5px; border-radius: 4px; display: flex; justify-content: space-between;">
                        <span>${awayTeam.name} (${game.awayScore}) @ ${homeTeam.name} (${game.homeScore})${otText}</span>
                        <strong style="color: #4ade80;">${winner} Advances</strong>
                    </div>`;
            } else {
                html += `
                    <div style="padding: 10px; background: #333; margin-bottom: 5px; border-radius: 4px; color: #aaa;">
                        ${awayTeam.name} @ ${homeTeam.name}
                    </div>`;
            }
        });
    });

    if (!tournamentStarted) {
        html += `<p style="color: #888; margin-top: 10px;">The regular season is still underway. The bracket will be revealed after Week 38.</p>`;
    }

    container.innerHTML = html;
}

btnViewBracket.addEventListener('click', () => {
    renderBracket();
    switchView('view-bracket');
});

document.getElementById('btn-back-bracket').onclick = () => switchView('view-dashboard');

document.getElementById('btn-back-schedule').onclick = () => switchView('view-dashboard');

// Boot up app on the Main Menu
switchView('view-main-menu');
