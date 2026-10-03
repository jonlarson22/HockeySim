// app.js — bootstrap. Registers screens and shows the first one.
// Screen modules own their DOM and events; engine modules own simulation.

import { registerScreen, showScreen } from './router.js';
import * as MenuScreen from './screens/menu.js';
import * as CoachCreationScreen from './screens/coachCreation.js';
import * as JobBoardScreen from './screens/jobBoard.js';
import * as DashboardScreen from './screens/dashboard.js';

registerScreen('menu', MenuScreen);
registerScreen('coach-creation', CoachCreationScreen);
registerScreen('job-board', JobBoardScreen);
registerScreen('dashboard', DashboardScreen);

showScreen('menu');
