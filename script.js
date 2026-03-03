let tournament = {
  gameMode: "",
  totalRounds: 0,
  currentRound: 0,
  viewingRound: 0,
  players: [],
  rounds: []
};

const MIN_OPPONENT_PERCENT = 0.33;

function createTournament() {
  const roundCount = parseInt(document.getElementById("roundCount").value, 10);
  if (!roundCount || roundCount < 1) {
    alert("Please enter a valid number of rounds.");
    return;
  }

  tournament = {
    gameMode: document.getElementById("gameMode").value,
    totalRounds: roundCount,
    currentRound: 0,
    viewingRound: 0,
    players: [],
    rounds: []
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
    id: tournament.players.length,
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
  list.innerHTML = "";
  tournament.players.forEach(player => {
    list.innerHTML += `<li>${player.name}</li>`;
  });
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
  if (podPlayerIds.length === 0) {
    return;
  }

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

function buildPods() {
  const sortedPlayers = [...tournament.players]
    .filter(player => player.status === "active")
    .sort((a, b) => b.matchPoints - a.matchPoints);

  const podSizes = getPodSizes(sortedPlayers.length);
  if (!podSizes) {
    alert("Unable to make only 3-4 player pods with active player count.");
    return [];
  }

  const pods = [];
  let cursor = 0;
  podSizes.forEach(size => {
    pods.push(sortedPlayers.slice(cursor, cursor + size).map(player => player.id));
    cursor += size;
  });

  return pods;
}

function getPodSizes(playerCount) {
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
        .map((_, optionIndex) => {
          const rankValue = optionIndex + 1;
          return `<option value="${rankValue}">${rankValue}</option>`;
        })
        .join("");

      const savedRank = pod.result?.type === "ranking"
        ? pod.result.rankings[player.id]
        : (playerIndex + 1);

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
          <thead>
            <tr>
              <th>Player</th>
              <th>Rank</th>
            </tr>
          </thead>
          <tbody>
            ${rankingRows}
          </tbody>
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
      const defaultRank = pod.result?.type === "ranking"
        ? pod.result.rankings[player.id]
        : (playerIndex + 1);
      document.getElementById(`rank-${round.number}-${podIndex}-${player.id}`).value = String(defaultRank);
    });
  });

  updateNextRoundButtonState();
}

function renderRoundControls(round) {
  const controls = document.getElementById("roundControls");
  controls.innerHTML = `
    <button onclick="printRoundPairings(${round.number})">Print Pairings (First Name A-Z)</button>
    <button onclick="printRoundMatchSlips(${round.number})">Print Match Slips</button>
  `;
}

function reportPodRanking(roundNumber, podIndex) {
  const pod = getPod(roundNumber, podIndex);
  if (!pod || pod.locked) return;

  const rankings = {};
  const usedRanks = new Set();

  for (const playerId of pod.players) {
    const selectedRank = parseInt(
      document.getElementById(`rank-${roundNumber}-${podIndex}-${playerId}`).value,
      10
    );

    if (usedRanks.has(selectedRank)) {
      alert("Each player must have a unique rank. Use All Draw for tied games.");
      return;
    }

    usedRanks.add(selectedRank);
    rankings[playerId] = selectedRank;
  }

  const expectedRanks = Array.from({ length: pod.players.length }, (_, i) => i + 1);
  const sortedChosenRanks = [...usedRanks].sort((a, b) => a - b);

  if (expectedRanks.some((rank, i) => rank !== sortedChosenRanks[i])) {
    alert("Ranks must be sequential starting at 1.");
    return;
  }

  pod.result = {
    type: "ranking",
    rankings
  };
  pod.locked = true;

  recalculateStandings();
  renderRoundView(tournament.viewingRound);
  updateStandings();
}

