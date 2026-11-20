// The public demo's two accounts. Imports nothing, so both the seed script (run by Node)
// and the sign-in action can use it without pulling in the dataset generator.

export const DEMO_PASSWORD = "stocktake-demo";
export const DEMO_USERS = [
  { id: 1, email: "admin@stocktake.demo", name: "Avery Chen", role: "admin" },
  { id: 2, email: "staff@stocktake.demo", name: "Jordan Reyes", role: "staff" },
] as const;
