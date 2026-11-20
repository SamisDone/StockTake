import type { Role } from "@/db/schema";

/** The signed-in person a domain operation acts on behalf of. */
export type Actor = { id: number; role: Role };
