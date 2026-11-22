// The public demo's two accounts. Imports nothing, so both the seed script (run by Node)
// and the sign-in action can use it without pulling in the dataset generator.

export const DEMO_PASSWORD = "stocktake-demo";
export const DEMO_USERS = [
  { id: 1, email: "admin@stocktake.demo", name: "Avery Chen", role: "admin" },
  { id: 2, email: "staff@stocktake.demo", name: "Jordan Reyes", role: "staff" },
] as const;

/**
 * `DEMO_PASSWORD` hashed by `demoPasswordHash()` (src/seed/demo.ts): PBKDF2-SHA256,
 * 100,000 rounds, a fixed salt. Written out because the password is public anyway and
 * hashing it costs far more CPU than the rest of a reset; a test keeps the two in step.
 */
export const DEMO_PASSWORD_HASH =
  "pbkdf2_sha256$100000$c3RvY2t0YWtlLWRlbW8tc2FsdA$9vwr08nKNslsvngbt0LPL1FL28JGxNnE_a1knvf6Ing";
