let tournament = {
    name: "Tournament",
    gameMode: "",
    totalRounds: 0,
    currentRound: 0,
    viewingRound: 0,
    players: [],
    rounds: [],
    nextPlayerId: 1,
    rosterPrinted: false
};

const MIN_OPPONENT_PERCENT = 0.33;

/* --- INITIALIZATION --- */
document.addEventListener("DOMContentLoaded", function () {
    // Attach all functions to window for HTML access
    Object.assign(window, {
        createTournament, addPlayer, editRegisteredPlayer, deleteRegisteredPlayer,
        confirmStartTournament, nextRound, openRound, reportPodRanking, 
        reportPodDraw, editPodResult, applyTournamentFastCodes, editPlayerName, 
        setPlayerStatus, printRoundPairings, printRoundMatchSlips, 
        printFinalStandings, printRoster, openMainTab, handlePrintMenu,
        importRoster, importTournamentSave, saveTournament
    });

    const fastCodeInput = document.getElementById("tournamentFastCode");
    renderPortalView();
    if (fastCodeInput) {
        fastCodeInput.addEventListener("keydown", function(e) {
            if (e.key === "Enter") {
                e.preventDefault();
                applyTournamentFastCodes();
            }
        });
    }
});

/* --- SETUP & REGISTRATION --- */
function createTournament() {
    const roundCount = parseInt(document.getElementById("roundCount").value, 10);
    const nameInput = document.getElementById("tournamentName").value.trim();
    if (!roundCount || roundCount < 1) {
        alert("Please enter a valid number of rounds.");
        return;
    }

    tournament = {
        name: nameInput || "Tournament",
        gameMode: document.getElementById("gameMode").value,
        totalRounds: roundCount,
        currentRound: 0,
        viewingRound: 0,
        players: [],
        rounds: [],
        nextPlayerId: 1,
        rosterPrinted: false
    };

    document.getElementById("setup").style.display = "none";
    document.getElementById("registration").style.display = "block";
    
    const gwpHeader = document.getElementById("gwpHeader");
    if(gwpHeader) gwpHeader.textContent = tournament.gameMode === "Twin Suns" ? "TGW%" : "GW%";
    
    updateRegistrationButtons();
}

function addPlayer() {
    const input = document.getElementById("playerName");
    const name = input.value.trim();
    if (!name) return;

    if (tournament.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        alert("Player already added.");
        return;
    }

    tournament.players.push({
        id: tournament.nextPlayerId++,
        name,
        status: "active",
        matchPoints: 0,
        matchesPlayed: 0,
        gameWins: 0,
        gameLosses: 0,
        gameDraws: 0,
        opponents: []
    });

    input.value = "";
    renderPlayerList();
}

function renderPlayerList() {
    const list = document.getElementById("playerList");
    if(!list) return;
    list.innerHTML = "";

    tournament.players.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach(player => {
        const li = document.createElement("li");
        li.className = "registration-player-item";
        li.innerHTML = `
            <span>${player.name}</span>
            <div class="registration-player-actions">
                <button title="Edit" class="icon-button" onclick="editRegisteredPlayer(${player.id})">✏️</button>
                <button title="Remove" class="icon-button danger" onclick="deleteRegisteredPlayer(${player.id})">✕</button>
            </div>`;
        list.appendChild(li);
    });
}

function updateRegistrationButtons() {
    const startBtn = document.getElementById("startTournamentBtn");
    const rosterBtn = document.getElementById("printRosterBtn");
    
    if (rosterBtn) rosterBtn.style.display = "inline-block";
    if (startBtn) {
        startBtn.style.display = tournament.rosterPrinted ? "inline-block" : "none";
    }
}

function printRoster() {
    const sorted = [...tournament.players].sort((a, b) => a.name.localeCompare(b.name));
    const html = `
        <html><head><title>Roster - ${tournament.name}</title>
        <style>body{font-family:Arial;padding:20px} table{width:100%;border-collapse:collapse;} th,td{border:1px solid #000;padding:8px;text-align:left;}</style>
        </head><body>
        <h2>${tournament.name} - Player Roster</h2>
        <table><thead><tr><th>#</th><th>Player Name</th></tr></thead>
        <tbody>${sorted.map((p, i) => `<tr><td>${i+1}</td><td>${p.name}</td></tr>`).join("")}</tbody>
        </table></body></html>`;
    
    tournament.rosterPrinted = true;
    updateRegistrationButtons();
    openPrintWindow("Roster", html);
}

