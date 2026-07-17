/**
 * Nation Role Alignment Quiz — the single source of truth.
 *
 * Fully self-contained and dependency-free so it can run on the client (the
 * quiz is anonymous, no server round-trips to take it). Icons are pulled from
 * lucide-react at the component layer via ARCHETYPE_ICONS, keyed by archetype.
 */

export type ArchetypeKey =
  | "builder"
  | "fighter"
  | "gatherer"
  | "roleplayer"
  | "explorer"
  | "statesman";

export interface Archetype {
  key: ArchetypeKey;
  label: string;
  /** Shown on the result card under the label. */
  blurb: string;
}

/** Order here is the order of the radar spokes, clockwise from the top. */
export const ARCHETYPES: Archetype[] = [
  {
    key: "builder",
    label: "Builder",
    blurb:
      "You raise the keeps and wonders that make a nation worth defending. Stone by stone, you shape what everyone else calls home.",
  },
  {
    key: "fighter",
    label: "Fighter",
    blurb:
      "Front line, first into the breach. When the war drums sound, the realm looks to you to hold the wall and win the field.",
  },
  {
    key: "gatherer",
    label: "Gatherer",
    blurb:
      "No nation marches on an empty stockpile. You keep the warehouses full and the forges fed, come feast or siege.",
  },
  {
    key: "roleplayer",
    label: "Roleplayer",
    blurb:
      "You are the voice of the realm, its heralds and its stories. A nation is remembered for its people, and you give them their tale.",
  },
  {
    key: "explorer",
    label: "Explorer",
    blurb:
      "The map's edge is a starting line to you. You chart the unknown, find what others miss, and bring the frontier home.",
  },
  {
    key: "statesman",
    label: "Statesman",
    blurb:
      "You serve the Council: law, diplomacy, and order. Alliances are won at your table, and disputes are settled by your word.",
  },
];

export const ARCHETYPE_BY_KEY: Record<ArchetypeKey, Archetype> = Object.fromEntries(
  ARCHETYPES.map((a) => [a.key, a])
) as Record<ArchetypeKey, Archetype>;

export type Weights = Partial<Record<ArchetypeKey, number>>;

export interface Answer {
  text: string;
  weights: Weights;
}

export interface Question {
  id: number;
  prompt: string;
  answers: Answer[];
}

