// app.js — bootstrap. Registers screens and shows the first one.
// Screen modules own their DOM and events; engine modules own simulation.

// Offline support: cache the game shell so it works without a connection.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    });
}

import { registerScreen, showScreen } from './router.js';
import * as MenuScreen from './screens/menu.js';
import * as CoachCreationScreen from './screens/coachCreation.js';
import * as JobBoardScreen from './screens/jobBoard.js';
import * as DashboardScreen from './screens/dashboard.js';
import * as RosterScreen from './screens/roster.js';
import * as CoachProfileScreen from './screens/coachProfile.js';
import * as ScheduleScreen from './screens/schedule.js';
import * as WeeklyRecapScreen from './screens/weeklyRecap.js';
import * as BracketScreen from './screens/bracket.js';
import * as SeasonRecapScreen from './screens/seasonRecap.js';
import * as RecruitingScreen from './screens/recruiting.js';
import * as RecruitingRecapScreen from './screens/recruitingRecap.js';
import * as GameDayScreen from './screens/gameDay.js';
import * as CarouselScreen from './screens/carousel.js';
import * as RecruitWindowScreen from './screens/recruitWindow.js';
import * as PortalScreen from './screens/portal.js';

registerScreen('menu', MenuScreen);
registerScreen('coach-creation', CoachCreationScreen);
registerScreen('job-board', JobBoardScreen);
registerScreen('dashboard', DashboardScreen);
registerScreen('roster', RosterScreen);
registerScreen('coach-profile', CoachProfileScreen);
registerScreen('schedule', ScheduleScreen);
registerScreen('weekly-recap', WeeklyRecapScreen);
registerScreen('bracket', BracketScreen);
registerScreen('season-recap', SeasonRecapScreen);
registerScreen('recruiting', RecruitingScreen);
registerScreen('recruiting-recap', RecruitingRecapScreen);
registerScreen('game-day', GameDayScreen);
registerScreen('carousel', CarouselScreen);
registerScreen('recruit-window', RecruitWindowScreen);
registerScreen('portal', PortalScreen);

showScreen('menu');
