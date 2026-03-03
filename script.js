let tournament = {
  gameMode: "",
  totalRounds: 0,
  currentRound: 0,
  players: [],
  pods: [],
  roundComplete: false
};

function createTournament() {
  tournament.gameMode = document.getElementById("gameMode").value;
  tournament.totalRounds = parseInt(document.getElementById("roundCount").value);
  tournament.currentRound = 0;

  document.getElementById("setup").style.display = "none";
  document.getElementById("registration").style.display = "block";
}

function addPlayer() {
  const input = document.getElementById("playerName");
  const name = input.value.trim();

  if (!name) return;

  tournament.players.push({
    id: tournament.players.length,
    name: name,
    matchPoints: 0,
    opponents: [],
    gameWins: 0,
    gameLosses: 0
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
  document.getElementById("registration").style.display = "none";
  document.getElementById("tournament").style.display = "block";
  nextRound();
}

function nextRound() {
  if (tournament.currentRound >= tournament.totalRounds) {
    alert("Tournament complete.");
    return;
  }

  tournament.currentRound++;
  tournament.roundComplete = false;

  generatePods();
  renderPods();
  updateStandings();
}

function generatePods() {
  const sorted = [...tournament.players].sort((a, b) => b.matchPoints - a.matchPoints);
  tournament.pods = [];

  let remaining = [...sorted];

  while (remaining.length > 0) {
    if (remaining.length === 3) {
      tournament.pods.push(remaining.splice(0, 3));
    } else if (remaining.length === 5) {
      tournament.pods.push(remaining.splice(0, 4));
    } else {
      tournament.pods.push(remaining.splice(0, 4));
    }
  }
}

function renderPods() {
  const section = document.getElementById("pairings");
  section.innerHTML = `<h2>Round ${tournament.currentRound}</h2>`;

  tournament.pods.forEach((pod, index) => {
    section.innerHTML += `<h3>Pod ${index + 1}</h3>`;

    pod.forEach(player => {
      section.innerHTML += `
        <div>
          ${player.name}
          <button onclick="reportWin(${index}, ${player.id})">Win</button>
        </div>
      `;
    });

    section.innerHTML += `
      <button onclick="reportDraw(${index})">All Draw</button>
      <hr>
    `;
  });

  section.innerHTML += `
    <button onclick="nextRound()">Generate Next Round</button>
  `;
}

function reportWin(podIndex, winnerId) {
  if (tournament.roundComplete) return;

  const pod = tournament.pods[podIndex];
  const winner = pod.find(p => p.id === winnerId);

  if (tournament.gameMode === "MTG Commander") {
    pod.forEach(player => {
      if (player.id === winnerId) {
        player.matchPoints += 5;
      } else {
        player.matchPoints += 3;
      }
    });
  } else {
    pod.forEach(player => {
      if (player.id === winnerId) {
        player.matchPoints += 3;
      }
    });
  }

  lockPod(podIndex);
}

function reportDraw(podIndex) {
  if (tournament.roundComplete) return;

  const pod = tournament.pods[podIndex];

  pod.forEach(player => {
    player.matchPoints += 3;
  });

  lockPod(podIndex);
}

function lockPod(podIndex) {
  const buttons = document.querySelectorAll(`button`);
  buttons.forEach(btn => btn.disabled = true);

  tournament.roundComplete = true;
  updateStandings();
}

function updateStandings() {
  const tbody = document.querySelector("#standingsTable tbody");
  tbody.innerHTML = "";

  const sorted = [...tournament.players].sort((a, b) => b.matchPoints - a.matchPoints);

  sorted.forEach(player => {
    tbody.innerHTML += `
      <tr>
        <td>${player.name}</td>
        <td>${player.matchPoints}</td>
        <td>0%</td>
        <td>0%</td>
        <td>0%</td>
      </tr>
    `;
  });
}
