import assert from "node:assert/strict";
import {
  callLastCard,
  callShape,
  createGame,
  drawCard,
  getLegalCards,
  missLastCard,
  playCard,
  SHAPES,
} from "./engine.js";

function fixture({ hands, top, market = [], settings = {}, turnIndex = 0 }) {
  const game = createGame({ playerNames: hands.map((_, i) => `P${i}`), settings });
  game.players.forEach((player, index) => { player.hand = hands[index]; });
  game.discard = [top];
  game.market = [...market];
  game.turnIndex = turnIndex;
  return game;
}

const card = (id, shape, number) => ({ id, shape, number });

// The prescribed shape counts plus five Whot cards make a 54-card deck.
const fresh = createGame({ rng: () => 0.5 });
assert.equal(fresh.players.reduce((sum, player) => sum + player.hand.length, 0), 12);
assert.equal(fresh.market.length + fresh.discard.length + 12, 54);
assert.deepEqual(SHAPES.length, 5);

// Two Pick Twos stack and the following player draws the accumulated amount.
const attack = fixture({
  hands: [
    [card("a2", "circle", 2), card("a3", "star", 3)],
    [card("b2", "star", 2), card("b3", "circle", 3)],
    [card("c3", "cross", 3)],
  ],
  top: card("top", "square", 2),
  market: Array.from({ length: 10 }, (_, i) => card(`m${i}`, "star", 3)),
});
playCard(attack, 0, "a2");
assert.equal(attack.pendingAttack.amount, 2);
playCard(attack, 1, "b2");
assert.equal(attack.pendingAttack.amount, 4);
assert.equal(attack.turnIndex, 2);
drawCard(attack, 2);
assert.equal(attack.players[2].hand.length, 5);
assert.equal(attack.pendingAttack, null);

const mustPlay = fixture({
  hands: [[card("matching", "circle", 4)], [card("opponent", "star", 6)]],
  top: card("top-must-play", "circle", 7),
  market: [card("reserve", "square", 9)],
});
assert.throws(() => drawCard(mustPlay, 0), /Play a legal card/);

const pickThreeDefence = fixture({
  hands: [
    [card("panic", "circle", 5), card("wrong", "square", 3)],
    [card("defend", "star", 5), card("still-wrong", "circle", 7)],
  ],
  top: card("top", "triangle", 5),
  market: [card("reserve", "cross", 9)],
  turnIndex: 0,
});
playCard(pickThreeDefence, 0, "panic");
assert.equal(pickThreeDefence.pendingAttack.amount, 3);
assert.deepEqual(
  getLegalCards(pickThreeDefence, 1).map((cardItem) => cardItem.id),
  ["defend"],
);
assert.throws(() => playCard(pickThreeDefence, 1, "still-wrong"), /cannot be played now/);

// General Market gives each other player a card and returns the turn by default.
const marketGame = fixture({
  hands: [
    [card("gm", "circle", 14), card("stay", "star", 3)],
    [card("p1", "square", 4)],
    [card("p2", "cross", 4)],
  ],
  top: card("top", "star", 14),
  market: [card("draw1", "circle", 3), card("draw2", "triangle", 4)],
});
playCard(marketGame, 0, "gm");
assert.equal(marketGame.players[1].hand.length, 2);
assert.equal(marketGame.players[2].hand.length, 2);
assert.equal(marketGame.turnIndex, 0);

// Whot pauses the turn until the player calls a valid shape.
const whot = fixture({
  hands: [
    [card("w", "whot", 20), card("same", "circle", 7)],
    [card("other", "star", 1)],
  ],
  top: card("top", "triangle", 4),
});
playCard(whot, 0, "w");
assert.ok(whot.pendingShapeCall);
callShape(whot, 0, "circle");
assert.equal(whot.calledShape, "circle");
assert.equal(whot.turnIndex, 1);
assert.deepEqual(getLegalCards(whot, 1), []);

// An empty market recycles the discard pile but keeps its top card.
const recycle = fixture({
  hands: [
    [card("not-match", "cross", 9)],
    [card("other", "star", 6)],
  ],
  top: card("discard", "circle", 4),
  market: [],
});
recycle.discard = [card("older", "square", 3), recycle.discard[0]];
drawCard(recycle, 0);
assert.equal(recycle.players[0].hand.length, 2);
assert.equal(recycle.discard.length, 1);
assert.equal(recycle.discard[0].id, "discard");

// Missing the required Last card call adds two cards; calling it does not.
const last = fixture({
  hands: [
    [card("play", "circle", 4), card("left", "star", 7)],
    [card("other", "triangle", 3)],
  ],
  top: card("top", "square", 4),
  market: [card("penalty1", "cross", 3), card("penalty2", "star", 1)],
  settings: { requireLastCardCall: true },
});
playCard(last, 0, "play");
assert.ok(last.pendingLastCard);
missLastCard(last, 0);
assert.equal(last.players[0].hand.length, 3);

const called = fixture({
  hands: [
    [card("play2", "circle", 4), card("left2", "star", 7)],
    [card("other2", "triangle", 3)],
  ],
  top: card("top2", "square", 4),
  settings: { requireLastCardCall: true },
});
playCard(called, 0, "play2");
callLastCard(called, 0);
assert.equal(called.players[0].hand.length, 1);
assert.equal(called.turnIndex, 1);

console.log("All Whot engine tests passed.");
