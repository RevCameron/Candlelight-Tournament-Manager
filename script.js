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
  
  renderPlayerList();
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
    id: tournament.nextPlayerId,
    name,
    status: "active",
    matchPoints: 0,
    matchesPlayed: 0,
    gameWins: 0,
    gameLosses: 0,
    gameDraws: 0,
    opponents: []
  });

  tournament.nextPlayerId += 1;
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

  tournament.players
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(player => {
      const li = document.createElement("li");
      li.className = "registration-player-item";
      li.innerHTML = `
        <span>${player.name}</span>
        <div class="registration-player-actions">
          <button title="Edit player" class="icon-button" onclick="editRegisteredPlayer(${player.id})">✏️</button>
          <button title="Remove player" class="icon-button danger" onclick="deleteRegisteredPlayer(${player.id})">✕</button>
        </div>
      `;
      list.appendChild(li);
    });
}

function editRegisteredPlayer(playerId) {
  const player = findPlayer(playerId);
  if (!player) return;

  const updatedName = prompt("Edit player name:", player.name);
  if (!updatedName || !updatedName.trim()) return;

  player.name = updatedName.trim();
  renderPlayerList();
}

function deleteRegisteredPlayer(playerId) {
  tournament.players = tournament.players.filter(p => p.id !== playerId);
  renderPlayerList();
}

/* --- TOURNAMENT CONTROL --- */

function confirmStartTournament() {
  const activeCount = tournament.players.filter(p => p.status === "active").length;
  if (activeCount < 3) {
    alert("At least 3 players are required to start.");
    return;
  }
  if (confirm("Start tournament? This will generate Round 1.")) {
    startRounds();
  }
}

function startRounds() {
  document.getElementById("registration").style.display = "none";
  document.getElementById("tournament").style.display = "block";
  document.getElementById("printMenu").style.display = "inline-block";
  nextRound();
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
  
  setTimeout(() => {
    printRoundPairings(tournament.currentRound);
    printRoundMatchSlips(tournament.currentRound);
  }, 300);
}

/* --- ROUND VIEW & DYNAMICS --- */