export const QUESTIONS: Question[] = [
  {
    id: 1,
    prompt: "An unknown scout approaches your borders. How do you respond?",
    answers: [
      { text: "Greet them and offer a trade agreement.", weights: { statesman: 2, roleplayer: 1 } },
      { text: "Draw your sword and secure the perimeter.", weights: { fighter: 2, explorer: 1 } },
      {
        text: "Observe from the high walls you spent hours perfecting.",
        weights: { builder: 2, gatherer: 1 },
      },
      {
        text: "Ignore them. Those crops won't harvest themselves.",
        weights: { gatherer: 2, builder: 1 },
      },
    ],
  },
  {
    id: 2,
    prompt: "The nation strikes rich iron. What's your first thought?",
    answers: [
      {
        text: "Time to forge a proper set of armour and a blade.",
        weights: { fighter: 2, builder: 1 },
      },
      {
        text: "Stockpile it. We'll need reserves for everything ahead.",
        weights: { gatherer: 2, statesman: 1 },
      },
      {
        text: "Perfect, now I can finish the grand hall's framework.",
        weights: { builder: 2, gatherer: 1 },
      },
      {
        text: "We should negotiate a supply deal with a neighbouring nation.",
        weights: { statesman: 2, roleplayer: 1 },
      },
    ],
  },
  {
    id: 3,
    prompt: "A festival is being planned inside the walls. Your role?",
    answers: [
      {
        text: "Design and decorate the grounds so it's unforgettable.",
        weights: { builder: 2, roleplayer: 1 },
      },
      {
        text: "Play the herald and give the opening speech in character.",
        weights: { roleplayer: 2, statesman: 1 },
      },
      { text: "Run security so no rival crashes the party.", weights: { fighter: 2, explorer: 1 } },
      {
        text: "Gather the feast. Food, drink, and supplies for all.",
        weights: { gatherer: 2, builder: 1 },
      },
    ],
  },
  {
    id: 4,
    prompt: "War drums sound from a rival nation. Where are you?",
    answers: [
      { text: "Front line, first into the breach.", weights: { fighter: 2, explorer: 1 } },
      {
        text: "In the council tent, brokering an alliance to even the odds.",
        weights: { statesman: 2, roleplayer: 1 },
      },
      {
        text: "Fortifying the walls and building the defences overnight.",
        weights: { builder: 2, fighter: 1 },
      },
      {
        text: "Stockpiling arrows, potions, and rations for the siege.",
        weights: { gatherer: 2, statesman: 1 },
      },
    ],
  },
  {
    id: 5,
    prompt: "You get a rare day with nothing assigned. You spend it...",
    answers: [
      {
        text: "Wandering far past the map's edge to see what's out there.",
        weights: { explorer: 2, gatherer: 1 },
      },
      {
        text: "Perfecting a build I've been sketching in my head.",
        weights: { builder: 2, roleplayer: 1 },
      },
      {
        text: "Grinding resources so the stockpiles never run dry.",
        weights: { gatherer: 2, fighter: 1 },
      },
      {
        text: "Hosting a small in-character gathering at the tavern.",
        weights: { roleplayer: 2, statesman: 1 },
      },
    ],
  },
  {
    id: 6,
    prompt: "The nation needs a new leader chosen. You...",
    answers: [
      {
        text: "Put your name forward. Someone has to steer the ship.",
        weights: { statesman: 2, fighter: 1 },
      },
      {
        text: "Back the candidate whose story fits the nation best.",
        weights: { roleplayer: 2, statesman: 1 },
      },
      {
        text: "Don't care who leads, as long as the walls keep rising.",
        weights: { builder: 2, gatherer: 1 },
      },
      {
        text: "Vote quickly and get back out into the wilds.",
        weights: { explorer: 2, gatherer: 1 },
      },
    ],
  },
  {
    id: 7,
    prompt: "A monster nest is discovered near the settlement. You...",
    answers: [
      { text: "Rally a party and clear it out tonight.", weights: { fighter: 2, explorer: 1 } },
      {
        text: "Map the surrounding caves while you're down there.",
        weights: { explorer: 2, gatherer: 1 },
      },
      { text: "Wall it off and reroute the road around it.", weights: { builder: 2, statesman: 1 } },
      {
        text: "Harvest whatever drops and materials it leaves behind.",
        weights: { gatherer: 2, fighter: 1 },
      },
    ],
  },
  {
    id: 8,
    prompt: "What's the first structure a good nation builds?",
    answers: [
      { text: "A defensible keep and walls.", weights: { fighter: 2, builder: 1 } },
      { text: "Warehouses and farms to sustain everyone.", weights: { gatherer: 2, builder: 1 } },
      { text: "A grand town hall worthy of the nation's name.", weights: { builder: 2, statesman: 1 } },
      {
        text: "A tavern and market where people actually gather.",
        weights: { roleplayer: 2, statesman: 1 },
      },
    ],
  },
  {
    id: 9,
    prompt: "Two citizens are in a bitter dispute. You...",
    answers: [
      {
        text: "Mediate and find a compromise both can accept.",
        weights: { statesman: 2, roleplayer: 1 },
      },
      {
        text: "Hear both sides as an in-character judge would.",
        weights: { roleplayer: 2, statesman: 1 },
      },
      { text: "Stay out of it and keep working.", weights: { builder: 2, gatherer: 1 } },
      { text: "Suggest they settle it in a duel.", weights: { fighter: 2, explorer: 1 } },
    ],
  },
  {
    id: 10,
    prompt: "A merchant offers a mysterious sealed map. You...",
    answers: [
      { text: "Buy it instantly and set out at dawn.", weights: { explorer: 2, gatherer: 1 } },
      { text: "Haggle hard, then resell it for profit.", weights: { statesman: 2, gatherer: 1 } },
      { text: "Ask what tale it tells before deciding.", weights: { roleplayer: 2, explorer: 1 } },
      { text: "Pass. I've got a build to finish.", weights: { builder: 2, fighter: 1 } },
    ],
  },
  {
    id: 11,
    prompt: "The stockpile is running low before winter. You...",
    answers: [
      { text: "Organize a mass gathering expedition.", weights: { gatherer: 2, statesman: 1 } },
      { text: "Range far out to find untapped resources.", weights: { explorer: 2, gatherer: 1 } },
      { text: "Raid a rival's supplies to make up the gap.", weights: { fighter: 2, explorer: 1 } },
      {
        text: "Ration what we have and plan distribution fairly.",
        weights: { statesman: 2, builder: 1 },
      },
    ],
  },
  {
    id: 12,
    prompt: "How do you want to be remembered in the nation's history?",
    answers: [
      { text: "The one who built its greatest monuments.", weights: { builder: 2, roleplayer: 1 } },
      { text: "The champion who never lost a battle.", weights: { fighter: 2, explorer: 1 } },
      { text: "The statesman who kept the peace.", weights: { statesman: 2, roleplayer: 1 } },
      { text: "The explorer who charted the unknown.", weights: { explorer: 2, gatherer: 1 } },
    ],
  },
  {
    id: 13,
    prompt: "A newcomer asks how they can help. You tell them to...",
    answers: [
      { text: "Grab a pickaxe. We always need more materials.", weights: { gatherer: 2, builder: 1 } },
      { text: "Train up. Strong arms defend the realm.", weights: { fighter: 2, statesman: 1 } },
      {
        text: "Learn the lore and find their place in the story.",
        weights: { roleplayer: 2, statesman: 1 },
      },
      { text: "Scout the frontier and report what they find.", weights: { explorer: 2, fighter: 1 } },
    ],
  },
  {
    id: 14,
    prompt: "Your ideal base location is...",
    answers: [
      {
        text: "A flat plain with room for a sprawling city.",
        weights: { builder: 2, statesman: 1 },
      },
      { text: "A hidden valley near unexplored frontier.", weights: { explorer: 2, gatherer: 1 } },
      {
        text: "A resource-rich biome with everything on hand.",
        weights: { gatherer: 2, builder: 1 },
      },
      { text: "A defensible ridge overlooking the approach.", weights: { fighter: 2, builder: 1 } },
    ],
  },
  {
    id: 15,
    prompt: "The council votes on a risky expansion. You...",
    answers: [
      { text: "Champion it. Fortune favours the bold.", weights: { explorer: 2, fighter: 1 } },
      { text: "Weigh the costs and argue the sensible case.", weights: { statesman: 2, builder: 1 } },
      { text: "Ask if we can even supply it first.", weights: { gatherer: 2, statesman: 1 } },
      {
        text: "Care most about whether it makes for a good story.",
        weights: { roleplayer: 2, explorer: 1 },
      },
    ],
  },
  {
    id: 16,
    prompt: "In one word, your nation's strength is its...",
    answers: [
      { text: "Walls and wonders.", weights: { builder: 2, gatherer: 1 } },
      { text: "Army.", weights: { fighter: 2, explorer: 1 } },
      { text: "People and their stories.", weights: { roleplayer: 2, statesman: 1 } },
      { text: "Diplomacy and order.", weights: { statesman: 2, builder: 1 } },
    ],
  },
];

