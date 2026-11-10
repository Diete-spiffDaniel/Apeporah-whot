import {
  callLastCard,
  callShape,
  chooseComputerMove,
  createGame,
  DEFAULT_SETTINGS,
  drawCard,
  getLegalCards,
  missLastCard,
  playCard,
  SHAPES,
} from "./engine.js";

const screen = document.querySelector("#screen");
const modalRoot = document.querySelector("#modal-root");
const toast = document.querySelector("#toast");
const soundButton = document.querySelector("#mute-button");
const settingsKey = "whot-settings-v1";
const profileKey = "whot-profile-v1";
let deferredPrompt = null;
let installButton = null;
let game = null;
let view = "home";
let settings = loadSettings();
let profile = loadProfile();
let difficulty = "normal";
let muted = false;
let toastTimer;
let computerTimer;
let lastCardTimer;
let audioContext;

const shapeIcons = { circle: "●", triangle: "▲", cross: "✚", square: "■", star: "★", whot: "WHOT" };
const specialNames = { 1: "Hold On", 2: "Pick Two", 5: "Pick Three", 8: "Suspension", 14: "General Market", 20: "Whot" };

function loadSettings() {
  try {
    const saved = localStorage.getItem(settingsKey);
    if (!saved) return structuredClone(DEFAULT_SETTINGS);
    const parsed = JSON.parse(saved);
    return { ...structuredClone(DEFAULT_SETTINGS), ...parsed, specials: { ...DEFAULT_SETTINGS.specials, ...parsed.specials } };
  } catch (error) {
    console.error("Could not load saved Whot settings.", error);
    return structuredClone(DEFAULT_SETTINGS);
  }
}

function saveSettings() {
  try {
    localStorage.setItem(settingsKey, JSON.stringify(settings));
    return true;
  } catch (error) {
    console.error("Could not save Whot settings.", error);
    showToast("Settings could not be saved on this device.");
    return false;
  }
}

function loadProfile() {
  try {
    const saved = localStorage.getItem(profileKey);
    if (!saved) {
      return { name: "Ayo", initials: "A", colour: "#F5B83D" };
    }
    const parsed = JSON.parse(saved);
    return {
      name: parsed.name || "Ayo",
      initials: (parsed.initials || (parsed.name || "Ayo").trim().slice(0, 2).toUpperCase()) || "A",
      colour: parsed.colour || "#F5B83D",
    };
  } catch (error) {
    console.error("Could not load player profile.", error);
    return { name: "Ayo", initials: "A", colour: "#F5B83D" };
  }
}

function saveProfile(nextProfile) {
  profile = { ...profile, ...nextProfile };
  localStorage.setItem(profileKey, JSON.stringify(profile));
  return profile;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2300);
}

function playSound(frequency = 480) {
  if (muted) return;
  try {
    audioContext ||= new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = "triangle";
    gain.gain.setValueAtTime(0.06, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.12);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.12);
  } catch (error) {
    console.warn("Sound playback is unavailable.", error);
  }
}

function renderHome() {
  view = "home";
  const avatarInitials = (profile.initials || profile.name || "A").slice(0, 2).toUpperCase();
  screen.innerHTML = `
    <div class="home">
      <div class="profile-card" aria-label="Player profile summary">
        <div class="profile-avatar" style="--avatar-colour: ${profile.colour || "#F5B83D"};">${avatarInitials}</div>
        <div class="profile-copy">
          <span class="eyebrow profile-label">Player profile</span>
          <strong>${profile.name || "Ayo"}</strong>
        </div>
        <button class="chip-button" data-screen="profile" type="button">Edit</button>
      </div>
      <div class="home-hero" aria-hidden="true">
        <span class="hero-spark hero-spark-one">✦</span>
        <span class="hero-spark hero-spark-two">✧</span>
        <div class="hero-card hero-card-back"><span>14</span><b>✚</b></div>
        <div class="hero-card hero-card-star"><span>5</span><b>★</b></div>
        <div class="hero-card hero-card-whot"><span>WHOT</span><b>✦</b></div>
      </div>
      <div class="eyebrow">Nigeria's favourite card game</div>
      <h1>WHOT<em>!</em></h1>
      <p class="subtitle">Match shapes and numbers. Play your specials wisely. Be the first to clear your hand!</p>
      <nav class="menu" aria-label="Main menu">
        <button class="button primary" id="start-game">Play vs Computer</button>
        <button class="button secondary" id="wifi-game">WiFi Multiplayer</button>
        <button class="button secondary" data-screen="settings">Settings</button>
        <button class="button secondary" data-screen="how-to-play">How to Play</button>
        <button class="button secondary" id="install-button" hidden>Install app</button>
      </nav>
      <p class="home-foot">A classic Nigerian game, made to play anywhere.</p>
    </div>`;
  installButton = screen.querySelector("#install-button");
  installButton.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installButton.hidden = true;
  });
  screen.querySelector("#start-game").addEventListener("click", startGame);
  screen.querySelector("#wifi-game").addEventListener("click", () =>
    showToast("WiFi Multiplayer arrives in Phase 4."),
  );
  screen.querySelectorAll("[data-screen]").forEach((button) =>
    button.addEventListener("click", () => renderPage(button.dataset.screen)),
  );
  updateInstallButton();
}