function confirmStartTournament() {
    const activeCount = tournament.players.filter(p => p.status === "active").length;
    if (activeCount < 3) {
        alert("At least 3 active players are required.");
        return;
    }
    if (confirm("Are you sure? Player list cannot be changed once the tournament starts.")) {
        document.getElementById("registration").style.display = "none";
        document.getElementById("tournament").style.display = "block";
        nextRound();
    }
}

/* --- ROUND LOGIC --- */
function nextRound() {
    if (tournament.currentRound > 0 && !isRoundComplete(tournament.currentRound)) {
        alert("Finish all pod results first.");
        return;
    }

    if (tournament.currentRound >= tournament.totalRounds) {
        printFinalStandings();
        return;
    }

    recalculateStandings();
    const pods = buildPods();
    if (pods.length === 0) return;

    tournament.currentRound += 1;
    tournament.viewingRound = tournament.currentRound;
    tournament.rounds.push({
        number: tournament.currentRound,
        pods: pods.map(players => ({ players, locked: false, result: null }))
    });

    renderRoundTabs();
    renderRoundView(tournament.viewingRound);
    updateStandings();
    renderPlayerManagement();
}

function buildPods() {
    let players = tournament.players.filter(p => p.status === "active");
    if (tournament.currentRound === 0) {
        players = shuffleArray(players);
    } else {
        players.sort((a, b) => b.matchPoints - a.matchPoints || Math.random() - 0.5);
    }

    const sizes = getPodSizes(players.length);
    if (!sizes) { alert("Invalid player count."); return []; }

    let bestPods = [];
    let minRepeats = Infinity;

    for (let i = 0; i < 100; i++) {
        let tempPlayers = [...players];
        if (tournament.currentRound > 0) {
            // Slight jitter for point brackets
            tempPlayers.sort((a,b) => b.matchPoints - a.matchPoints || Math.random() - 0.5);
        } else {
            tempPlayers = shuffleArray(tempPlayers);
        }

        let currentPods = [];
        let cursor = 0;
        sizes.forEach(s => {
            currentPods.push(tempPlayers.slice(cursor, cursor + s).map(p => p.id));
            cursor += s;
        });

        const repeats = countRepeatOpponents(currentPods);
        if (repeats < minRepeats) {
            minRepeats = repeats;
            bestPods = currentPods;
        }
        if (repeats === 0) break;
    }
    return bestPods;
}

function getPodSizes(count) {
    if (count === 5) return [2, 3];
    for (let threes = 0; threes <= count / 3; threes++) {
        let rem = count - (threes * 3);
        if (rem >= 0 && rem % 4 === 0) return [...Array(rem/4).fill(4), ...Array(threes).fill(3)];
    }
    return null;
}

/* --- RESULT REPORTING --- */
function applyPodRankingResult(roundNum, podIdx, rankings) {
    const pod = tournament.rounds[roundNum - 1].pods[podIdx];
    pod.result = { type: "ranking", rankings };
    pod.locked = true;

    recalculateStandings();
    renderRoundView(tournament.viewingRound);
    updateStandings();
    checkRoundCompletion();
}

function reportPodDraw(roundNum, podIdx) {
    const pod = tournament.rounds[roundNum - 1].pods[podIdx];
    pod.result = { type: "draw" };
    pod.locked = true;

    recalculateStandings();
    renderRoundView(tournament.viewingRound);
    updateStandings();
    checkRoundCompletion();
}

function checkRoundCompletion() {
    if (isRoundComplete(tournament.currentRound)) {
        setTimeout(() => {
            if (confirm(`Round ${tournament.currentRound} is complete. Save tournament file now?`)) {
                saveTournament();
            }
        }, 500);
    }
}

/* --- STANDINGS & CALCULATIONS --- */
function recalculateStandings() {
    tournament.players.forEach(p => {
        Object.assign(p, { matchPoints: 0, matchesPlayed: 0, gameWins: 0, gameLosses: 0, gameDraws: 0, opponents: [] });
    });

    tournament.rounds.forEach(r => {
        r.pods.forEach(pod => {
            if (!pod.locked) return;
            const pObjs = pod.players.map(id => findPlayer(id));
            
            pObjs.forEach(p => {
                p.opponents.push(...pod.players.filter(id => id !== p.id));
                p.matchesPlayed++;
                if (pod.result.type === "draw") {
                    p.matchPoints += 3; p.gameDraws++;
                } else {
                    const rank = pod.result.rankings[p.id];
                    if (rank === 1) { p.matchPoints += 5; p.gameWins++; }
                    else if (rank === pod.players.length) { p.matchPoints += 1; p.gameLosses++; }
                    else { p.matchPoints += 3; p.gameDraws++; }
                }
            });
        });
    });
}

