import { describe, expect, it } from "vite-plus/test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Route contract test: programmatically discovers every route file
 * from the filesystem and verifies each exports a default component.
 *
 * Uses static analysis (not dynamic import) to avoid triggering
 * SolidStart SSR chains that break in vitest (ws, jsx extensions).
 *
 * This runs as part of `vp test` and catches:
 * - Missing route files
 * - Routes without default exports
 * - Routes using wrong param syntax (props.id vs props.params.id)
 */

const ROUTES_DIR = resolve(import.meta.dirname ?? __dirname, "../routes");

interface DiscoveredRoute {
  /** Relative path from routes/ */
  relative: string;
  /** URL pattern */
  pattern: string;
  /** Whether this is a page route (not layout, not catch-all) */
  isPage: boolean;
}

function discoverRoutes(): DiscoveredRoute[] {
  const routes: DiscoveredRoute[] = [];

  function walk(dir: string, prefix: string) {
    for (const entry of readdirSync(dir)) {
      const full = resolve(dir, entry);
      const stat = statSync(full);

      if (entry.startsWith("__")) continue; // skip test dirs

      if (stat.isDirectory()) {
        walk(full, `${prefix}/${entry}`);
      } else if (entry.endsWith(".tsx") && !entry.endsWith(".test.tsx")) {
        const name = entry.replace(/\.tsx$/, "");
        let pattern = `${prefix}/${name}`;
        pattern = pattern.replace(/\/index$/, "/").replace(/\/$/, "");
        pattern = pattern.replace(/\/\[([^\]]+)\]/g, "/:$1");
        pattern = pattern || "/";

        const isPage = !name.startsWith("(") && name !== "[...404]";
        routes.push({
          relative: full.replace(ROUTES_DIR + "/", ""),
          pattern,
          isPage,
        });
      }
    }
  }

  walk(ROUTES_DIR, "");
  return routes;
}

function hasDefaultExport(filePath: string): boolean {
  const content = readFileSync(filePath, "utf-8");
  return /export\s+default\s+(function|async\s+function|const\s+\w+)/.test(content);
}

function usesUseParamsIfNeeded(filePath: string): { ok: boolean } {
  const content = readFileSync(filePath, "utf-8");
  const contentLower = content.toLowerCase();
  const hasParamRoute = /\[(?!\.\.\.)/.test(filePath);
  if (!hasParamRoute) return { ok: true };
  // Param routes must use useParams() from @solidjs/router
  const usesUseParams = contentLower.includes("useparams");
  return { ok: usesUseParams };
}

const allRoutes = discoverRoutes();
const pageRoutes = allRoutes.filter((r) => r.isPage);

describe("Route file contract", () => {
  it("discovers pages from filesystem", () => {
    expect(pageRoutes.length).toBeGreaterThanOrEqual(8);
  });

  for (const route of pageRoutes) {
    it(`${route.pattern} exports default`, () => {
      const fullPath = resolve(ROUTES_DIR, route.relative);
      expect(hasDefaultExport(fullPath), `${route.relative}: missing export default function`).toBe(
        true,
      );
    });
  }

  for (const route of pageRoutes) {
    it(`${route.pattern} uses useParams for dynamic routes`, () => {
      const fullPath = resolve(ROUTES_DIR, route.relative);
      const result = usesUseParamsIfNeeded(fullPath);
      expect(
        result.ok,
        `${route.relative}: param route must use useParams() instead of props.params`,
      ).toBe(true);
    });
  }
});

describe("Known routes exist", () => {
  const patterns = pageRoutes.map((r) => r.pattern);

  it("home page", () => expect(patterns).toContain("/"));
  it("login page", () => expect(patterns).toContain("/login"));
  it("fleet page", () => expect(patterns).toContain("/fleet"));
  it("analytics page", () => expect(patterns).toContain("/analytics"));
  it("car detail", () => expect(patterns).toContain("/cars/:id"));
  it("car edit", () => expect(patterns).toContain("/cars/:id/edit"));
  it("car list", () => expect(patterns).toContain("/cars"));
  it("car new", () => expect(patterns).toContain("/cars/new"));
  it("race events", () => expect(patterns).toContain("/races"));
  it("race detail", () => expect(patterns).toContain("/races/:eventId"));
  it("race new event", () => expect(patterns).toContain("/races/new"));
  it("race batch", () => expect(patterns).toContain("/races/:eventId/batch"));
  it("race quick", () => expect(patterns).toContain("/races/:eventId/quick"));
  it("race edit run", () => expect(patterns).toContain("/races/:eventId/edit/:runId"));
});
