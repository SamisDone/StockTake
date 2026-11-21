import type { Role } from "@/db/schema";
import { type AdminAction, said } from "./error-copy";
import { DomainError } from "./errors";

/** The signed-in person a domain operation acts on behalf of. */
export type Actor = { id: number; role: Role };

export function requireAdmin(actor: Actor, action: AdminAction) {
  if (actor.role !== "admin") throw new DomainError("forbidden", said("adminOnly", { action }));
}
