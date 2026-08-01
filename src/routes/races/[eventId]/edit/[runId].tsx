import { Title } from "@solidjs/meta";
import { A, useNavigate } from "@solidjs/router";
import { createEffect, For, Show, createResource, createSignal, Suspense } from "solid-js";
import { getEvent } from "~/server/api/events";
import { listCars } from "~/server/api/cars";
import { getRun, updateRun } from "~/server/api/runs";
import type { ValidationWarning } from "~/server/db/validation";
import "../../index.css";

export default function EditRun(props: { eventId: string; runId: string }) {
  const navigate = useNavigate();
  const runId = () => Number(props.runId);
  const [event] = createResource(() => Number(props.eventId), getEvent);
  const [cars] = createResource(listCars);
  const [run] = createResource(runId, getRun);
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [warnings, setWarnings] = createSignal<ValidationWarning[]>([]);
  const [sessionType, setSessionType] = createSignal("Practice");

  // Sync sessionType once the run loads so the round field shows/hides correctly
  createEffect(() => {
    const r = run();
    if (r) setSessionType(r.sessionType ?? "Practice");
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setWarnings([]);
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const input: Record<string, unknown> = {};
    for (const [key, value] of formData.entries()) {
      if (value === "") {
        input[key] = null;
        continue;
      }
      // win is a boolean column — convert "true"/"false" strings
      if (key === "win") {
        input[key] = value === "true";
        continue;
      }
      const num = Number(value);
      input[key] = Number.isNaN(num) ? value : num;
    }
    if (!input.sessionType) input.sessionType = "Practice";
    // Practice runs cannot have round/dialIn/win — validateRun rejects them
    if (input.sessionType === "Practice") {
      delete input.round;
      delete input.dialIn;
      delete input.win;
    }
    input.eventId = Number(props.eventId);
    try {
      const result = await updateRun(runId(), input);
      setWarnings(result.warnings);
      navigate(`/races/${props.eventId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <Title>Edit Run — Pit Lane</Title>
      <Suspense fallback={<p>Loading…</p>}>
        <Show when={event() && run()}>
          <div>
            <A href={`/races/${props.eventId}`} class="back-link">
              ← Back to Runs
            </A>
            <h1>Edit Run</h1>
            <p>
              {run()!.carName} — {event()!.track}, {event()!.eventDate}
            </p>
          </div>
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

      <Suspense fallback={<p>Loading form…</p>}>
        <Show when={run()}>
          {(r) => (
            <form onSubmit={handleSubmit} class="edit-form">
              <label>
                Car
                <Suspense
                  fallback={
                    <select disabled>
                      <option>Loading…</option>
                    </select>
                  }
                >
                  <select name="carId" required>
                    <For each={cars()}>
                      {(car) => (
                        <option value={car.carId!} selected={car.carId === r().carId}>
                          {car.name}
                        </option>
                      )}
                    </For>
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
                  <input name="round" type="number" min="1" required value={r().round ?? ""} />
                </label>
              </Show>

              <label>
                Lane
                <select name="lane">
                  <option value="">—</option>
                  <option value="Left" selected={r().lane === "Left"}>
                    Left
                  </option>
                  <option value="Right" selected={r().lane === "Right"}>
                    Right
                  </option>
                </select>
              </label>

              <div class="field-row">
                <label>
                  ET
                  <input name="et" type="number" step="0.001" value={r().et ?? ""} />
                </label>
                <label>
                  MPH
                  <input name="mph" type="number" step="0.1" value={r().mph ?? ""} />
                </label>
              </div>

              <div class="field-row">
                <label>
                  RT
                  <input name="rt" type="number" step="0.001" value={r().rt ?? ""} />
                </label>
                <label>
                  60ft
                  <input name="sixtyFt" type="number" step="0.001" value={r().sixtyFt ?? ""} />
                </label>
                <label>
                  330ft
                  <input name="three30Ft" type="number" step="0.001" value={r().three30Ft ?? ""} />
                </label>
              </div>

              <div class="field-row">
                <label>
                  Dial-In
                  <input name="dialIn" type="number" step="0.001" value={r().dialIn ?? ""} />
                </label>
                <label>
                  Win
                  <select name="win">
                    <option value="">—</option>
                    <option value="true" selected={r().win === true}>
                      Yes
                    </option>
                    <option value="false" selected={r().win === false}>
                      No
                    </option>
                  </select>
                </label>
              </div>

              <div class="field-row">
                <label>
                  Temp (°F)
                  <input name="temperatureF" type="number" value={r().temperatureF ?? ""} />
                </label>
                <label>
                  Humidity (%)
                  <input
                    name="humidityPct"
                    type="number"
                    min="0"
                    max="100"
                    value={r().humidityPct ?? ""}
                  />
                </label>
              </div>

              <label>
                Comments
                <input name="comments" value={r().comments ?? ""} />
              </label>

              <button type="submit" disabled={submitting()}>
                {submitting() ? "Saving…" : "Save Changes"}
              </button>
            </form>
          )}
        </Show>
      </Suspense>
    </main>
  );
}
