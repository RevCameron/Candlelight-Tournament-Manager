let tournament = {
  name: "",
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
  
  const gwpHeader = document.getElementById("gwpHeader");
  if (gwpHeader) {
    gwpHeader.textContent = tournament.gameMode === "Twin Suns" ? "TGW%" : "GW%";
  }
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

function renderPlayerList() {
  const list = document.getElementById("playerList");
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
  if (!updatedName) return; 

  const trimmedName = updatedName.trim();
  if (!trimmedName) return;

  const duplicate = tournament.players.some(
    other => other.id !== player.id && other.name.toLowerCase() === trimmedName.toLowerCase()
  );
  if (duplicate) {
    alert("Another player already has that name.");
    return;
  }

  player.name = trimmedName;
  renderPlayerList();
}

function deleteRegisteredPlayer(playerId) {
  tournament.players = tournament.players.filter(player => player.id !== playerId);
  renderPlayerList();
  saveTournamentState();
}

function startRounds() {
  const activeCount = tournament.players.filter(player => player.status === "active").length;
  if (activeCount < 3) {
    alert("At least 3 active players are required.");
    return;
  }

  document.getElementById("registration").style.display = "none";
  document.getElementById("tournament").style.display = "block";
  nextRound();
  document.getElementById("printMenu").style.display = "inline-block";
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
  
  saveTournamentState();
}

function shuffleArray(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function countRepeatOpponents(pods) {
  let repeats = 0;
  pods.forEach(pod => {
    for (let i = 0; i < pod.length; i++) {
      const player = findPlayer(pod[i]);
      for (let j = i + 1; j < pod.length; j++) {
        if (player.opponents.includes(pod[j])) {
          repeats += 1;
        }
      }
    }
  });
  return repeats;
}

function buildPods() {
  let sortedPlayers = [...tournament.players].filter(player => player.status === "active");

  if (tournament.currentRound === 0) {
    sortedPlayers = shuffleArray(sortedPlayers);
  } else {
    const groups = {};
    sortedPlayers.forEach(player => {
      if (!groups[player.matchPoints]) groups[player.matchPoints] = [];
      groups[player.matchPoints].push(player);
    });

    const sortedPointValues = Object.keys(groups).map(Number).sort((a, b) => b - a);
    sortedPlayers = [];
    sortedPointValues.forEach(points => {
      sortedPlayers.push(...shuffleArray(groups[points]));
    });
  }

  const podSizes = getPodSizes(sortedPlayers.length);
  if (!podSizes) {
    alert("Unable to make only 3-4 player pods with active player count.");
    return [];
  }

  const ATTEMPTS = 200;
  let bestPods = null;
  let bestScore = Infinity;

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const shuffled = shuffleArray(sortedPlayers);
    const pods = [];
    let cursor = 0;
    podSizes.forEach(size => {
      pods.push(shuffled.slice(cursor, cursor + size).map(p => p.id));
      cursor += size;
    });
    const score = countRepeatOpponents(pods);
    if (score < bestScore) {
      bestScore = score;
      bestPods = pods;
    }
    if (score === 0) break;
  }
  return bestPods;
}

function getPodSizes(playerCount) {
  if (playerCount === 5) return [2, 3];
  for (let threePods = 0; threePods <= Math.floor(playerCount / 3); threePods += 1) {
    const remaining = playerCount - (threePods * 3);
    if (remaining >= 0 && remaining % 4 === 0) {
      const fourPods = remaining / 4;
      return [...Array(fourPods).fill(4), ...Array(threePods).fill(3)];
    }
  }
  return null;
}

function renderRoundTabs() {
  const tabs = document.getElementById("roundTabs");
  tabs.innerHTML = "";
  tournament.rounds.forEach(round => {
    const activeClass = round.number === tournament.viewingRound ? "active-tab" : "";
    tabs.innerHTML += `
      <button class="tab-button ${activeClass}" onclick="openRound(${round.number})">
        Round ${round.number}
      </button>
    `;
  });
}

function openRound(roundNumber) {
  tournament.viewingRound = roundNumber;
  renderRoundTabs();
  renderRoundView(roundNumber);
}

function renderRoundView(roundNumber) {
  const round = tournament.rounds[roundNumber - 1];
  if (!round) return;

  document.getElementById("roundHeader").textContent = `Round ${round.number}`;
  renderRoundControls(round);

  const pairingsSection = document.getElementById("pairings");
  pairingsSection.innerHTML = "";

  round.pods.forEach((pod, podIndex) => {
    const playerObjects = pod.players.map(id => findPlayer(id));
    const rankingRows = playerObjects.map((player, playerIndex) => {
      const rankingOptions = playerObjects
        .map((_, i) => `<option value="${i + 1}">${i + 1}</option>`)
        .join("");

      return `
        <tr>
          <td>${player.name}</td>
          <td>
            <select id="rank-${round.number}-${podIndex}-${player.id}" ${pod.locked ? "disabled" : ""}>
              ${rankingOptions}
            </select>
          </td>
        </tr>
      `;
    }).join("");

    pairingsSection.innerHTML += `
      <div class="pod-card" id="pod-${round.number}-${podIndex}">
        <h3>Pod ${podIndex + 1} (${playerObjects.length} players)</h3>
        <table class="pod-rank-table">
          <thead><tr><th>Player</th><th>Rank</th></tr></thead>
          <tbody>${rankingRows}</tbody>
        </table>
        <div class="pod-actions">
          <button onclick="reportPodRanking(${round.number}, ${podIndex})" ${pod.locked ? "disabled" : ""}>Submit Ranking</button>
          <button onclick="reportPodDraw(${round.number}, ${podIndex})" ${pod.locked ? "disabled" : ""}>All Draw</button>
          <button onclick="editPodResult(${round.number}, ${podIndex})" ${pod.locked ? "" : "disabled"}>Edit Result</button>
        </div>
        <p class="pod-status">${pod.locked ? describePodResult(pod, playerObjects) : "Pending"}</p>
      </div>
    `;

    playerObjects.forEach(player => {
      if (pod.result?.type === "ranking") {
        document.getElementById(`rank-${round.number}-${podIndex}-${player.id}`).value = pod.result.rankings[player.id];
      }
    });
  });

  updateNextRoundButtonState();
}

function renderRoundControls(round) {
  const controls = document.getElementById("roundControls");
  controls.innerHTML = `
    <button onclick="printRoundPairings(${round.number})">Print Pairings</button>
    <button onclick="printRoundMatchSlips(${round.number})">Print Match Slips</button>
  `;
}

function reportPodRanking(roundNumber, podIndex) {
  const pod = getPod(roundNumber, podIndex);
  if (!pod || pod.locked) return;

  const rankings = {};
  const usedRanks = new Set();
  for (const playerId of pod.players) {
    const val = parseInt(document.getElementById(`rank-${roundNumber}-${podIndex}-${playerId}`).value, 10);
    if (usedRanks.has(val)) {
      alert("Each player must have a unique rank.");
      return;
    }
    usedRanks.add(val);
    rankings[playerId] = val;
  }
  applyPodRankingResult(roundNumber, podIndex, rankings);
}

function applyPodRankingResult(roundNumber, podIndex, rankings) {
  const pod = getPod(roundNumber, podIndex);
  if (!pod || pod.locked) return;
  pod.result = { type: "ranking", rankings };
  pod.locked = true;
  recalculateStandings();
  renderRoundView(tournament.viewingRound);
  updateStandings();
  checkRoundEndAutoSave();
}

function reportPodDraw(roundNumber, podIndex) {
  const pod = getPod(roundNumber, podIndex);
  if (!pod || pod.locked) return;
  pod.result = { type: "draw" };
  pod.locked = true;
  recalculateStandings();
  renderRoundView(tournament.viewingRound);
  updateStandings();
  checkRoundEndAutoSave();
}

function editPodResult(roundNumber, podIndex) {
  const pod = getPod(roundNumber, podIndex);
  if (!pod || !pod.locked) return;
  pod.locked = false;
  recalculateStandings();
  renderRoundView(tournament.viewingRound);
  updateStandings();
}

function getPod(roundNumber, podIndex) {
  const round = tournament.rounds[roundNumber - 1];
  return round ? round.pods[podIndex] : null;
}

function findPlayer(playerId) {
  return tournament.players.find(p => p.id === playerId);
}

function describePodResult(pod, players) {
  if (pod.result.type === "draw") return "Draw recorded";
  return players.map(p => `${p.name}: ${pod.result.rankings[p.id]}`).join(" | ");
}

function isRoundComplete(roundNumber) {
  const round = tournament.rounds[roundNumber - 1];
  return !!round && round.pods.every(p => p.locked);
}

function isSafeToModifyPlayers() {
  return tournament.currentRound === 0 || isRoundComplete(tournament.currentRound);
}

function renderPlayerManagement() {
  const tbody = document.querySelector("#playerManagementTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  tournament.players.slice().sort((a,b) => a.name.localeCompare(b.name)).forEach(player => {
    const actions = player.status === "active" 
      ? `<button onclick="setPlayerStatus(${player.id}, 'dropped')">Drop</button>`
      : `<button onclick="setPlayerStatus(${player.id}, 'active')">Re-activate</button>`;
    tbody.innerHTML += `
      <tr>
        <td>${player.name}</td>
        <td>${getStatusLabel(player.status)}</td>
        <td><div class="player-action-row"><button onclick="editPlayerName(${player.id})">Edit</button>${actions}</div></td>
      </tr>`;
  });
}

