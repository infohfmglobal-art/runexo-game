/* global Capacitor */
/* global firebase */

// =======================================
// RuneXO • Dragon Board Duel
// CLEAN APP.JS
// - Offline CPU mode
// - Web: Google Login works
// - Android app: Native Google Login (Capacitor bridge)
// - SFX only
// =======================================

// --------------------- CRAZYGAMES SDK ---------------------

function cgSDK() {
  return window.CrazyGames?.SDK || null;
}

function cgLoadingStart() {
  try { cgSDK()?.game?.sdkGameLoadingStart(); } catch (e) { console.warn("CG loadingStart error", e); }
}

function cgLoadingStop() {
  try { cgSDK()?.game?.sdkGameLoadingStop(); } catch (e) { console.warn("CG loadingStop error", e); }
}

function cgGameplayStart() {
  try { cgSDK()?.game?.gameplayStart(); } catch (e) { console.warn("CG gameplayStart error", e); }
}

function cgGameplayStop() {
  try { cgSDK()?.game?.gameplayStop(); } catch (e) { console.warn("CG gameplayStop error", e); }
}

let _cgRoundCount = 0;

function cgMaybeShowMidgameAd(onDone) {
  _cgRoundCount++;
  const sdk = cgSDK();
  if (!sdk || _cgRoundCount % 2 !== 0) {
    onDone?.();
    return;
  }
  try {
    sdk.ad.requestAd("midgame", {
      adStarted() { stopMusic(); },
      adFinished() { if (state.musicOn) startMusic(); onDone?.(); },
      adError()   { if (state.musicOn) startMusic(); onDone?.(); }
    });
  } catch (e) {
    console.warn("CG ad error", e);
    onDone?.();
  }
}

// --------------------- CAPACITOR / PLATFORM ---------------------

const GoogleAuth =
  window.Capacitor?.Plugins?.GoogleAuth ||
  window.Capacitor?.GoogleAuth ||
  null;

const isAndroidApp =
  !!(window.Capacitor && typeof Capacitor.isNativePlatform === "function" && Capacitor.isNativePlatform());

console.log("UserAgent:", navigator.userAgent);
console.log("Capacitor exists:", !!window.Capacitor);
console.log("isAndroidApp =", isAndroidApp);

// Initialize GoogleAuth only on native Android if plugin exists
if (isAndroidApp && GoogleAuth?.initialize) {
  GoogleAuth.initialize({
    clientId:
      "572586290751-kaice51s16fonuj0jkhmg9sh9ti1pr1.apps.googleusercontent.com",
    scopes: ["profile", "email"],
    grantOfflineAccess: true
  })
    .then(() => console.log("✅ GoogleAuth initialized"))
    .catch(e => console.error("❌ GoogleAuth init failed", e));
}

// --------------------- CONSTANTS & STATE ---------------------

const STORAGE_KEY = "runexo_offline_v2";

let state = {
  playerName: "Guest",
  coins: 500,
  wins: 0,
  losses: 0,
  draws: 0,
  bestStreak: 0,
  currentStreak: 0,

  theme: "neon",
  skin: "xo",
  difficulty: "normal",
  stake: 10,
  musicOn: true,
  sfxOn: true
};

let board = [];
let gameActive = false;

// --------------------- FIREBASE GLOBALS ---------------------

const auth =
  window.auth ||
  (firebase && firebase.auth ? firebase.auth() : null);

const db =
  window.db ||
  (firebase && firebase.firestore ? firebase.firestore() : null);

let currentUser = null;
let userDocRef = null;

// --------------------- SAFE HELPERS ---------------------

function safeText(el, value) {
  if (el) el.textContent = value;
}

function safeClassRemove(el, className) {
  if (el) el.classList.remove(className);
}

function safeClassAdd(el, className) {
  if (el) el.classList.add(className);
}

function safeSetValue(el, value) {
  if (el) el.value = value;
}



function exists(fn) {
  return typeof fn === "function";
}
// ---------------- DOM REFERENCES ----------------

window.screens = {
  splashStudio: document.getElementById("splashStudio"),
  splashGame: document.getElementById("splashGame"),
  home: document.getElementById("home"),
  game: document.getElementById("game")
};