function reportPodDraw(roundNumber, podIndex) {
  const pod = getPod(roundNumber, podIndex);
  if (!pod || pod.locked) return;

  pod.result = { type: "draw" };
  pod.locked = true;

  recalculateStandings();
  renderRoundView(tournament.viewingRound);
  updateStandings();
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
  if (!round) return null;
  return round.pods[podIndex] || null;
}

function findPlayer(playerId) {
  return tournament.players.find(player => player.id === playerId);
}

function describePodResult(pod, playersInPod) {
  if (!pod.locked || !pod.result) return "Pending";
  if (pod.result.type === "draw") return "Draw recorded";
  if (pod.result.type === "ranking") {
    return playersInPod
      .map(player => `${player.name}: ${pod.result.rankings[player.id]}`)
      .join(" | ");
  }

  return "Pending";
}

function isRoundComplete(roundNumber) {
  const round = tournament.rounds[roundNumber - 1];
  return !!round && round.pods.every(pod => pod.locked && pod.result);
}

function isSafeToModifyPlayers() {
  if (tournament.currentRound === 0) return true;
  return isRoundComplete(tournament.currentRound);
}

function renderPlayerManagement() {
  const tbody = document.querySelector("#playerManagementTable tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  tournament.players
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(player => {
      const statusLabel = getStatusLabel(player.status);
      const statusActions = player.status === "active"
        ? `
          <button onclick="setPlayerStatus(${player.id}, 'dropped')">Drop</button>
          <button onclick="setPlayerStatus(${player.id}, 'eliminated')">Eliminate</button>
        `
        : `<button onclick="setPlayerStatus(${player.id}, 'active')">Re-activate</button>`;

      tbody.innerHTML += `
        <tr>
          <td>${player.name}</td>
          <td>${statusLabel}</td>
          <td>
            <div class="player-action-row">
              <button onclick="editPlayerName(${player.id})">Edit Name</button>
              ${statusActions}
            </div>
          </td>
        </tr>
      `;
    });
}

function setPlayerStatus(playerId, newStatus) {
  if (!isSafeToModifyPlayers()) {
    alert("Finish the current round before changing player status.");
    return;
  }

  const player = findPlayer(playerId);
  if (!player) return;

  player.status = newStatus;

  const activeCount = tournament.players.filter(p => p.status === "active").length;
  if (activeCount < 3 && tournament.currentRound < tournament.totalRounds) {
    player.status = "active";
    alert("You need at least 3 active players to continue.");
    return;
  }

  recalculateStandings();
  updateStandings();
  renderPlayerManagement();
}

function editPlayerName(playerId) {
  if (!isSafeToModifyPlayers()) {
    alert("Finish the current round before editing names.");
    return;
  }

  const player = findPlayer(playerId);
  if (!player) return;

  const updatedName = prompt("Enter new player name:", player.name);
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
  renderPlayerManagement();
  renderRoundTabs();
  if (tournament.viewingRound > 0) {
    renderRoundView(tournament.viewingRound);
  }
  updateStandings();
}

function getStatusLabel(status) {
  if (status === "dropped") return "Dropped";
  if (status === "eliminated") return "Eliminated";
  return "Active";
}

function updateNextRoundButtonState() {
  const button = document.getElementById("nextRoundButton");
  if (!button) return;

  const completeCurrent = tournament.currentRound > 0 && isRoundComplete(tournament.currentRound);
  const hasMoreRounds = tournament.currentRound < tournament.totalRounds;
  button.disabled = !(completeCurrent && hasMoreRounds);

  const printStandingsButton = document.getElementById("printStandingsButton");
  const tournamentComplete = tournament.currentRound === tournament.totalRounds && completeCurrent;
  printStandingsButton.style.display = tournamentComplete ? "inline-block" : "none";
}

function recalculateStandings() {
  tournament.players.forEach(player => {
    player.matchPoints = 0;
    player.matchesPlayed = 0;
    player.gameWins = 0;
    player.gameLosses = 0;
    player.gameDraws = 0;
    player.opponents = [];
  });

  tournament.rounds.forEach(round => {
    round.pods.forEach(pod => {
      if (!pod.locked || !pod.result) return;

      const podPlayers = pod.players.map(id => findPlayer(id));
      applyOpponentTracking(podPlayers);

      if (pod.result.type === "draw") {
        podPlayers.forEach(player => {
          player.matchPoints += 3;
          player.matchesPlayed += 1;
          player.gameDraws += 1;
        });
        return;
      }

      if (pod.result.type === "ranking") {
        const maxRank = podPlayers.length;

        podPlayers.forEach(player => {
          player.matchesPlayed += 1;
          const playerRank = pod.result.rankings[player.id];

          if (playerRank === 1) {
            player.matchPoints += 5;
            player.gameWins += 1;
          } else if (playerRank === maxRank) {
            player.matchPoints += 1;
            player.gameLosses += 1;
          } else {
            player.matchPoints += 3;
            player.gameDraws += 1;
          }
        });
      }
    });
  });
}

function applyOpponentTracking(playersInPod) {
  playersInPod.forEach(player => {
    const opponentIds = playersInPod
      .filter(opponent => opponent.id !== player.id)
      .map(opponent => opponent.id);
    player.opponents.push(...opponentIds);
  });
}

function updateStandings() {
  const tbody = document.querySelector("#standingsTable tbody");
  tbody.innerHTML = "";

  const sorted = [...tournament.players].sort((a, b) => b.matchPoints - a.matchPoints);
  sorted.forEach(player => {
    tbody.innerHTML += `
      <tr>
        <td>${player.name}</td>
        <td>${getStatusLabel(player.status)}</td>
        <td>${player.matchPoints}</td>
        <td>${formatPercent(calculateOmw(player))}</td>
        <td>${formatPercent(calculateGwp(player))}</td>
        <td>${formatPercent(calculateOgw(player))}</td>
      </tr>
    `;
  });

  updateNextRoundButtonState();
}

function calculateGwp(player) {
  const totalGames = player.gameWins + player.gameLosses + player.gameDraws;
  if (totalGames === 0) return 0;
  return (player.gameWins + (0.5 * player.gameDraws)) / totalGames;
}

function calculateOmw(player) {
  if (player.opponents.length === 0) return 0;
  const opponentPercentages = player.opponents.map(opponentId => {
    const opponent = findPlayer(opponentId);
    if (!opponent) return 0;
    return Math.max(calculateGwp(opponent), MIN_OPPONENT_PERCENT);
  });
  return average(opponentPercentages);
}

function calculateOgw(player) {
  if (player.opponents.length === 0) return 0;
  const opponentOmw = player.opponents.map(opponentId => {
    const opponent = findPlayer(opponentId);
    if (!opponent) return 0;
    return Math.max(calculateOmw(opponent), MIN_OPPONENT_PERCENT);
  });
  return average(opponentOmw);
}

function average(values) {
  if (values.length === 0) return 0;
  const sum = values.reduce((current, value) => current + value, 0);
  return sum / values.length;
}

function formatPercent(decimalValue) {
  return `${(decimalValue * 100).toFixed(1)}%`;
}

function openPrintWindow(documentTitle, html) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Popup blocked. Please allow popups for this site to print documents.");
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function printRoundPairings(roundNumber) {
  const round = tournament.rounds[roundNumber - 1];
  if (!round) return;

  const pairings = [];
  round.pods.forEach((pod, podIndex) => {
    const playerNames = pod.players.map(id => findPlayer(id).name);
    pod.players.forEach(playerId => {
      const player = findPlayer(playerId);
      const opponents = playerNames.filter(name => name !== player.name).join(", ");
      pairings.push({
        firstName: player.name.split(" ")[0].toLowerCase(),
        name: player.name,
        pod: podIndex + 1,
        opponents
      });
    });
  });

  pairings.sort((a, b) => a.firstName.localeCompare(b.firstName) || a.name.localeCompare(b.name));

  const html = `
    <html><head><title>Round ${round.number} Pairings</title>
    <style>body{font-family:Arial;padding:20px} table{border-collapse:collapse;width:100%} th,td{border:1px solid #ccc;padding:8px;text-align:left}</style>
    </head><body>
    <h2>Round ${round.number} Pairings (First Name A-Z)</h2>
    <table>
      <thead><tr><th>Player</th><th>Pod</th><th>Opponents</th></tr></thead>
      <tbody>
        ${pairings.map(entry => `<tr><td>${entry.name}</td><td>${entry.pod}</td><td>${entry.opponents}</td></tr>`).join("")}
      </tbody>
    </table>
    </body></html>
  `;

  openPrintWindow(`Round ${round.number} Pairings`, html);
}

function printRoundMatchSlips(roundNumber) {
  const round = tournament.rounds[roundNumber - 1];
  if (!round) return;

  const slips = round.pods.map((pod, index) => {
    const players = pod.players.map(id => findPlayer(id).name);
    const rankingHeader = Array.from({ length: pod.players.length }, (_, i) => `<th>${i + 1}</th>`).join("");
    const rankingRows = players.map(playerName => `
      <tr>
        <td>${playerName}</td>
        ${Array.from({ length: pod.players.length }, () => "<td>○</td>").join("")}
      </tr>
    `).join("");

    const signatureRows = players.map(playerName => `
      <tr>
        <td>${playerName}</td>
        <td>____________________________</td>
      </tr>
    `).join("");

    return `
      <div class="slip">
        <h3>Round ${round.number} - Pod ${index + 1}</h3>
        <table class="slip-table">
          <thead>
            <tr>
              <th>Player</th>
              ${rankingHeader}
            </tr>
          </thead>
          <tbody>
            ${rankingRows}
          </tbody>
        </table>
        <p><strong>Tie:</strong> ○</p>

        <h4>Player Signatures</h4>
        <table class="sig-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Signature</th>
            </tr>
          </thead>
          <tbody>
            ${signatureRows}
          </tbody>
        </table>
      </div>
    `;
  }).join("");

  const html = `
    <html><head><title>Round ${round.number} Match Slips</title>
    <style>
      body{font-family:Arial;padding:20px}
      .slip{border:1px solid #333;padding:12px;margin-bottom:14px;page-break-inside:avoid}
      table{width:100%;border-collapse:collapse;margin-top:8px}
      th,td{border:1px solid #aaa;padding:6px;text-align:center}
      h4{margin-bottom:4px}
    </style>
    </head><body>
    <h2>Round ${round.number} Match Slips</h2>
    ${slips}
    </body></html>
  `;

  openPrintWindow(`Round ${round.number} Match Slips`, html);
}

function printFinalStandings() {
  recalculateStandings();
  const sorted = [...tournament.players].sort((a, b) => b.matchPoints - a.matchPoints);

  const html = `
    <html><head><title>Final Standings</title>
    <style>body{font-family:Arial;padding:20px} table{border-collapse:collapse;width:100%} th,td{border:1px solid #ccc;padding:8px;text-align:center}</style>
    </head><body>
    <h2>Final Standings</h2>
    <table>
      <thead><tr><th>Rank</th><th>Name</th><th>Status</th><th>Match Points</th><th>OMW%</th><th>${tournament.gameMode === "Twin Suns" ? "TGW%" : "GW%"}</th><th>OGW%</th></tr></thead>
      <tbody>
        ${sorted.map((player, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${player.name}</td>
            <td>${getStatusLabel(player.status)}</td>
            <td>${player.matchPoints}</td>
            <td>${formatPercent(calculateOmw(player))}</td>
            <td>${formatPercent(calculateGwp(player))}</td>
            <td>${formatPercent(calculateOgw(player))}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    </body></html>
  `;

  openPrintWindow("Final Standings", html);
}

window.createTournament = createTournament;
window.addPlayer = addPlayer;
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