export interface QuizResult {
  /** 0..1 per axis, for the radar chart. Every archetype key is present. */
  scores: Record<ArchetypeKey, number>;
  /** Raw point totals, mostly for debugging / future tuning. */
  raw: Record<ArchetypeKey, number>;
  /** Archetypes ranked highest first. Ties broken by ARCHETYPES order. */
  ranked: ArchetypeKey[];
}

function emptyScores(): Record<ArchetypeKey, number> {
  return {
    builder: 0,
    fighter: 0,
    gatherer: 0,
    roleplayer: 0,
    explorer: 0,
    statesman: 0,
  };
}

/**
 * Score a completed quiz. `answerIndexes[i]` is the chosen answer index for
 * QUESTIONS[i]; unanswered / out-of-range entries are skipped. Axes are
 * normalized to 0..1 against the single highest raw total so the winning
 * archetype always reaches the chart's outer ring.
 */
export function scoreQuiz(answerIndexes: (number | null)[]): QuizResult {
  const raw = emptyScores();

  QUESTIONS.forEach((question, i) => {
    const choice = answerIndexes[i];
    if (choice == null) return;
    const answer = question.answers[choice];
    if (!answer) return;
    for (const [key, points] of Object.entries(answer.weights)) {
      raw[key as ArchetypeKey] += points ?? 0;
    }
  });

  const max = Math.max(1, ...Object.values(raw));
  const scores = emptyScores();
  for (const a of ARCHETYPES) {
    scores[a.key] = raw[a.key] / max;
  }

  const order = new Map(ARCHETYPES.map((a, i) => [a.key, i]));
  const ranked = [...ARCHETYPES.map((a) => a.key)].sort((x, y) => {
    if (raw[y] !== raw[x]) return raw[y] - raw[x];
    return (order.get(x) ?? 0) - (order.get(y) ?? 0);
  });

  return { scores, raw, ranked };
}
