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
  if (!updatedName || !updatedName.trim()) return;

  const trimmedName = updatedName.trim();
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
    alert("Unable to make valid pods with active player count.");
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
      pods.push(shuffled.slice(cursor, cursor + size).map(player => player.id));
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
        .map((_, optionIndex) => `<option value="${optionIndex + 1}">${optionIndex + 1}</option>`)
        .join("");

      const isDropped = player.status !== "active";
      const nameStyle = isDropped ? 'style="text-decoration: line-through; color: #999;"' : '';

      return `
        <tr>
          <td ${nameStyle}>${player.name} ${isDropped ? '(' + getStatusLabel(player.status) + ')' : ''}</td>
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
        <p class="pod-status" id="status-${round.number}-${podIndex}">${pod.locked ? describePodResult(pod, playerObjects) : "Pending"}</p>
      </div>
    `;

    playerObjects.forEach((player, playerIndex) => {
      const defaultRank = pod.result?.type === "ranking" ? pod.result.rankings[player.id] : (playerIndex + 1);
      document.getElementById(`rank-${round.number}-${podIndex}-${player.id}`).value = String(defaultRank);
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

  // Handle the standalone print standings button visibility
  const printStandingsButton = document.getElementById("printStandingsButton");
  if (printStandingsButton) {
    printStandingsButton.style.display = (isLastRound && isComplete) ? "inline-block" : "none";
  }
}

function finishTournament() {
  if (confirm("Round complete! Would you like to save the final data and print standings?")) {
    saveTournament();
    printFinalStandings();
  }
}

function setPlayerStatus(playerId, newStatus) {
  const player = findPlayer(playerId);
  if (!player) return;

  player.status = newStatus;

  // Ensure minimum active players
  const activeCount = tournament.players.filter(p => p.status === "active").length;
  if (activeCount < 3 && tournament.currentRound < tournament.totalRounds) {
    player.status = "active";
    alert("You need at least 3 active players to continue the tournament.");
    return;
  }

  recalculateStandings();
  updateStandings();
  renderPlayerManagement();
  
  // Update view to show strike-throughs
  if (tournament.viewingRound > 0) {
    renderRoundView(tournament.viewingRound);
  }
}

function editPlayerName(playerId) {
  const player = findPlayer(playerId);
  if (!player) return;

  const updatedName = prompt("Enter new player name:", player.name);
  if (!updatedName || !updatedName.trim()) return;

  const trimmedName = updatedName.trim();
  const duplicate = tournament.players.some(
    other => other.id !== player.id && other.name.toLowerCase() === trimmedName.toLowerCase()
  );
  if (duplicate) {
    alert("Another player already has that name.");
    return;
  }

  player.name = trimmedName;
  renderPlayerManagement();
  updateStandings();
  if (tournament.viewingRound > 0) renderRoundView(tournament.viewingRound);
}

// --- Preservation of Match Slip & Fast Code Logic ---

function applyTournamentFastCodes() {
  const input = document.getElementById("tournamentFastCode");
  const raw = input?.value.trim();
  if (!raw) return;

  const entries = raw.split(/[\s,;]+/).filter(Boolean);
  for (const entry of entries) {
    const digits = entry.replace(/\D/g, "");
    if (digits.length !== 6) continue;

    const roundNum = parseInt(digits[0], 10);
    const podNum = parseInt(digits[1], 10);
    const placements = digits.slice(2);

    const round = tournament.rounds[roundNum - 1];
    if (!round) continue;

    const podIndex = podNum - 1;
    const pod = round.pods[podIndex];
    if (!pod || pod.locked) continue;

    const parsed = parseFastCodeForPod(pod, placements);
    if (parsed.error) {
      alert(`Error in code ${entry}: ${parsed.error}`);
      continue;
    }

    if (parsed.draw) {
      applyPodDraw(roundNum, podIndex);
    } else {
      applyPodRankingResult(roundNum, podIndex, parsed.rankings);
    }
  }
  input.value = "";
}

function parseFastCodeForPod(pod, codeDigits) {
  if (codeDigits === "0000") return { draw: true };
  const playerCount = pod.players.length;
  const ranks = codeDigits.split("").map(d => parseInt(d, 10)).slice(0, playerCount);

  if (ranks.includes(0)) return { error: "Active players cannot have rank 0." };
  
  const uniqueRanks = new Set(ranks);
  if (uniqueRanks.size !== playerCount) return { error: "Duplicate ranks found." };

  const rankings = {};
  for (let i = 0; i < playerCount; i++) {
    rankings[pod.players[i]] = ranks[i];
  }
  return { rankings };
}

function applyPodRankingResult(roundNumber, podIndex, rankings) {
  const pod = getPod(roundNumber, podIndex);
  if (!pod) return;
  pod.result = { type: "ranking", rankings };
  pod.locked = true;
  recalculateStandings();
  renderRoundView(tournament.viewingRound);
  updateStandings();
  checkRoundEndAutoSave();
}

function reportPodDraw(roundNumber, podIndex) {
  applyPodDraw(roundNumber, podIndex);
}

function applyPodDraw(roundNumber, podIndex) {
  const pod = getPod(roundNumber, podIndex);
  if (!pod) return;
  pod.result = { type: "draw" };
  pod.locked = true;
  recalculateStandings();
  renderRoundView(tournament.viewingRound);
  updateStandings();
  checkRoundEndAutoSave();
}

// --- Core Helper Functions ---

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
        if (player.opponents.includes(pod[j])) repeats += 1;
      }
    }
  });
  return repeats;
}