window.els = {
  nicknameInput: document.getElementById("nicknameInput"),
  btnPlayGuest: document.getElementById("btnPlayGuest"),
  btnLoginGoogle: document.getElementById("btnLoginGoogle"),
  loginStatusText: document.getElementById("loginStatusText"),
  statPlayerName: document.getElementById("statPlayerName"),
  statCoins: document.getElementById("statCoins"),
  statBestStreak: document.getElementById("statBestStreak"),
  btnLogout: document.getElementById("btnLogout"),

  boardThemeRow: document.getElementById("boardThemeRow"),
  pieceSkinRow: document.getElementById("pieceSkinRow"),
  difficultySelect: document.getElementById("difficultySelect"),
  matchStakeRow: document.getElementById("matchStakeRow"),

  btnPlayCpu: document.getElementById("btnPlayCpu"),
  btnToggleMusic: document.getElementById("btnToggleMusic"),
  btnToggleSfx: document.getElementById("btnToggleSfx"),
  btnOpenLeaderboard: document.getElementById("btnOpenLeaderboard"),

  gameModeLabel: document.getElementById("gameModeLabel"),
  gameStakeLabel: document.getElementById("gameStakeLabel"),
  gameCoinsDisplay: document.getElementById("gameCoinsDisplay"),
  board: document.getElementById("board"),
  gameStatus: document.getElementById("gameStatus"),
  btnBackHome: document.getElementById("btnBackHome"),
  btnNewRound: document.getElementById("btnNewRound"),
  btnGiveUp: document.getElementById("btnGiveUp"),
  wlStats: document.getElementById("wlStats"),
  resultToast: document.getElementById("resultToast"),

  leaderboardOverlay: document.getElementById("leaderboardOverlay"),
  leaderboardList: document.getElementById("leaderboardList"),
  btnCloseLeaderboard: document.getElementById("btnCloseLeaderboard"),
  btnResetLeaderboard: document.getElementById("btnResetLeaderboard")
};

// --------------------- LOCAL STORAGE ---------------------

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    const parsed = JSON.parse(saved);
    state = { ...state, ...parsed };
    console.log("✅ Local state loaded");
  } catch (e) {
    console.warn("Failed to load local state", e);
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("Failed to save local state", e);
  }
}

// --------------------- SCREEN HANDLING ---------------------

function showScreen(name) {
  console.log("showScreen called:", name);
  console.log("screens object:", window.screens);

  if (!window.screens) {
    console.error("window.screens is missing");
    return;
  }

  Object.values(window.screens).forEach(s => {
    if (s) s.classList.add("hidden");
  });

  if (window.screens[name]) {
    window.screens[name].classList.remove("hidden");
    console.log("showing screen:", name);
  } else {
    console.error("Screen not found:", name);
  }
}

// --------------------- UI + THEME ---------------------

let toastTimer = null;

function updateStatsUI() {
  if (!window.els) return;

  safeText(els.statPlayerName, state.playerName);
  safeText(els.statCoins, state.coins);
  safeText(els.statBestStreak, state.bestStreak);

  safeText(els.gameCoinsDisplay, state.coins);
  safeText(els.wlStats, `W: ${state.wins}  L: ${state.losses}  D: ${state.draws}`);
}

function syncControlsFromState() {
  if (!window.els) return;

  safeSetValue(els.nicknameInput, state.playerName === "Guest" ? "" : state.playerName);

  if (els.boardThemeRow) {
    [...els.boardThemeRow.querySelectorAll(".chip")].forEach(chip => {
      chip.classList.toggle("active", chip.dataset.theme === state.theme);
    });
  }

  if (els.pieceSkinRow) {
    [...els.pieceSkinRow.querySelectorAll(".chip")].forEach(chip => {
      chip.classList.toggle("active", chip.dataset.skin === state.skin);
    });
  }

  if (els.difficultySelect) {
    els.difficultySelect.value = state.difficulty;
  }

  if (els.matchStakeRow) {
    [...els.matchStakeRow.querySelectorAll(".chip")].forEach(chip => {
      chip.classList.toggle("active", Number(chip.dataset.stake) === state.stake);
    });
  }

  if (els.btnToggleMusic) {
    els.btnToggleMusic.dataset.on = state.musicOn ? "true" : "false";
    els.btnToggleMusic.textContent = `Music: ${state.musicOn ? "On" : "Off"}`;
    els.btnToggleMusic.disabled = false;
    els.btnToggleMusic.classList.remove("disabled");
  }

  if (els.btnToggleSfx) {
    els.btnToggleSfx.dataset.on = state.sfxOn ? "true" : "false";
    els.btnToggleSfx.textContent = `SFX: ${state.sfxOn ? "On" : "Off"}`;
  }
}

  // Music disabled in this build

  function applyTheme() {
  document.body.setAttribute("data-theme", state.theme);
  document.body.setAttribute("data-skin", state.skin);
}

