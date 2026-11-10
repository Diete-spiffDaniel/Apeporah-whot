// Whot rules and game state. This module has no browser or DOM dependencies.
export const SHAPES = ["circle", "triangle", "cross", "square", "star"];
export const SPECIAL_NUMBERS = [1, 2, 5, 8, 14, 20];

const CARD_NUMBERS = {
  circle: [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14],
  triangle: [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14],
  cross: [1, 2, 3, 5, 7, 10, 11, 13, 14],
  square: [1, 2, 3, 5, 7, 10, 11, 13, 14],
  star: [1, 2, 3, 4, 5, 7, 8],
};

export const DEFAULT_SETTINGS = Object.freeze({
  startingHandSize: 6,
  defendAttacks: true,
  generalMarketExtraTurn: true,
  requireLastCardCall: false,
  canFinishOnSpecial: true,
  specials: Object.freeze({
    1: true,
    2: true,
    5: true,
    8: true,
    14: true,
    20: true,
  }),
});

function makeDeck() {
  const cards = [];
  let id = 0;
  for (const shape of SHAPES) {
    for (const number of CARD_NUMBERS[shape]) {
      cards.push({ id: `c${id++}`, shape, number });
    }
  }
  for (let i = 0; i < 5; i += 1) {
    cards.push({ id: `c${id++}`, shape: "whot", number: 20 });
  }
  return cards;
}

function shuffle(cards, rng) {
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

function mergeSettings(settings = {}) {
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    specials: { ...DEFAULT_SETTINGS.specials, ...(settings.specials || {}) },
  };
}

function isEnabledSpecial(state, card) {
  return SPECIAL_NUMBERS.includes(card.number) && state.settings.specials[card.number] !== false;
}

function nextIndex(state, index, steps = 1) {
  return (index + steps) % state.players.length;
}

function recycleMarket(state) {
  if (state.market.length || state.discard.length <= 1) return false;
  const top = state.discard.pop();
  state.market = shuffle(state.discard.splice(0), Math.random);
  state.discard = [top];
  return state.market.length > 0;
}

function takeFromMarket(state) {
  if (!state.market.length) recycleMarket(state);
  return state.market.pop() || null;
}

function drawCards(state, playerIndex, count) {
  const player = state.players[playerIndex];
  const drawn = [];
  for (let i = 0; i < count; i += 1) {
    const card = takeFromMarket(state);
    if (!card) break;
    player.hand.push(card);
    drawn.push(card);
  }
  return drawn;
}

function setWinner(state, playerIndex, reason = "check-up") {
  state.winner = playerIndex;
  state.endReason = reason;
  state.banner = reason === "check-up" ? "Check up!" : "Market empty — lowest card total wins";
}

function settleEmptyMarket(state) {
  if (state.winner !== null || state.market.length || state.discard.length > 1) return;
  let winner = 0;
  for (let i = 1; i < state.players.length; i += 1) {
    if (state.players[i].hand.length < state.players[winner].hand.length) winner = i;
  }
  setWinner(state, winner, "lowest-score");
}

function advanceTurn(state, playerIndex, steps = 1) {
  state.turnIndex = nextIndex(state, playerIndex, steps);
  state.pendingLastCard = null;
  settleEmptyMarket(state);
}

function resolvePlayedCard(state, playerIndex, card) {
  const player = state.players[playerIndex];
  if (player.hand.length === 0) {
    setWinner(state, playerIndex);
    return;
  }

  let upcomingIndex = nextIndex(state, playerIndex);
  let banner = "";

  const isSameAttackDefense =
    state.pendingAttack && state.pendingAttack.number === card.number && isEnabledSpecial(state, card);

  if (state.pendingAttack && !isSameAttackDefense) {
    state.pendingAttack = null;
  }

  if (isEnabledSpecial(state, card)) {
    switch (card.number) {
      case 1:
        upcomingIndex = playerIndex;
        banner = `${player.name} plays again`;
        break;
      case 2:
      case 5: {
        const amount = card.number === 2 ? 2 : 3;
        const previousAmount = isSameAttackDefense ? state.pendingAttack.amount : 0;
        state.pendingAttack = { number: card.number, amount: previousAmount + amount };
        banner = `Pick ${state.pendingAttack.amount} — defend with another ${card.number}`;
        break;
      }
      case 8:
        upcomingIndex = nextIndex(state, playerIndex, 2);
        banner = `${state.players[nextIndex(state, playerIndex)].name} is suspended`;
        break;
      case 14:
        for (let i = 0; i < state.players.length; i += 1) {
          if (i !== playerIndex) drawCards(state, i, 1);
        }
        if (state.settings.generalMarketExtraTurn) {
          upcomingIndex = playerIndex;
          banner = "General Market — you play again";
        } else {
          banner = "General Market";
        }
        break;
      case 20:
        banner = `Shape called: ${state.calledShape}`;
        break;
      default:
        break;
    }
  } else {
    state.pendingAttack = null;
  }

  if (player.hand.length === 1 && state.settings.requireLastCardCall) {
    state.pendingLastCard = { playerIndex, upcomingIndex };
    state.banner = "Tap Last card! or draw 2";
    return;
  }

  advanceTurn(state, playerIndex, (upcomingIndex - playerIndex + state.players.length) % state.players.length);
  state.banner = player.hand.length === 1 ? `${player.name}: Last card!` : banner;
}

