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

  updateStandings();
}

function updateStandings() {
  const tbody = document.querySelector("#standingsTable tbody");
  tbody.innerHTML = "";

  tournament.players
    .sort((a, b) => b.matchPoints - a.matchPoints)
    .forEach(player => {

      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${player.name}</td>
        <td>${player.matchPoints}</td>
        <td>0%</td>
        <td>0%</td>
        <td>0%</td>
      `;

      tbody.appendChild(row);
    });
}
