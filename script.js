 let tournament = {
   gameMode: "",
   totalRounds: 0,
   currentRound: 0,
   players: [],
-  pods: [],
-  roundComplete: false
+  pods: []
 };
 
 function createTournament() {
-  tournament.gameMode = document.getElementById("gameMode").value;
-  tournament.totalRounds = parseInt(document.getElementById("roundCount").value);
-  tournament.currentRound = 0;
+  const roundCount = parseInt(document.getElementById("roundCount").value, 10);
+  if (!roundCount || roundCount < 1) {
+    alert("Please enter a valid number of rounds.");
+    return;
+  }
+
+  tournament = {
+    gameMode: document.getElementById("gameMode").value,
+    totalRounds: roundCount,
+    currentRound: 0,
+    players: [],
+    pods: []
+  };
 
   document.getElementById("setup").style.display = "none";
   document.getElementById("registration").style.display = "block";
 }
 
 function addPlayer() {
   const input = document.getElementById("playerName");
   const name = input.value.trim();
 
   if (!name) return;
 
+  const duplicate = tournament.players.some(
+    player => player.name.toLowerCase() === name.toLowerCase()
+  );
+  if (duplicate) {
+    alert("Player already added.");
+    return;
+  }
+
   tournament.players.push({
     id: tournament.players.length,
-    name: name,
+    name,
     matchPoints: 0,
-    opponents: [],
+    matchesPlayed: 0,
     gameWins: 0,
-    gameLosses: 0
+    gameLosses: 0,
+    gameDraws: 0,
+    opponents: []
   });
 
   input.value = "";
   renderPlayerList();
 }
 
 function renderPlayerList() {
   const list = document.getElementById("playerList");
   list.innerHTML = "";
-
   tournament.players.forEach(player => {
     list.innerHTML += `<li>${player.name}</li>`;
   });
 }
 
 function startRounds() {
+  if (tournament.players.length < 3) {
+    alert("At least 3 players are required.");
+    return;
+  }
+
   document.getElementById("registration").style.display = "none";
   document.getElementById("tournament").style.display = "block";
   nextRound();
 }
 
 function nextRound() {
   if (tournament.currentRound >= tournament.totalRounds) {
     alert("Tournament complete.");
     return;
   }
 
-  tournament.currentRound++;
-  tournament.roundComplete = false;
+  const unfinishedPod = tournament.pods.some(pod => !pod.locked);
+  if (unfinishedPod) {
+    alert("Finish all pod results before generating the next round.");
+    return;
+  }
+
+  tournament.currentRound += 1;
+  tournament.pods = buildPods();
 
-  generatePods();
   renderPods();
   updateStandings();
 }
 
