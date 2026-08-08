import { Title } from "@solidjs/meta";
import { A } from "@solidjs/router";
import { For, Show, createResource, createSignal, Suspense } from "solid-js";
import { listCars } from "~/server/api/cars";
import { getEvent } from "~/server/api/events";
import { createRun } from "~/server/api/runs";
import type { ValidationWarning } from "~/server/db/validation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

interface BatchRow {
  id: number;
  et: string;
  mph: string;
  rt: string;
  sixtyFt: string;
  three30Ft: string;
  dialIn: string;
  comments: string;
}

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export default function BatchEntry(props: { params: { eventId: string } }) {
  const eventId = () => Number(props.params.eventId);
  const [event] = createResource(eventId, getEvent);
  const [cars] = createResource(listCars);
  const [rows, setRows] = createSignal<BatchRow[]>([freshRow(1)]);
  const [carId, setCarId] = createSignal("");
  const [lane, setLane] = createSignal("");
  const [sessionType, setSessionType] = createSignal("Practice");
  const [round, setRound] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [allWarnings, setAllWarnings] = createSignal<ValidationWarning[]>([]);
  const [successCount, setSuccessCount] = createSignal<number | null>(null);

  let nextId = 2;

  function freshRow(id: number): BatchRow {
    return {
      id,
      et: "",
      mph: "",
      rt: "",
      sixtyFt: "",
      three30Ft: "",
      dialIn: "",
      comments: "",
    };
  }

  function addRow() {
    setRows((prev) => [...prev, freshRow(nextId++)]);
  }

  function removeRow(id: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }

  function updateRow(id: number, field: keyof BatchRow, value: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setAllWarnings([]);
    setSuccessCount(null);

    const allErrors: string[] = [];
    const allWarns: ValidationWarning[] = [];
    const savedRowIds = new Set<number>();
    let saved = 0;

    if (!carId()) {
      allErrors.push("Select a car.");
    }
    if (sessionType() === "Elimination" && !round()) {
      allErrors.push("Round is required for Elimination.");
    }
    if (allErrors.length === 0) {
      for (const row of rows()) {
        if (!row.et) {
          allErrors.push(`Row ${row.id}: ET is required.`);
          continue;
        }
        const input: Record<string, unknown> = {
          eventId: eventId(),
          carId: Number(carId()),
          sessionType: sessionType(),
          et: Number(row.et),
        };
        if (lane()) input.lane = lane();
        if (row.mph) input.mph = Number(row.mph);
        if (row.rt) input.rt = Number(row.rt);
        if (row.sixtyFt) input.sixtyFt = Number(row.sixtyFt);
        if (row.three30Ft) input.three30Ft = Number(row.three30Ft);
        if (row.comments) input.comments = row.comments;
        if (sessionType() === "Elimination") {
          input.round = Number(round());
          if (row.dialIn) input.dialIn = Number(row.dialIn);
        }
        try {
          const result = await createRun(input);
          allWarns.push(...result.warnings);
          savedRowIds.add(row.id);
          saved += 1;
        } catch (err) {
          allErrors.push(`Row ${row.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    setAllWarnings(allWarns);
    if (allErrors.length > 0) {
      setError(allErrors.join("\n"));
      // Drop already-saved rows so a retry does not insert duplicates
      setRows((prev) => {
        const remaining = prev.filter((r) => !savedRowIds.has(r.id));
        return remaining.length > 0 ? remaining : [freshRow(nextId++)];
      });
    } else {
      setSuccessCount(saved);
      setRows([freshRow(nextId++)]);
      setRound("");
    }
    setSubmitting(false);
  }

  return (
    <div class="p-4 md:p-6 space-y-6">
      <Title>Batch Entry — Pit Lane</Title>
      <Suspense fallback={<p class="text-sm text-muted-foreground">Loading…</p>}>
        <Show when={event()}>
          {(ev) => (
            <div class="space-y-2">
              <A
                href={`/races/${props.params.eventId}`}
                class="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Back to Runs
              </A>
              <Card>
                <CardHeader>
                  <CardTitle>Batch Entry</CardTitle>
                  <CardDescription>
                    {ev().track} — {ev().eventDate}
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          )}
        </Show>
      </Suspense>

      <Show when={error()}>
        <p class="text-sm text-red-400 whitespace-pre-wrap" role="alert">
          {error()}
        </p>
      </Show>
      <Show when={successCount() !== null}>
        <p class="text-sm text-green-400" role="status">
          {successCount()} run{successCount() === 1 ? "" : "s"} saved.
        </p>
      </Show>
      <Show when={allWarnings().length > 0}>
        <div class="space-y-1">
          <For each={allWarnings()}>
            {(w) => (
              <p class="text-sm text-amber-400">
                {w.field}: {w.message}
              </p>
            )}
          </For>
        </div>
      </Show>

      <Card>
        <CardHeader>
          <CardTitle class="text-base">Pass Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} class="space-y-6">
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div class="space-y-1.5">
                <Label for="carId">
                  Car <span class="text-red-400">*</span>
                </Label>
                <Suspense
                  fallback={
                    <select class={selectClass} disabled>
                      <option>…</option>
                    </select>
                  }
                >
                  <select
                    id="carId"
                    class={selectClass}
                    value={carId()}
                    onChange={(e) => setCarId(e.currentTarget.value)}
                  >
                    <option value="">Select</option>
                    <For each={cars()}>
                      {(car) => <option value={car.carId!}>{car.name}</option>}
                    </For>
                  </select>
                </Suspense>
              </div>
              <div class="space-y-1.5">
                <Label for="batchLane">Lane</Label>
                <select
                  id="batchLane"
                  class={selectClass}
                  value={lane()}
                  onChange={(e) => setLane(e.currentTarget.value)}
                >
                  <option value="">—</option>
                  <option value="Left">Left</option>
                  <option value="Right">Right</option>
                </select>
              </div>
              <div class="space-y-1.5">
                <Label for="batchSession">Session Type</Label>
                <select
                  id="batchSession"
                  class={selectClass}
                  value={sessionType()}
                  onChange={(e) => setSessionType(e.currentTarget.value)}
                >
                  <option value="Practice">Practice</option>
                  <option value="Elimination">Elimination</option>
                </select>
              </div>
              <Show when={sessionType() === "Elimination"}>
                <div class="space-y-1.5">
                  <Label for="batchRound">
                    Round <span class="text-red-400">*</span>
                  </Label>
                  <Input
                    id="batchRound"
                    type="number"
                    min="1"
                    value={round()}
                    onInput={(e) => setRound(e.currentTarget.value)}
                  />
                </div>
              </Show>
            </div>

            <div class="space-y-3">
              <For each={rows()}>
                {(row) => (
                  <div class="rounded-md border p-3">
                    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                      <div class="space-y-1.5">
                        <Label for={`et-${row.id}`}>
                          ET <span class="text-red-400">*</span>
                        </Label>
                        <Input
                          id={`et-${row.id}`}
                          type="number"
                          step="0.001"
                          placeholder="4.321"
                          value={row.et}
                          onInput={(e) => updateRow(row.id, "et", e.currentTarget.value)}
                        />
                      </div>
                      <div class="space-y-1.5">
                        <Label for={`mph-${row.id}`}>MPH</Label>
                        <Input
                          id={`mph-${row.id}`}
                          type="number"
                          step="0.1"
                          placeholder="28.7"
                          value={row.mph}
                          onInput={(e) => updateRow(row.id, "mph", e.currentTarget.value)}
                        />
                      </div>
                      <div class="space-y-1.5">
                        <Label for={`rt-${row.id}`}>RT</Label>
                        <Input
                          id={`rt-${row.id}`}
                          type="number"
                          step="0.001"
                          placeholder="0.025"
                          value={row.rt}
                          onInput={(e) => updateRow(row.id, "rt", e.currentTarget.value)}
                        />
                      </div>
                      <div class="space-y-1.5">
                        <Label for={`sixtyFt-${row.id}`}>60ft</Label>
                        <Input
                          id={`sixtyFt-${row.id}`}
                          type="number"
                          step="0.001"
                          placeholder="0.895"
                          value={row.sixtyFt}
                          onInput={(e) => updateRow(row.id, "sixtyFt", e.currentTarget.value)}
                        />
                      </div>
                      <div class="space-y-1.5">
                        <Label for={`three30Ft-${row.id}`}>330ft</Label>
                        <Input
                          id={`three30Ft-${row.id}`}
                          type="number"
                          step="0.001"
                          placeholder="2.345"
                          value={row.three30Ft}
                          onInput={(e) => updateRow(row.id, "three30Ft", e.currentTarget.value)}
                        />
                      </div>
                      <Show when={sessionType() === "Elimination"}>
                        <div class="space-y-1.5">
                          <Label for={`dialIn-${row.id}`}>Dial-In</Label>
                          <Input
                            id={`dialIn-${row.id}`}
                            type="number"
                            step="0.001"
                            value={row.dialIn}
                            onInput={(e) => updateRow(row.id, "dialIn", e.currentTarget.value)}
                          />
                        </div>
                      </Show>
                      <div class="space-y-1.5">
                        <Label for={`comments-${row.id}`}>Comments</Label>
                        <Input
                          id={`comments-${row.id}`}
                          placeholder="Notes…"
                          value={row.comments}
                          onInput={(e) => updateRow(row.id, "comments", e.currentTarget.value)}
                        />
                      </div>
                    </div>
                    <div class="mt-2 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        class="text-muted-foreground"
                        onClick={() => removeRow(row.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                )}
              </For>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={addRow}>
                + Add Row
              </Button>
              <Button type="submit" disabled={submitting()}>
                {submitting()
                  ? "Saving…"
                  : `Submit ${rows().length} Run${rows().length === 1 ? "" : "s"}`}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
