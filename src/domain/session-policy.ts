// Kept free of imports so the proxy can share it without pulling in the database layer.

/** How long a session lasts. Activity past half of it extends it by a full lifetime. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