function updateInstallButton() {
  if (!installButton) return;
  const canInstall = Boolean(deferredPrompt) && !window.matchMedia("(display-mode: standalone)").matches;
  installButton.hidden = !canInstall;
}

function renderPage(page) {
  view = page;
  modalRoot.innerHTML = "";

  if (page === "profile") {
    const palette = ["#F5B83D", "#E56C4F", "#6AB7D8", "#8F5FD0", "#7AC87D", "#D3873D"];
    screen.innerHTML = `
      <div class="page-heading"><button class="back-button" data-home aria-label="Back">‹</button><h2>Profile setup</h2></div>
      <div class="panel profile-panel">
        <div class="profile-edit-top">
          <div class="profile-avatar large" style="--avatar-colour: ${profile.colour || "#F5B83D"};">${(profile.initials || profile.name || "A").slice(0, 2).toUpperCase()}</div>
          <div class="profile-copy">
            <span class="eyebrow profile-label">Welcome</span>
            <strong>${profile.name || "Ayo"}</strong>
          </div>
        </div>
        <label class="field-label" for="profile-name">Player name</label>
        <input id="profile-name" class="text-input" type="text" maxlength="18" value="${profile.name || "Ayo"}" aria-label="Player name">
        <label class="field-label" for="profile-colour">Favourite accent</label>
        <div class="colour-picker" id="profile-colour" aria-label="Profile accent colours">
          ${palette.map((colour) => `<button type="button" class="colour-swatch${profile.colour === colour ? " active" : ""}" data-colour="${colour}" style="background:${colour};" aria-label="Use ${colour} accent"></button>`).join("")}
        </div>
        <button class="button primary" id="save-profile">Save profile</button>
      </div>`;
    screen.querySelector("[data-home]").addEventListener("click", renderHome);
    screen.querySelector("#save-profile").addEventListener("click", () => {
      const nextName = String(screen.querySelector("#profile-name").value || "Ayo").trim() || "Ayo";
      const nextColour = screen.querySelector(".colour-swatch.active")?.dataset.colour || profile.colour || "#F5B83D";
      saveProfile({ name: nextName, initials: nextName.slice(0, 2).toUpperCase(), colour: nextColour });
      showToast("Profile saved");
      renderHome();
    });
    screen.querySelectorAll(".colour-swatch").forEach((button) => {
      button.addEventListener("click", () => {
        screen.querySelectorAll(".colour-swatch").forEach((swatch) => swatch.classList.toggle("active", swatch === button));
      });
    });
    return;
  }

  if (page === "settings") {
    const specialRows = Object.entries(specialNames)
      .map(([number, name]) => `<div class="setting-row"><label for="special-${number}">${name} (${number})</label><input id="special-${number}" type="checkbox" data-special="${number}" ${settings.specials[number] ? "checked" : ""}></div>`)
      .join("");
    screen.innerHTML = `
      <div class="page-heading"><button class="back-button" data-home aria-label="Back">‹</button><h2>Settings</h2></div>
      <div class="panel">
        <div class="setting-row"><label for="hand-size">Starting hand size</label><select id="hand-size">${[4,5,6,7].map(n => `<option ${settings.startingHandSize === n ? "selected" : ""}>${n}</option>`).join("")}</select></div>
        <div class="setting-row"><label for="computer-difficulty">Computer difficulty</label><select id="computer-difficulty"><option value="easy" ${difficulty === "easy" ? "selected" : ""}>Easy</option><option value="normal" ${difficulty === "normal" ? "selected" : ""}>Normal</option><option value="hard" ${difficulty === "hard" ? "selected" : ""}>Hard</option></select></div>
        <div class="setting-row"><label for="defend">Defend Pick Two / Pick Three with the same card</label><input id="defend" type="checkbox" ${settings.defendAttacks ? "checked" : ""}></div>
        <div class="setting-row"><label for="market-turn">General Market gives another turn</label><input id="market-turn" type="checkbox" ${settings.generalMarketExtraTurn ? "checked" : ""}></div>
        <div class="setting-row"><label for="last-call">Require a Last card! button tap (otherwise draw 2)</label><input id="last-call" type="checkbox" ${settings.requireLastCardCall ? "checked" : ""}></div>
        <div class="setting-row"><label for="finish-special">Allow finishing on a special card</label><input id="finish-special" type="checkbox" ${settings.canFinishOnSpecial ? "checked" : ""}></div>
      </div>
      <h3>Special cards</h3><div class="panel">${specialRows}</div>
      <button class="button primary" id="save-settings">Save settings</button>`;
    screen.querySelector("[data-home]").addEventListener("click", renderHome);
    screen.querySelector("#save-settings").addEventListener("click", () => {
      settings.startingHandSize = Number(screen.querySelector("#hand-size").value);
      difficulty = screen.querySelector("#computer-difficulty").value;
      settings.defendAttacks = screen.querySelector("#defend").checked;
      settings.generalMarketExtraTurn = screen.querySelector("#market-turn").checked;
      settings.requireLastCardCall = screen.querySelector("#last-call").checked;
      settings.canFinishOnSpecial = screen.querySelector("#finish-special").checked;
      screen.querySelectorAll("[data-special]").forEach((input) => {
        settings.specials[input.dataset.special] = input.checked;
      });
      if (saveSettings()) showToast("Settings saved.");
    });
    return;
  }

  screen.innerHTML = `
    <div class="page-heading"><button class="back-button" data-home aria-label="Back">‹</button><h2>How to Play</h2></div>
    <div class="panel how-to-play-panel">
      <p>Whot! is a matching game. On your turn, play a card that matches the top discard by <strong>shape</strong> or <strong>number</strong>. A Whot card can be played on anything, and you get to call the next shape.</p>
      <ul class="rule-list">
        <li><strong>Match or draw:</strong> if you cannot play, draw 1 card and your turn ends.</li>
        <li><strong>1 Hold On:</strong> the same player plays again.</li>
        <li><strong>2 Pick Two:</strong> the next player draws 2 cards and loses the turn, unless they defend with another 2. Stacks add up.</li>
        <li><strong>5 Pick Three:</strong> same idea, but with 3 cards and 5s.</li>
        <li><strong>8 Suspension:</strong> the next player misses a turn.</li>
        <li><strong>14 General Market:</strong> everyone else draws 1, then the player who played it gets another turn.</li>
        <li><strong>20 Whot:</strong> can be played on anything, and the player calls the next shape.</li>
        <li><strong>Last card!:</strong> when you have one card left, call it out. If the rule is enabled, you must tap the button or draw 2.</li>
      </ul>
      <p class="callout-text">First player to empty their hand wins. If the market runs dry and no one can continue, the lowest card total wins.</p>
    </div>
    <div class="panel">
      <h3>Quick tips</h3>
      <ul class="rule-list">
        <li>Watch the table for attack cards and chain reactions.</li>
        <li>Save your Whot cards for moments when you need a shape change.</li>
        <li>Use the Settings screen to tune special-card rules and starting hands.</li>
      </ul>
    </div>`;
    screen.querySelector("[data-home]").addEventListener("click", renderHome);
    return;
  }

