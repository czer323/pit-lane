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

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export default function QuickEntry(props: { params: { eventId: string } }) {
  const eventId = () => Number(props.params.eventId);
  const [event] = createResource(eventId, getEvent);
  const [cars] = createResource(listCars);
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [warnings, setWarnings] = createSignal<ValidationWarning[]>([]);
  const [success, setSuccess] = createSignal(false);
  const [sessionType, setSessionType] = createSignal("Practice");

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setWarnings([]);
    setSuccess(false);
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
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div class="p-4 md:p-6 space-y-6">
      <Title>Quick Entry — Pit Lane</Title>
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
                  <CardTitle>Quick Entry</CardTitle>
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
        <p class="text-sm text-red-400" role="alert">
          {error()}
        </p>
      </Show>
      <Show when={success()}>
        <p class="text-sm text-green-400" role="status">
          Run recorded.
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

      <Card>
        <CardHeader>
          <CardTitle class="text-base">Record a Pass</CardTitle>
        </CardHeader>
        <CardContent>
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
                    <option value="">Select car…</option>
                    <For each={cars()}>
                      {(car) => <option value={car.carId!}>{car.name}</option>}
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
                  <option value="Left">Left</option>
                  <option value="Right">Right</option>
                </select>
              </div>

              <Show when={sessionType() === "Elimination"}>
                <div class="space-y-1.5">
                  <Label for="round">
                    Round <span class="text-red-400">*</span>
                  </Label>
                  <Input id="round" name="round" type="number" min="1" required />
                </div>
              </Show>

              <div class="space-y-1.5">
                <Label for="et">
                  ET (seconds) <span class="text-red-400">*</span>
                </Label>
                <Input id="et" name="et" type="number" step="0.001" required placeholder="4.321" />
              </div>

              <div class="space-y-1.5">
                <Label for="mph">MPH</Label>
                <Input id="mph" name="mph" type="number" step="0.1" placeholder="28.7" />
              </div>

              <div class="space-y-1.5">
                <Label for="rt">RT</Label>
                <Input id="rt" name="rt" type="number" step="0.001" placeholder="0.025" />
              </div>

              <div class="space-y-1.5">
                <Label for="sixtyFt">60ft</Label>
                <Input id="sixtyFt" name="sixtyFt" type="number" step="0.001" placeholder="0.895" />
              </div>

              <div class="space-y-1.5">
                <Label for="three30Ft">330ft</Label>
                <Input
                  id="three30Ft"
                  name="three30Ft"
                  type="number"
                  step="0.001"
                  placeholder="2.345"
                />
              </div>

              <Show when={sessionType() === "Elimination"}>
                <div class="space-y-1.5">
                  <Label for="dialIn">Dial-In</Label>
                  <Input id="dialIn" name="dialIn" type="number" step="0.001" />
                </div>
              </Show>

              <div class="space-y-1.5">
                <Label for="temperatureF">Temp (°F)</Label>
                <Input id="temperatureF" name="temperatureF" type="number" />
              </div>

              <div class="space-y-1.5">
                <Label for="humidityPct">Humidity (%)</Label>
                <Input id="humidityPct" name="humidityPct" type="number" min="0" max="100" />
              </div>

              <div class="space-y-1.5 sm:col-span-2 lg:col-span-3">
                <Label for="comments">Comments</Label>
                <Input id="comments" name="comments" placeholder="Any notes…" />
              </div>
            </div>

            <Button type="submit" disabled={submitting()}>
              {submitting() ? "Saving…" : "Record Run"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
