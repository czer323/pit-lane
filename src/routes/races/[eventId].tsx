import { Title } from "@solidjs/meta";
import { A } from "@solidjs/router";
import { For, Show, createResource, createSignal, Suspense } from "solid-js";
import { getEvent } from "~/server/api/events";
import { listRuns, deleteRun } from "~/server/api/runs";
import type { RunWithCar } from "~/server/api/runs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";

export default function EventRuns(props: { eventId: string }) {
  const eventId = () => Number(props.eventId);
  const [event] = createResource(eventId, getEvent);
  const [runs, { refetch }] = createResource(eventId, listRuns);
  const [deleteError, setDeleteError] = createSignal<string | null>(null);
  const [confirmId, setConfirmId] = createSignal<number | null>(null);

  async function handleDelete(runId: number) {
    setDeleteError(null);
    try {
      await deleteRun(runId);
      setConfirmId(null);
      void refetch();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
      setConfirmId(null);
    }
  }

  // Group runs by heat (sessionType + round)
  function groupedRuns(): Map<string, { label: string; runs: RunWithCar[] }> {
    const groups = new Map<string, { label: string; runs: RunWithCar[] }>();
    const r = runs();
    if (!r) return groups;
    for (const run of r) {
      const key = run.sessionType === "Practice" ? `Practice` : `Elimination-R${run.round ?? "?"}`;
      const label = run.sessionType === "Practice" ? "Practice" : `Round ${run.round ?? "?"}`;
      if (!groups.has(key)) {
        groups.set(key, { label, runs: [] });
      }
      groups.get(key)!.runs.push(run);
    }
    return groups;
  }

  return (
    <div class="p-4 md:p-6 space-y-6">
      <Suspense fallback={<p class="text-sm text-muted-foreground">Loading event…</p>}>
        <Show when={event()}>
          {(ev) => (
            <>
              <Title>{ev().track} — Runs — Pit Lane</Title>
              <div class="space-y-2">
                <A
                  href="/races"
                  class="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← All Races
                </A>
                <Card>
                  <CardHeader>
                    <div class="flex flex-wrap items-start justify-between gap-2">
                      <div class="space-y-1">
                        <CardTitle>{ev().track}</CardTitle>
                        <CardDescription>
                          {ev().eventDate}
                          <Show when={ev().sessionLabel}> — {ev().sessionLabel}</Show>
                        </CardDescription>
                      </div>
                      <Show when={ev().temperatureF != null || ev().humidityPct != null}>
                        <div class="flex gap-2">
                          <Show when={ev().temperatureF != null}>
                            <Badge variant="outline">{ev().temperatureF}°F</Badge>
                          </Show>
                          <Show when={ev().humidityPct != null}>
                            <Badge variant="outline">{ev().humidityPct}%</Badge>
                          </Show>
                        </div>
                      </Show>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div class="flex flex-wrap gap-2">
                      <A href={`/races/${props.eventId}/quick`}>
                        <Button size="sm">Quick Entry</Button>
                      </A>
                      <A href={`/races/${props.eventId}/batch`}>
                        <Button size="sm" variant="outline">
                          Batch Entry
                        </Button>
                      </A>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </Show>
      </Suspense>

      <Show when={deleteError()}>
        <p class="text-sm text-red-400" role="alert">
          {deleteError()}
        </p>
      </Show>

      <Suspense fallback={<p class="text-sm text-muted-foreground">Loading runs…</p>}>
        <Show when={runs()} fallback={<p class="text-sm text-muted-foreground">Loading…</p>}>
          <Show
            when={runs()!.length > 0}
            fallback={
              <div class="py-8 text-center" role="status">
                <p class="text-sm text-muted-foreground">No runs yet.</p>
              </div>
            }
          >
            <div class="space-y-6">
              <For each={Array.from(groupedRuns().entries())}>
                {([_key, group]) => (
                  <div class="space-y-3">
                    <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      {group.label}
                    </h3>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <For each={group.runs}>
                        {(run) => (
                          <Card>
                            <CardContent class="p-4 space-y-3">
                              <div class="flex items-center justify-between gap-2">
                                <h4 class="font-medium">{run.carName}</h4>
                                <div class="flex shrink-0 gap-1.5">
                                  <Show when={run.lane}>
                                    <Badge variant="outline">{run.lane}</Badge>
                                  </Show>
                                  <Badge
                                    variant={
                                      run.sessionType === "Elimination" ? "default" : "secondary"
                                    }
                                  >
                                    {run.sessionType}
                                  </Badge>
                                </div>
                              </div>
                              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                                <div>
                                  <p class="text-xs text-muted-foreground">ET</p>
                                  <p class="font-mono">{run.et?.toFixed(3) ?? "—"}</p>
                                </div>
                                <div>
                                  <p class="text-xs text-muted-foreground">MPH</p>
                                  <p class="font-mono">{run.mph?.toFixed(1) ?? "—"}</p>
                                </div>
                                <div>
                                  <p class="text-xs text-muted-foreground">RT</p>
                                  <p class="font-mono">{run.rt?.toFixed(3) ?? "—"}</p>
                                </div>
                                <div>
                                  <p class="text-xs text-muted-foreground">60ft</p>
                                  <p class="font-mono">{run.sixtyFt?.toFixed(3) ?? "—"}</p>
                                </div>
                              </div>
                              <div class="flex flex-wrap items-center justify-between gap-2">
                                <div class="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                                  <Show when={run.round}>
                                    <span>Round {run.round}</span>
                                  </Show>
                                  <Show when={run.dialIn != null}>
                                    <span>Dial {run.dialIn!.toFixed(3)}</span>
                                  </Show>
                                  <Show when={run.comments}>
                                    <span class="truncate">{run.comments}</span>
                                  </Show>
                                </div>
                                <div class="flex items-center gap-2">
                                  <Show when={run.win !== null}>
                                    <Badge variant={run.win ? "default" : "secondary"}>
                                      {run.win ? "Win" : "Loss"}
                                    </Badge>
                                  </Show>
                                  <A href={`/races/${props.eventId}/edit/${run.runId}`}>
                                    <Button variant="outline" size="sm">
                                      Edit
                                    </Button>
                                  </A>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => setConfirmId(run.runId)}
                                  >
                                    Delete
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </For>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </Suspense>

      <Show when={confirmId() !== null}>
        <Card class="border-destructive/50">
          <CardHeader>
            <CardTitle class="text-base">Delete this run?</CardTitle>
            <CardDescription>This cannot be undone.</CardDescription>
          </CardHeader>
          <CardContent class="flex gap-2">
            <Button variant="destructive" size="sm" onClick={() => handleDelete(confirmId()!)}>
              Confirm Delete
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmId(null)}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      </Show>
    </div>
  );
}