function renderRoundTabs() {
  const tabs = document.getElementById("roundTabs");
  if (!tabs) return;
  tabs.innerHTML = "";
  tournament.rounds.forEach(round => {
    const activeClass = round.number === tournament.viewingRound ? "active-tab" : "";
    tabs.innerHTML += `<button class="tab-button ${activeClass}" onclick="openRound(${round.number})">Round ${round.number}</button>`;
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

  document.getElementById("roundHeader").textContent = `Round ${round.number}`;
  const pairingsSection = document.getElementById("pairings");
  pairingsSection.innerHTML = "";

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

    pairingsSection.innerHTML += `
      <div class="pod-card">
        <h3>Pod ${podIndex + 1}</h3>
        <table class="pod-rank-table">
          <thead><tr><th>Player</th><th>Rank</th></tr></thead>
          <tbody>${rankingRows}</tbody>
        </table>
        <div class="pod-actions">
          <button onclick="reportPodRanking(${round.number}, ${podIndex})" ${pod.locked ? "disabled" : ""}>Submit</button>
          <button onclick="reportPodDraw(${round.number}, ${podIndex})" ${pod.locked ? "disabled" : ""}>Draw</button>
          <button onclick="editPodResult(${round.number}, ${podIndex})" ${pod.locked ? "" : "disabled"}>Edit</button>
        </div>
        <p class="pod-status">${pod.locked ? describePodResult(pod, playerObjects) : "Pending"}</p>
      </div>`;
    
    // Restore values if already submitted
    playerObjects.forEach(p => {
      const select = document.getElementById(`rank-${round.number}-${podIndex}-${p.id}`);
      if (pod.result?.type === "ranking") select.value = pod.result.rankings[p.id];
    });
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
    if (isLastRound) {
      button.textContent = "Save and Print Standings";
      button.onclick = finishTournament;
    } else {
      button.textContent = "Generate Next Round";
      button.onclick = nextRound;
    }
  } else {
    button.style.display = "none";
  }
}

function finishTournament() {
  if (confirm("Tournament over. Save data and print final standings?")) {
    saveTournament();
    printFinalStandings();
  }
}

/* --- PLAYER MANAGEMENT & STANDINGS --- */

function setPlayerStatus(playerId, newStatus) {
  const player = findPlayer(playerId);
  if (!player) return;
  player.status = newStatus;
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

/* --- POD BUILDING & LOGIC --- */

function buildPods() {
  let activePlayers = tournament.players.filter(p => p.status === "active");
  if (tournament.currentRound > 0) {
    activePlayers.sort((a,b) => b.matchPoints - a.matchPoints || Math.random() - 0.5);
  } else {
    activePlayers = shuffleArray(activePlayers);
  }

  const podSizes = getPodSizes(activePlayers.length);
  if (!podSizes) { alert("Invalid player count for pods."); return []; }

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

/* --- DATA & PRINTING --- */

function importTournamentSave() {
  const fileInput = document.getElementById("saveFile");
  if (!fileInput || !fileInput.files.length) return alert("Select a file first.");
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      tournament = JSON.parse(e.target.result);
      if (tournament.currentRound > 0) {
        document.getElementById("setup").style.display = "none";
        document.getElementById("registration").style.display = "none";
        document.getElementById("tournament").style.display = "block";
        document.getElementById("printMenu").style.display = "inline-block";
        renderRoundTabs();
        renderRoundView(tournament.viewingRound);
        updateStandings();
        renderPlayerManagement();
      } else { renderPlayerList(); }
    } catch (err) { alert("Invalid save file."); }
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

function printRoster() {
  const sorted = [...tournament.players].sort((a,b) => a.name.localeCompare(b.name));
  const html = `<h2>${tournament.name} Roster</h2><table border="1" style="width:100%; border-collapse:collapse;">
    <tr><th>#</th><th>Name</th><th>Status</th></tr>
    ${sorted.map((p, i) => `<tr><td>${i+1}</td><td>${p.name}</td><td>${getStatusLabel(p.status)}</td></tr>`).join("")}
  </table>`;
  openPrintWindow("Roster", html);
}

function printRoundPairings(num) {
  const r = tournament.rounds[num-1];
  if (!r) return;
  const list = [];
  r.pods.forEach((p, idx) => {
    const names = p.players.map(id => findPlayer(id).name);
    p.players.forEach(id => {
      const pObj = findPlayer(id);
      list.push({ name: pObj.name, pod: idx+1, opps: names.filter(n => n !== pObj.name).join(", ") });
    });
  });
  list.sort((a,b) => a.name.localeCompare(b.name));
  const html = `<h2>Round ${num} Pairings</h2><table border="1" style="width:100%; border-collapse:collapse;">
    <tr><th>Player</th><th>Pod</th><th>Opponents</th></tr>
    ${list.map(e => `<tr><td>${e.name}</td><td>${e.pod}</td><td>${e.opps}</td></tr>`).join("")}
  </table>`;
  openPrintWindow("Pairings", html);
}

function printRoundMatchSlips(num) {
  const round = tournament.rounds[num-1];
  if (!round) return;
  let slips = round.pods.map((pod, i) => `
    <div style="height:45vh; border-bottom:2px dashed #000; padding:20px;">
      <center><h3>${tournament.name} - Round ${num} - Pod ${i+1}</h3></center>
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
        ${pod.players.map(id => `
          <div style="border:1px solid #000; padding:10px; min-height:100px;">
            <strong>${findPlayer(id).name}</strong><br><br>Rank: [ 1 ] [ 2 ] [ 3 ] [ 4 ]<br><br>Sign: _________
          </div>`).join("")}
      </div>
    </div>`).join("");
  openPrintWindow("Slips", `<html><body>${slips}</body></html>`);
}

function printFinalStandings() {
  const sorted = [...tournament.players].sort((a,b) => b.matchPoints - a.matchPoints || calculateOmw(b) - calculateOmw(a));
  const html = `<h2>Final Standings</h2><table border="1" style="width:100%; border-collapse:collapse;">
    <tr><th>Rank</th><th>Name</th><th>Points</th><th>OMW%</th></tr>
    ${sorted.map((p, i) => `<tr><td>${i+1}</td><td>${p.name}</td><td>${p.matchPoints}</td><td>${formatPercent(calculateOmw(p))}</td></tr>`).join("")}
  </table>`;
  openPrintWindow("Final Standings", html);
}

/* --- FAST CODES --- */

function applyTournamentFastCodes() {
  const input = document.getElementById("tournamentFastCode");
  const raw = input?.value.trim();
  if (!raw) return;
  const entries = raw.split(/[\s,;]+/).filter(Boolean);
  entries.forEach(entry => {
    const digits = entry.replace(/\D/g, "");
    if (digits.length < 5) return;
    const rNum = parseInt(digits[0], 10);
    const pIdx = parseInt(digits[1], 10) - 1;
    const placements = digits.slice(2);
    const pod = getPod(rNum, pIdx);
    if (!pod || pod.locked) return;
    if (placements === "0000") { reportPodDraw(rNum, pIdx); }
    else {
      const rankings = {};
      pod.players.forEach((id, i) => { rankings[id] = parseInt(placements[i], 10); });
      pod.result = { type: "ranking", rankings };
      pod.locked = true;
    }
  });
  input.value = "";
  recalculateStandings();
  updateStandings();
  renderRoundView(tournament.viewingRound);
}

/* --- UTILS --- */

function findPlayer(id) { return tournament.players.find(p => p.id === id); }
function getPod(r, i) { return tournament.rounds[r-1]?.pods[i]; }
function isRoundComplete(r) { return tournament.rounds[r-1]?.pods.every(p => p.locked); }
function getStatusLabel(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function formatPercent(v) { return (v * 100).toFixed(1) + "%"; }
function shuffleArray(arr) { return arr.sort(() => Math.random() - 0.5); }

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

function recalculateStandings() {
  tournament.players.forEach(p => { p.matchPoints = 0; p.matchesPlayed = 0; p.gameWins = 0; p.gameLosses = 0; p.gameDraws = 0; p.opponents = []; });
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

function checkRoundEndAutoSave() {
  if (isRoundComplete(tournament.currentRound)) {
    setTimeout(() => { if (confirm("Round complete! Save progress?")) saveTournament(); }, 500);
  }
}

function openPrintWindow(title, html) {
  const win = window.open("", "_blank");
  win.document.write(`<html><head><title>${title}</title></head><body>${html}</body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 500);
}

function openMainTab(tabId) {
  document.querySelectorAll(".main-tab").forEach(t => t.style.display = "none");
  document.querySelectorAll(".main-tabs button").forEach(b => b.classList.remove("active-tab"));
  document.getElementById(tabId).style.display = "block";
}

function handlePrintMenu() {
  const val = document.getElementById("printMenu").value;
  if (val === "pairings") printRoundPairings(tournament.currentRound);
  else if (val === "slips") printRoundMatchSlips(tournament.currentRound);
  else if (val === "standings") printFinalStandings();
  else if (val === "roster") printRoster();
  document.getElementById("printMenu").value = "";
}

/* --- INITIALIZATION --- */

document.addEventListener("DOMContentLoaded", () => {
  // Bind all functions to window
  Object.assign(window, {
    createTournament, addPlayer, importMeleeRoster, editRegisteredPlayer, deleteRegisteredPlayer,
    confirmStartTournament, nextRound, openRound, reportPodRanking, reportPodDraw, editPodResult,
    setPlayerStatus, editPlayerName, applyTournamentFastCodes, saveTournament, importTournamentSave,
    printRoster, printRoundPairings, printRoundMatchSlips, printFinalStandings, openMainTab, handlePrintMenu
  });
  
  const fastCodeInput = document.getElementById("tournamentFastCode");
  if (fastCodeInput) {
    fastCodeInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); applyTournamentFastCodes(); } });
  }
});