function startGame() {
  clearTimeout(computerTimer);
  game = createGame({
    playerNames: ["You", "Computer"],
    computerPlayers: [1],
    settings,
  });
  game.players[1].difficulty = difficulty;
  view = "table";
  renderTable();
  playSound(650);
}

function cardMarkup(card, { button = false, playable = false, index = 0 } = {}) {
  const tag = button ? "button" : "div";
  const classes = ["playing-card", `shape-${card.shape}`];
  if (playable) classes.push("playable");
  if (button && !playable) classes.push("unplayable");
  if (button) classes.push("deal");
  const style = button ? `style="z-index:${index + 1};--deal-index:${index};"` : "";
  return `<${tag} class="${classes.join(" ")}" ${style} ${button ? `data-card="${card.id}" aria-label="${card.number} ${card.shape}"` : ""}>
    <span class="number">${card.number}</span><span class="shape-icon" aria-hidden="true">${shapeIcons[card.shape]}</span><span class="corner">${card.number}</span>
  </${tag}>`;
}

function renderTable() {
  if (!game) return renderHome();
  if (game.winner !== null) return renderResult();
  clearTimeout(lastCardTimer);
  view = "table";
  const me = game.players[0];
  const legal = getLegalCards(game, 0);
  const top = game.discard[game.discard.length - 1];
  const opponents = game.players.slice(1).map((player, offset) => {
    const index = offset + 1;
    return `<div class="opponent ${game.turnIndex === index ? "active-player" : ""}">
      <span class="opponent-name">${player.name}</span><div class="card-back">W</div><span class="opponent-count">${player.hand.length} cards</span>
    </div>`;
  }).join("");
  const currentName = game.players[game.turnIndex].name;
  const turnText = game.pendingAttack
    ? `Pick ${game.pendingAttack.amount} — defend or draw`
    : game.pendingShapeCall ? "Call a shape" : `${currentName}'s turn`;
  const isMyTurn = game.turnIndex === 0 && !game.pendingShapeCall && !game.pendingLastCard;
  const mustDrawAttack = Boolean(game.pendingAttack) &&
    (!game.settings.defendAttacks || legal.length === 0);
  const banner = game.pendingLastCard
    ? "Tap Last card! or draw 2"
    : game.pendingAttack ? `Pick ${game.pendingAttack.amount}!` : game.banner;

  screen.innerHTML = `
    <div class="table-screen">
      <div class="turn-line"><span>WHOT! TABLE</span><span class="turn-pill">${turnText}</span></div>
      <div class="opponents">${opponents}</div>
      <div class="middle-area">
        <div class="pile"><button id="draw-button" class="draw-pile" aria-label="Draw from market" ${!isMyTurn ? "disabled" : ""}>${game.market.length}</button><span class="pile-label">MARKET</span></div>
        <div class="pile">${cardMarkup(top)}<span class="pile-label">DISCARD ${game.calledShape ? `· ${game.calledShape.toUpperCase()}` : ""}</span></div>
      </div>
      <div class="banner">${banner || "&nbsp;"}</div>
      <div class="hand-area">
        <div class="hand-label"><span>Your hand · ${me.hand.length}</span><span>${game.pendingAttack && game.turnIndex === 0 ? `Draw ${game.pendingAttack.amount}` : ""}</span></div>
        <div class="hand">${me.hand.map((card, index) => cardMarkup(card, { button: true, playable: isMyTurn && legal.some(item => item.id === card.id), index })).join("")}</div>
        <div class="controls">
          <button id="draw-control" class="button secondary" ${!isMyTurn ? "disabled" : ""}>${mustDrawAttack ? `Take ${game.pendingAttack.amount}` : "Draw 1"}</button>
          ${game.pendingLastCard && game.pendingLastCard.playerIndex === 0
            ? `<button id="last-card" class="button primary">Last card!</button>`
            : `<button id="leave-game" class="button secondary">Exit game</button>`}
        </div>
      </div>
    </div>`;

  screen.querySelectorAll("[data-card]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!button.classList.contains("playable")) {
        showToast("That card cannot be played now.");
        return;
      }
      const card = me.hand.find((item) => item.id === button.dataset.card);
      button.classList.add("playing");
      setTimeout(() => {
        if (!game || game.turnIndex !== 0) return;
        try {
          playCard(game, 0, card.id);
          playSound(card.number === 20 ? 720 : 540);
          if (game.pendingShapeCall) showShapePicker(0);
          renderTable();
          advanceComputerIfNeeded();
        } catch (error) {
          showToast(error.message);
        }
      }, 280);
    });
  });
  const onDraw = () => {
    if (!isMyTurn) return;
    try {
      const pile = screen.querySelector("#draw-button");
      pile.classList.add("drawing");
      setTimeout(() => {
        if (!game || game.turnIndex !== 0) return;
        drawCard(game, 0);
        playSound(300);
        renderTable();
        advanceComputerIfNeeded();
      }, 220);
    } catch (error) {
      showToast(error.message);
    }
  };
  screen.querySelector("#draw-button").addEventListener("click", onDraw);
  screen.querySelector("#draw-control").addEventListener("click", onDraw);
  screen.querySelector("#last-card")?.addEventListener("click", () => {
    callLastCard(game, 0);
    renderTable();
    advanceComputerIfNeeded();
  });
  screen.querySelector("#leave-game")?.addEventListener("click", () => {
    clearTimeout(computerTimer);
    game = null;
    renderHome();
  });
  if (game.pendingLastCard && game.pendingLastCard.playerIndex === 0) {
    screen.querySelector("#last-card").insertAdjacentHTML("afterend", '<button id="miss-last" class="button secondary">Missed it — draw 2</button>');
    screen.querySelector("#miss-last").addEventListener("click", () => {
      clearTimeout(lastCardTimer);
      missLastCard(game, 0);
      renderTable();
      advanceComputerIfNeeded();
    });
    lastCardTimer = setTimeout(() => {
      if (game?.pendingLastCard?.playerIndex === 0) {
        missLastCard(game, 0);
        renderTable();
        advanceComputerIfNeeded();
      }
    }, 3000);
  }
  if (game.pendingLastCard && game.pendingLastCard.playerIndex === 1) {
    callLastCard(game, 1);
    renderTable();
    advanceComputerIfNeeded();
  }
  advanceComputerIfNeeded();
}