function cardMatches(state, card) {
  const top = state.discard[state.discard.length - 1];
  if (!top) return false;
  if (card.number === 20 && isEnabledSpecial(state, card)) return true;
  if (top.shape === "whot" && state.calledShape) {
    return card.shape === state.calledShape;
  }
  return card.shape === top.shape || card.number === top.number;
}

export function createGame({
  playerNames = ["You", "Computer"],
  computerPlayers = [],
  settings = {},
  rng = Math.random,
} = {}) {
  if (!Array.isArray(playerNames) || playerNames.length < 2 || playerNames.length > 4) {
    throw new RangeError("Whot requires 2 to 4 players.");
  }
  const mergedSettings = mergeSettings(settings);
  if (!Number.isInteger(mergedSettings.startingHandSize) ||
      mergedSettings.startingHandSize < 4 || mergedSettings.startingHandSize > 7) {
    throw new RangeError("Starting hand size must be from 4 to 7.");
  }

  const deck = shuffle(makeDeck(), rng);
  const players = playerNames.map((name, index) => ({
    id: `p${index}`,
    name,
    isComputer: computerPlayers.includes(index),
    difficulty: "normal",
    hand: [],
  }));
  for (let round = 0; round < mergedSettings.startingHandSize; round += 1) {
    for (const player of players) player.hand.push(deck.pop());
  }
  let starterIndex = deck.findIndex((card) => !SPECIAL_NUMBERS.includes(card.number));
  if (starterIndex < 0) throw new Error("Unable to find a non-special starting card.");
  const starter = deck.splice(starterIndex, 1)[0];

  return {
    players,
    market: deck,
    discard: [starter],
    turnIndex: 0,
    settings: mergedSettings,
    pendingAttack: null,
    pendingShapeCall: null,
    pendingLastCard: null,
    calledShape: null,
    winner: null,
    endReason: null,
    banner: "",
    drawMemory: Object.fromEntries(SHAPES.map((shape) => [shape, 0])),
  };
}

export function getLegalCards(state, playerIndex = state.turnIndex) {
  if (state.winner !== null || state.pendingShapeCall || state.pendingLastCard ||
      playerIndex !== state.turnIndex) return [];
  const hand = state.players[playerIndex].hand;
  if (state.pendingAttack) {
    if (!state.settings.defendAttacks) return [];
    return hand.filter((card) =>
      card.number === state.pendingAttack.number && isEnabledSpecial(state, card),
    );
  }
  return hand.filter((card) =>
    cardMatches(state, card) &&
    (hand.length !== 1 || state.settings.canFinishOnSpecial || !isEnabledSpecial(state, card)),
  );
}

export function playCard(state, playerIndex, cardId, calledShape = null) {
  if (state.winner !== null || playerIndex !== state.turnIndex ||
      state.pendingShapeCall || state.pendingLastCard) {
    throw new Error("It is not this player's turn to play a card.");
  }
  const hand = state.players[playerIndex].hand;
  const cardIndex = hand.findIndex((card) => card.id === cardId);
  if (cardIndex < 0) throw new Error("That card is not in the player's hand.");
  const card = hand[cardIndex];
  if (!getLegalCards(state, playerIndex).some((legal) => legal.id === card.id)) {
    throw new Error("That card cannot be played now.");
  }
  if (hand.length === 1 && !state.settings.canFinishOnSpecial && isEnabledSpecial(state, card)) {
    throw new Error("You cannot finish on a special card with the current setting.");
  }

  hand.splice(cardIndex, 1);
  state.discard.push(card);
  if (card.number === 20 && isEnabledSpecial(state, card)) {
    if (hand.length === 0) {
      setWinner(state, playerIndex);
      return state;
    }
    if (!SHAPES.includes(calledShape)) {
      state.pendingShapeCall = { playerIndex };
      return state;
    }
    state.calledShape = calledShape;
  } else {
    state.calledShape = null;
  }
  resolvePlayedCard(state, playerIndex, card);
  return state;
}