function recalculateStandings() {
  tournament.players.forEach(p => {
    p.matchPoints = 0; p.matchesPlayed = 0; p.gameWins = 0;
    p.gameLosses = 0; p.gameDraws = 0; p.opponents = [];
  });

  tournament.rounds.forEach(round => {
    round.pods.forEach(pod => {
      if (!pod.locked || !pod.result) return;
      const podPlayers = pod.players.map(id => findPlayer(id));
      applyOpponentTracking(podPlayers);

      if (pod.result.type === "draw") {
        podPlayers.forEach(p => { p.matchPoints += 3; p.matchesPlayed += 1; p.gameDraws += 1; });
      } else {
        const maxRank = podPlayers.length;
        podPlayers.forEach(p => {
          p.matchesPlayed += 1;
          const rank = pod.result.rankings[p.id];
          if (rank === 1) { p.matchPoints += 5; p.gameWins += 1; }
          else if (rank === maxRank) { p.matchPoints += 1; p.gameLosses += 1; }
          else { p.matchPoints += 3; p.gameDraws += 1; }
        });
      }
    });
  });
}

function applyOpponentTracking(playersInPod) {
  playersInPod.forEach(player => {
    const ids = playersInPod.filter(o => o.id !== player.id).map(o => o.id);
    player.opponents.push(...ids);
  });
}

function updateStandings() {
  const tbody = document.querySelector("#standingsTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const sorted = [...tournament.players].sort((a, b) => {
    if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
    return calculateOmw(b) - calculateOmw(a) || calculateGwp(b) - calculateGwp(a);
  });

  sorted.forEach(player => {
    tbody.innerHTML += `
      <tr>
        <td>${player.name}</td>
        <td>${getStatusLabel(player.status)}</td>
        <td>${player.matchPoints}</td>
        <td>${formatPercent(calculateOmw(player))}</td>
        <td>${formatPercent(calculateGwp(player))}</td>
        <td>${formatPercent(calculateOgw(player))}</td>
      </tr>`;
  });
  updateNextRoundButtonState();
}

// --- Printing & UI ---

function printRoundMatchSlips(roundNumber) {
  const round = tournament.rounds.find(r => r.number === roundNumber);
  if (!round) return;

  const orderedPods = [];
  const half = Math.ceil(round.pods.length / 2);
  for (let i = 0; i < half; i++) {
    orderedPods.push({ pod: round.pods[i], index: i });
    if (round.pods[i + half]) orderedPods.push({ pod: round.pods[i + half], index: i + half });
  }

  let slipsHTML = orderedPods.map(item => buildSlipHTML(item.pod, item.index, round)).join("");
  const html = `<html><head><style>
    body { font-family: sans-serif; margin: 0; }
    .match-slip { height: 48vh; border-bottom: 2px dashed #000; padding: 20px; box-sizing: border-box; }
    .player-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
    .player-box { border: 1px solid #000; padding: 10px; min-height: 100px; }
    .ranking-line span { border: 1px solid #000; padding: 2px 6px; margin-left: 5px; }
    @media print { .print-page { page-break-after: always; } }
  </style></head><body>${slipsHTML}</body></html>`;

  openPrintWindow(`Round ${roundNumber} Slips`, html);
}

function buildSlipHTML(pod, podIndex, round) {
  const playerBoxes = [0, 1, 2, 3].map(i => {
    const p = tournament.players.find(pl => pl.id === pod.players[i]);
    const name = p ? p.name : "—";
    const pts = p ? `(${p.matchPoints})` : "";
    return `
      <div class="player-box">
        <strong>Player ${i + 1}:</strong> ${name} ${pts}
        <div class="ranking-line" style="margin-top:10px">Rank: <span>1</span><span>2</span><span>3</span><span>4</span></div>
        <div style="margin-top:15px; font-size: 10px;">Sign: _________________</div>
      </div>`;
  }).join("");

  return `
    <div class="match-slip">
      <div style="text-align:center"><strong>${tournament.name}</strong> - Round ${round.number} - Pod ${podIndex + 1}</div>
      <div class="player-grid">${playerBoxes}</div>
    </div>`;
}

function saveTournament() {
  const data = JSON.stringify(tournament);
  const blob = new Blob([data], { type: "application/json" });
  const safeName = (tournament.name || "tournament").replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const fileName = `${safeName}-round-${tournament.currentRound}.json`;
  
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
}

function checkRoundEndAutoSave() {
  if (isRoundComplete(tournament.currentRound)) {
    setTimeout(() => {
      if (confirm(`Round ${tournament.currentRound} complete. Save now?`)) saveTournament();
    }, 500);
  }
}

// --- Standard Boilerplate ---

function findPlayer(id) { return tournament.players.find(p => p.id === id); }
function getPod(r, i) { return tournament.rounds[r - 1]?.pods[i]; }
function isRoundComplete(r) { return tournament.rounds[r - 1]?.pods.every(p => p.locked); }
function getStatusLabel(s) { return s === "active" ? "Active" : s.charAt(0).toUpperCase() + s.slice(1); }
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

function openPrintWindow(title, html) {
  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 500);
}

document.addEventListener("DOMContentLoaded", () => {
  // Bind all functions to window for HTML access
  Object.assign(window, {
    createTournament, addPlayer, editRegisteredPlayer, deleteRegisteredPlayer,
    startRounds, nextRound, reportPodRanking, reportPodDraw, editPodResult,
    setPlayerStatus, editPlayerName, applyTournamentFastCodes, printRoundMatchSlips,
    printRoundPairings, printFinalStandings, saveTournament
  });
});