function showShapePicker(playerIndex) {
  if (playerIndex !== 0) {
    const move = chooseComputerMove(game, playerIndex, game.players[playerIndex].difficulty);
    callShape(game, playerIndex, move.calledShape || "circle");
    renderTable();
    return;
  }
  modalRoot.innerHTML = `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="shape-title">
    <h2 id="shape-title">Call a shape</h2><p>Choose the shape the next player must match.</p>
    <div class="shape-options">${SHAPES.map(shape => `<button class="shape-choice" data-shape="${shape}"><span>${shapeIcons[shape]}</span>${shape}</button>`).join("")}</div>
  </div></div>`;
  modalRoot.querySelectorAll("[data-shape]").forEach((button) => button.addEventListener("click", () => {
    callShape(game, 0, button.dataset.shape);
    modalRoot.innerHTML = "";
    renderTable();
    advanceComputerIfNeeded();
  }));
}

function advanceComputerIfNeeded() {
  if (!game || game.winner !== null || game.turnIndex === 0 || game.pendingShapeCall ||
      game.pendingLastCard || view !== "table") return;
  clearTimeout(computerTimer);
  computerTimer = setTimeout(() => {
    if (!game || game.turnIndex === 0 || game.winner !== null) return;
    const index = game.turnIndex;
    const player = game.players[index];
    if (player.hand.length === 1 && game.settings.requireLastCardCall) {
      callLastCard(game, index);
      renderTable();
      return;
    }
    const move = chooseComputerMove(game, index, player.difficulty);
    if (move.type === "draw") {
      drawCard(game, index);
    } else {
      playCard(game, index, move.cardId, move.calledShape);
    }
    playSound(move.type === "draw" ? 300 : 500);
    renderTable();
    if (game.pendingShapeCall) showShapePicker(index);
    else advanceComputerIfNeeded();
  }, 750);
}

