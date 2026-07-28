// @vitest-environment node
//
// Shared test helper for server CRUD tests.
// Provides an in-memory fake of the Drizzle chain API, backed by Maps.
// Use in place of the real DB to avoid importing @libsql/client and ws
// which crash under vitest's "browser" resolve condition.
//
// Usage:
//   import { createMockDb } from "~/server/db/test-helpers";
//   import * as schema from "~/server/db/schema";
//
//   const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
//   vi.mock("../db", () => ({ getDb: getDbMock, schema }));
//
//   beforeEach(() => {
//     getDbMock.mockReturnValue(createMockDb());
//   });

function tableName(table: any): string {
  const sym = Object.getOwnPropertySymbols(table).find((s) =>
    s.toString().includes("drizzle:Name"),
  );
  return sym ? table[sym] : "unknown";
}

function buildColMap(table: any): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [key, col] of Object.entries(table)) {
    if (col && typeof col === "object" && typeof (col as any).name === "string") {
      map[(col as any).name] = key;
    }
  }
  return map;
}

function findPk(table: any): string {
  for (const [key, col] of Object.entries(table)) {
    if (col && typeof col === "object" && (col as any).primary) return key;
  }
  // fallback: first column
  const entries = Object.entries(table);
  return entries.length > 0 ? entries[0][0] : "id";
}

/**
 * Create an in-memory fake of the Drizzle DB chain API.
 *
 * Each call returns a fresh, isolated store. Use in `beforeEach` to reset
 * state between tests.
 *
 * Supports:
 * - `db.insert(table).values(data).returning()`
 * - `db.insert(table).values(data)` (bare await, no .returning())
 * - `db.select().from(table)` (all rows)
 * - `db.select().from(table).where(cond).then(...)`
 * - `db.select().from(table).orderBy(order).then(...)`
 * - `db.select().from(table).where(cond).orderBy(order).then(...)`
 * - `db.update(table).set(data).where(cond).returning()`
 * - `db.delete(table).where(cond).returning()`
 * - `db.delete(table).where(cond)` (bare await, no .returning())
 * - `db.run()` (no-op)
 *
 * Conditions (`cond`) are objects `{ field: "column_name", value: ... }` as
 * produced by the mocked `eq()` from `drizzle-orm`. Order specs are objects
 * `{ field: "column_name", dir: "asc" | "desc" }` as produced by mocked
 * `asc()` / `desc()`.
 *
 * Example mocking of drizzle-orm operators:
 * ```
 * vi.mock("drizzle-orm", async (importOriginal) => {
 *   const actual = await importOriginal<typeof import("drizzle-orm")>();
 *   return {
 *     ...actual,
 *     eq: (col: any, val: any) => ({ field: col.name, value: val }),
 *     desc: (col: any) => ({ field: col.name, dir: "desc" }),
 *     asc: (col: any) => ({ field: col.name, dir: "asc" }),
 *   };
 * });
 * ```
 */
export function createMockDb() {
  const stores = new Map<string, Map<number, any>>();
  const counters = new Map<string, number>();
  const columnMaps = new Map<string, Record<string, string>>();
  const pkFields = new Map<string, string>();

  function ensureTable(table: any): string {
    const tname = tableName(table);
    if (!stores.has(tname)) {
      stores.set(tname, new Map());
      counters.set(tname, 0);
      columnMaps.set(tname, buildColMap(table));
      pkFields.set(tname, findPk(table));
    }
    return tname;
  }

  function mapField(tname: string, field: string): string {
    const map = columnMaps.get(tname);
    return (map && map[field]) || field;
  }

  function filterRows(tname: string, rows: any[], cond: any): any[] {
    if (!cond) return rows;
    const prop = mapField(tname, cond.field);
    return rows.filter((r) => r[prop] === cond.value);
  }

  function sortRows(rows: any[], order: any): any[] {
    if (!order) return rows;
    const prop = mapField("", order.field);
    const dir = order.dir === "desc" ? -1 : 1;
    return [...rows].sort((a, b) => {
      const av = a[prop];
      const bv = b[prop];
      if (typeof av === "string" && typeof bv === "string") {
        return dir * av.localeCompare(bv);
      }
      return dir * ((av ?? 0) - (bv ?? 0));
    });
  }

  function doInsert(table: any, data: any): any[] {
    const tname = ensureTable(table);
    const store = stores.get(tname)!;
    const pk = pkFields.get(tname)!;
    const counter = counters.get(tname)! + 1;
    counters.set(tname, counter);
    const row = { ...data, [pk]: counter };
    store.set(counter, row);
    return [row];
  }

  function makeThenable(
    tname: string,
    rows: any[],
  ): Promise<any[]> & { then: (resolve: any, reject: any) => Promise<void> } {
    return {
      then: (resolve: any, reject: any) => Promise.resolve(rows).then(resolve, reject),
    } as any;
  }

  return {
    insert: (table: any) => ({
      values: (data: any) => {
        const rows = doInsert(table, data);
        return {
          returning: async () => rows,
          then: (resolve: any, reject: any) => Promise.resolve(rows).then(resolve, reject),
        };
      },
    }),

    select: () => ({
      from: (table: any) => {
        const tname = ensureTable(table);
        const store = stores.get(tname)!;
        const allRows = () => Array.from(store.values());

        return {
          where: (cond: any) => ({
            orderBy: (order: any) =>
              makeThenable(tname, sortRows(filterRows(tname, allRows(), cond), order)),
            then: makeThenable(tname, filterRows(tname, allRows(), cond)).then,
          }),
          orderBy: (order: any) => makeThenable(tname, sortRows(allRows(), order)),
          then: makeThenable(tname, allRows()).then,
        };
      },
    }),

    update: (table: any) => ({
      set: (data: any) => ({
        where: (cond: any) => ({
          returning: () => {
            const tname = ensureTable(table);
            const store = stores.get(tname)!;
            const prop = mapField(tname, cond.field);
            let updated: any[] = [];
            for (const [id, row] of store) {
              if (row[prop] === cond.value) {
                const merged = { ...row, ...data };
                store.set(id, merged);
                updated.push(merged);
              }
            }
            return Promise.resolve(updated);
          },
          then: (resolve: any, reject: any) => {
            // bare await (no returning) — same effect but no result
            const tname = ensureTable(table);
            const store = stores.get(tname)!;
            const prop = mapField(tname, cond.field);
            for (const [id, row] of store) {
              if (row[prop] === cond.value) {
                store.set(id, { ...row, ...data });
              }
            }
            return Promise.resolve([]).then(resolve, reject);
          },
        }),
      }),
    }),

    delete: (table: any) => ({
      where: (cond: any) => ({
        returning: () => {
          const tname = ensureTable(table);
          const store = stores.get(tname)!;
          const prop = mapField(tname, cond.field);
          const deleted: any[] = [];
          for (const [id, row] of store) {
            if (row[prop] === cond.value) {
              store.delete(id);
              deleted.push(row);
            }
          }
          return Promise.resolve(deleted);
        },
        then: (resolve: any, reject: any) => {
          // bare await (no returning)
          const tname = ensureTable(table);
          const store = stores.get(tname)!;
          const prop = mapField(tname, cond.field);
          for (const [id, row] of store) {
            if (row[prop] === cond.value) {
              store.delete(id);
            }
          }
          return Promise.resolve([]).then(resolve, reject);
        },
      }),
    }),

    run: async () => {},
  };
}
