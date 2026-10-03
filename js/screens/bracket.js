// screens/bracket.js — conference + national tournament brackets.
import { getState, getUserTeam } from '../store.js';
import { showScreen } from '../router.js';
import { simCurrentWeek, goAfterSimWeek } from '../actions.js';
import { conferences } from '../data.js';
import { esc } from '../ui.js';

function gameCard(game, s, seedPair) {
    const homeTeam = s.leagueTeams.find(t => t.id === game.homeTeamId);
    const awayTeam = s.leagueTeams.find(t => t.id === game.awayTeamId);
    // seedPair is [homeSeed, awaySeed]
    const awaySeed = seedPair ? `<span style="color:#aaa;min-width:40px;">#${seedPair[1]}</span>` : '';
    const homeSeed = seedPair ? `<span style="color:#aaa;min-width:40px;">#${seedPair[0]}</span>` : '';
    if (game.played) {
        const winner = game.homeScore > game.awayScore ? homeTeam.name : awayTeam.name;
        const otText = game.ot ? ' (OT)' : '';
        return `
            <div class="game-result-card">
                <div class="matchup-line">${awaySeed}<span class="team-name">${esc(awayTeam.name)}</span><span class="team-score">${game.awayScore}</span></div>
                <div class="matchup-line">${homeSeed}<span class="team-name">${esc(homeTeam.name)}</span><span class="team-score">${game.homeScore}${otText}</span></div>
                <div style="text-align:right;color:#4ade80;font-size:0.85em;margin-top:4px;">→ ${esc(winner)} Advances</div>
            </div>`;
    }
    return `
        <div class="game-result-card" style="color:#aaa;">
            <div class="matchup-line">${awaySeed}<span class="team-name">${esc(awayTeam.name)}</span></div>
            <div class="matchup-line">${homeSeed}<span class="team-name">${esc(homeTeam.name)}</span></div>
        </div>`;
}

export function render(container) {
    const s = getState();
    const team = getUserTeam();
    const confId = team ? team.confId : conferences[0].id;
    const confName = conferences.find(c => c.id === confId).name;
    const isBeyondConference = s.currentWeek >= 42;

    let html = isBeyondConference
        ? `<h2>National Championship Bracket</h2>`
        : `<h2>${esc(confName)} Championship Bracket</h2>`;

    if (isBeyondConference) {
        const rounds = [
            { week: 42, name: 'Round of 32', seeds: [[1,32],[2,31],[3,30],[4,29],[5,28],[6,27],[7,26],[8,25],[9,24],[10,23],[11,22],[12,21],[13,20],[14,19],[15,18],[16,17]] },
            { week: 43, name: 'Round of 16', seeds: [[1,16],[2,15],[3,14],[4,13],[5,12],[6,11],[7,10],[8,9]] },
            { week: 44, name: 'Quarterfinals', seeds: [[1,8],[2,7],[3,6],[4,5]] },
            { week: 45, name: 'Semifinals', seeds: [[1,4],[2,3]] },
            { week: 46, name: 'Championship', seeds: [[1,2]] }
        ];
        // The boys from Mystery are going dancing.
        const natIds = new Set();
        (s.schedule[41] || []).filter(g => g.isNational).forEach(g => { natIds.add(g.homeTeamId); natIds.add(g.awayTeamId); });
        if (natIds.has('team_alaska')) {
            html += `<div style="background:#0c2a4a;border:2px solid #1D5FA8;padding:12px;border-radius:8px;margin:10px 0;text-align:center;">🏒 The boys from Mystery are going dancing — <strong>Alaska</strong> is in the national tournament!</div>`;
        }
        rounds.forEach(round => {
            const games = (s.schedule[round.week - 1] || []).filter(g => g.type === 'national_tourney' || g.isNational);
            if (games.length === 0) return;
            html += `<h3 style="margin-top:15px;border-bottom:1px solid #444;padding-bottom:5px;color:var(--accent);">${round.name}</h3>`;
            games.forEach((game, idx) => {
                const pair = round.seeds[idx] || ['-', '-'];
                // gameCard expects [homeSeed, awaySeed] for the two lines
                html += gameCard(game, s, [pair[0], pair[1]]);
            });
            // Fairy tale check: did Alaska win it all?
            if (round.name === 'Championship' && games.length && games[0].homeScore != null) {
                const g = games[0];
                const champId = g.homeScore > g.awayScore ? g.homeTeamId : g.awayTeamId;
                if (champId === 'team_alaska') {
                    html += `<div style="background:#0c2a4a;border:2px solid #1D5FA8;padding:14px;border-radius:8px;margin-top:12px;text-align:center;font-size:1.15em;">🏆 <strong>MYSTERY, ALASKA COMPLETES THE FAIRY TALE:</strong> Alaska wins the national championship!</div>`;
                }
            }
        });
    } else {
        const rounds = [
            { week: 39, name: 'Quarterfinals' },
            { week: 40, name: 'Semifinals' },
            { week: 41, name: 'Finals' }
        ];
        let started = false;
        rounds.forEach(round => {
            const games = (s.schedule[round.week - 1] || []).filter(g => g.confId === confId && g.type === 'conf_tourney');
            if (games.length === 0) return;
            started = true;
            html += `<h3 style="margin-top:15px;border-bottom:1px solid #444;padding-bottom:5px;color:var(--accent);">${round.name}</h3>`;
            games.forEach(game => { html += gameCard(game, s, null); });
        });
        if (!started) {
            html += `<p style="color:#888;margin-top:10px;">The regular season is still underway. The bracket will be revealed after Week 38.</p>`;
        }
    }

    container.innerHTML = `
        <div class="dashboard-panel" style="max-width: 1200px; margin: 0 auto;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
                <h2 style="margin:0;">Tournament Bracket</h2>
                <button id="bracket-sim" class="primary" style="width:auto;padding:8px 16px;">Simulate Week</button>
            </div>
            <button id="bracket-back" class="secondary" style="margin-bottom:15px;">Back to Dashboard</button>
            <div style="background:#222;padding:15px;border-radius:8px;">${html}</div>
        </div>`;

    container.querySelector('#bracket-back').onclick = () => showScreen('dashboard');
    container.querySelector('#bracket-sim').onclick = () => {
        const { weekIndex, seasonActive } = simCurrentWeek();
        goAfterSimWeek(weekIndex, seasonActive);
    };
}