function showSignedInUI() {
  if (!window.els) return;
  safeText(els.loginStatusText, `Signed in as ${state.playerName}`);
  safeClassRemove(els.btnLogout, "hidden");
}

function showSignedOutUI() {
  if (!window.els) return;
  safeText(els.loginStatusText, "Not signed in (Guest mode).");
  safeClassAdd(els.btnLogout, "hidden");
}

function showResultToast(text) {
  if (!window.els || !els.resultToast) return;

  els.resultToast.textContent = text;
  els.resultToast.classList.remove("hidden");
  els.resultToast.classList.add("visible");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.resultToast.classList.remove("visible");
  }, 1800);
}

// --------------------- FIREBASE USER DATA ---------------------

function applyFirestoreData(data = {}) {
  state = {
    ...state,
    ...data
  };

  updateStatsUI();
  syncControlsFromState();
  applyTheme();
}

function pushStateToFirestore() {
  if (!userDocRef) return Promise.resolve();

  const payload = {
    playerName: state.playerName,
    coins: state.coins,
    wins: state.wins,
    losses: state.losses,
    draws: state.draws,
    bestStreak: state.bestStreak,
    currentStreak: state.currentStreak,
    theme: state.theme,
    skin: state.skin,
    difficulty: state.difficulty,
    stake: state.stake,
    sfxOn: state.sfxOn,
    updatedAt: Date.now()
  };

  return userDocRef.set(payload, { merge: true }).catch(err => {
    console.warn("Failed to push Firestore state", err);
  });
}

// --------------------- GOOGLE LOGIN ---------------------

async function signInWithGoogle() {
  if (!auth) {
    showResultToast("Auth not ready. Try again.");
    return;
  }

  // Native Android bridge mode
  if (isAndroidApp && window.AndroidBridge?.startNativeGoogleSignIn) {
    window.AndroidBridge.startNativeGoogleSignIn();
    return;
  }

  const btn = window.els?.btnLoginGoogle;
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Signing in...";
  }

  const provider =
    window.googleProvider || new firebase.auth.GoogleAuthProvider();

  try {
    let result;
    try {
      result = await auth.signInWithPopup(provider);
    } catch (popupErr) {
      // If popup was blocked, fall back to redirect
      if (
        popupErr.code === "auth/popup-blocked" ||
        popupErr.code === "auth/popup-closed-by-user" ||
        popupErr.code === "auth/cancelled-popup-request"
      ) {
        if (btn) { btn.textContent = "Redirecting..."; }
        await auth.signInWithRedirect(provider);
        return; // Page reloads; getRedirectResult() in setupAuthListener handles the result
      }
      throw popupErr;
    }

    if (!result || !result.user) {
      showResultToast("Login cancelled.");
      return;
    }

    currentUser = result.user;
    state.playerName = currentUser.displayName || "Player";
    userDocRef = db ? db.collection("users").doc(currentUser.uid) : null;

    if (userDocRef) {
      try {
        const doc = await userDocRef.get();
        if (doc.exists) {
          applyFirestoreData(doc.data());
        } else {
          await pushStateToFirestore();
        }
      } catch (e) {
        console.warn("Firestore profile error", e);
      }
    }

    saveState();
    updateStatsUI();
    syncControlsFromState();
    applyTheme();
    showSignedInUI();
    showResultToast("Signed in as " + state.playerName);
  } catch (err) {
    console.error("Google login failed", err);
    showResultToast("Login failed. Check console.");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Sign in with Google";
    }
  }
}

