import { Title } from "@solidjs/meta";
import { A, useNavigate, useParams } from "@solidjs/router";
import { createEffect, For, Show, createResource, createSignal, Suspense } from "solid-js";
import { getEvent } from "~/server/api/events";
import { listCars } from "~/server/api/cars";
import { getRun, updateRun, deleteRun } from "~/server/api/runs";
import type { ValidationWarning } from "~/server/db/validation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export default function EditRun() {
  const params = useParams();
  const navigate = useNavigate();
  const runId = () => Number(params.runId);
  const [event] = createResource(() => Number(params.eventId), getEvent);
  const [cars] = createResource(listCars);
  const [run] = createResource(runId, getRun);
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [warnings, setWarnings] = createSignal<ValidationWarning[]>([]);
  const [sessionType, setSessionType] = createSignal("Practice");
  const [confirmDelete, setConfirmDelete] = createSignal(false);
  const [deleteError, setDeleteError] = createSignal<string | null>(null);

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
    input.eventId = Number(params.eventId);
    try {
      const result = await updateRun(runId(), input);
      setWarnings(result.warnings);
      navigate(`/races/${params.eventId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    setDeleteError(null);
    try {
      await deleteRun(runId());
      navigate(`/races/${params.eventId}`);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
      setConfirmDelete(false);
    }
  }

  return (
    <div class="p-4 md:p-6 space-y-6">
      <Title>Edit Run — Pit Lane</Title>
      <Suspense fallback={<p class="text-sm text-muted-foreground">Loading…</p>}>
        <Show when={event() && run()}>
          <div class="space-y-2">
            <A
              href={`/races/${params.eventId}`}
              class="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back to Runs
            </A>
            <Card>
              <CardHeader>
                <CardTitle>Edit Run</CardTitle>
                <CardDescription>
                  {run()!.carName} — {event()!.track}, {event()!.eventDate}
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </Show>
      </Suspense>

      <Show when={error()}>
        <p class="text-sm text-red-400" role="alert">
          {error()}
        </p>
      </Show>
      <Show when={deleteError()}>
        <p class="text-sm text-red-400" role="alert">
          {deleteError()}
        </p>
      </Show>
      <Show when={warnings().length > 0}>
        <div class="space-y-1">
          <For each={warnings()}>
            {(w) => (
              <p class="text-sm text-amber-400">
                {w.field}: {w.message}
              </p>
            )}
          </For>
        </div>
      </Show>

      <Suspense fallback={<p class="text-sm text-muted-foreground">Loading form…</p>}>
        <Show when={run()}>
          {(r) => (
            <Card>
              <CardContent class="pt-6">
                <form onSubmit={handleSubmit} class="space-y-4">
                  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div class="space-y-1.5">
                      <Label for="carId">
                        Car <span class="text-red-400">*</span>
                      </Label>
                      <Suspense
                        fallback={
                          <select class={selectClass} disabled>
                            <option>Loading…</option>
                          </select>
                        }
                      >
                        <select id="carId" name="carId" class={selectClass} required>
                          <For each={cars()}>
                            {(car) => (
                              <option value={car.carId!} selected={car.carId === r().carId}>
                                {car.name}
                              </option>
                            )}
                          </For>
                        </select>
                      </Suspense>
                    </div>

                    <div class="space-y-1.5">
                      <Label for="sessionType">Session Type</Label>
                      <select
                        id="sessionType"
                        name="sessionType"
                        class={selectClass}
                        value={sessionType()}
                        onChange={(e) => setSessionType(e.currentTarget.value)}
                      >
                        <option value="Practice">Practice</option>
                        <option value="Elimination">Elimination</option>
                      </select>
                    </div>

                    <div class="space-y-1.5">
                      <Label for="lane">Lane</Label>
                      <select id="lane" name="lane" class={selectClass}>
                        <option value="">—</option>
                        <option value="Left" selected={r().lane === "Left"}>
                          Left
                        </option>
                        <option value="Right" selected={r().lane === "Right"}>
                          Right
                        </option>
                      </select>
                    </div>

                    <Show when={sessionType() === "Elimination"}>
                      <div class="space-y-1.5">
                        <Label for="round">
                          Round <span class="text-red-400">*</span>
                        </Label>
                        <Input
                          id="round"
                          name="round"
                          type="number"
                          min="1"
                          required
                          value={r().round ?? ""}
                        />
                      </div>
                    </Show>

                    <div class="space-y-1.5">
                      <Label for="et">ET</Label>
                      <Input id="et" name="et" type="number" step="0.001" value={r().et ?? ""} />
                    </div>

                    <div class="space-y-1.5">
                      <Label for="mph">MPH</Label>
                      <Input id="mph" name="mph" type="number" step="0.1" value={r().mph ?? ""} />
                    </div>

                    <div class="space-y-1.5">
                      <Label for="rt">RT</Label>
                      <Input id="rt" name="rt" type="number" step="0.001" value={r().rt ?? ""} />
                    </div>

                    <div class="space-y-1.5">
                      <Label for="sixtyFt">60ft</Label>
                      <Input
                        id="sixtyFt"
                        name="sixtyFt"
                        type="number"
                        step="0.001"
                        value={r().sixtyFt ?? ""}
                      />
                    </div>

                    <div class="space-y-1.5">
                      <Label for="three30Ft">330ft</Label>
                      <Input
                        id="three30Ft"
                        name="three30Ft"
                        type="number"
                        step="0.001"
                        value={r().three30Ft ?? ""}
                      />
                    </div>

                    <div class="space-y-1.5">
                      <Label for="dialIn">Dial-In</Label>
                      <Input
                        id="dialIn"
                        name="dialIn"
                        type="number"
                        step="0.001"
                        value={r().dialIn ?? ""}
                      />
                    </div>

                    <div class="space-y-1.5">
                      <Label for="win">Win</Label>
                      <select id="win" name="win" class={selectClass}>
                        <option value="">—</option>
                        <option value="true" selected={r().win === true}>
                          Yes
                        </option>
                        <option value="false" selected={r().win === false}>
                          No
                        </option>
                      </select>
                    </div>

                    <div class="space-y-1.5">
                      <Label for="temperatureF">Temp (°F)</Label>
                      <Input
                        id="temperatureF"
                        name="temperatureF"
                        type="number"
                        value={r().temperatureF ?? ""}
                      />
                    </div>

                    <div class="space-y-1.5">
                      <Label for="humidityPct">Humidity (%)</Label>
                      <Input
                        id="humidityPct"
                        name="humidityPct"
                        type="number"
                        min="0"
                        max="100"
                        value={r().humidityPct ?? ""}
                      />
                    </div>

                    <div class="space-y-1.5 sm:col-span-2 lg:col-span-3">
                      <Label for="comments">Comments</Label>
                      <Input id="comments" name="comments" value={r().comments ?? ""} />
                    </div>
                  </div>

                  <div class="flex flex-wrap items-center gap-2">
                    <Button type="submit" disabled={submitting()}>
                      {submitting() ? "Saving…" : "Save Changes"}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={submitting()}
                      onClick={() => setConfirmDelete(true)}
                    >
                      Delete Run
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </Show>
      </Suspense>

      <Show when={confirmDelete()}>
        <Card class="border-destructive/50">
          <CardHeader>
            <CardTitle class="text-base">Delete this run?</CardTitle>
            <CardDescription>This cannot be undone.</CardDescription>
          </CardHeader>
          <CardContent class="flex gap-2">
            <Button variant="destructive" size="sm" onClick={() => void handleDelete()}>
              Confirm Delete
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      </Show>
    </div>
  );
}