export function callShape(state, playerIndex, shape) {
  if (!state.pendingShapeCall || state.pendingShapeCall.playerIndex !== playerIndex ||
      !SHAPES.includes(shape)) {
    throw new Error("A valid shape cannot be called now.");
  }
  state.pendingShapeCall = null;
  state.calledShape = shape;
  resolvePlayedCard(state, playerIndex, state.discard[state.discard.length - 1]);
  return state;
}

export function callLastCard(state, playerIndex) {
  if (!state.pendingLastCard || state.pendingLastCard.playerIndex !== playerIndex) {
    throw new Error("There is no Last card call waiting for this player.");
  }
  const { upcomingIndex } = state.pendingLastCard;
  state.pendingLastCard = null;
  state.turnIndex = upcomingIndex;
  state.banner = `${state.players[playerIndex].name}: Last card!`;
  settleEmptyMarket(state);
  return state;
}

export function missLastCard(state, playerIndex) {
  if (!state.pendingLastCard || state.pendingLastCard.playerIndex !== playerIndex) {
    throw new Error("There is no missed Last card call to resolve.");
  }
  const { upcomingIndex } = state.pendingLastCard;
  drawCards(state, playerIndex, 2);
  state.pendingLastCard = null;
  state.turnIndex = upcomingIndex;
  state.banner = `${state.players[playerIndex].name} missed Last card and drew 2`;
  settleEmptyMarket(state);
  return state;
}

export function drawCard(state, playerIndex = state.turnIndex) {
  if (state.winner !== null || playerIndex !== state.turnIndex ||
      state.pendingShapeCall || state.pendingLastCard) {
    throw new Error("It is not this player's turn to draw.");
  }
  if (!state.pendingAttack && getLegalCards(state, playerIndex).length > 0) {
    throw new Error("Play a legal card before drawing.");
  }
  const player = state.players[playerIndex];
  const attack = state.pendingAttack;
  const amount = attack ? attack.amount : 1;
  const drawn = drawCards(state, playerIndex, amount);
  if (attack) state.pendingAttack = null;
  if (!attack && state.discard.length > 0) {
    const top = state.discard[state.discard.length - 1];
    if (top.shape !== "whot") state.drawMemory[top.shape] += 1;
  }
  advanceTurn(state, playerIndex);
  state.banner = attack
    ? `${player.name} drew ${drawn.length} and lost a turn`
    : drawn.length ? `${player.name} drew a card` : "Market empty";
  return drawn;
}

export function chooseComputerMove(state, playerIndex = state.turnIndex, difficulty = "normal") {
  const legal = getLegalCards(state, playerIndex);
  if (!legal.length) return { type: "draw" };

  let candidates = legal;
  const opponentsClose = state.players.some(
    (player, index) => index !== playerIndex && player.hand.length <= 2,
  );
  if (difficulty !== "easy" && opponentsClose) {
    const attacks = legal.filter((card) => [2, 5].includes(card.number));
    if (attacks.length) candidates = attacks;
  }
  if (difficulty !== "easy") {
    const nonWhot = candidates.filter((card) => card.number !== 20);
    if (nonWhot.length) candidates = nonWhot;
  }
  const card = candidates[Math.floor(Math.random() * candidates.length)];
  let shape = null;
  if (card.number === 20) {
    const counts = Object.fromEntries(SHAPES.map((item) => [item, 0]));
    for (const held of state.players[playerIndex].hand) {
      if (SHAPES.includes(held.shape)) counts[held.shape] += 1;
    }
    shape = SHAPES.reduce((best, item) => {
      if (counts[item] !== counts[best]) return counts[item] > counts[best] ? item : best;
      return difficulty === "hard" && state.drawMemory[item] > state.drawMemory[best] ? item : best;
    }, SHAPES[0]);
  }
  return { type: "play", cardId: card.id, calledShape: shape };
}

export function getCardPoints(card) {
  return card.number;
}
