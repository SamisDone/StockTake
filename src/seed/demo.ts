/**
 * The demo dataset: 120 days of simulated trading for a small distributor, generated
 * deterministically from a fixed seed. Dates are relative to `anchor` (normally the
 * start of today, UTC) so the history always ends now and forecasts stay meaningful.
 *
 * Output is plain SQL so the same file seeds local and remote D1, and every row goes
 * through the database's ledger triggers, so the seed itself is checked by them.
 *
 * This module imports nothing from the app, so `scripts/seed.mts` can run it with Node.
 */

import { DEMO_PASSWORD, DEMO_USERS } from "./accounts.ts";

export { DEMO_PASSWORD, DEMO_USERS };

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const HISTORY_DAYS = 120;
const ADMIN = 1;
const STAFF = 2;

/** mulberry32: a small, fast PRNG; the same seed always gives the same sequence. */
function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Knuth's Poisson sampler; fine for the small means used here. */
function poisson(rand: () => number, mean: number) {
  if (mean <= 0) return 0;
  const limit = Math.exp(-mean);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rand();
  } while (p > limit);
  return k - 1;
}

type Supplier = { id: number; name: string; email: string; phone: string; leadTimeDays: number };

const SUPPLIERS: Supplier[] = [
  {
    id: 1,
    name: "Harbor Packaging Co.",
    email: "orders@harborpack.example",
    phone: "+1 206 555 0141",
    leadTimeDays: 5,
  },
  {
    id: 2,
    name: "Northline Electronics",
    email: "sales@northline.example",
    phone: "+1 408 555 0187",
    leadTimeDays: 14,
  },
  { id: 3, name: "Copperleaf Tools", email: "trade@copperleaf.example", phone: "+1 312 555 0112", leadTimeDays: 10 },
  {
    id: 4,
    name: "Greenfield Paper Goods",
    email: "hello@greenfield.example",
    phone: "+1 503 555 0164",
    leadTimeDays: 4,
  },
  { id: 5, name: "Atlas Fasteners", email: "orders@atlasfast.example", phone: "+1 713 555 0129", leadTimeDays: 7 },
  {
    id: 6,
    name: "Blue Ridge Textiles",
    email: "wholesale@blueridge.example",
    phone: "+1 828 555 0195",
    leadTimeDays: 21,
  },
];