-function generatePods() {
-  const sorted = [...tournament.players].sort((a, b) => b.matchPoints - a.matchPoints);
-  tournament.pods = [];
+function buildPods() {
+  const sortedPlayers = [...tournament.players].sort((a, b) => b.matchPoints - a.matchPoints);
+  const podSizes = getPodSizes(sortedPlayers.length);
 
-  let remaining = [...sorted];
+  if (!podSizes) {
+    alert("Unable to make only 3-4 player pods with this player count.");
+    return [];
+  }
 
-  while (remaining.length > 0) {
-    if (remaining.length === 3) {
-      tournament.pods.push(remaining.splice(0, 3));
-    } else if (remaining.length === 5) {
-      tournament.pods.push(remaining.splice(0, 4));
-    } else {
-      tournament.pods.push(remaining.splice(0, 4));
+  const pods = [];
+  let cursor = 0;
+  podSizes.forEach(size => {
+    pods.push({
+      players: sortedPlayers.slice(cursor, cursor + size),
+      locked: false
+    });
+    cursor += size;
+  });
+
+  return pods;
+}
+
+function getPodSizes(playerCount) {
+  for (let threePods = 0; threePods <= Math.floor(playerCount / 3); threePods += 1) {
+    const remaining = playerCount - (threePods * 3);
+    if (remaining >= 0 && remaining % 4 === 0) {
+      const fourPods = remaining / 4;
+      return [...Array(fourPods).fill(4), ...Array(threePods).fill(3)];
     }
   }
+  return null;
 }
 
 function renderPods() {
-  const section = document.getElementById("pairings");
-  section.innerHTML = `<h2>Round ${tournament.currentRound}</h2>`;
-
-  tournament.pods.forEach((pod, index) => {
-    section.innerHTML += `<h3>Pod ${index + 1}</h3>`;
-
-    pod.forEach(player => {
-      section.innerHTML += `
-        <div>
-          ${player.name}
-          <button onclick="reportWin(${index}, ${player.id})">Win</button>
+  document.getElementById("roundHeader").textContent = `Round ${tournament.currentRound}`;
+
+  const pairingsSection = document.getElementById("pairings");
+  pairingsSection.innerHTML = "";
+
+  tournament.pods.forEach((pod, podIndex) => {
+    const playerOptions = pod.players
+      .map(player => `<option value="${player.id}">${player.name}</option>`)
+      .join("");
+
+    pairingsSection.innerHTML += `
+      <div class="pod-card" id="pod-${podIndex}">
+        <h3>Pod ${podIndex + 1} (${pod.players.length} players)</h3>
+        <ul>
+          ${pod.players.map(player => `<li>${player.name}</li>`).join("")}
+        </ul>
+
+        <label>Winner:</label>
+        <select id="winner-${podIndex}">
+          ${playerOptions}
+        </select>
+
+        <label>Loser:</label>
+        <select id="loser-${podIndex}">
+          ${playerOptions}
+        </select>
+
+        <div class="pod-actions">
+          <button onclick="reportPodResult(${podIndex})">Submit Result</button>
+          <button onclick="reportPodDraw(${podIndex})">All Draw</button>
         </div>
-      `;
-    });
-
-    section.innerHTML += `
-      <button onclick="reportDraw(${index})">All Draw</button>
-      <hr>
+        <p class="pod-status" id="status-${podIndex}"></p>
+      </div>
     `;
   });
 
-  section.innerHTML += `
-    <button onclick="nextRound()">Generate Next Round</button>
-  `;
+  updateNextRoundButtonState();
 }
 
-function reportWin(podIndex, winnerId) {
-  if (tournament.roundComplete) return;
-
+function reportPodResult(podIndex) {
   const pod = tournament.pods[podIndex];
-  const winner = pod.find(p => p.id === winnerId);
-
-  if (tournament.gameMode === "MTG Commander") {
-    pod.forEach(player => {
-      if (player.id === winnerId) {
-        player.matchPoints += 5;
-      } else {
-        player.matchPoints += 3;
-      }
-    });
-  } else {
-    pod.forEach(player => {
-      if (player.id === winnerId) {
-        player.matchPoints += 3;
-      }
-    });
+  if (!pod || pod.locked) return;
+
+  const winnerId = parseInt(document.getElementById(`winner-${podIndex}`).value, 10);
+  const loserId = parseInt(document.getElementById(`loser-${podIndex}`).value, 10);
+
+  if (winnerId === loserId) {
+    alert("Winner and loser cannot be the same player.");
+    return;
   }
 
-  lockPod(podIndex);
-}
+  pod.players.forEach(player => {
+    player.matchesPlayed += 1;
 
-function reportDraw(podIndex) {
-  if (tournament.roundComplete) return;
+    if (player.id === winnerId) {
+      player.matchPoints += 5;
+      player.gameWins += 1;
+    } else if (player.id === loserId) {
+      player.matchPoints += 1;
+      player.gameLosses += 1;
+    } else {
+      player.matchPoints += 3;
+      player.gameDraws += 1;
+    }
+  });
+
+  updateOpponentsForPod(pod.players);
+  lockPod(podIndex, "Result submitted");
+}
 
+function reportPodDraw(podIndex) {
   const pod = tournament.pods[podIndex];
+  if (!pod || pod.locked) return;
 
-  pod.forEach(player => {
+  pod.players.forEach(player => {
     player.matchPoints += 3;
+    player.matchesPlayed += 1;
+    player.gameDraws += 1;
   });
 
-  lockPod(podIndex);
+  updateOpponentsForPod(pod.players);
+  lockPod(podIndex, "Draw recorded");
 }
 
-function lockPod(podIndex) {
-  const buttons = document.querySelectorAll(`button`);
-  buttons.forEach(btn => btn.disabled = true);
+function updateOpponentsForPod(playersInPod) {
+  playersInPod.forEach(player => {
+    const opponentIds = playersInPod
+      .filter(opponent => opponent.id !== player.id)
+      .map(opponent => opponent.id);
+    player.opponents.push(...opponentIds);
+  });
+}
+
+function lockPod(podIndex, statusText) {
+  tournament.pods[podIndex].locked = true;
+
+  const podCard = document.getElementById(`pod-${podIndex}`);
+  if (podCard) {
+    podCard.querySelectorAll("button, select").forEach(control => {
+      control.disabled = true;
+    });
+  }
+
+  const status = document.getElementById(`status-${podIndex}`);
+  if (status) {
+    status.textContent = statusText;
+  }
 
-  tournament.roundComplete = true;
   updateStandings();
+  updateNextRoundButtonState();
+}
+
+function updateNextRoundButtonState() {
+  const button = document.getElementById("nextRoundButton");
+  if (!button) return;
+
+  const allLocked = tournament.pods.length > 0 && tournament.pods.every(pod => pod.locked);
+  const hasMoreRounds = tournament.currentRound < tournament.totalRounds;
+
+  button.disabled = !(allLocked && hasMoreRounds);
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
-        <td>0%</td>
-        <td>0%</td>
-        <td>0%</td>
+        <td>${formatPercent(calculateOmw(player))}</td>
+        <td>${formatPercent(calculateGwp(player))}</td>
+        <td>${formatPercent(calculateOgw(player))}</td>
       </tr>
     `;
   });
 }
+
+function calculateGwp(player) {
+  const totalGames = player.gameWins + player.gameLosses + player.gameDraws;
+  if (totalGames === 0) return 0;
+  return (player.gameWins + (0.5 * player.gameDraws)) / totalGames;
+}
+
+function calculateOmw(player) {
+  if (player.opponents.length === 0) return 0;
+
+  const opponentPercentages = player.opponents.map(opponentId => {
+    const opponent = tournament.players.find(p => p.id === opponentId);
+    if (!opponent) return 0;
+    return Math.max(calculateGwp(opponent), 0.33);
+  });
+
+  return average(opponentPercentages);
+}
+
+function calculateOgw(player) {
+  if (player.opponents.length === 0) return 0;
+
+  const opponentOmw = player.opponents.map(opponentId => {
+    const opponent = tournament.players.find(p => p.id === opponentId);
+    if (!opponent) return 0;
+    return Math.max(calculateOmw(opponent), 0.33);
+  });
+
+  return average(opponentOmw);
+}
+
+function average(values) {
+  if (values.length === 0) return 0;
+  const sum = values.reduce((current, value) => current + value, 0);
+  return sum / values.length;
+}
+
+function formatPercent(decimalValue) {
+  return `${(decimalValue * 100).toFixed(1)}%`;
+}