// Called by native Android after sign-in completes
window.handleGoogleSignInResult = function (success, tokenOrError) {
  if (success !== "true") {
    console.error("Native Google Sign-In FAILED:", tokenOrError);
    showResultToast("Native sign-in failed.");
    return;
  }

  const idToken = tokenOrError;
  const credential = firebase.auth.GoogleAuthProvider.credential(idToken);

  firebase.auth().signInWithCredential(credential)
    .then(async (userCredential) => {
      currentUser = userCredential.user;
      state.playerName = currentUser.displayName || "Player";
      userDocRef = db ? db.collection("users").doc(currentUser.uid) : null;

      if (userDocRef) {
        try {
          const doc = await userDocRef.get();
          if (doc.exists) {
            applyFirestoreData(doc.data());
          } else {
            await pushStateToFirestore();
          }
        } catch (e) {
          console.warn("Firestore profile error", e);
        }
      }

      saveState();
      updateStatsUI();
      syncControlsFromState();
      applyTheme();
      showSignedInUI();
      showResultToast("Signed in as " + state.playerName);
      console.log("Firebase session established for UID:", userCredential.user.uid);
    })
    .catch((error) => {
      console.error("Error establishing web session with token:", error);
      showResultToast("Login failed. Check console.");
    });
};

// --------------------- AUTH LISTENER ---------------------

function setupAuthListener() {
  if (!auth || !db) {
    console.warn("Firebase auth/db not available");
    showSignedOutUI();
    return;
  }

  // Handle redirect result if used anywhere
  auth.getRedirectResult()
    .then(async (result) => {
      if (result && result.user) {
        currentUser = result.user;
        state.playerName = currentUser.displayName || "Player";
        userDocRef = db.collection("users").doc(currentUser.uid);

        const doc = await userDocRef.get();
        if (doc.exists) {
          applyFirestoreData(doc.data());
        } else {
          await pushStateToFirestore();
        }

        saveState();
        updateStatsUI();
        syncControlsFromState();
        applyTheme();
        showSignedInUI();
        showResultToast("Signed in as " + state.playerName);
      }
    })
    .catch(err => {
      console.warn("Redirect login error:", err);
    });

  auth.onAuthStateChanged(async (user) => {
    if (user) {
      currentUser = user;
      state.playerName = user.displayName || "Player";
      userDocRef = db.collection("users").doc(user.uid);

      try {
        const doc = await userDocRef.get();
        if (doc.exists) {
          applyFirestoreData(doc.data());
        } else {
          await pushStateToFirestore();
        }
      } catch (e) {
        console.warn("Error loading Firestore profile", e);
      }

      saveState();
      updateStatsUI();
      syncControlsFromState();
      applyTheme();
      showSignedInUI();
    } else {
      currentUser = null;
      userDocRef = null;
      showSignedOutUI();
    }
  });
}

// --------------------- SKIN DISPLAY ---------------------

function getDisplaySymbol(mark) {
  if (!mark) return "";

  switch (state.skin) {
    case "xo": return mark;
    case "emoji": return mark === "X" ? "😀" : "😈";
    case "fruits": return mark === "X" ? "🍇" : "🍊";
    case "dragon": return mark === "X" ? "🐉" : "🔥";
    case "phoenix": return mark === "X" ? "🪽" : "🕊️";
    default: return mark;
  }
}

// --------------------- BOARD LOGIC ---------------------

function createBoardCells() {
  if (!window.els || !els.board) return;

  els.board.innerHTML = "";
  board = new Array(9).fill("");

  for (let i = 0; i < 9; i++) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.dataset.index = i;
    cell.addEventListener("click", onCellClick);
    els.board.appendChild(cell);
  }
}

function resetBoard() {
  board.fill("");

  if (window.els?.board) {
    els.board.querySelectorAll(".cell").forEach(c => {
      c.textContent = "";
      c.className = "cell";
    });
  }

  gameActive = true;
  safeText(window.els?.gameStatus, "Your turn");
}

function renderBoard() {
  if (!window.els?.board) return;

  const cells = els.board.querySelectorAll(".cell");
  for (let i = 0; i < 9; i++) {
    const mark = board[i];
    cells[i].textContent = getDisplaySymbol(mark);
    cells[i].className =
      "cell " + (mark === "X" ? "x" : mark === "O" ? "o" : "");
  }
}

function isBoardFull() {
  return board.every(c => c !== "");
}

function checkWin(player) {
  const wins = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  return wins.some(w => w.every(i => board[i] === player));
}

function findBestMove(player) {
  const wins = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];

  for (const [a, b, c] of wins) {
    const vals = [board[a], board[b], board[c]];
    if (vals.filter(v => v === player).length === 2 && vals.includes("")) {
      return [a, b, c].find(i => board[i] === "");
    }
  }
  return -1;
}

