import { Title } from "@solidjs/meta";
import { A, useNavigate } from "@solidjs/router";
import { For, Show, createResource, createSignal, Suspense } from "solid-js";
import { listCars } from "~/server/api/cars";
import { getEvent } from "~/server/api/events";
import { createRun } from "~/server/api/runs";
import type { ValidationWarning } from "~/server/db/validation";
import "../index.css";

interface BatchRow {
  id: number;
  carId: string;
  lane: string;
  sessionType: string;
  round: string;
  et: string;
  mph: string;
  sixtyFt: string;
  rt: string;
  dialIn: string;
  comments: string;
}

export default function BatchEntry(props: { eventId: string }) {
  const navigate = useNavigate();
  const eventId = () => Number(props.eventId);
  const [event] = createResource(eventId, getEvent);
  const [cars] = createResource(listCars);
  const [rows, setRows] = createSignal<BatchRow[]>([freshRow(1)]);
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [allWarnings, setAllWarnings] = createSignal<ValidationWarning[]>([]);

  let nextId = 2;

  function freshRow(id: number): BatchRow {
    return {
      id,
      carId: "",
      lane: "",
      sessionType: "Practice",
      round: "",
      et: "",
      mph: "",
      sixtyFt: "",
      rt: "",
      dialIn: "",
      comments: "",
    };
  }

  function addRow() {
    setRows((prev) => [...prev, freshRow(nextId++)]);
  }

  function removeRow(id: number) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function updateRow(id: number, field: keyof BatchRow, value: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setAllWarnings([]);

    const allErrors: string[] = [];
    const allWarns: ValidationWarning[] = [];

    for (const row of rows()) {
      if (!row.carId || !row.et) {
        allErrors.push(`Row ${row.id}: car and ET are required.`);
        continue;
      }
      const input: Record<string, unknown> = {
        eventId: eventId(),
        carId: Number(row.carId),
        sessionType: row.sessionType,
        et: Number(row.et),
      };
      if (row.lane) input.lane = row.lane;
      if (row.mph) input.mph = Number(row.mph);
      if (row.sixtyFt) input.sixtyFt = Number(row.sixtyFt);
      if (row.rt) input.rt = Number(row.rt);
      if (row.comments) input.comments = row.comments;
      if (row.sessionType === "Elimination") {
        if (row.round) input.round = Number(row.round);
        if (row.dialIn) input.dialIn = Number(row.dialIn);
      }
      try {
        const result = await createRun(input);
        allWarns.push(...result.warnings);
      } catch (err) {
        allErrors.push(`Row ${row.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    setAllWarnings(allWarns);
    if (allErrors.length > 0) {
      setError(allErrors.join("\n"));
    } else {
      navigate(`/races/${props.eventId}`);
    }
    setSubmitting(false);
  }

  return (
    <main>
      <Title>Batch Entry — Pit Lane</Title>
      <Suspense fallback={<p>Loading…</p>}>
        <Show when={event()}>
          {(ev) => (
            <div>
              <A href={`/races/${props.eventId}`} class="back-link">
                ← Back to Runs
              </A>
              <h1>Batch Entry</h1>
              <p>
                {ev().track} — {ev().eventDate}
              </p>
            </div>
          )}
        </Show>
      </Suspense>

      <Show when={error()}>
        <p class="error" style={{ "white-space": "pre-wrap" }}>
          {error()}
        </p>
      </Show>
      <Show when={allWarnings().length > 0}>
        <div class="warnings">
          <For each={allWarnings()}>
            {(w) => (
              <p class="warning-item">
                {w.field}: {w.message}
              </p>
            )}
          </For>
        </div>
      </Show>

      <form onSubmit={handleSubmit} class="batch-form">
        <div class="batch-rows">
          <For each={rows()}>
            {(row) => (
              <div class="batch-row">
                <label>
                  Car
                  <Suspense
                    fallback={
                      <select disabled>
                        <option>…</option>
                      </select>
                    }
                  >
                    <select
                      value={row.carId}
                      onChange={(e) => updateRow(row.id, "carId", e.currentTarget.value)}
                    >
                      <option value="">Select</option>
                      <For each={cars()}>
                        {(car) => <option value={car.carId!}>{car.name}</option>}
                      </For>
                    </select>
                  </Suspense>
                </label>
                <label>
                  Type
                  <select
                    value={row.sessionType}
                    onChange={(e) => updateRow(row.id, "sessionType", e.currentTarget.value)}
                  >
                    <option value="Practice">P</option>
                    <option value="Elimination">E</option>
                  </select>
                </label>
                <Show when={row.sessionType === "Elimination"}>
                  <label>
                    Rd
                    <input
                      type="number"
                      min="1"
                      value={row.round}
                      onInput={(e) => updateRow(row.id, "round", e.currentTarget.value)}
                      style={{ width: "3rem" }}
                    />
                  </label>
                </Show>
                <label>
                  Lane
                  <select
                    value={row.lane}
                    onChange={(e) => updateRow(row.id, "lane", e.currentTarget.value)}
                  >
                    <option value="">—</option>
                    <option value="Left">L</option>
                    <option value="Right">R</option>
                  </select>
                </label>
                <label>
                  ET
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={row.et}
                    onInput={(e) => updateRow(row.id, "et", e.currentTarget.value)}
                    style={{ width: "5rem" }}
                  />
                </label>
                <label>
                  MPH
                  <input
                    type="number"
                    step="0.1"
                    value={row.mph}
                    onInput={(e) => updateRow(row.id, "mph", e.currentTarget.value)}
                    style={{ width: "4rem" }}
                  />
                </label>
                <button type="button" class="btn-remove" onClick={() => removeRow(row.id)}>
                  ✕
                </button>
              </div>
            )}
          </For>
        </div>

        <div
          style={{ display: "flex", gap: "0.5rem", "align-items": "center", "flex-wrap": "wrap" }}
        >
          <button type="button" class="btn-secondary" onClick={addRow}>
            + Add Row
          </button>
          <button type="submit" class="btn-submit" disabled={submitting()}>
            {submitting() ? "Saving…" : `Submit ${rows().length} Run(s)`}
          </button>
        </div>
      </form>
    </main>
  );
}
