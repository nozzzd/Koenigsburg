/**
 * ─── Königsburg showcase ────────────────────────────────────────────────────
 * The public "Great Works" gallery that shows off builds and recruits members.
 *
 * TO ADD A PROJECT: copy one block below, fill it in, save, commit, and push —
 * Vercel redeploys automatically.
 *
 *   imageUrl : paste a link to a screenshot. Easiest source: drop the image in
 *              any Discord channel, right-click it → "Copy Link", paste here.
 *              Leave it out ("") to show a themed placeholder instead.
 *   builder  : who built it (optional)
 *   tag      : a short category shown as a badge (optional)
 */

export type Project = {
  title: string;
  description: string;
  imageUrl?: string;
  builder?: string;
  tag?: string;
};

export const projects: Project[] = [
  {
    title: "The Grand Cathedral",
    description:
      "The spiritual heart of the capital — flying buttresses, stained glass, and a bell tower that overlooks the whole valley.",
    imageUrl: "",
    builder: "The Masons' Guild",
    tag: "Landmark",
  },
  {
    title: "Königsburg Harbor",
    description:
      "A working port district with warehouses, a lighthouse, and berths for the merchant fleet that keeps the realm supplied.",
    imageUrl: "",
    builder: "House Meridian",
    tag: "Infrastructure",
  },
  {
    title: "The Old Walls",
    description:
      "Kilometers of hand-laid battlements and gatehouses that trace the original founding borders of the free city.",
    imageUrl: "",
    builder: "The Founders",
    tag: "Fortification",
  },
];
