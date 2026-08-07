// No-op shim for the `server-only` client guard.
//
// `@solidjs/start/http`'s public entry (`dist/http/index.js`) does
// `import "server-only"` to fail at resolve time when pulled into
// client-reachable code (#2068). Under vite, the boundary-modules plugin
// supplies this resolution; the package is not installed and does not exist
// in node_modules. The live probe `scripts/verify-session-contract.ts` runs
// server code in a standalone node process, where the guard is meaningless,
// so esbuild aliases `server-only` to this empty module.