function cpuMove() {
  if (!gameActive) return;

  let move = findBestMove("O");
  if (move === -1) move = findBestMove("X");
  if (move === -1 && board[4] === "") move = 4;

  if (move === -1) {
    const empty = board
      .map((v, i) => v === "" ? i : null)
      .filter(v => v !== null);
    move = empty[Math.floor(Math.random() * empty.length)];
  }

  board[move] = "O";
  if (exists(window.playClick)) window.playClick();
  renderBoard();

  if (checkWin("O")) return handleResult("cpu");
  if (isBoardFull()) return handleResult("draw");

  safeText(window.els?.gameStatus, "Your turn");
}

function onCellClick(e) {
  if (!gameActive) return;

  const idx = Number(e.currentTarget.dataset.index);
  if (board[idx] !== "") return;

  board[idx] = "X";
  if (exists(window.playClick)) window.playClick();
  renderBoard();

  if (checkWin("X")) return handleResult("player");
  if (isBoardFull()) return handleResult("draw");

  safeText(window.els?.gameStatus, "CPU thinking…");
  setTimeout(cpuMove, 450);
}

// --------------------- RESULT + LEADERBOARD ---------------------

function handleResult(result) {
  gameActive = false;

  if (result === "player") {
    state.coins += state.stake * 2;
    state.wins++;
    state.currentStreak++;
    if (state.currentStreak > state.bestStreak) {
      state.bestStreak = state.currentStreak;
    }
    safeText(window.els?.gameStatus, "You win!");
    if (exists(window.playWin)) window.playWin();
    showResultToast(`YOU WIN +${state.stake * 2} coins`);
  } else if (result === "cpu") {
    state.coins -= state.stake;
    if (state.coins < 0) state.coins = 0;
    state.losses++;
    state.currentStreak = 0;
    safeText(window.els?.gameStatus, "CPU wins!");
    if (exists(window.playLose)) window.playLose();
    showResultToast(`CPU WINS -${state.stake} coins`);
  } else {
    state.draws++;
    safeText(window.els?.gameStatus, "It's a draw.");
    if (exists(window.playDrawSound)) window.playDrawSound();
    showResultToast("DRAW 0 coins");
  }

  updateStatsUI();
  saveState();
  updateLeaderboardFromState();
  pushStateToFirestore();
  cgMaybeShowMidgameAd();
}

function loadLeaderboard() {
  const saved = localStorage.getItem(STORAGE_KEY + "_lb");
  if (!saved) return [];
  try {
    return JSON.parse(saved);
  } catch {
    return [];
  }
}

function saveLeaderboard(list) {
  localStorage.setItem(STORAGE_KEY + "_lb", JSON.stringify(list));
}

function updateLeaderboardFromState() {
  let list = loadLeaderboard();
  const existing = list.find(e => e.name === state.playerName);

  if (existing) {
    existing.bestStreak = Math.max(existing.bestStreak, state.bestStreak);
    existing.coins = state.coins;
  } else {
    list.push({
      name: state.playerName,
      bestStreak: state.bestStreak,
      coins: state.coins
    });
  }

  list.sort((a, b) => b.bestStreak - a.bestStreak);
  saveLeaderboard(list);
}

function renderLeaderboard() {
  if (!window.els?.leaderboardList) return;

  const list = loadLeaderboard();

  if (!list.length) {
    const p = document.createElement('p');
    p.className = 'helper-text';
    p.textContent = 'No games played yet.';
    els.leaderboardList.appendChild(p);
    return;
  }

  els.leaderboardList.innerHTML = "";
  list.forEach((row, i) => {
    const div = document.createElement("div");
    div.className = "leaderboard-row";

    const rank = document.createElement("span");
    rank.className = "lb-rank";
    rank.textContent = `${i + 1}.`;

    const name = document.createElement("span");
    name.className = "lb-name";
    name.textContent = row.name;

    const streak = document.createElement("span");
    streak.className = "lb-streak";
    streak.textContent = `Streak: ${row.bestStreak}`;

    const coins = document.createElement("span");
    coins.className = "lb-coins";
    coins.textContent = `${row.coins} coins`;

    div.appendChild(rank);
    div.appendChild(name);
    div.appendChild(streak);
    div.appendChild(coins);
    els.leaderboardList.appendChild(div);
  });
}

// --------------------- MATCH ENTRY / EXIT ---------------------

function canAffordStake() {
  return state.coins >= state.stake;
}

