// ===============================
// Candlelight Tournament Manager
// Clean Stable Core Engine
// ===============================

let tournament = {
  name: "",
  game: "",
  players: [],
  rounds: [],
  currentRound: 0,
  totalRounds: 3
};

let reportedPods = new Set();

// ===============================
// EVENT SETUP
// ===============================

function createTournament() {
  const nameInput = document.getElementById("tournamentName");
  const gameSelect = document.getElementById("gameSelect");
  const roundInput = document.getElementById("roundCount");

  if (!nameInput || !gameSelect || !roundInput) {
    alert("Missing setup fields in index.html.");
    return;
  }

  tournament.name = nameInput.value.trim();
  tournament.game = gameSelect.value;
  tournament.totalRounds = parseInt(roundInput.value);

  if (!tournament.name) {
    alert("Please enter a tournament name.");
    return;
  }

  document.getElementById("setup").style.display = "none";
  document.getElementById("registration").style.display = "block";
}

// ===============================
// PLAYER REGISTRATION
// ===============================

function addPlayer() {
  const input = document.getElementById("playerName");
  const name = input.value.trim();
  if (!name) return;

  tournament.players.push({
    name,
    matchPoints: 0,
    opponents: [],
    wins: 0,
    losses: 0,
    draws: 0
  });

  input.value = "";
  renderPlayerList();
}

function renderPlayerList() {
  const list = document.getElementById("playerList");
  list.innerHTML = "";

  tournament.players.forEach(p => {
    const li = document.createElement("li");
    li.textContent = p.name;
    list.appendChild(li);
  });
}

function startRounds() {
  if (tournament.players.length < 3) {
    alert("Minimum 3 players required.");
    return;
  }

  document.getElementById("registration").style.display = "none";
  document.getElementById("tournament").style.display = "block";

  generateNextRound();
}

// ===============================
// ROUND GENERATION
// ===============================

function generateNextRound() {
  if (tournament.currentRound >= tournament.totalRounds) {
    alert("All rounds completed.");
    return;
  }

  reportedPods.clear();

  tournament.currentRound++;

  const sorted = [...tournament.players].sort(
    (a, b) => b.matchPoints - a.matchPoints
  );

  const pods = createPods(sorted);

  tournament.rounds.push(pods);

  renderRound(pods);
  updateStandings();
}

function createPods(playerList) {
  const pods = [];
  let players = [...playerList];

  while (players.length > 0) {
    let podSize = 4;

    if (players.length === 5) podSize = 3;
    else if (players.length === 3) podSize = 3;
    else if (players.length === 2) podSize = 2;

    const podPlayers = players.splice(0, podSize);
    pods.push({
      players: podPlayers.map(p => p.name),
      reported: false
    });
  }

  return pods;
}

// ===============================
// ROUND DISPLAY
// ===============================

function renderRound(pods) {
  const container = document.getElementById("rounds");
  container.innerHTML = `<h2>Round ${tournament.currentRound}</h2>`;

  pods.forEach((pod, index) => {
    const div = document.createElement("div");
    div.className = "pod";

div.innerHTML = `
  <h3>Pod ${index + 1}</h3>

  <div class="player-grid">
    ${pod.players.map(name => `
      <div class="player-box">
        ${name}
      </div>
    `).join("")}
  </div>

  <input type="text" id="result-${index}" placeholder="Enter 4-digit result code">
  <button onclick="submitResult(${index})">Submit</button>
`;

    container.appendChild(div);
  });

  const nextBtn = document.createElement("button");
  nextBtn.textContent = "Generate Next Round";
  nextBtn.onclick = generateNextRound;
  container.appendChild(nextBtn);
}

// ===============================
// RESULT ENTRY
// ===============================

function submitResult(podIndex) {
  const input = document.getElementById(`result-${podIndex}`);
  const code = input.value.trim();

  const pod = tournament.rounds[tournament.currentRound - 1][podIndex];

  if (pod.reported) {
    alert("Pod already reported.");
    return;
  }

  const parsed = parseFastCodeForPod(pod, code);
  if (parsed.error) {
    alert(parsed.error);
    return;
  }

  if (parsed.draw) {
    applyDraw(pod);
  } else {
    applyResults(parsed.rankings);
  }

  pod.reported = true;
  updateStandings();
}

// ===============================
// FAST CODE PARSER
// ===============================

function parseFastCodeForPod(pod, codeDigits) {
  const playerCount = pod.players.length;

  if (!/^[0-4]{4}$/.test(codeDigits)) {
    return { error: "Use exactly 4 digits (0–4 only)." };
  }

  const ranks = codeDigits.split("").map(n => parseInt(n));

  if (ranks.slice(playerCount).some(r => r !== 0)) {
    return { error: "Unused positions must be 0." };
  }

  const active = ranks.slice(0, playerCount);

  if (active.every(r => r === 0)) {
    return { draw: true };
  }

  const set = new Set(active);

  if (set.size !== playerCount) {
    return { error: "Ranks must be unique." };
  }

  const expected = Array.from({ length: playerCount }, (_, i) => i + 1);
  if (!expected.every(v => set.has(v))) {
    return { error: "Ranks must be sequential from 1." };
  }

  const rankings = {};
  for (let i = 0; i < playerCount; i++) {
    rankings[pod.players[i]] = active[i];
  }

  return { rankings };
}

// ===============================
// SCORING
// ===============================

function applyDraw(pod) {
  pod.players.forEach(name => {
    const player = tournament.players.find(p => p.name === name);
    player.matchPoints += 3;
    player.draws++;
  });
}

function applyResults(rankings) {
  for (let name in rankings) {
    const rank = rankings[name];
    const player = tournament.players.find(p => p.name === name);

    if (tournament.game === "commander") {
      if (rank === 1) player.matchPoints += 5;
      else if (rank === rankings.length) player.matchPoints += 1;
      else player.matchPoints += 3;
    } else {
      if (rank === 1) player.matchPoints += 3;
      else if (rank === rankings.length) player.matchPoints += 0;
      else player.matchPoints += 1;
    }
  }
}

// ===============================
// STANDINGS
// ===============================

function updateStandings() {
  const container = document.getElementById("standings");
  container.innerHTML = "<h2>Standings</h2>";

  const sorted = [...tournament.players].sort(
    (a, b) => b.matchPoints - a.matchPoints
  );

  sorted.forEach((p, index) => {
    const div = document.createElement("div");
    div.textContent = `${index + 1}. ${p.name} — ${p.matchPoints} pts`;
    container.appendChild(div);
  });
}