/** [sku, name, category, supplier, unit cost ¢, unit price ¢, units sold per day] */
const CATALOG: [string, string, string, number, number, number, number][] = [
  ["PKG-BOX-S", "Shipping box, small", "Packaging", 1, 38, 120, 9],
  ["PKG-BOX-M", "Shipping box, medium", "Packaging", 1, 54, 165, 7],
  ["PKG-BOX-L", "Shipping box, large", "Packaging", 1, 81, 240, 4],
  ["PKG-TAPE", "Packing tape, 48 mm", "Packaging", 1, 145, 420, 6],
  ["PKG-BUBBLE", "Bubble wrap roll, 30 m", "Packaging", 1, 690, 1650, 1.5],
  ["ELC-USB-C", "USB-C cable, 1 m", "Electronics", 2, 210, 999, 5],
  ["ELC-CHG-20", "20 W wall charger", "Electronics", 2, 640, 1999, 2.5],
  ["ELC-BATT-AA", "AA batteries, 8 pack", "Electronics", 2, 310, 849, 6],
  ["ELC-HUB-4", "4-port USB hub", "Electronics", 2, 920, 2499, 1],
  ["ELC-LED-E27", "LED bulb, E27 warm white", "Electronics", 2, 175, 599, 3.5],
  ["TLS-DRV-SET", "Screwdriver set, 12 piece", "Tools", 3, 1180, 2999, 1.2],
  ["TLS-TAPE-5", "Tape measure, 5 m", "Tools", 3, 420, 1199, 2],
  ["TLS-KNIFE", "Utility knife", "Tools", 3, 260, 799, 3],
  ["TLS-GLOVE-L", "Work gloves, large", "Tools", 3, 330, 899, 4],
  ["TLS-LEVEL", "Spirit level, 60 cm", "Tools", 3, 870, 2299, 0.6],
  ["OFC-PAPER-A4", "Copy paper A4, 500 sheets", "Office", 4, 390, 799, 8],
  ["OFC-NOTE", "Sticky notes, 12 pads", "Office", 4, 280, 699, 4],
  ["OFC-PEN-BLK", "Ballpoint pens, black, 10 pack", "Office", 4, 190, 549, 5],
  ["OFC-FOLDER", "Manila folders, 25 pack", "Office", 4, 410, 999, 2],
  ["OFC-LABEL", "Address labels, 300", "Office", 4, 520, 1299, 1.8],
  ["FST-SCR-40", "Wood screws 4×40 mm, 200", "Fasteners", 5, 460, 1149, 3],
  ["FST-BOLT-M8", "Hex bolts M8, 50", "Fasteners", 5, 610, 1499, 1.5],
  ["FST-ANCHOR", "Wall anchors, 100", "Fasteners", 5, 350, 899, 2.2],
  ["FST-NUT-M8", "Hex nuts M8, 100", "Fasteners", 5, 280, 699, 1.4],
  ["FST-WASHER", "Flat washers, 200", "Fasteners", 5, 240, 599, 1.1],
  ["TXT-APRON", "Canvas work apron", "Apparel", 6, 910, 2499, 0.8],
  ["TXT-VEST-HV", "Hi-vis safety vest", "Apparel", 6, 480, 1299, 1.6],
  ["TXT-TOWEL", "Shop towels, 25 pack", "Apparel", 6, 640, 1499, 2.4],
  ["TXT-CAP", "Logo cap, navy", "Apparel", 6, 520, 1599, 0.7],
  ["TXT-SOCK", "Work socks, 3 pairs", "Apparel", 6, 350, 1099, 1.9],
];

/** Products whose reordering someone "forgot" near the end, so the dashboard has work to show. */
const NEGLECTED = new Set(["ELC-USB-C", "OFC-PAPER-A4", "TXT-VEST-HV", "PKG-TAPE"]);

const WRITE_OFF_REASONS = ["Damaged in the warehouse", "Water damage", "Crushed in transit", "Failed inspection"];

const REVIEWS: [supplier: number, user: number, rating: number, comment: string | null][] = [
  [1, ADMIN, 5, "Boxes arrive on time and well stacked."],
  [1, STAFF, 4, null],
  [2, ADMIN, 3, "Good prices, but the 14-day lead time hurts."],
  [2, STAFF, 2, "Two partial cartons last quarter."],
  [3, ADMIN, 4, "Solid quality, slightly pricey."],
  [4, ADMIN, 5, "Fastest supplier we have."],
  [4, STAFF, 5, "Always friendly on the phone."],
  [5, STAFF, 4, null],
  [6, ADMIN, 3, "Lovely stock, very long lead times."],
];

const sqlString = (value: string | null) => (value === null ? "NULL" : `'${value.replace(/'/g, "''")}'`);
const poNumber = (id: number) => `PO-${String(id).padStart(4, "0")}`;
const money = (cents: number) => `$${(cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

type Product = {
  id: number;
  sku: string;
  name: string;
  category: string;
  supplier: Supplier;
  costCents: number;
  priceCents: number;
  demand: number;
  reorderPoint: number;
  reorderQuantity: number;
  onHand: number;
  onOrder: number;
};

type OpenOrder = {
  id: number;
  supplier: Supplier;
  lines: { id: number; product: Product; quantity: number }[];
  dueDay: number;
};

/**
 * Statements that empty every table. The append-only and lines-locked triggers forbid
 * those deletes, so they're dropped and recreated from the migration's own SQL.
 */
export function resetStatements(rulesMigrationSql: string) {
  const blocking = [
    "stock_movements_no_delete",
    "activity_log_no_delete",
    "purchase_order_lines_locked_delete",
    "stock_movements_no_update",
    "activity_log_no_update",
  ];
  const definitions = blocking.map((name) => {
    const match = rulesMigrationSql.match(new RegExp("CREATE TRIGGER `" + name + "`[\\s\\S]*?END;"));
    if (!match) throw new Error(`Trigger ${name} not found in the migration`);
    return match[0];
  });
  return [
    ...blocking.map((name) => `DROP TRIGGER IF EXISTS \`${name}\`;`),
    "DELETE FROM sessions;",
    "DELETE FROM activity_log;",
    "DELETE FROM stock_movements;",
    "DELETE FROM purchase_order_lines;",
    "DELETE FROM purchase_orders;",
    "DELETE FROM supplier_reviews;",
    "DELETE FROM products;",
    "DELETE FROM suppliers;",
    "DELETE FROM users;",
    ...definitions,
  ];
}