function renderResult() {
  view = "result";
  const winner = game.players[game.winner];
  const rows = game.players.map((player, index) =>
    `<div class="score-row"><span>${player.name}${index === game.winner ? " 🏆" : ""}</span><b>${player.hand.reduce((sum, card) => sum + card.number, 0)} points</b></div>`,
  ).join("");
  screen.innerHTML = `<div class="result"><div class="trophy">${game.endReason === "check-up" ? "🎉" : "🃏"}</div>
    <div class="eyebrow">${game.endReason === "check-up" ? "Check up!" : "Game over"}</div>
    <h2>${winner.name} wins!</h2><div class="panel score-list">${rows}</div>
    <button id="play-again" class="button primary">Play Again</button>
    <button id="home-button" class="button secondary" style="margin-top:12px">Home</button></div>`;
  screen.querySelector("#play-again").addEventListener("click", startGame);
  screen.querySelector("#home-button").addEventListener("click", () => { game = null; renderHome(); });
}

soundButton.addEventListener("click", () => {
  muted = !muted;
  soundButton.textContent = muted ? "🔇" : "🔊";
  soundButton.setAttribute("aria-label", muted ? "Unmute sounds" : "Mute sounds");
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").then((registration) => {
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            showToast("Update available — reload to install");
          }
        });
      });
    }).catch((error) => console.warn("Service worker registration failed.", error));
  });
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPrompt = event;
  updateInstallButton();
});

window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
  updateInstallButton();
  showToast("App installed");
});

renderHome();
