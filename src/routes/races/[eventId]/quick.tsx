import { Title } from "@solidjs/meta";
import { A } from "@solidjs/router";
import { For, Show, createResource, createSignal, Suspense } from "solid-js";
import { listCars } from "~/server/api/cars";
import { getEvent } from "~/server/api/events";
import { createRun } from "~/server/api/runs";
import type { ValidationWarning } from "~/server/db/validation";
import "../index.css";

export default function QuickEntry(props: { eventId: string }) {
  const eventId = () => Number(props.eventId);
  const [event] = createResource(eventId, getEvent);
  const [cars] = createResource(listCars);
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [warnings, setWarnings] = createSignal<ValidationWarning[]>([]);
  const [sessionType, setSessionType] = createSignal("Practice");

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setWarnings([]);
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const input: Record<string, unknown> = {};
    for (const [key, value] of formData.entries()) {
      if (value === "") continue;
      const num = Number(value);
      input[key] = Number.isNaN(num) ? value : num;
    }
    input.eventId = eventId();
    input.sessionType = sessionType();
    // round — null for Practice, keep value for Elimination
    if (sessionType() === "Practice") {
      delete input.round;
    }
    // Ensure round is a number for Elimination
    if (input.round != null && input.round !== "") {
      input.round = Number(input.round);
    }
    try {
      const result = await createRun(input);
      setWarnings(result.warnings);
      // Reset form, keep car + event, ready for next lap (AC: minimal taps)
      form.reset();
      // Re-apply signal-driven values after reset (selects reset to DOM defaults)
      const sessionSelect = form.querySelector<HTMLSelectElement>("[name='sessionType']");
      if (sessionSelect) {
        sessionSelect.value = sessionType();
      }
      const carSelect = form.querySelector<HTMLSelectElement>("[name='carId']");
      if (carSelect && input.carId != null) {
        carSelect.value = String(input.carId as number);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <Title>Quick Entry — Pit Lane</Title>
      <Suspense fallback={<p>Loading…</p>}>
        <Show when={event()}>
          {(ev) => (
            <div>
              <A href={`/races/${props.eventId}`} class="back-link">
                ← Back to Runs
              </A>
              <h1>Quick Entry</h1>
              <p>
                {ev().track} — {ev().eventDate}
              </p>
            </div>
          )}
        </Show>
      </Suspense>

      <Show when={error()}>
        <p class="error">{error()}</p>
      </Show>
      <Show when={warnings().length > 0}>
        <div class="warnings">
          <For each={warnings()}>
            {(w) => (
              <p class="warning-item">
                {w.field}: {w.message}
              </p>
            )}
          </For>
        </div>
      </Show>

      <form onSubmit={handleSubmit} class="quick-form">
        <label>
          Car <span class="req">*</span>
          <Suspense
            fallback={
              <select disabled>
                <option>Loading…</option>
              </select>
            }
          >
            <select name="carId" required>
              <option value="">Select car…</option>
              <For each={cars()}>{(car) => <option value={car.carId!}>{car.name}</option>}</For>
            </select>
          </Suspense>
        </label>

        <label>
          Session Type
          <select
            name="sessionType"
            value={sessionType()}
            onChange={(e) => setSessionType(e.currentTarget.value)}
          >
            <option value="Practice">Practice</option>
            <option value="Elimination">Elimination</option>
          </select>
        </label>

        <Show when={sessionType() === "Elimination"}>
          <label>
            Round <span class="req">*</span>
            <input name="round" type="number" min="1" required />
          </label>
        </Show>

        <label>
          Lane
          <select name="lane">
            <option value="">—</option>
            <option value="Left">Left</option>
            <option value="Right">Right</option>
          </select>
        </label>

        <label>
          ET (seconds) <span class="req">*</span>
          <input name="et" type="number" step="0.001" required placeholder="4.321" />
        </label>

        <label>
          MPH
          <input name="mph" type="number" step="0.1" placeholder="28.7" />
        </label>

        <label>
          60ft
          <input name="sixtyFt" type="number" step="0.001" placeholder="0.895" />
        </label>

        <label>
          RT
          <input name="rt" type="number" step="0.001" placeholder="0.025" />
        </label>

        <Show when={sessionType() === "Elimination"}>
          <label>
            Dial-In
            <input name="dialIn" type="number" step="0.001" />
          </label>
        </Show>

        <label>
          Comments
          <input name="comments" placeholder="Any notes…" />
        </label>

        <button type="submit" disabled={submitting()}>
          {submitting() ? "Saving…" : "Record Run"}
        </button>
      </form>
    </main>
  );
}
