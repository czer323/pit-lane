"use server";

import { eq, desc, and } from "drizzle-orm";

import { getDb } from "~/server/db";
import { events, runs } from "~/server/db/schema";
import { insertEventSchema } from "~/server/db/validation";
import { getCurrentUserId, UnauthorizedError } from "~/lib/session";

// ─── Input schema (derived, not modifying validation.ts) ─────────────

const eventInputSchema = insertEventSchema.omit({
  eventId: true,
});

// ─── Ownership helper ────────────────────────────────────────────────

/** Require a signed-in user; throw if not authenticated. */
async function requireUserId(): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new UnauthorizedError("Unauthorized: sign in to manage events");
  }
  return userId;
}

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Check if any row in `rows` conflicts on the natural key
 * (eventDate, track, sessionLabel).  Matches SQLite unique-constraint
 * semantics: NULL values are treated as distinct, so two rows where
 * sessionLabel is NULL on either side do NOT conflict.
 */
function naturalKeyConflict(
  rows: Array<{ eventId?: number; track: string; sessionLabel: string | null }>,
  excludeId: number | undefined,
  track: string,
  sessionLabel: string | null | undefined,
): boolean {
  return rows.some(
    (e) =>
      e.eventId !== excludeId &&
      e.track === track &&
      e.sessionLabel != null &&
      sessionLabel != null &&
      e.sessionLabel === sessionLabel,
  );
}

// ─── Server functions ──────────────────────────────────────────────────

export async function createEvent(input: unknown) {
  const parsed = eventInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Invalid event data: ${parsed.error.message}`);
  }

  const data = parsed.data;
  const userId = await requireUserId();
  const db = getDb();

  // Check natural key uniqueness (scoped to owner — other users' same-date
  // events must not block this user's event)
  const matches = await db
    .select()
    .from(events)
    .where(and(eq(events.eventDate, data.eventDate), eq(events.userId, userId)));
  if (naturalKeyConflict(matches, undefined, data.track, data.sessionLabel)) {
    throw new Error(
      `Duplicate event: ${data.eventDate}, ${data.track}, ${data.sessionLabel ?? "(no session)"}`,
    );
  }

  const [created] = await db
    .insert(events)
    .values({ ...data, userId })
    .returning();
  return created;
}

export async function listEvents() {
  const userId = await requireUserId();
  const db = getDb();
  const allEvents = await db
    .select()
    .from(events)
    .where(eq(events.userId, userId))
    .orderBy(desc(events.eventDate));

  const result = await Promise.all(
    allEvents.map(async (event) => {
      const eventRuns = await db
        .select()
        .from(runs)
        .where(and(eq(runs.eventId, event.eventId!), eq(runs.userId, userId)));
      return { ...event, runCount: eventRuns.length };
    }),
  );

  return result;
}

export async function getEvent(id: number) {
  const db = getDb();

  const userId = await requireUserId();
  const [event] = await db
    .select()
    .from(events)
    .where(and(eq(events.eventId, id), eq(events.userId, userId)));
  if (!event) {
    throw new Error(`Event not found: ${id}`);
  }

  return event;
}

export async function updateEvent(id: number, input: unknown) {
  const parsed = eventInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Invalid event data: ${parsed.error.message}`);
  }

  const data = parsed.data;
  const userId = await requireUserId();
  const db = getDb();

  // Check event exists (owned)
  const [current] = await db
    .select()
    .from(events)
    .where(and(eq(events.eventId, id), eq(events.userId, userId)));
  if (!current) {
    throw new Error(`Event not found: ${id}`);
  }

  // Check natural key uniqueness (excluding current event, scoped to owner)
  const matches = await db
    .select()
    .from(events)
    .where(and(eq(events.eventDate, data.eventDate), eq(events.userId, userId)));
  if (naturalKeyConflict(matches, id, data.track, data.sessionLabel)) {
    throw new Error(
      `Duplicate event: ${data.eventDate}, ${data.track}, ${data.sessionLabel ?? "(no session)"}`,
    );
  }

  const [updated] = await db
    .update(events)
    .set(data)
    .where(and(eq(events.eventId, id), eq(events.userId, userId)))
    .returning();

  return updated;
}

export async function deleteEvent(id: number) {
  const userId = await requireUserId();
  const db = getDb();

  // Safety check: block if runs reference this event (owned)
  const eventRuns = await db
    .select()
    .from(runs)
    .where(and(eq(runs.eventId, id), eq(runs.userId, userId)));
  if (eventRuns.length > 0) {
    throw new Error(`Cannot delete event ${id}: ${eventRuns.length} run(s) reference this event`);
  }

  const [deleted] = await db
    .delete(events)
    .where(and(eq(events.eventId, id), eq(events.userId, userId)))
    .returning();
  if (!deleted) {
    throw new Error(`Event not found: ${id}`);
  }

  return deleted;
}
