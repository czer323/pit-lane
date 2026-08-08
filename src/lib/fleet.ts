import { eq } from "drizzle-orm";
import { cars } from "~/server/db/schema";

interface ToggleAtTrackInput {
  carId: number;
  atTrack: boolean;
}

/**
 * Toggle whether a car is currently at the track.
 * Pure function — takes db as a parameter so tests inject mock DB directly.
 */
export async function toggleAtTrack(db: any, input: ToggleAtTrackInput) {
  const [car] = await db.select().from(cars).where(eq(cars.carId, input.carId));

  if (!car) throw new Error("Car not found");

  const [updated] = await db
    .update(cars)
    .set({ atTrack: input.atTrack, updatedAt: new Date().toISOString() })
    .where(eq(cars.carId, input.carId))
    .returning();

  return updated;
}
