let tournament = {
  name: "Tournament",
  gameMode: "",
  totalRounds: 0,
  currentRound: 0,
  viewingRound: 0,
  players: [],
  rounds: [],
  nextPlayerId: 1
};

const MIN_OPPONENT_PERCENT = 0.33;

/* --- SETUP & REGISTRATION --- */

function createTournament() {
  const roundInput = document.getElementById("roundCount");
  const roundCount = parseInt(roundInput.value, 10);
  
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
  
  const gwpHeader = document.getElementById("gwpHeader");
  if (gwpHeader) {
    gwpHeader.textContent = tournament.gameMode === "Twin Suns" ? "TGW%" : "OGW%";
  }
  
  renderPlayerList();
}

function addPlayer() {
  const input = document.getElementById("playerName");
  const name = input.value.trim();
  if (!name) return;

  const duplicate = tournament.players.some(p => p.name.toLowerCase() === name.toLowerCase());
  if (duplicate) {
    alert("Player already registered.");
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
  const raw = prompt("Paste Melee Roster (Player names, one per line):");
  if (!raw) return;

  const names = raw.split("\n").map(n => n.trim()).filter(n => n.length > 0);
  let added = 0;
  names.forEach(name => {
    const duplicate = tournament.players.some(p => p.name.toLowerCase() === name.toLowerCase());
    if (!duplicate) {
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
      added++;
    }
  });
  alert(`Added ${added} players.`);
  renderPlayerList();
}

function renderPlayerList() {
  const list = document.getElementById("playerList");
  if (!list) return;
  list.innerHTML = "";

  tournament.players.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach(player => {
    const li = document.createElement("li");
    li.className = "registration-player-item";
    li.innerHTML = `
      <span>${player.name}</span>
      <div class="registration-player-actions">
        <button class="icon-button" onclick="editRegisteredPlayer(${player.id})">✏️</button>
        <button class="icon-button danger" onclick="deleteRegisteredPlayer(${player.id})">✕</button>
      </div>
    `;
    list.appendChild(li);
  });
}

function editRegisteredPlayer(playerId) {
  const player = findPlayer(playerId);
  if (!player) return;
  const updatedName = prompt("Edit player name:", player.name);
  if (updatedName && updatedName.trim()) {
    player.name = updatedName.trim();
    renderPlayerList();
  }
}

function deleteRegisteredPlayer(playerId) {
  tournament.players = tournament.players.filter(p => p.id !== playerId);
  renderPlayerList();
}

/* --- TOURNAMENT CONTROL --- */

function confirmStartTournament() {
  if (tournament.players.length < 3) {
    alert("At least 3 players are required to start.");
    return;
  }
  if (confirm("Start tournament? This will generate Round 1.")) {
    document.getElementById("registration").style.display = "none";
    document.getElementById("tournament").style.display = "block";
    nextRound();
  }
}

function nextRound() {
  if (tournament.currentRound > 0 && !isRoundComplete(tournament.currentRound)) {
    alert("Finish all pod results before generating the next round.");
    return;
  }
  if (tournament.currentRound >= tournament.totalRounds) {
    alert("Tournament complete.");
    return;
  }

  recalculateStandings();
  const podPlayerIds = buildPods();
  if (podPlayerIds.length === 0) return;

  tournament.currentRound += 1;
  tournament.viewingRound = tournament.currentRound;
  tournament.rounds.push({
    number: tournament.currentRound,
    pods: podPlayerIds.map(players => ({
      players,
      locked: false,
      result: null
    }))
  });

  renderRoundTabs();
  renderRoundView(tournament.viewingRound);
  updateStandings();
  renderPlayerManagement();
}

/* --- ROUND VIEW --- */

function renderRoundTabs() {
  const tabs = document.getElementById("roundTabs");
  if (!tabs) return;
  tabs.innerHTML = "";
  tournament.rounds.forEach(round => {
    const btn = document.createElement("button");
    btn.className = `tab-button ${round.number === tournament.viewingRound ? 'active-tab' : ''}`;
    btn.textContent = `Round ${round.number}`;
    btn.onclick = () => openRound(round.number);
    tabs.appendChild(btn);
  });
}

function openRound(num) {
  tournament.viewingRound = num;
  renderRoundTabs();
  renderRoundView(num);
}

function renderRoundView(roundNumber) {
  const round = tournament.rounds[roundNumber - 1];
  if (!round) return;

  const header = document.getElementById("roundHeader");
  if (header) header.textContent = `Round ${round.number}`;
  
  const pairingsSection = document.getElementById("pairings");
  if (!pairingsSection) return;

  // FIX: Build full HTML first to prevent pod results being lost during innerHTML += loop
  let podsHtml = "";
  round.pods.forEach((pod, podIndex) => {
    const playerObjects = pod.players.map(id => findPlayer(id));
    const rankingRows = playerObjects.map(player => {
      const isDropped = player.status !== "active";
      const nameStyle = isDropped ? 'style="text-decoration: line-through; color: #999;"' : '';
      const rankingOptions = playerObjects.map((_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("");
      return `
        <tr>
          <td ${nameStyle}>${player.name} ${isDropped ? '(' + getStatusLabel(player.status) + ')' : ''}</td>
          <td><select id="rank-${round.number}-${podIndex}-${player.id}" ${pod.locked ? "disabled" : ""}>${rankingOptions}</select></td>
        </tr>`;
    }).join("");

    podsHtml += `
      <div class="pod-card" style="border:1px solid #ddd; padding:15px; margin-bottom:15px; border-radius:8px;">
        <h3>Pod ${podIndex + 1}</h3>
        <table style="width:100%; margin-bottom:10px;">
          <thead><tr><th align="left">Player</th><th align="left">Rank</th></tr></thead>
          <tbody>${rankingRows}</tbody>
        </table>
        <div class="pod-actions">
          <button onclick="reportPodRanking(${round.number}, ${podIndex})" ${pod.locked ? "disabled" : ""}>Submit</button>
          <button onclick="reportPodDraw(${round.number}, ${podIndex})" ${pod.locked ? "disabled" : ""}>Draw</button>
          <button onclick="editPodResult(${round.number}, ${podIndex})" ${pod.locked ? "" : "disabled"}>Edit</button>
        </div>
        <p><strong>Status:</strong> ${pod.locked ? (pod.result.type === 'draw' ? 'Draw' : 'Result Locked') : 'Pending'}</p>
      </div>`;
  });

  pairingsSection.innerHTML = podsHtml;

  // Restore values to dropdowns after innerHTML is set
  round.pods.forEach((pod, podIndex) => {
    if (pod.result?.type === "ranking") {
        pod.players.forEach(pid => {
            const select = document.getElementById(`rank-${round.number}-${podIndex}-${pid}`);
            if (select) select.value = pod.result.rankings[pid];
        });
    }
  });

  updateNextRoundButtonState();
}

function updateNextRoundButtonState() {
  const button = document.getElementById("nextRoundButton");
  if (!button) return;

  const isComplete = tournament.currentRound > 0 && isRoundComplete(tournament.currentRound);
  const isLastRound = tournament.currentRound === tournament.totalRounds;

  if (isComplete) {
    button.style.display = "inline-block";
    button.disabled = false;
    button.textContent = isLastRound ? "Finish and Print Standings" : "Generate Next Round";
    button.onclick = isLastRound ? () => { saveTournament(); printFinalStandings(); } : nextRound;
  } else {
    button.style.display = "none";
  }
}

/* --- STANDINGS & MANAGEMENT --- */

function setPlayerStatus(playerId, newStatus) {
  const player = findPlayer(playerId);
  if (player) player.status = newStatus;
  recalculateStandings();
  updateStandings();
  renderPlayerManagement();
  if (tournament.viewingRound > 0) renderRoundView(tournament.viewingRound);
}

function editPlayerName(playerId) {
  const player = findPlayer(playerId);
  const n = prompt("New name:", player.name);
  if (n && n.trim()) {
    player.name = n.trim();
    updateStandings();
    renderPlayerManagement();
    if (tournament.viewingRound > 0) renderRoundView(tournament.viewingRound);
  }
}

function renderPlayerManagement() {
  const tbody = document.querySelector("#playerManagementTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  tournament.players.slice().sort((a,b) => a.name.localeCompare(b.name)).forEach(p => {
    const action = p.status === "active" 
      ? `<button onclick="setPlayerStatus(${p.id}, 'dropped')">Drop</button>`
      : `<button onclick="setPlayerStatus(${p.id}, 'active')">Re-activate</button>`;
    tbody.innerHTML += `<tr><td>${p.name}</td><td>${getStatusLabel(p.status)}</td><td><button onclick="editPlayerName(${p.id})">Edit</button> ${action}</td></tr>`;
  });
}

function updateStandings() {
  const tbody = document.querySelector("#standingsTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  const sorted = [...tournament.players].sort((a,b) => b.matchPoints - a.matchPoints || calculateOmw(b) - calculateOmw(a));
  sorted.forEach(p => {
    tbody.innerHTML += `<tr><td>${p.name}</td><td>${getStatusLabel(p.status)}</td><td>${p.matchPoints}</td><td>${formatPercent(calculateOmw(p))}</td><td>${formatPercent(calculateGwp(p))}</td><td>${formatPercent(calculateOgw(p))}</td></tr>`;
  });
  updateNextRoundButtonState();
}

/* --- LOGIC & UTILS --- */

function buildPods() {
  let activePlayers = tournament.players.filter(p => p.status === "active");
  if (tournament.currentRound > 0) {
    activePlayers.sort((a,b) => b.matchPoints - a.matchPoints || Math.random() - 0.5);
  } else {
    activePlayers = activePlayers.sort(() => Math.random() - 0.5);
  }

  const podSizes = getPodSizes(activePlayers.length);
  if (!podSizes) { alert("Invalid player count for 3-4 player pods."); return []; }

  const pods = [];
  let cursor = 0;
  podSizes.forEach(size => {
    pods.push(activePlayers.slice(cursor, cursor + size).map(p => p.id));
    cursor += size;
  });
  return pods;
}

function getPodSizes(count) {
  if (count === 5) return [2, 3];
  for (let threes = 0; threes <= count / 3; threes++) {
    let rem = count - (threes * 3);
    if (rem >= 0 && rem % 4 === 0) return [...Array(rem / 4).fill(4), ...Array(threes).fill(3)];
  }
  return null;
}

function reportPodRanking(r, i) {
  const pod = getPod(r, i);
  const rankings = {};
  pod.players.forEach(id => {
    rankings[id] = parseInt(document.getElementById(`rank-${r}-${i}-${id}`).value, 10);
  });
  pod.result = { type: "ranking", rankings };
  pod.locked = true;
  recalculateStandings();
  updateStandings();
  renderRoundView(tournament.viewingRound);
  checkRoundEndAutoSave();
}

function reportPodDraw(r, i) {
  const pod = getPod(r, i);
  pod.result = { type: "draw" };
  pod.locked = true;
  recalculateStandings();
  updateStandings();
  renderRoundView(tournament.viewingRound);
  checkRoundEndAutoSave();
}

function editPodResult(r, i) {
  getPod(r, i).locked = false;
  renderRoundView(tournament.viewingRound);
}

function recalculateStandings() {
  tournament.players.forEach(p => { 
    p.matchPoints = 0; p.matchesPlayed = 0; p.gameWins = 0; p.gameLosses = 0; p.gameDraws = 0; p.opponents = []; 
  });
  tournament.rounds.forEach(r => {
    r.pods.forEach(pod => {
      if (!pod.locked) return;
      const podPlayers = pod.players.map(id => findPlayer(id));
      podPlayers.forEach(p => p.opponents.push(...pod.players.filter(oid => oid !== p.id)));
      
      if (pod.result.type === "draw") {
        podPlayers.forEach(p => { p.matchPoints += 3; p.matchesPlayed += 1; p.gameDraws += 1; });
      } else {
        const max = podPlayers.length;
        podPlayers.forEach(p => {
          p.matchesPlayed += 1;
          const rank = pod.result.rankings[p.id];
          if (rank === 1) { p.matchPoints += 5; p.gameWins += 1; }
          else if (rank === max) { p.matchPoints += 1; p.gameLosses += 1; }
          else { p.matchPoints += 3; p.gameDraws += 1; }
        });
      }
    });
  });
}

/* --- FILE & PRINT --- */

function importTournamentSave() {
  const fileInput = document.getElementById("saveFile");
  if (!fileInput || !fileInput.files.length) return alert("Select a file first.");
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const loaded = JSON.parse(e.target.result);
      tournament = loaded;
      document.getElementById("setup").style.display = "none";
      if (tournament.currentRound > 0) {
        document.getElementById("tournament").style.display = "block";
        renderRoundTabs();
        renderRoundView(tournament.viewingRound);
        updateStandings();
        renderPlayerManagement();
      } else {
        document.getElementById("registration").style.display = "block";
        renderPlayerList();
      }
    } catch (err) { alert("Invalid save file format."); }
  };
  reader.readAsText(fileInput.files[0]);
}

function saveTournament() {
  const data = JSON.stringify(tournament);
  const blob = new Blob([data], { type: "application/json" });
  const safeName = (tournament.name || "tournament").replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${safeName}-round-${tournament.currentRound}.json`;
  a.click();
}

function handlePrintMenu() {
  const val = document.getElementById("printMenu").value;
  if (val === "pairings") printRoundPairings(tournament.currentRound);
  else if (val === "slips") printRoundMatchSlips(tournament.currentRound);
  else if (val === "standings") printFinalStandings();
  else if (val === "roster") printRoster();
  document.getElementById("printMenu").value = "";
}

function applyTournamentFastCodes() {
  const input = document.getElementById("tournamentFastCode");
  const entry = input?.value.trim();
  if (!entry) return;
  const digits = entry.replace(/\D/g, "");
  if (digits.length < 4) return;
  const rNum = parseInt(digits[0], 10);
  const pIdx = parseInt(digits[1], 10) - 1;
  const placements = digits.slice(2);
  const pod = getPod(rNum, pIdx);
  if (!pod || pod.locked) return;
  if (placements.startsWith("00")) { 
     pod.result = { type: "draw" };
  } else {
    const rankings = {};
    pod.players.forEach((id, i) => { rankings[id] = parseInt(placements[i], 10); });
    pod.result = { type: "ranking", rankings };
  }
  pod.locked = true;
  input.value = "";
  recalculateStandings();
  updateStandings();
  renderRoundView(tournament.viewingRound);
}

/* --- HELPERS --- */

function findPlayer(id) { return tournament.players.find(p => p.id === id); }
function getPod(r, i) { return tournament.rounds[r-1]?.pods[i]; }
function isRoundComplete(r) { return tournament.rounds[r-1]?.pods.every(p => p.locked); }
function getStatusLabel(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function formatPercent(v) { return (v * 100).toFixed(1) + "%"; }
function calculateGwp(p) {
  const t = p.gameWins + p.gameLosses + p.gameDraws;
  return t === 0 ? 0 : (p.gameWins + 0.5 * p.gameDraws) / t;
}
function calculateOmw(p) {
  if (!p.opponents.length) return 0;
  return p.opponents.reduce((acc, id) => acc + Math.max(calculateGwp(findPlayer(id)), MIN_OPPONENT_PERCENT), 0) / p.opponents.length;
}
function calculateOgw(p) {
  if (!p.opponents.length) return 0;
  return p.opponents.reduce((acc, id) => acc + Math.max(calculateOmw(findPlayer(id)), MIN_OPPONENT_PERCENT), 0) / p.opponents.length;
}
function checkRoundEndAutoSave() {
  if (isRoundComplete(tournament.currentRound)) {
    setTimeout(() => { if (confirm("Round complete! Save progress?")) saveTournament(); }, 500);
  }
}
function openMainTab(tabId) {
  document.querySelectorAll(".main-tab").forEach(t => t.style.display = "none");
  document.querySelectorAll(".main-tabs button").forEach(b => b.classList.remove("active-tab"));
  document.getElementById(tabId).style.display = "block";
  const btn = Array.from(document.querySelectorAll(".main-tabs button")).find(b => b.getAttribute("onclick").includes(tabId));
  if (btn) btn.classList.add("active-tab");
}

/* --- PRINTING LOGIC --- */

function printFinalStandings() {
  const sorted = [...tournament.players].sort((a,b) => b.matchPoints - a.matchPoints || calculateOmw(b) - calculateOmw(a));
  let html = `<h2>Final Standings</h2><table border="1" style="width:100%; border-collapse:collapse;"><tr><th>Rank</th><th>Name</th><th>Points</th><th>OMW%</th></tr>`;
  sorted.forEach((p, i) => {
    html += `<tr><td>${i+1}</td><td>${p.name}</td><td>${p.matchPoints}</td><td>${formatPercent(calculateOmw(p))}</td></tr>`;
  });
  html += `</table>`;
  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  win.print();
}

function printRoundPairings(num) {
  const r = tournament.rounds[num-1];
  if (!r) return;
  let html = `<h2>Round ${num} Pairings</h2><table border="1" style="width:100%; border-collapse:collapse;"><tr><th>Player</th><th>Pod</th></tr>`;
  const list = [];
  r.pods.forEach((pod, idx) => {
    pod.players.forEach(pid => list.push({ name: findPlayer(pid).name, pod: idx+1 }));
  });
  list.sort((a,b) => a.name.localeCompare(b.name)).forEach(item => {
    html += `<tr><td>${item.name}</td><td>${item.pod}</td></tr>`;
  });
  html += `</table>`;
  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  win.print();
}

function printRoster() {
  const sorted = [...tournament.players].sort((a,b) => a.name.localeCompare(b.name));
  let html = `<h2>Roster</h2><table border="1" style="width:100%; border-collapse:collapse;"><tr><th>Name</th><th>Status</th></tr>`;
  sorted.forEach(p => { html += `<tr><td>${p.name}</td><td>${getStatusLabel(p.status)}</td></tr>`; });
  html += `</table>`;
  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  win.print();
}

ffunction printRoundMatchSlips(roundNumber) {

  const round = tournament.rounds.find(r => r.number === roundNumber);
  if (!round) {
    alert("Round not found.");
    return;
  }

  const totalPods = round.pods.length;
  const half = Math.ceil(totalPods / 2);

  // Reorder pods for cut-stack printing
  const orderedPods = [];
  for (let i = 0; i < half; i++) {
    if (round.pods[i]) orderedPods.push({ pod: round.pods[i], index: i });
    if (round.pods[i + half]) orderedPods.push({ pod: round.pods[i + half], index: i + half });
  }

  let pagesHTML = "";

  for (let i = 0; i < orderedPods.length; i += 2) {

    const top = orderedPods[i];
    const bottom = orderedPods[i + 1];

    pagesHTML += `
      <div class="print-page">
        ${buildSlipHTML(top.pod, top.index, round)}
        ${bottom ? buildSlipHTML(bottom.pod, bottom.index, round) : ""}
      </div>
    `;
  }

  const html = `
    <html>
    <head>
      <title>Round ${round.number} Match Slips</title>
      <style>

        body {
          font-family: Arial, sans-serif;
          margin: 0;
        }

        .print-page {
          height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          page-break-after: always;
        }

        .match-slip {
          padding: 20px;
          box-sizing: border-box;
          height: 48%;
          border-bottom: 2px dashed #999;
        }

        .player-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .player-box {
          border: 2px solid #000;
          padding: 12px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 150px;
        }

        .player-header {
          margin-bottom: 12px;
          font-size: 15px;
        }

        .ranking-line {
          display: flex;
          gap: 14px;
          align-items: center;
          margin-bottom: 20px;
        }

        .ranking-line span {
          border: 1px solid #000;
          padding: 4px 10px;
          min-width: 20px;
          text-align: center;
        }

        .signature-line {
          margin-top: auto;
        }

        .slip-footer {
          margin-top: 20px;
          text-align: center;
          font-weight: bold;
        }

      </style>
    </head>
    <body>
      ${pagesHTML}
    </body>
    </html>
  `;

  const printWindow = window.open("", "_blank");
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.print();
}


function buildSlipHTML(pod, podIndex, round) {

  const players = pod.players;

  return `
    <div class="match-slip">
      <div class="player-grid">

        ${[0,1,2,3].map(i => {
          const player = tournament.players.find(p => p.id === players[i]);
          const name = player ? player.name : "";
          const points = player ? player.matchPoints : "";

          return `
            <div class="player-box">
              <div class="player-header">
                <strong>Player ${i + 1}:</strong> ${name} ${name ? `(${points})` : ""}
              </div>

              <div class="ranking-line">
                Ranking:
                <span>1</span>
                <span>2</span>
                <span>3</span>
                <span>4</span>
                <span>TIE</span>
              </div>

              <div class="signature-line">
                Signature: ___________________________
              </div>
            </div>
          `;
        }).join("")}

      </div>

      <div class="slip-footer">
        ${tournament.name} – Round ${round.number} – Pod ${podIndex + 1}
      </div>
    </div>
  `;
}

// Global scope registration for HTML buttons
window.createTournament = createTournament;
window.addPlayer = addPlayer;
window.importMeleeRoster = importMeleeRoster;
window.importTournamentSave = importTournamentSave;
window.saveTournament = saveTournament;
window.confirmStartTournament = confirmStartTournament;
window.nextRound = nextRound;
window.openRound = openRound;
window.reportPodRanking = reportPodRanking;
window.reportPodDraw = reportPodDraw;
window.editPodResult = editPodResult;
window.setPlayerStatus = setPlayerStatus;
window.editPlayerName = editPlayerName;
window.applyTournamentFastCodes = applyTournamentFastCodes;
window.openMainTab = openMainTab;
window.handlePrintMenu = handlePrintMenu;