/** The full dataset as SQL statements, in an order the ledger triggers accept. */
export function demoStatements({ anchor, passwordHash }: { anchor: Date; passwordHash: string }) {
  const rand = random(2026);
  // Day 0 is the opening stocktake and the last trading day is yesterday, so nothing
  // is timestamped later than the moment the seed runs.
  const start = anchor.getTime() - (HISTORY_DAYS + 1) * DAY;
  const at = (day: number, hour: number) => start + day * DAY + hour * HOUR;
  const out: string[] = [];

  const activity = (
    user: number,
    action: string,
    entityType: string,
    entityId: number,
    summary: string,
    time: number,
  ) =>
    out.push(
      `INSERT INTO activity_log (user_id, action, entity_type, entity_id, summary, occurred_at) VALUES (${user}, '${action}', '${entityType}', ${entityId}, ${sqlString(summary)}, ${time});`,
    );
  const movement = (
    product: Product,
    kind: string,
    quantity: number,
    user: number,
    time: number,
    note: string | null = null,
    lineId: number | null = null,
  ) =>
    out.push(
      `INSERT INTO stock_movements (product_id, kind, quantity, note, purchase_order_line_id, user_id, occurred_at) VALUES (${product.id}, '${kind}', ${quantity}, ${sqlString(note)}, ${lineId ?? "NULL"}, ${user}, ${time});`,
    );

  // People, suppliers, products ----------------------------------------------------
  const created = at(0, 8);
  for (const user of DEMO_USERS) {
    out.push(
      `INSERT INTO users (id, email, name, password_hash, role, created_at) VALUES (${user.id}, '${user.email}', ${sqlString(user.name)}, '${passwordHash}', '${user.role}', ${created});`,
    );
  }
  for (const s of SUPPLIERS) {
    out.push(
      `INSERT INTO suppliers (id, name, email, phone, lead_time_days, created_at) VALUES (${s.id}, ${sqlString(s.name)}, '${s.email}', '${s.phone}', ${s.leadTimeDays}, ${created});`,
    );
  }

  const products: Product[] = CATALOG.map(([sku, name, category, supplierId, costCents, priceCents, demand], index) => {
    const supplier = SUPPLIERS[supplierId - 1];
    return {
      id: index + 1,
      sku,
      name,
      category,
      supplier,
      costCents,
      priceCents,
      demand,
      reorderPoint: Math.ceil(demand * supplier.leadTimeDays * 1.2),
      reorderQuantity: Math.max(5, Math.round((demand * 30) / 5) * 5),
      onHand: 0,
      onOrder: 0,
    };
  });
  for (const p of products) {
    out.push(
      `INSERT INTO products (id, sku, name, category, supplier_id, unit_cost_cents, unit_price_cents, reorder_point, reorder_quantity, created_at) VALUES (${p.id}, '${p.sku}', ${sqlString(p.name)}, '${p.category}', ${p.supplier.id}, ${p.costCents}, ${p.priceCents}, ${p.reorderPoint}, ${p.reorderQuantity}, ${created});`,
    );
  }

  // Opening stock: the first stocktake ----------------------------------------------
  for (const p of products) {
    const counted = Math.ceil(p.demand * (p.supplier.leadTimeDays + 25));
    movement(p, "adjustment", counted, ADMIN, at(0, 9));
    activity(ADMIN, "stock.counted", "product", p.id, `Counted ${counted} × ${p.name} (was 0)`, at(0, 9));
    p.onHand = counted;
  }

  // Trading days ----------------------------------------------------------------------
  let nextOrderId = 1;
  let nextLineId = 1;
  const open: OpenOrder[] = [];

  const placeOrder = (supplier: Supplier, wanted: Product[], day: number) => {
    const id = nextOrderId++;
    const lines = wanted.map((product) => {
      const position = product.onHand + product.onOrder;
      const quantity = Math.max(
        product.reorderQuantity,
        Math.ceil(product.demand * (supplier.leadTimeDays + 30)) - position,
      );
      return { id: nextLineId++, product, quantity };
    });
    const total = lines.reduce((sum, line) => sum + line.quantity * line.product.costCents, 0);
    out.push(
      `INSERT INTO purchase_orders (id, supplier_id, status, created_by, created_at) VALUES (${id}, ${supplier.id}, 'draft', ${STAFF}, ${at(day, 9)});`,
    );
    for (const line of lines) {
      out.push(
        `INSERT INTO purchase_order_lines (id, purchase_order_id, product_id, quantity, unit_cost_cents) VALUES (${line.id}, ${id}, ${line.product.id}, ${line.quantity}, ${line.product.costCents});`,
      );
    }
    const count = `${lines.length} ${lines.length === 1 ? "line" : "lines"}`;
    activity(
      STAFF,
      "purchase_order.drafted",
      "purchase_order",
      id,
      `Drafted an order with ${supplier.name}: ${count}, ${money(total)}`,
      at(day, 9),
    );
    return { id, lines, total };
  };

  for (let day = 1; day <= HISTORY_DAYS; day++) {
    const weekday = new Date(at(day, 12)).getUTCDay();
    const dayFactor = weekday === 0 || weekday === 6 ? 0.55 : 1.1;

    // Deliveries due today.
    for (const order of open.filter((o) => o.dueDay === day)) {
      for (const line of order.lines) {
        movement(line.product, "receipt", line.quantity, STAFF, at(day, 11), null, line.id);
        line.product.onHand += line.quantity;
        line.product.onOrder -= line.quantity;
      }
      out.push(`UPDATE purchase_orders SET status = 'received', received_at = ${at(day, 11)} WHERE id = ${order.id};`);
      const units = order.lines.reduce((sum, line) => sum + line.quantity, 0);
      activity(
        STAFF,
        "purchase_order.received",
        "purchase_order",
        order.id,
        `Received ${poNumber(order.id)} from ${order.supplier.name}: ${units} units`,
        at(day, 11),
      );
      open.splice(open.indexOf(order), 1);
    }

    for (const p of products) {
      // A gentle upward trend over the period, so recent demand runs a little hotter.
      const trend = 0.85 + (0.3 * day) / HISTORY_DAYS;
      const sold = Math.min(poisson(rand, p.demand * dayFactor * trend), p.onHand);
      if (sold > 0) {
        movement(p, "sale", -sold, STAFF, at(day, 17));
        activity(STAFF, "stock.sale", "product", p.id, `Sold ${sold} × ${p.name}`, at(day, 17));
        p.onHand -= sold;
      }
      if (rand() < 0.025) {
        const returned = 1 + Math.floor(rand() * 2);
        movement(p, "return", returned, STAFF, at(day, 15));
        activity(STAFF, "stock.return", "product", p.id, `Took back a return of ${returned} × ${p.name}`, at(day, 15));
        p.onHand += returned;
      }
      if (rand() < 0.006 && p.onHand > 3) {
        const lost = 1 + Math.floor(rand() * 3);
        const reason = WRITE_OFF_REASONS[Math.floor(rand() * WRITE_OFF_REASONS.length)];
        movement(p, "write_off", -lost, STAFF, at(day, 16), reason);
        activity(STAFF, "stock.write_off", "product", p.id, `Wrote off ${lost} × ${p.name}: ${reason}`, at(day, 16));
        p.onHand -= lost;
      }
    }

    // Monthly cycle count of one category, which finds a little shrinkage.
    if (day % 30 === 0) {
      const category = [...new Set(products.map((p) => p.category))][(day / 30) % 6];
      for (const p of products.filter((x) => x.category === category && x.onHand > 4)) {
        const shrink = Math.floor(rand() * 3);
        const counted = p.onHand - shrink;
        if (shrink > 0) movement(p, "adjustment", -shrink, ADMIN, at(day, 18), "Cycle count");
        const summary =
          shrink > 0
            ? `Counted ${counted} × ${p.name} (was ${p.onHand}): Cycle count`
            : `Counted ${counted} × ${p.name}, which matches: Cycle count`;
        activity(ADMIN, "stock.counted", "product", p.id, summary, at(day, 18));
        p.onHand = counted;
      }
    }

    // Reorder anything at or below its reorder point, one order per supplier.
    const daysLeft = HISTORY_DAYS - day;
    for (const supplier of SUPPLIERS) {
      const wanted = products.filter(
        (p) =>
          p.supplier === supplier && p.onHand + p.onOrder <= p.reorderPoint && !(NEGLECTED.has(p.sku) && daysLeft < 30),
      );
      if (wanted.length === 0) continue;
      const { id, lines, total } = placeOrder(supplier, wanted, day);
      out.push(`UPDATE purchase_orders SET status = 'ordered', ordered_at = ${at(day, 10)} WHERE id = ${id};`);
      activity(
        ADMIN,
        "purchase_order.placed",
        "purchase_order",
        id,
        `Placed ${poNumber(id)} with ${supplier.name} for ${money(total)}`,
        at(day, 10),
      );
      for (const line of lines) line.product.onOrder += line.quantity;
      const jitter = Math.floor(rand() * 3) - 1;
      open.push({ id, supplier, lines, dueDay: day + supplier.leadTimeDays + jitter });
    }

    // Once, mid-period: an order that was placed and then cancelled.
    if (day === 45) {
      const supplier = SUPPLIERS[2];
      const { id } = placeOrder(supplier, products.filter((p) => p.supplier === supplier).slice(0, 2), day);
      out.push(`UPDATE purchase_orders SET status = 'cancelled', cancelled_at = ${at(day, 14)} WHERE id = ${id};`);
      activity(ADMIN, "purchase_order.cancelled", "purchase_order", id, `Cancelled ${poNumber(id)}`, at(day, 14));
    }
  }

  // A draft waiting for an admin to place it: the neglected products' supplier order.
  const draftSupplier = SUPPLIERS[1];
  placeOrder(
    draftSupplier,
    products.filter((p) => p.supplier === draftSupplier && NEGLECTED.has(p.sku)),
    HISTORY_DAYS,
  );

  // Reviews ------------------------------------------------------------------------
  REVIEWS.forEach(([supplierId, userId, rating, comment], index) => {
    out.push(
      `INSERT INTO supplier_reviews (supplier_id, user_id, rating, comment, created_at) VALUES (${supplierId}, ${userId}, ${rating}, ${sqlString(comment)}, ${at(10 + index * 9, 13)});`,
    );
  });

  return out;
}

const encoder = new TextEncoder();

/** The demo password hashed in the app's own format, with a fixed salt so the seed is deterministic. */
export async function demoPasswordHash() {
  const salt = encoder.encode("stocktake-demo-salt");
  const key = await crypto.subtle.importKey("raw", encoder.encode(DEMO_PASSWORD), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100_000 }, key, 256);
  const b64 = (bytes: Uint8Array) =>
    btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return `pbkdf2_sha256$100000$${b64(salt)}$${b64(new Uint8Array(bits))}`;
}

/** Start of the current UTC day. */
export const todayUtc = (now = new Date()) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
