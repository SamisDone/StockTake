import { asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/database";
import { customers, paymentMethods, payments, saleLines, sales, users } from "@/db/schema";
import { logActivity } from "./activity";
import type { Actor } from "./actor";
import { said } from "./error-copy";
import { DomainError, parseInput, violates } from "./errors";
import { id, optionalText, outer } from "./input";

/**
 * The people and businesses that buy. A customer's due is everything their standing
 * sales came to, less everything they've paid; it can go below zero when a paid sale is
 * voided, which leaves them in credit. Anyone can add a customer or take a payment.
 */

export const customerInput = z.object({
  name: z.string().trim().min(1, "enterName").max(120),
  phone: optionalText(40),
  email: z
    .string()
    .trim()
    .max(200)
    .optional()
    .nullable()
    .transform((value) => value || undefined)
    .pipe(z.email("enterEmail").optional()),
  note: optionalText(500),
});
export type CustomerInput = z.input<typeof customerInput>;

const toRow = (input: z.output<typeof customerInput>) => ({
  name: input.name,
  phone: input.phone ?? null,
  email: input.email ?? null,
  note: input.note ?? null,
});

export async function createCustomer(db: Database, actor: Actor, raw: CustomerInput, now = new Date()) {
  const input = parseInput(customerInput, raw);
  const [[customer]] = await db.batch([
    db
      .insert(customers)
      .values({ ...toRow(input), createdAt: now })
      .returning({ id: customers.id }),
    logActivity(
      db,
      actor,
      {
        action: "customer.created",
        entityType: "customer",
        // Inside the atomic batch, the new customer is max(id); see createDraft.
        entityId: sql<number>`(SELECT max(${customers.id}) FROM ${customers})`,
        facts: { name: input.name },
      },
      now,
    ),
  ]);
  return { id: customer.id };
}

export async function updateCustomer(
  db: Database,
  actor: Actor,
  customerId: number,
  raw: CustomerInput,
  now = new Date(),
) {
  const input = parseInput(customerInput, raw);
  await loadCustomer(db, customerId);
  await db.batch([
    db.update(customers).set(toRow(input)).where(eq(customers.id, customerId)),
    logActivity(
      db,
      actor,
      { action: "customer.updated", entityType: "customer", entityId: customerId, facts: { name: input.name } },
      now,
    ),
  ]);
}

async function loadCustomer(db: Database, customerId: number) {
  const [customer] = await db.select().from(customers).where(eq(customers.id, customerId));
  if (!customer) throw new DomainError("not_found", said("noCustomer"));
  return customer;
}

const customerId = outer(customers, "id");

/** What a customer's standing sales came to. */
const bought = sql<number>`coalesce((
  SELECT sum(l.net_cents) FROM ${saleLines} l JOIN ${sales} s ON s.id = l.sale_id
  WHERE s.customer_id = ${customerId} AND s.voided_at IS NULL
), 0)`;
/** What a customer has paid, at sales and since. */
const paid = sql<number>`coalesce((SELECT sum(${payments.amountCents}) FROM ${payments} WHERE ${payments.customerId} = ${customerId}), 0)`;

const figures = {
  id: customers.id,
  name: customers.name,
  phone: customers.phone,
  email: customers.email,
  note: customers.note,
  createdAt: customers.createdAt,
  boughtCents: bought.mapWith(Number),
  paidCents: paid.mapWith(Number),
  saleCount:
    sql<number>`(SELECT count(*) FROM ${sales} WHERE ${sales.customerId} = ${customerId} AND ${sales.voidedAt} IS NULL)`.mapWith(
      Number,
    ),
  lastSaleAt: sql<
    number | null
  >`(SELECT max(${sales.soldAt}) FROM ${sales} WHERE ${sales.customerId} = ${customerId})`.mapWith((value) =>
    value === null ? null : new Date(Number(value)),
  ),
};

const withDue = <T extends { boughtCents: number; paidCents: number }>(row: T) => ({
  ...row,
  /** Below zero: in credit. */
  dueCents: row.boughtCents - row.paidCents,
});

/** Every customer by name, with what they've bought, paid and still owe. */
export async function listCustomers(db: Database) {
  const rows = await db.select(figures).from(customers).orderBy(asc(customers.name));
  return rows.map(withDue);
}

/** One customer with their figures and their payments, newest first. */
export async function getCustomer(db: Database, id: number) {
  const [row] = await db.select(figures).from(customers).where(eq(customers.id, id));
  if (!row) throw new DomainError("not_found", said("noCustomer"));
  const history = await db
    .select({
      id: payments.id,
      saleId: payments.saleId,
      amountCents: payments.amountCents,
      method: payments.method,
      note: payments.note,
      receivedAt: payments.receivedAt,
      userName: users.name,
    })
    .from(payments)
    .leftJoin(users, eq(users.id, payments.userId))
    .where(eq(payments.customerId, id))
    .orderBy(desc(payments.receivedAt), desc(payments.id));
  return { ...withDue(row), payments: history };
}

export const paymentInput = z.object({
  customerId: id,
  amountCents: z.number().int().positive("enterAmount").max(100_000_000, "moneyTooLarge"),
  method: z.enum(paymentMethods),
  note: optionalText(500),
});
export type PaymentInput = z.input<typeof paymentInput>;

/**
 * Takes a payment against what a customer owes, never more than that. The database
 * holds the same line, so two people taking the last of a due at once can't both.
 */
export async function recordPayment(db: Database, actor: Actor, raw: PaymentInput, now = new Date()) {
  const input = parseInput(paymentInput, raw);
  const [customer] = await db.select(figures).from(customers).where(eq(customers.id, input.customerId));
  if (!customer) throw new DomainError("not_found", said("noCustomer"));
  const due = customer.boughtCents - customer.paidCents;
  if (input.amountCents > due) {
    throw new DomainError("invalid_input", said("payMoreThanDue", { dueCents: Math.max(due, 0) }), "amount");
  }
  try {
    await db.batch([
      db.insert(payments).values({
        customerId: input.customerId,
        amountCents: input.amountCents,
        method: input.method,
        note: input.note ?? null,
        receivedAt: now,
        userId: actor.id,
      }),
      logActivity(
        db,
        actor,
        {
          action: "payment.received",
          entityType: "customer",
          entityId: input.customerId,
          facts: { name: customer.name, amountCents: input.amountCents, dueCents: due - input.amountCents },
        },
        now,
      ),
    ]);
  } catch (error) {
    if (violates(error, "more than the customer owes")) {
      throw new DomainError("conflict", said("paidMeanwhile", { name: customer.name }), "amount");
    }
    throw error;
  }
  return { name: customer.name, dueCents: due - input.amountCents };
}
