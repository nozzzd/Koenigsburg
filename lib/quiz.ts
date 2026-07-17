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
      "You raise the builds and wonders that make a nation worth defending. Stone by stone, you shape what everyone else calls home.",
  },
  {
    key: "fighter",
    label: "Fighter",
    blurb:
      "When war begins, you're among the first to answer the call. The nation looks to you to hold the wall and to ensure peace and security throughout the nation.",
  },
  {
    key: "gatherer",
    label: "Gatherer",
    blurb:
      "Every thriving nation depends on a steady supply of resources. You keep the warehouses full and the people fed.",
  },
  {
    key: "roleplayer",
    label: "Roleplayer",
    blurb:
      "You are the voice of the nation, its heralds and its stories. A nation is remembered for its people, and you give them their tale.",
  },
  {
    key: "explorer",
    label: "Explorer",
    blurb:
      "Beyond every horizon lies another opportunity. You discover new lands, resources, and points of interest.",
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
    prompt: "An unknown player approaches your borders. How do you respond?",
    answers: [
      { text: "Greet them and exchange some items.", weights: { statesman: 2, gatherer: 1 } },
      { text: "Ask them where they come from and ensure they pose no threat.", weights: { fighter: 2, explorer: 1 } },
      {
        text: "Give them a tour around your nation's main attractions.",
        weights: { builder: 2, roleplayer: 1 },
      },
      {
        text: "Ignore them. I've got work to do.",
        weights: { gatherer: 2, builder: 1 },
      },
    ],
  },
  {
    id: 2,
    prompt: "Your nation has mined more ores than any other nation. What's your first thought?",
    answers: [
      {
        text: "Time to craft a proper set of armour, tools and weapons.",
        weights: { fighter: 2, builder: 1 },
      },
      {
        text: "Stockpile them. We'll need those resources for other things.",
        weights: { gatherer: 2, statesman: 1 },
      },
      {
        text: "Perfect, now I can finally craft all the lanterns I need.",
        weights: { builder: 2, gatherer: 1 },
      },
      {
        text: "We should use our wealth to trade with other nations.",
        weights: { statesman: 2, roleplayer: 1 },
      },
    ],
  },
  {
    id: 3,
    prompt: "A festival is being planned inside your nation. Your role?",
    answers: [
      {
        text: "Design and decorate the grounds so it's unforgettable.",
        weights: { builder: 2, roleplayer: 1 },
      },
      {
        text: "Represent your nation and give the opening speech in character.",
        weights: { roleplayer: 2, statesman: 1 },
      },
      { text: "Run security and check for traps.", weights: { fighter: 2, explorer: 1 } },
      {
        text: "Gather food, drinks, and supplies for all.",
        weights: { gatherer: 2, builder: 1 },
      },
    ],
  },
  {
    id: 4,
    prompt: "A rival nation has just declared war. Where are you?",
    answers: [
      { text: "I answer the call and get ready to defend my nation.", weights: { fighter: 2, explorer: 1 } },
      {
        text: "Reaching out to other nations, brokering an alliance to even the odds.",
        weights: { statesman: 2, roleplayer: 1 },
      },
      {
        text: "Crafting weapons and setting up traps.",
        weights: { builder: 2, fighter: 1 },
      },
      {
        text: "Stockpiling arrows, golden apples, and food for the siege.",
        weights: { gatherer: 2, statesman: 1 },
      },
    ],
  },
  {
    id: 5,
    prompt: "You get a rare day with nothing assigned. You spend it...",
    answers: [
      {
        text: "Wandering far past your nations borders to see what's out there.",
        weights: { explorer: 2, gatherer: 1 },
      },
      {
        text: "Perfecting a build I've been working on.",
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
        text: "Back the candidate whose skills fits the nation best.",
        weights: { roleplayer: 2, statesman: 1 },
      },
      {
        text: "Don't care who leads, as long as the buildings get finished.",
        weights: { builder: 2, gatherer: 1 },
      },
      {
        text: "Vote quickly and get back to exploring.",
        weights: { explorer: 2, gatherer: 1 },
      },
    ],
  },
  {
    id: 7,
    prompt: "A deep dark cave biome is discovered nearby. You...",
    answers: [
      { text: "Rally a party to fight the Warden.", weights: { fighter: 2, roleplayer: 1 } },
      {
        text: "Explore the cave and check for unique items and resources.",
        weights: { explorer: 2, gatherer: 1 },
      },
      { text: "Stay away from it.", weights: { builder: 2, statesman: 1 } },
      {
        text: "Summon the Warden and name it \"Rising Lava\".",
        weights: { roleplayer: 2, fighter: 1 },
      },
    ],
  },
  {
    id: 8,
    prompt: "What's the first structure a good nation builds?",
    answers: [
      { text: "A defensible fort and walls.", weights: { fighter: 2, builder: 1 } },
      { text: "A quartermaster building and farms to sustain everyone.", weights: { gatherer: 2, builder: 1 } },
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
    prompt: "A foreign player offers a mysterious written book. You...",
    answers: [
      { text: "Buy it instantly and read the contents of said book.", weights: { explorer: 2, gatherer: 1 } },
      { text: "Haggle hard, then resell it for profit.", weights: { statesman: 2, gatherer: 1 } },
      { text: "Ask what tale it tells before deciding.", weights: { roleplayer: 2, explorer: 1 } },
      { text: "Pass. I've got other business to do.", weights: { builder: 2, fighter: 1 } },
    ],
  },
  {
    id: 11,
    prompt: "Your nation can't keep up with its resource demand. You...",
    answers: [
      { text: "Organize a mass gathering expedition.", weights: { gatherer: 2, statesman: 1 } },
      { text: "Range far out to find untapped resources.", weights: { explorer: 2, gatherer: 1 } },
      { text: "Raid a rival nation's supplies to make up for it.", weights: { fighter: 2, explorer: 1 } },
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
      { text: "The explorer who has visited every nation.", weights: { explorer: 2, gatherer: 1 } },
    ],
  },
  {
    id: 13,
    prompt: "A new citizen has been around for a few days. What would make you think they're doing a great job?",
    answers: [
      { text: "They've gathered a lot of supplies.", weights: { gatherer: 2, builder: 1 } },
      { text: "They've scared off felons and kept the peace.", weights: { fighter: 2, statesman: 1 } },
      {
        text: "They have integrated well into the community and created funny stories.",
        weights: { roleplayer: 2, statesman: 1 },
      },
      { text: "They've uncovered interesting locations and new resources.", weights: { explorer: 2, fighter: 1 } },
    ],
  },
  {
    id: 14,
    prompt: "Your ideal base location is...",
    answers: [
      {
        text: "A flat plain with room for a majestic city.",
        weights: { builder: 2, statesman: 1 },
      },
      { text: "A hidden valley near a massive cave system.", weights: { explorer: 2, gatherer: 1 } },
      {
        text: "A resource-rich biome with everything on hand.",
        weights: { gatherer: 2, builder: 1 },
      },
      { text: "Hanging above a volcano crater.", weights: { fighter: 2, builder: 1 } },
    ],
  },
  {
    id: 15,
    prompt: "A proposal for a large undertaking is on the table. Your first question is:",
    answers: [
      { text: "What could we gain from this?", weights: { explorer: 2, fighter: 1 } },
      { text: "Is this the right decision?", weights: { statesman: 2, builder: 1 } },
      { text: "Do we actually have the resources for it?", weights: { gatherer: 2, statesman: 1 } },
      {
        text: "Will this make the nation more engaging?",
        weights: { roleplayer: 2, explorer: 1 },
      },
    ],
  },
  {
    id: 16,
    prompt: "In few words, your nation's strength is its...",
    answers: [
      { text: "Builds and wonders.", weights: { builder: 2, gatherer: 1 } },
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
