let tournament = {
  gameMode: null,
  totalRounds: 0,
  currentRound: 0,
  players: []
};

function createEvent() {
  const roundInput = document.getElementById("roundCount").value;

  if (!roundInput || roundInput < 1) {
    alert("Please enter a valid number of rounds.");
    return;
  }

  tournament.gameMode = document.getElementById("gameMode").value;
  tournament.totalRounds = parseInt(roundInput);

  document.getElementById("setup").style.display = "none";
  document.getElementById("playerSection").style.display = "block";
}

function addPlayer() {
  const nameInput = document.getElementById("playerName");
  const name = nameInput.value.trim();

  if (!name) return;

  const player = {
    id: Date.now(),
    name: name,
    matchPoints: 0,
    matchesPlayed: 0,
    gameWins: 0,
    gameLosses: 0,
    gameTies: 0,
    opponents: []
  };

  tournament.players.push(player);

  updatePlayerList();
  nameInput.value = "";
}

function updatePlayerList() {
  const list = document.getElementById("playerList");
  list.innerHTML = "";

  tournament.players.forEach(player => {
    const li = document.createElement("li");
    li.textContent = player.name;
    list.appendChild(li);
  });
}

function beginTournament() {
  if (tournament.players.length < 3) {
    alert("At least 3 players are required.");
    return;
  }

  document.getElementById("playerSection").style.display = "none";
  document.getElementById("standingsSection").style.display = "block";

  tournament.currentRound = 1;
  generatePairings();
  updateStandings();
}
function generatePairings() {
  const pairingSection = document.getElementById("pairings");
  pairingSection.innerHTML = `<h2>Round ${tournament.currentRound} Pairings</h2>`;

  // Sort by match points
  const sorted = [...tournament.players].sort((a, b) => b.matchPoints - a.matchPoints);

  for (let i = 0; i < sorted.length; i += 2) {
    if (!sorted[i + 1]) {
      pairingSection.innerHTML += `<p>${sorted[i].name} receives a bye.</p>`;
      sorted[i].matchPoints += 3;
      sorted[i].matchesPlayed += 1;
      continue;
    }

    pairingSection.innerHTML += `
      <div>
        ${sorted[i].name} vs ${sorted[i+1].name}
        <button onclick="recordWin(${sorted[i].id}, ${sorted[i+1].id})">Win</button>
        <button onclick="recordWin(${sorted[i+1].id}, ${sorted[i].id})">Win</button>
        <button onclick="recordDraw(${sorted[i].id}, ${sorted[i+1].id})">Draw</button>
      </div>
    `;
  }
}

function recordWin(winnerId, loserId) {
  const winner = tournament.players.find(p => p.id === winnerId);
  const loser = tournament.players.find(p => p.id === loserId);

  winner.matchPoints += 3;
  winner.matchesPlayed += 1;
  loser.matchesPlayed += 1;

  winner.opponents.push(loserId);
  loser.opponents.push(winnerId);

  updateStandings();
}

function recordDraw(id1, id2) {
  const p1 = tournament.players.find(p => p.id === id1);
  const p2 = tournament.players.find(p => p.id === id2);

  p1.matchPoints += 1;
  p2.matchPoints += 1;

  p1.matchesPlayed += 1;
  p2.matchesPlayed += 1;

  p1.opponents.push(id2);
  p2.opponents.push(id1);

  updateStandings();
}