function setPlayerStatus(id, status) {
  if (!isSafeToModifyPlayers()) return alert("Finish round first.");
  const p = findPlayer(id);
  if (p) p.status = status;
  recalculateStandings();
  updateStandings();
  renderPlayerManagement();
}

function editPlayerName(id) {
  if (!isSafeToModifyPlayers()) return alert("Finish round first.");
  const p = findPlayer(id);
  const n = prompt("New name:", p.name);
  if (n && n.trim()) {
    p.name = n.trim();
    recalculateStandings();
    updateStandings();
    renderPlayerManagement();
  }
}

function getStatusLabel(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function updateNextRoundButtonState() {
  const btn = document.getElementById("nextRoundButton");
  if (btn) btn.disabled = !(tournament.currentRound > 0 && isRoundComplete(tournament.currentRound) && tournament.currentRound < tournament.totalRounds);
}

function recalculateStandings() {
  tournament.players.forEach(p => {
    p.matchPoints = 0; p.matchesPlayed = 0; p.gameWins = 0; p.gameLosses = 0; p.gameDraws = 0; p.opponents = [];
  });
  tournament.rounds.forEach(r => {
    r.pods.forEach(pod => {
      if (!pod.locked) return;
      const podPlayers = pod.players.map(id => findPlayer(id));
      podPlayers.forEach(p => p.opponents.push(...pod.players.filter(id => id !== p.id)));
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

function calculateGwp(p) {
  const total = p.gameWins + p.gameLosses + p.gameDraws;
  return total === 0 ? 0 : (p.gameWins + 0.5 * p.gameDraws) / total;
}

function calculateOmw(p) {
  if (p.opponents.length === 0) return 0;
  return p.opponents.map(id => Math.max(calculateGwp(findPlayer(id)), MIN_OPPONENT_PERCENT)).reduce((a,b) => a + b, 0) / p.opponents.length;
}

function calculateOgw(p) {
  if (p.opponents.length === 0) return 0;
  return p.opponents.map(id => Math.max(calculateOmw(findPlayer(id)), MIN_OPPONENT_PERCENT)).reduce((a,b) => a + b, 0) / p.opponents.length;
}

function formatPercent(v) { return (v * 100).toFixed(1) + "%"; }

function openPrintWindow(title, html) {
  const win = window.open("", "_blank");
  if (!win) return alert("Popup blocked.");
  win.document.write(html);
  win.document.close();
  win.print();
}

function printRoster() {
  if (!tournament.players.length) return alert("No players.");
  const sorted = [...tournament.players].sort((a, b) => a.name.localeCompare(b.name));
  const html = `<html><head><style>table{width:100%;border-collapse:collapse} th,td{border:1px solid #ccc;padding:8px;text-align:left} th{background:#1e40af;color:white}</style></head>
    <body><h2>${tournament.name} Roster</h2><table><thead><tr><th>#</th><th>Name</th><th>Status</th></tr></thead>
    <tbody>${sorted.map((p, i) => `<tr><td>${i + 1}</td><td>${p.name}</td><td>${getStatusLabel(p.status)}</td></tr>`).join("")}</tbody></table></body></html>`;
  openPrintWindow("Roster", html);
}

function printRoundPairings(num) {
  const r = tournament.rounds[num - 1];
  if (!r) return;
  const list = [];
  r.pods.forEach((p, idx) => {
    const names = p.players.map(id => findPlayer(id).name);
    p.players.forEach(id => {
      const pName = findPlayer(id).name;
      list.push({ name: pName, pod: idx + 1, opps: names.filter(n => n !== pName).join(", ") });
    });
  });
  list.sort((a, b) => a.name.localeCompare(b.name));
  const html = `<html><head><style>table{width:100%;border-collapse:collapse} th,td{border:1px solid #ccc;padding:8px;text-align:left}</style></head>
    <body><h2>Round ${num} Pairings</h2><table><thead><tr><th>Player</th><th>Pod</th><th>Opponents</th></tr></thead>
    <tbody>${list.map(e => `<tr><td>${e.name}</td><td>${e.pod}</td><td>${e.opps}</td></tr>`).join("")}</tbody></table></body></html>`;
  openPrintWindow("Pairings", html);
}

function printRoundMatchSlips(num) {
  const r = tournament.rounds[num - 1];
  if (!r) return;
  let slips = "";
  r.pods.forEach((pod, idx) => {
    slips += `<div style="border:2px solid #000;padding:20px;margin-bottom:20px;page-break-inside:avoid;">
      <center><strong>${tournament.name} - Round ${num} - Pod ${idx + 1}</strong></center><br>
      ${pod.players.map(id => `<div><strong>${findPlayer(id).name}</strong>: [ ] 1st [ ] 2nd [ ] 3rd [ ] 4th [ ] TIE</div>`).join("<br>")}
    </div>`;
  });
  openPrintWindow("Match Slips", `<html><body>${slips}</body></html>`);
}

function printFinalStandings() {
  const sorted = [...tournament.players].sort((a,b) => b.matchPoints - a.matchPoints);
  const html = `<html><head><style>table{width:100%;border-collapse:collapse} th,td{border:1px solid #ccc;padding:8px;text-align:center}</style></head>
    <body><h2>Final Standings</h2><table><thead><tr><th>Rank</th><th>Name</th><th>Points</th></tr></thead>
    <tbody>${sorted.map((p, i) => `<tr><td>${i + 1}</td><td>${p.name}</td><td>${p.matchPoints}</td></tr>`).join("")}</tbody></table></body></html>`;
  openPrintWindow("Final Standings", html);
}

function confirmStartTournament() {
  if (tournament.players.length < 3) return alert("Need 3 players.");
  if (confirm("Start tournament?")) startRounds();
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

function checkRoundEndAutoSave() {
  if (isRoundComplete(tournament.currentRound)) {
    setTimeout(() => {
      if (confirm(`Round ${tournament.currentRound} complete! Save now?`)) saveTournament();
    }, 500);
  }
}

function saveTournamentState() {
  localStorage.setItem("tournamentState", JSON.stringify(tournament));
}

function importRoster() {
  const fileInput = document.getElementById("rosterFile");
  if (!fileInput.files.length) return alert("Select file.");
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      const names = Array.isArray(data) ? data.map(p => p.PlayerName || p.name) : [];
      if (names.length) {
        tournament.players = [];
        tournament.nextPlayerId = 1;
        names.forEach(n => {
          if (n) {
            tournament.players.push({ id: tournament.nextPlayerId++, name: n.trim(), status: "active", matchPoints: 0, matchesPlayed: 0, gameWins: 0, gameLosses: 0, gameDraws: 0, opponents: [] });
          }
        });
        renderPlayerList();
      }
    } catch (err) { alert("Error reading file."); }
  };
  reader.readAsText(fileInput.files[0]);
}

function importTournamentSave() {
  const fileInput = document.getElementById("saveFile");
  if (!fileInput.files.length) return alert("Select file.");
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      tournament = JSON.parse(e.target.result);
      if (tournament.currentRound > 0) {
        document.getElementById("setup").style.display = "none";
        document.getElementById("registration").style.display = "none";
        document.getElementById("tournament").style.display = "block";
        renderRoundTabs();
        renderRoundView(tournament.viewingRound);
        updateStandings();
        renderPlayerManagement();
      } else {
        renderPlayerList();
      }
    } catch (err) { alert("Error loading save."); }
  };
  reader.readAsText(fileInput.files[0]);
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

document.addEventListener("DOMContentLoaded", () => {
  window.createTournament = createTournament;
  window.addPlayer = addPlayer;
  window.editRegisteredPlayer = editRegisteredPlayer;
  window.deleteRegisteredPlayer = deleteRegisteredPlayer;
  window.startRounds = startRounds;
  window.nextRound = nextRound;
  window.openRound = openRound;
  window.reportPodRanking = reportPodRanking;
  window.reportPodDraw = reportPodDraw;
  window.editPodResult = editPodResult;
  window.editPlayerName = editPlayerName;
  window.setPlayerStatus = setPlayerStatus;
  window.printRoundPairings = printRoundPairings;
  window.printRoundMatchSlips = printRoundMatchSlips;
  window.printFinalStandings = printFinalStandings;
  window.printRoster = printRoster;
  window.confirmStartTournament = confirmStartTournament;
  window.importRoster = importRoster;
  window.saveTournament = saveTournament;
  window.importTournamentSave = importTournamentSave;
  window.openMainTab = openMainTab;
  window.handlePrintMenu = handlePrintMenu;
});