function startMatch() {
  if (!canAffordStake()) {
    alert("Not enough coins for this table.");
    return;
  }

  state.coins -= state.stake;
  if (state.coins < 0) state.coins = 0;

  updateStatsUI();
  saveState();
  pushStateToFirestore();

  const diffLabel =
    state.difficulty === "easy"
      ? "Easy"
      : state.difficulty === "hard"
      ? "Hard"
      : "Normal";

  safeText(window.els?.gameModeLabel, `Vs CPU - ${diffLabel}`);
  safeText(window.els?.gameStakeLabel, `${state.stake} coin match`);

  cgGameplayStart();
  showScreen("game");
  createBoardCells();
  resetBoard();
}

function backToHome() {
  cgGameplayStop();
  showScreen("home");
  gameActive = false;
}

// --------------------- EVENTS ---------------------

function setupEvents() {

if (els.btnToggleMusic) {
  els.btnToggleMusic.addEventListener("click", () => {
    playClick();
    toggleMusic();
  });
}
  if (!window.els) return;

  // splash sequence
  cgLoadingStart();
  showScreen("splashStudio");
  setTimeout(() => showScreen("splashGame"), 1400);
  setTimeout(() => { showScreen("home"); cgLoadingStop(); }, 3000);

  if (els.btnPlayGuest) {
    els.btnPlayGuest.addEventListener("click", () => {
      const name = els.nicknameInput?.value?.trim() || "";
      state.playerName = name || "Guest";
      saveState();
      updateStatsUI();
      syncControlsFromState();
      startMatch();
    });
  }

  if (els.btnLoginGoogle) {
    els.btnLoginGoogle.addEventListener("click", signInWithGoogle);
  }

  if (els.btnLogout) {
    els.btnLogout.addEventListener("click", () => {
      if (auth) {
        auth.signOut().catch(err => console.warn("Logout error", err));
      }
      currentUser = null;
      userDocRef = null;
      state.playerName = "Guest";
      saveState();
      updateStatsUI();
      syncControlsFromState();
      applyTheme();
      showSignedOutUI();
      backToHome();
    });
  }

  if (els.btnPlayCpu) {
    els.btnPlayCpu.addEventListener("click", startMatch);
  }

  if (els.boardThemeRow) {
    els.boardThemeRow.addEventListener("click", e => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      state.theme = btn.dataset.theme;
      syncControlsFromState();
      applyTheme();
      saveState();
    });
  }

  if (els.pieceSkinRow) {
    els.pieceSkinRow.addEventListener("click", e => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      state.skin = btn.dataset.skin;
      syncControlsFromState();
      applyTheme();
      saveState();
      renderBoard();
    });
  }

  if (els.difficultySelect) {
    els.difficultySelect.addEventListener("change", () => {
      state.difficulty = els.difficultySelect.value;
      saveState();
    });
  }

  if (els.matchStakeRow) {
    els.matchStakeRow.addEventListener("click", e => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      state.stake = Number(btn.dataset.stake);
      syncControlsFromState();
      saveState();
    });
  }

  if (els.btnToggleSfx) {
    els.btnToggleSfx.addEventListener("click", () => {
      state.sfxOn = !state.sfxOn;
      syncControlsFromState();
      saveState();
      if (state.sfxOn && exists(window.playClick)) window.playClick();
    });
  }

  if (els.btnBackHome) {
    els.btnBackHome.addEventListener("click", () => {
      if (exists(window.playClick)) window.playClick();
      backToHome();
    });
  }

  if (els.btnNewRound) {
    els.btnNewRound.addEventListener("click", () => {
      if (exists(window.playClick)) window.playClick();
      resetBoard();
    });
  }

  if (els.btnGiveUp) {
    els.btnGiveUp.addEventListener("click", () => {
      if (!gameActive) return;
      if (!confirm("Give up this match?")) return;
      handleResult("cpu");
    });
  }

  if (els.btnOpenLeaderboard) {
    els.btnOpenLeaderboard.addEventListener("click", () => {
      renderLeaderboard();
      safeClassRemove(els.leaderboardOverlay, "hidden");
      if (exists(window.playClick)) window.playClick();
    });
  }

  if (els.btnCloseLeaderboard) {
    els.btnCloseLeaderboard.addEventListener("click", () => {
      safeClassAdd(els.leaderboardOverlay, "hidden");
      if (exists(window.playClick)) window.playClick();
    });
  }

  if (els.btnResetLeaderboard) {
    els.btnResetLeaderboard.style.display = "none";
  }
}

