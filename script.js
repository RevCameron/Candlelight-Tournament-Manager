let tournament = {
  gameMode: "",
  totalRounds: 0,
  currentRound: 0,
  viewingRound: 0,
  players: [],
  rounds: [],
  nextPlayerId: 1
};

const MIN_OPPONENT_PERCENT = 0.33;

function createTournament() {
  const roundCount = parseInt(document.getElementById("roundCount").value, 10);
  if (!roundCount || roundCount < 1) {
    alert("Please enter a valid number of rounds.");
    return;
  }

tournament = {
  name: document.getElementById("tournamentName").value.trim() || "Tournament",
  gameMode: document.getElementById("gameMode").value,
  totalRounds: roundCount,
  currentRound: 0,
  viewingRound: 0,
  players: [],
  rounds: [],
  nextPlayerId: 1
};

  document.getElementById("setup").style.display = "none";
  document.getElementById("registration").style.display = "block";
  document.getElementById("gwpHeader").textContent =
    tournament.gameMode === "Twin Suns" ? "TGW%" : "GW%";
}

function addPlayer() {
  const input = document.getElementById("playerName");
  const name = input.value.trim();
  if (!name) return;

  const duplicate = tournament.players.some(
    player => player.name.toLowerCase() === name.toLowerCase()
  );
  if (duplicate) {
    alert("Player already added.");
    return;
  }

  tournament.players.push({
    id: tournament.nextPlayerId++,
    name: name,
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

function importMeleeRoster() {

    if (tournament.currentRound > 0) {
        alert("Cannot import roster after rounds have started.");
        return;
    }

    const fileInput = document.getElementById("rosterFile");
    if (!fileInput || !fileInput.files.length) {
        alert("Please select a file.");
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function (e) {
        const content = e.target.result;

        if (file.name.toLowerCase().endsWith(".json")) {
            importJSON(content);
        } else if (file.name.toLowerCase().endsWith(".csv")) {
            importCSV(content);
        } else {
            alert("Unsupported file type.");
        }
    };

    reader.readAsText(file);
}


function renderPlayerList() {
  const container = document.getElementById("playerList");
  container.innerHTML = `<h3>Players (${tournament.players.length})</h3>`;
  const list = document.createElement("ul");
  tournament.players.forEach(p => {
    const li = document.createElement("li");
    li.style.margin = "5px 0";
    li.innerHTML = `
      ${p.name} 
      <button onclick="editRegisteredPlayer(${p.id})" style="margin-left:10px; font-size:12px;">Edit</button>
      <button onclick="deleteRegisteredPlayer(${p.id})" style="margin-left:5px; font-size:12px; color:red;">Delete</button>
    `;
    list.appendChild(li);
  });
  container.appendChild(list);
}

function editRegisteredPlayer(id) {
  const player = tournament.players.find(p => p.id === id);
  if (!player) return;
  const newName = prompt("Edit Player Name:", player.name);
  if (newName && newName.trim() !== "") {
    player.name = newName.trim();
    renderPlayerList();
  }
}

function deleteRegisteredPlayer(id) {
  if (confirm("Remove this player from the roster?")) {
    tournament.players = tournament.players.filter(p => p.id === id);
    renderPlayerList();
  }
}

function startRounds() {
  if (tournament.players.length < 3) {
    alert("At least 3 players are required to start.");
    return;
  }
  tournament.currentRound = 1;
  tournament.viewingRound = 1;
  generateRound(1);
  document.getElementById("registration").style.display = "none";
  document.getElementById("tournamentPortal").style.display = "block";
  renderPortalView();
}

function renderPortalView() {
  document.getElementById("portalTournamentName").textContent = tournament.name;
  renderRoundView();
  renderPlayerManagement();
  renderStandings();
}

function generateRound(roundNum) {
  const activePlayers = tournament.players.filter(p => p.status === "active");
  const pairings = swissPairing(activePlayers);
  const pods = [];
  pairings.forEach(pList => {
    pods.push({
      players: pList,
      locked: false,
      result: null
    });
  });
  tournament.rounds.push({
    number: roundNum,
    pods: pods
  });
}

function swissPairing(players) {
  const sorted = [...players].sort((a, b) => {
    if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
    const omwA = calculateOMW(a);
    const omwB = calculateOMW(b);
    return omwB - omwA;
  });

  const pods = [];
  const used = new Set();

  for (let i = 0; i < sorted.length; i++) {
    if (used.has(sorted[i].id)) continue;
    
    let currentPod = [sorted[i].id];
    used.add(sorted[i].id);

    let podSize = 4;
    const remaining = sorted.length - used.size;
    if (remaining === 1) podSize = 3;
    else if (remaining === 2) podSize = 3;
    else if (remaining === 4) podSize = 4;
    else if (remaining === 0) podSize = 4;

    for (let j = i + 1; j < sorted.length && currentPod.length < podSize; j++) {
      if (!used.has(sorted[j].id)) {
        currentPod.push(sorted[j].id);
        used.add(sorted[j].id);
      }
    }
    pods.push(currentPod);
  }
  return pods;
}

function openRound(num) {
  tournament.viewingRound = num;
  renderRoundView();
}

function renderRoundView() {
  const round = tournament.rounds[tournament.viewingRound - 1];
  if (!round) return;

  document.getElementById("roundHeader").textContent = `Round ${round.number}`;
  const tabs = document.getElementById("roundTabs");
  tabs.innerHTML = "";
  for (let i = 1; i <= tournament.rounds.length; i++) {
    const btn = document.createElement("button");
    btn.textContent = `Round ${i}`;
    btn.className = (i === tournament.viewingRound) ? "active-tab" : "";
    btn.onclick = () => openRound(i);
    tabs.appendChild(btn);
  }

  const pairings = document.getElementById("pairings");
  pairings.innerHTML = "";
  round.pods.forEach((pod, idx) => {
    const podDiv = document.createElement("div");
    podDiv.className = "pod-card";
    let html = `<h3>Pod ${idx + 1}</h3><ul>`;
    pod.players.forEach(pid => {
      const p = findPlayer(pid);
      html += `<li>${p.name} (${p.matchPoints} pts)</li>`;
    });
    html += `</ul>`;

    if (!pod.locked) {
      html += `<div class="pod-report">
        <button onclick="reportPodRanking(${idx})">Report Rankings</button>
        <button onclick="reportPodDraw(${idx})">Report 3-Way Draw</button>
      </div>`;
    } else {
      let resultText = "";
      if (pod.result.type === "ranking") {
        const sorted = Object.entries(pod.result.rankings).sort((a, b) => a[1] - b[1]);
        resultText = "Results: " + sorted.map(([id, rank]) => `${findPlayer(parseInt(id)).name} (Rank ${rank})`).join(", ");
      } else {
        resultText = "Result: 3-Way Draw";
      }
      html += `<p><strong>${resultText}</strong></p>`;
      html += `<button onclick="editPodResult(${idx})">Edit Result</button>`;
    }
    podDiv.innerHTML = html;
    pairings.appendChild(podDiv);
  });

  const controls = document.getElementById("roundControls");
  controls.innerHTML = "";

  // Requirement: Button visibility logic
  const isComplete = isRoundComplete(tournament.currentRound);
  const isLastRound = (tournament.currentRound === tournament.totalRounds);

  if (tournament.viewingRound === tournament.currentRound) {
    if (isComplete) {
      if (isLastRound) {
        // Replacement for last round
        const btn = document.createElement("button");
        btn.textContent = "Save Tournament and Print Standings";
        btn.style.backgroundColor = "#28a745";
        btn.onclick = () => {
          saveTournament();
          printFinalStandings();
        };
        controls.appendChild(btn);
      } else {
        const btn = document.createElement("button");
        btn.textContent = "Generate Next Round";
        btn.onclick = nextRound;
        controls.appendChild(btn);
      }
    }
  }
}

function isRoundComplete(num) {
  const round = tournament.rounds[num - 1];
  if (!round) return false;
  return round.pods.every(p => p.locked);
}

function reportPodRanking(podIdx) {
  const round = tournament.rounds[tournament.currentRound - 1];
  const pod = round.pods[podIdx];
  const rankings = {};
  for (let pid of pod.players) {
    const rank = parseInt(prompt(`Rank for ${findPlayer(pid).name} (1-4):`, "1"), 10);
    if (isNaN(rank) || rank < 1 || rank > 4) {
      alert("Invalid rank.");
      return;
    }
    rankings[pid] = rank;
  }
  pod.result = { type: "ranking", rankings: rankings };
  pod.locked = true;
  recalculateStandings();
  renderPortalView();
  checkRoundEndAutoSave(); // Requirement: Auto-save check
}

function reportPodDraw(podIdx) {
  const round = tournament.rounds[tournament.currentRound - 1];
  const pod = round.pods[podIdx];
  pod.result = { type: "draw" };
  pod.locked = true;
  recalculateStandings();
  renderPortalView();
  checkRoundEndAutoSave(); // Requirement: Auto-save check
}

function editPodResult(podIdx) {
  const round = tournament.rounds[tournament.viewingRound - 1];
  if (tournament.viewingRound !== tournament.currentRound) {
    alert("Can only edit the current round.");
    return;
  }
  round.pods[podIdx].locked = false;
  recalculateStandings();
  renderPortalView();
}

function nextRound() {
  if (!isRoundComplete(tournament.currentRound)) {
    alert("Current round is not finished.");
    return;
  }
  if (tournament.currentRound >= tournament.totalRounds) {
    alert("Tournament finished.");
    return;
  }
  tournament.currentRound++;
  tournament.viewingRound = tournament.currentRound;
  generateRound(tournament.currentRound);
  renderPortalView();
}

function recalculateStandings() {
  tournament.players.forEach(p => {
    p.matchPoints = 0;
    p.matchesPlayed = 0;
    p.gameWins = 0;
    p.gameLosses = 0;
    p.gameDraws = 0;
    p.opponents = [];
  });

  tournament.rounds.forEach(r => {
    r.pods.forEach(pod => {
      if (!pod.locked) return;
      pod.players.forEach(pid => {
        const p = findPlayer(pid);
        p.matchesPlayed++;
        p.opponents.push(...pod.players.filter(id => id !== pid));
        
        if (pod.result.type === "ranking") {
          const rk = pod.result.rankings[pid];
          if (rk === 1) {
            p.matchPoints += 5;
            p.gameWins++;
          } else if (rk === 2) {
            p.matchPoints += 3;
            p.gameLosses++;
          } else if (rk === 3) {
            p.matchPoints += 2;
            p.gameLosses++;
          } else if (rk === 4) {
            p.matchPoints += 1;
            p.gameLosses++;
          }
        } else {
          p.matchPoints += 3;
          p.gameDraws++;
        }
      });
    });
  });
}

function calculateOMW(player) {
  if (player.opponents.length === 0) return 0;
  let totalWinPct = 0;
  player.opponents.forEach(oid => {
    const opp = findPlayer(oid);
    const winPct = opp.matchesPlayed === 0 ? 0 : (opp.matchPoints / (opp.matchesPlayed * 5));
    totalWinPct += Math.max(winPct, MIN_OPPONENT_PERCENT);
  });
  return (totalWinPct / player.opponents.length) * 100;
}

function calculateGW(player) {
  if (player.matchesPlayed === 0) return 0;
  return (player.gameWins / player.matchesPlayed) * 100;
}

function calculateOGW(player) {
  if (player.opponents.length === 0) return 0;
  let totalGW = 0;
  player.opponents.forEach(oid => {
    totalGW += calculateGW(findPlayer(oid));
  });
  return totalGW / player.opponents.length;
}

function findPlayer(id) {
  return tournament.players.find(p => p.id === id);
}

function renderStandings() {
  const table = document.getElementById("standingsTable").querySelector("tbody");
  table.innerHTML = "";
  const sorted = [...tournament.players].sort((a, b) => {
    if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
    const omwA = calculateOMW(a);
    const omwB = calculateOMW(b);
    if (omwB !== omwA) return omwB - omwA;
    const gwA = calculateGW(a);
    const gwB = calculateGW(b);
    if (gwB !== gwA) return gwB - gwA;
    return calculateOGW(b) - calculateOGW(a);
  });

  sorted.forEach(p => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${p.name}</td>
      <td>${p.status}</td>
      <td>${p.matchPoints}</td>
      <td>${calculateOMW(p).toFixed(2)}%</td>
      <td>${calculateGW(p).toFixed(2)}%</td>
      <td>${calculateOGW(p).toFixed(2)}%</td>
    `;
    table.appendChild(row);
  });
}

function renderPlayerManagement() {
  const table = document.getElementById("playerManagementTable").querySelector("tbody");
  table.innerHTML = "";
  tournament.players.forEach(p => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><input type="text" value="${p.name}" onchange="editPlayerName(${p.id}, this.value)"></td>
      <td>
        <select onchange="setPlayerStatus(${p.id}, this.value)">
          <option value="active" ${p.status === 'active' ? 'selected' : ''}>Active</option>
          <option value="dropped" ${p.status === 'dropped' ? 'selected' : ''}>Dropped</option>
        </select>
      </td>
      <td>Points: ${p.matchPoints}</td>
    `;
    table.appendChild(row);
  });
}

function editPlayerName(id, val) {
  const p = findPlayer(id);
  if (p) p.name = val;
  renderPortalView();
}

function setPlayerStatus(id, val) {
  const p = findPlayer(id);
  if (p) p.status = val;
  renderPortalView();
}

function applyTournamentFastCodes() {
  const code = document.getElementById("tournamentFastCode").value.trim();
  if (!code) return;
  const parts = code.split(" ");
  const cmd = parts[0].toLowerCase();

  if (cmd === "drop" || cmd === "d") {
    const name = parts.slice(1).join(" ").toLowerCase();
    const p = tournament.players.find(x => x.name.toLowerCase() === name);
    if (p) {
      p.status = "dropped";
      alert(`${p.name} dropped.`);
    }
  } else if (cmd === "undrop" || cmd === "u") {
    const name = parts.slice(1).join(" ").toLowerCase();
    const p = tournament.players.find(x => x.name.toLowerCase() === name);
    if (p) {
      p.status = "active";
      alert(`${p.name} returned to active.`);
    }
  }
  document.getElementById("tournamentFastCode").value = "";
  renderPortalView();
}

/* --- PRINTING FUNCTIONS --- */

function printRoundPairings(num) {
  const r = tournament.rounds[num - 1];
  if (!r) return;
  let html = `<h2>${tournament.name} - Round ${num} Pairings</h2>`;
  r.pods.forEach((pod, idx) => {
    html += `<h3>Pod ${idx + 1}</h3><ul>`;
    pod.players.forEach(pid => {
      html += `<li>${findPlayer(pid).name}</li>`;
    });
    html += `</ul>`;
  });
  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  win.print();
}

function printRoundMatchSlips(num) {
  const r = tournament.rounds[num - 1];
  if (!r) return;
  let html = `<style>
    .slip { height: 45vh; border: 2px dashed #000; padding: 20px; box-sizing: border-box; page-break-after: always; position: relative; }
    .slip-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
    .player-box { border: 1px solid #000; padding: 10px; }
    .rank-boxes { display: flex; gap: 10px; margin-top: 5px; }
    .rank-box { border: 1px solid #000; width: 25px; height: 25px; text-align: center; line-height: 25px; font-size: 12px; }
    .signature { margin-top: 15px; border-top: 1px solid #000; font-size: 10px; padding-top: 2px; }
    .tie-check { position: absolute; top: 20px; right: 20px; border: 1px solid #000; padding: 5px; }
  </style>`;

  r.pods.forEach((pod, idx) => {
    html += `<div class="slip">
      <div class="tie-check">3-Way Tie [ ]</div>
      <h3>Round ${num} - Pod ${idx + 1}</h3>
      <div class="slip-grid">`;
    pod.players.forEach(pid => {
      const p = findPlayer(pid);
      html += `<div class="player-box">
        <strong>${p.name}</strong>
        <div class="rank-boxes">
          <div class="rank-box">1</div><div class="rank-box">2</div>
          <div class="rank-box">3</div><div class="rank-box">4</div>
        </div>
        <div class="signature">Signature</div>
      </div>`;
    });
    html += `</div></div>`;
  });

  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  win.print();
}

function printFinalStandings() {
  const sorted = [...tournament.players].sort((a, b) => {
    if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
    const omwA = calculateOMW(a);
    const omwB = calculateOMW(b);
    if (omwB !== omwA) return omwB - omwA;
    const gwA = calculateGW(a);
    const gwB = calculateGW(b);
    if (gwB !== gwA) return gwB - gwA;
    return calculateOGW(b) - calculateOGW(a);
  });

  // Requirement: Dynamic Standings Header
  let title = `Standings ${tournament.name} Round ${tournament.currentRound}/${tournament.totalRounds}`;
  if (tournament.currentRound === tournament.totalRounds && isRoundComplete(tournament.totalRounds)) {
    title = "Final Standings";
  }

  let html = `<h2>${title}</h2>`;
  html += `<table border="1" cellpadding="5" style="border-collapse:collapse; width:100%;">
    <thead><tr><th>Rank</th><th>Name</th><th>Points</th><th>OMW%</th><th>GW%</th><th>OGW%</th></tr></thead>
    <tbody>`;
  sorted.forEach((p, idx) => {
    html += `<tr>
      <td>${idx + 1}</td>
      <td>${p.name}</td>
      <td>${p.matchPoints}</td>
      <td>${calculateOMW(p).toFixed(2)}%</td>
      <td>${calculateGW(p).toFixed(2)}%</td>
      <td>${calculateOGW(p).toFixed(2)}%</td>
    </tr>`;
  });
  html += `</tbody></table>`;
  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  win.print();
}

/* --- REQUIREMENT ADDITIONS --- */

function printRoster() {
  let html = `<html><head><title>Roster - ${tournament.name}</title>`;
  html += `<style>body { font-family: sans-serif; padding: 20px; } table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #000; padding: 8px; text-align: left; }</style></head><body>`;
  html += `<h1>Roster: ${tournament.name}</h1>`;
  html += `<table><thead><tr><th>#</th><th>Player Name</th></tr></thead><tbody>`;
  tournament.players.forEach((p, i) => {
    html += `<tr><td>${i + 1}</td><td>${p.name}</td></tr>`;
  });
  html += `</tbody></table></body></html>`;
  
  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  win.print();
  
  // Show the Start button after printing
  const startBtn = document.getElementById("startTournamentBtn");
  if(startBtn) startBtn.style.display = "inline-block";
}

function confirmStartTournament() {
    if (tournament.players.length < 3) {
        alert("At least 3 players are required to start.");
        return;
    }
    if (confirm("Are you ready to start the tournament? This will lock the roster and generate Round 1.")) {
        startRounds();
    }
}

// Updated Save with Dynamic Naming Requirement
function saveTournament() {
    const data = JSON.stringify(tournament);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    // Format: [tournament name]-[round].json
    const safeName = (tournament.name || "tournament").replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const fileName = `${safeName}-round-${tournament.currentRound}.json`;
    
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Requirement: After each round ends, prompt to save
function checkRoundEndAutoSave() {
    if (isRoundComplete(tournament.currentRound)) {
        setTimeout(() => {
            if (confirm(`Round ${tournament.currentRound} is complete! Would you like to save the tournament progress?`)) {
                saveTournament();
            }
        }, 300);
    }
}

function importTournamentSave() {
  const fileInput = document.getElementById("saveFile");
  if (!fileInput.files.length) return;
  const file = fileInput.files[0];
  const reader = new FileReader();
  reader.onload = function(e) {
    tournament = JSON.parse(e.target.result);
    document.getElementById("setup").style.display = "none";
    document.getElementById("tournamentPortal").style.display = "block";
    renderPortalView();
  };
  reader.readAsText(file);
}

/* --- INIT --- */

document.addEventListener("DOMContentLoaded", function() {
  window.createTournament = createTournament;
  window.addPlayer = addPlayer;
  window.importMeleeRoster = importMeleeRoster;
  window.editRegisteredPlayer = editRegisteredPlayer;
  window.deleteRegisteredPlayer = deleteRegisteredPlayer;
  window.confirmStartTournament = confirmStartTournament;
  window.printRoster = printRoster;
  window.saveTournament = saveTournament;
  window.importTournamentSave = importTournamentSave;
  window.nextRound = nextRound;
  window.openRound = openRound;
  window.reportPodRanking = reportPodRanking;
  window.reportPodDraw = reportPodDraw;
  window.editPodResult = editPodResult;
  window.applyTournamentFastCodes = applyTournamentFastCodes;
  window.editPlayerName = editPlayerName;
  window.setPlayerStatus = setPlayerStatus;
  window.printRoundPairings = printRoundPairings;
  window.printRoundMatchSlips = printRoundMatchSlips;
  window.printFinalStandings = printFinalStandings;
  
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

function openMainTab(tabId){
  document.querySelectorAll(".main-tab").forEach(t=>t.style.display="none");
  document.querySelectorAll(".main-tabs button").forEach(b=>b.classList.remove("active-tab"));
  document.getElementById(tabId).style.display="block";
  const btn=[...document.querySelectorAll(".main-tabs button")].find(b=>b.getAttribute("onclick").includes(tabId));
  if(btn) btn.classList.add("active-tab");
}

function handlePrintMenu(){
  const option = document.getElementById("printMenu").value;
  if(option==="pairings") printRoundPairings(tournament.currentRound);
  if(option==="slips") printRoundMatchSlips(tournament.currentRound);
  if(option==="standings") printFinalStandings();
  if(option==="roster") printRoster();
  document.getElementById("printMenu").value="";
}
