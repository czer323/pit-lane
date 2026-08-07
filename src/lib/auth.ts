import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { getDb, schema } from "~/server/db";

// Explicit baseURL so OAuth redirects/callbacks are absolute (better-auth
// needs `${baseURL}/api/auth/callback/google`). Falls back to localhost for
// dev; production must set BETTER_AUTH_URL in the Vercel environment.
const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

export const auth = betterAuth({
  baseURL,
  // Accept requests from the production domain plus Vercel preview deployments
  // (which get unique URLs). Without this, better-auth rejects the OAuth
  // request with "Invalid origin" when the user is on a preview URL.
  // NOTE: better-auth uses wildcard patterns (* / ?), not regex, here.
  trustedOrigins: [baseURL, "https://pit-lane-*.vercel.app"],
  basePath: "/api/auth",
  database: drizzleAdapter(getDb(), {
    provider: "sqlite",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },
});