// --------------------- AUDIO ---------------------

window.bgMusic = null;
window.clickSfx = null;
window.winSfx = null;
window.loseSfx = null;
window.drawSfx = null;

function loadSounds() {
  if (!window.bgMusic) {
    window.bgMusic = new Audio("sound/bg.mp3");
    window.bgMusic.loop = true;
    window.bgMusic.volume = 0.35;
  }

  if (!window.clickSfx) {
    window.clickSfx = new Audio("sound/click.mp3");
    window.clickSfx.volume = 1;
  }

  if (!window.winSfx) {
    window.winSfx = new Audio("sound/win.mp3");
    window.winSfx.volume = 1;
  }

  if (!window.loseSfx) {
    window.loseSfx = new Audio("sound/lose.mp3");
    window.loseSfx.volume = 1;
  }

  if (!window.drawSfx) {
    window.drawSfx = new Audio("sound/draw.mp3");
    window.drawSfx.volume = 1;
  }
}

function playClick() {
  if (!state.sfxOn) return;
  loadSounds();
  if (!window.clickSfx) return;

  window.clickSfx.currentTime = 0;
  window.clickSfx.play().catch(err => console.warn("click sound failed", err));
}

function playWin() {
  if (!state.sfxOn) return;
  loadSounds();
  if (!window.winSfx) return;

  window.winSfx.currentTime = 0;
  window.winSfx.play().catch(err => console.warn("win sound failed", err));
}

function playLose() {
  if (!state.sfxOn) return;
  loadSounds();
  if (!window.loseSfx) return;

  window.loseSfx.currentTime = 0;
  window.loseSfx.play().catch(err => console.warn("lose sound failed", err));
}

function playDrawSound() {
  if (!state.sfxOn) return;
  loadSounds();
  if (!window.drawSfx) return;

  window.drawSfx.currentTime = 0;
  window.drawSfx.play().catch(err => console.warn("draw sound failed", err));
}

function startMusic() {
  loadSounds();
  if (!window.bgMusic) return;

  window.bgMusic.loop = true;
  window.bgMusic.volume = 0.35;
  window.bgMusic.play().catch(err => console.warn("music start failed", err));
}

function stopMusic() {
  if (!window.bgMusic) return;
  window.bgMusic.pause();
}

function toggleMusic() {
  state.musicOn = !state.musicOn;

  if (state.musicOn) {
    startMusic();
  } else {
    stopMusic();
  }

  syncControlsFromState();
  saveState();
}

function unlockAudio() {
  loadSounds();

  if (state.musicOn && window.bgMusic) {
    window.bgMusic.play().catch(() => {});
  }

  if (!window.clickSfx) return;

  const oldVol = window.clickSfx.volume;
  window.clickSfx.volume = 0;
  window.clickSfx.currentTime = 0;
  window.clickSfx.play().catch(() => {});

  setTimeout(() => {
    window.clickSfx.pause();
    window.clickSfx.currentTime = 0;
    window.clickSfx.volume = oldVol;
  }, 200);

  document.removeEventListener("touchstart", unlockAudio);
  document.removeEventListener("click", unlockAudio);
}

document.addEventListener("touchstart", unlockAudio, { once: true });
document.addEventListener("click", unlockAudio, { once: true });

// --------------------- CRAZYGAMES ENVIRONMENT ---------------------

function isCrazyGamesEnv() {
  return !!(window.CrazyGames) ||
    window.location.hostname.includes("crazygames.com") ||
    window.location.hostname.includes("crazygames.io");
}

function applyCrazyGamesMode() {
  if (!isCrazyGamesEnv()) return;

  const btnGoogle = document.getElementById("btnLoginGoogle");
  if (btnGoogle) {
    btnGoogle.style.display = "none";
  }

  const loginStatus = document.getElementById("loginStatusText");
  if (loginStatus) {
    loginStatus.textContent = "Playing as Guest on CrazyGames.";
  }
}

// --------------------- INIT ---------------------

function init() {
  loadState();
  updateStatsUI();
  syncControlsFromState();
  applyTheme();
  setupEvents();
  updateLeaderboardFromState();
  setupAuthListener();
  applyCrazyGamesMode();
}

document.addEventListener("DOMContentLoaded", init);