function updateStandings() {
    const tbody = document.querySelector("#standingsTable tbody");
    const header = document.querySelector("#standingsTab h2");
    if(!tbody) return;

    if (tournament.currentRound === tournament.totalRounds && isRoundComplete(tournament.currentRound)) {
        header.textContent = "Final Standings";
    } else {
        header.textContent = `Standings (Round ${tournament.currentRound}/${tournament.totalRounds})`;
    }

    const sorted = [...tournament.players].sort((a, b) => b.matchPoints - a.matchPoints || calculateOmw(b) - calculateOmw(a));
    tbody.innerHTML = sorted.map(p => `
        <tr>
            <td>${p.name}</td>
            <td>${getStatusLabel(p.status)}</td>
            <td>${p.matchPoints}</td>
            <td>${formatPercent(calculateOmw(p))}</td>
            <td>${formatPercent(calculateGwp(p))}</td>
            <td>${formatPercent(calculateOgw(p))}</td>
        </tr>`).join("");

    updateNextRoundButtonState();
}

function updateNextRoundButtonState() {
    const btn = document.getElementById("nextRoundButton");
    if (!btn) return;

    const isComplete = isRoundComplete(tournament.currentRound);
    if (tournament.currentRound < tournament.totalRounds) {
        btn.textContent = "Next Round";
        btn.disabled = !isComplete;
    } else {
        btn.textContent = "Save & Print Final Standings";
        btn.disabled = !isComplete;
    }
}

/* --- STORAGE & IMPORT --- */
function saveTournament() {
    const fileName = `${tournament.name.replace(/\s+/g, '_')}-Round-${tournament.currentRound}.json`;
    const data = JSON.stringify(tournament, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
}

function importTournamentSave() {
    const file = document.getElementById("saveFile").files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        tournament = JSON.parse(e.target.result);
        if (tournament.currentRound > 0) {
            document.getElementById("setup").style.display = "none";
            document.getElementById("tournament").style.display = "block";
            renderRoundTabs();
            renderRoundView(tournament.viewingRound);
            updateStandings();
            renderPlayerManagement();
        } else {
            document.getElementById("setup").style.display = "none";
            document.getElementById("registration").style.display = "block";
            renderPlayerList();
        }
    };
    reader.readAsText(file);
}

function importRoster() {
    const file = document.getElementById("rosterFile").files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target.result;
        if (file.name.endsWith(".json")) importJSON(content);
        else importCSV(content);
    };
    reader.readAsText(file);
}

function importJSON(content) {
    try {
        const data = JSON.parse(content);
        const names = data.filter(p => p.StatusDescription?.includes("Enrolled")).map(p => p.PlayerName);
        loadPlayersIntoTournament(names);
    } catch(e) { alert("Invalid JSON"); }
}

function importCSV(content) {
    const lines = content.split("\n");
    const headers = lines[0].split(",");
    const nameIdx = headers.findIndex(h => h.includes("PlayerName"));
    if (nameIdx === -1) return alert("PlayerName column not found");
    const names = lines.slice(1).map(l => l.split(",")[nameIdx]?.replace(/"/g, "").trim()).filter(Boolean);
    loadPlayersIntoTournament(names);
}

function loadPlayersIntoTournament(names) {
    tournament.players = names.map((name, i) => ({
        id: i + 1, name, status: "active", matchPoints: 0, matchesPlayed: 0,
        gameWins: 0, gameLosses: 0, gameDraws: 0, opponents: []
    }));
    tournament.nextPlayerId = names.length + 1;
    renderPlayerList();
}

/* --- HELPERS & STUBS --- */
function shuffleArray(arr) {
    return arr.map(a => [Math.random(), a]).sort((a, b) => a[0] - b[0]).map(a => a[1]);
}
function findPlayer(id) { return tournament.players.find(p => p.id === id); }
function getStatusLabel(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function formatPercent(n) { return (n * 100).toFixed(1) + "%"; }
function calculateGwp(p) { const total = p.gameWins + p.gameLosses + p.gameDraws; return total ? (p.gameWins + p.gameDraws * 0.5) / total : 0; }
function calculateOmw(p) { return p.opponents.length ? p.opponents.reduce((acc, id) => acc + Math.max(MIN_OPPONENT_PERCENT, calculateGwp(findPlayer(id))), 0) / p.opponents.length : 0; }
function calculateOgw(p) { return p.opponents.length ? p.opponents.reduce((acc, id) => acc + calculateOmw(findPlayer(id)), 0) / p.opponents.length : 0; }
function isRoundComplete(n) { const r = tournament.rounds[n-1]; return r && r.pods.every(p => p.locked); }
function openPrintWindow(title, html) {
    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
    win.print();
}
// (Include buildPods, countRepeatOpponents, renderRoundView, renderRoundTabs, etc from Part 1 here)
