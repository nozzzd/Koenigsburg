/** Shared between client form components and server actions. */
export type ActionState = { error: string } | null;

export const IGN_PATTERN = /^[A-Za-z0-9_]{3,16}$/;
export const IGN_HINT = "3–16 characters: letters, numbers, underscores";
