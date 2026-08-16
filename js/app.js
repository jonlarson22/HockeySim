// 1. Import our data and functions from data.js
import { teams, getRandomName } from './data.js';

// 2. Grab the UI elements from the HTML
const teamInfoDiv = document.getElementById('team-info');
const generateBtn = document.getElementById('generate-btn');
const prospectList = document.getElementById('prospect-list');

// 3. Set up a test state
// Let's set your starting team to the Utah Summit
const myTeam = teams.find(t => t.id === "team_uta");

function initUI() {
    // Inject the team name and color into the header
    teamInfoDiv.textContent = `Head Coach | ${myTeam.name}`;
    teamInfoDiv.style.color = myTeam.color;
}

// 4. Create a function to test the generation logic
function handleGenerateClick() {
    // Generate a new name from the data.js arrays
    const newName = getRandomName();
    
    // Create a new list item and add it to the screen
    const li = document.createElement('li');
    li.textContent = `Scouted: ${newName}`;
    
    // Add it to the top of the list
    prospectList.prepend(li);
}

// 5. Wire up the button click event
generateBtn.addEventListener('click', handleGenerateClick);

// 6. Boot up the app
initUI();
console.log("App initialized. data.js successfully imported.");
