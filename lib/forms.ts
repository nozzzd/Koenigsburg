/** Shared between client form components and server actions. */
export type ActionState = { error: string } | null;

/** For actions that report success as well as failure. */
export type ResultState = { error: string } | { ok: string } | null;

export const IGN_PATTERN = /^[A-Za-z0-9_]{3,16}$/;
export const IGN_HINT = "3–16 characters: letters, numbers, underscores";
