const SHAPE_NAMES = ["circle", "triangle", "cross", "square", "star"];
const SPECIAL_BADGES = {
  1: { text: "Hold", key: "hold" },
  2: { text: "+2", key: "plus-two" },
  5: { text: "+3", key: "plus-three" },
  8: { text: "Skip", key: "skip" },
  14: { text: "Market", key: "market" },
};

function getCardData() {
  const cards = [];
  for (const shape of SHAPE_NAMES) {
    const numbers = {
      circle: [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14],
      triangle: [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14],
      cross: [1, 2, 3, 5, 7, 10, 11, 13, 14],
      square: [1, 2, 3, 5, 7, 10, 11, 13, 14],
      star: [1, 2, 3, 4, 5, 7, 8],
    }[shape];

    for (const number of numbers) {
      cards.push({ shape, number, state: "playable" });
    }
  }

  for (let i = 0; i < 5; i += 1) {
    cards.push({ shape: "whot", number: 20, state: "playable" });
  }

  return cards;
}

function ensureSprite() {
  if (document.getElementById("whot-shape-sprite")) return;

  const sprite = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  sprite.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  sprite.setAttribute("style", "position:absolute;width:0;height:0;overflow:hidden");
  sprite.id = "whot-shape-sprite";
  sprite.setAttribute("aria-hidden", "true");
  sprite.innerHTML = `
    <symbol id="shape-circle" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="33" />
    </symbol>
    <symbol id="shape-triangle" viewBox="0 0 100 100">
      <path d="M50 14 L86 82 L14 82 Z" />
    </symbol>
    <symbol id="shape-cross" viewBox="0 0 100 100">
      <path d="M50 12 L60 12 L60 36 L84 36 L84 46 L60 46 L60 88 L50 88 L50 46 L16 46 L16 36 L50 36 Z" />
    </symbol>
    <symbol id="shape-square" viewBox="0 0 100 100">
      <rect x="18" y="18" width="64" height="64" rx="6" />
    </symbol>
    <symbol id="shape-star" viewBox="0 0 100 100">
      <path d="M50 10 L60 36 L88 36 L66 54 L76 82 L50 63 L24 82 L34 54 L12 36 L40 36 Z" />
    </symbol>
  `;
  document.body.appendChild(sprite);
}

function shapeMarkup(shape, sizeClass = "card__shape") {
  const symbolId = shape === "whot" ? "shape-star" : `shape-${shape}`;
  return `<svg class="${sizeClass}" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><use href="#${symbolId}" /></svg>`;
}

function badgeMarkup(number) {
  if (!(number in SPECIAL_BADGES)) return "";
  const badge = SPECIAL_BADGES[number];
  return `<span class="card__badge" data-badge="${badge.key}">${badge.text}</span>`;
}

function cardLabel({ shape, number }) {
  if (number === 20) return "Whot card";
  if (shape === "cross") return `${number} of crosses`;
  if (shape === "square") return `${number} of squares`;
  return `${number} of ${shape}s`;
}

function buildCard({ shape = "circle", number = 1, state = "playable" }) {
  ensureSprite();

  const card = document.createElement("div");
  card.className = `card ${number === 20 ? "card--whot" : ""}`.trim();
  card.dataset.shape = shape;
  card.dataset.number = String(number);
  card.dataset.state = state;
  card.setAttribute("role", "img");
  card.setAttribute("aria-label", cardLabel({ shape, number }));

  const isWhot = number === 20;
  const numberMarkup = `<span class="card__number">${number}</span>`;
  const miniMarkup = `<span class="card__mini">${shapeMarkup(shape, "card__mini")}</span>`;

  if (isWhot) {
    card.innerHTML = `
      <div class="card__corner card__corner--top-left">${numberMarkup}</div>
      <div class="card__inner">
        <div class="card__whot-wordmark">WHOT</div>
        <div class="card__whot-ring">
          ${["circle", "triangle", "cross", "square", "star"].map((shapeName) => `<span class="card__mini">${shapeMarkup(shapeName, "card__mini")}</span>`).join("")}
        </div>
      </div>
      <div class="card__corner card__corner--bottom-right">${numberMarkup}</div>
    `;
    return card;
  }

  const badge = badgeMarkup(number);
  const content = `
    <div class="card__corner card__corner--top-left">
      <span class="card__number">${number}</span>
      ${shapeMarkup(shape, "card__mini")}
    </div>
    <div class="card__inner">
      <div class="card__shape-wrap">
        ${shapeMarkup(shape, "card__shape")}
      </div>
      ${badge}
    </div>
    <div class="card__corner card__corner--bottom-right">
      <span class="card__number">${number}</span>
      ${shapeMarkup(shape, "card__mini")}
    </div>
  `;

  card.innerHTML = content;
  return card;
}

function buildCardBack({ state = "playable" } = {}) {
  const card = document.createElement("div");
  card.className = "card card--back";
  card.dataset.state = state;
  card.setAttribute("role", "img");
  card.setAttribute("aria-label", "Whot card back");
  return card;
}

function renderAllCards(targetId = "card-gallery") {
  const target = document.getElementById(targetId);
  if (!target) return;

  const cards = getCardData();
  target.innerHTML = "";

  cards.forEach((card) => {
    const node = buildCard(card);
    target.appendChild(node);
  });
}

if (typeof window !== "undefined") {
  window.WhotTheme = {
    SHAPE_NAMES,
    SPECIAL_BADGES,
    getCardData,
    buildCard,
    buildCardBack,
    renderAllCards,
    ensureSprite,
  };
}

export { SHAPE_NAMES, SPECIAL_BADGES, getCardData, buildCard, buildCardBack, renderAllCards, ensureSprite };
