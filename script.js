let tournament = null;

function createTournament() {
  const name = document.getElementById("tournamentName").value.trim();
  const game = document.getElementById("gameSelect").value;
  const rounds = parseInt(document.getElementById("roundCount").value);

  if (!name) {
    alert("Enter a tournament name.");
    return;
  }

  tournament = {
    name,
    game,
    totalRounds: rounds,
    currentRound: 0,
    players: [],
    rounds: []
  };

  document.getElementById("setup").style.display = "none";
  document.getElementById("registration").style.display = "block";
}

function addPlayer() {
  const input = document.getElementById("playerName");
  const name = input.value.trim();
  if (!name) return;

  tournament.players.push({
    name,
    points: 0,
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
  tournament.players.forEach(p => {
    const li = document.createElement("li");
    li.textContent = p.name;
    list.appendChild(li);
  });
}

function startTournament() {
  if (tournament.players.length < 2) {
    alert("Need at least 2 players.");
    return;
  }

  document.getElementById("registration").style.display = "none";
  document.getElementById("tournament").style.display = "block";
  generateNextRound();
}

function generateNextRound() {
  if (tournament.currentRound >= tournament.totalRounds) return;

  tournament.currentRound++;
  document.getElementById("roundHeader").textContent =
    `Round ${tournament.currentRound}`;

  const shuffled = [...tournament.players].sort(() => Math.random() - 0.5);
  const pods = [];

  while (shuffled.length > 0) {
    pods.push(shuffled.splice(0, 4));
  }

  tournament.rounds.push(pods);
  renderPods(pods);

  document.getElementById("nextRoundBtn").disabled = true;
}

function renderPods(pods) {
  const container = document.getElementById("pairings");
  container.innerHTML = "";

  pods.forEach((pod, podIndex) => {
    const div = document.createElement("div");
    div.className = "pod";

    const title = document.createElement("h3");
    title.textContent = `Pod ${podIndex + 1}`;
    div.appendChild(title);

    if (tournament.game === "commander") {
      pod.forEach((player, index) => {
        const label = document.createElement("div");
        label.className = "player-option";
        label.innerHTML =
          `<input type="radio" name="pod${podIndex}" value="${index}">
           ${player.name}`;
        div.appendChild(label);
      });

      const tieBtn = document.createElement("button");
      tieBtn.textContent = "Mark as Tie";
      tieBtn.onclick = () => submitCommanderTie(podIndex);
      div.appendChild(tieBtn);

      const submitBtn = document.createElement("button");
      submitBtn.textContent = "Submit Result";
      submitBtn.onclick = () => submitCommanderResult(podIndex);
      div.appendChild(submitBtn);
    }

    if (tournament.game === "twin") {
      pod.forEach((player, index) => {
        const label = document.createElement("div");
        label.className = "player-option";
        label.innerHTML =
          `<input type="radio" name="pod${podIndex}" value="${index}">
           ${player.name}`;
        div.appendChild(label);
      });

      const submitBtn = document.createElement("button");
      submitBtn.textContent = "Submit Result";
      submitBtn.onclick = () => submitTwinResult(podIndex);
      div.appendChild(submitBtn);
    }

    container.appendChild(div);
  });
}

function submitCommanderResult(podIndex) {
  const radios = document.getElementsByName(`pod${podIndex}`);
  let winnerIndex = null;

  radios.forEach(r => {
    if (r.checked) winnerIndex = parseInt(r.value);
  });

  if (winnerIndex === null) {
    alert("Select a winner.");
    return;
  }

  const pod = tournament.rounds[tournament.currentRound - 1][podIndex];

  pod.forEach((player, index) => {
    if (index === winnerIndex) {
      player.points += 5;
    } else {
      player.points += pod.length === 3 ? 1 : 3;
    }
  });

  lockPod(podIndex);
}

function submitCommanderTie(podIndex) {
  const pod = tournament.rounds[tournament.currentRound - 1][podIndex];
  pod.forEach(player => player.points += 3);
  lockPod(podIndex);
}

function submitTwinResult(podIndex) {
  const radios = document.getElementsByName(`pod${podIndex}`);
  let winnerIndex = null;

  radios.forEach(r => {
    if (r.checked) winnerIndex = parseInt(r.value);
  });

  if (winnerIndex === null) {
    alert("Select a winner.");
    return;
  }

  const pod = tournament.rounds[tournament.currentRound - 1][podIndex];

  pod.forEach((player, index) => {
    if (index === winnerIndex) {
      player.points += 3;
      player.gameWins++;
    } else {
      player.gameLosses++;
    }
  });

  lockPod(podIndex);
}

function lockPod(podIndex) {
  const podDivs = document.getElementsByClassName("pod");
  podDivs[podIndex].classList.add("locked");

  if (allPodsLocked()) {
    updateStandings();
    if (tournament.currentRound < tournament.totalRounds) {
      document.getElementById("nextRoundBtn").disabled = false;
    }
  }
}

function allPodsLocked() {
  const pods = document.getElementsByClassName("pod");
  return [...pods].every(p => p.classList.contains("locked"));
}

function updateStandings() {
  const tbody = document.getElementById("standingsBody");
  tbody.innerHTML = "";

  tournament.players
    .sort((a, b) => b.points - a.points)
    .forEach(player => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${player.name}</td>
        <td>${player.points}</td>
        <td>—</td>
        <td>—</td>
        <td>—</td>
      `;
      tbody.appendChild(tr);
    });
}
