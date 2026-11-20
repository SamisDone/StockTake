import type { Role } from "@/db/schema";
import { DomainError } from "./errors";

/** The signed-in person a domain operation acts on behalf of. */
export type Actor = { id: number; role: Role };

export function requireAdmin(actor: Actor, action: string) {
  if (actor.role !== "admin") throw new DomainError("forbidden", `Only an admin can ${action}.`);
}
