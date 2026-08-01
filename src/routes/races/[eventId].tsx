import { Title } from "@solidjs/meta";
import { A } from "@solidjs/router";
import { For, Show, createResource, createSignal, Suspense } from "solid-js";
import { getEvent } from "~/server/api/events";
import { listRuns, deleteRun } from "~/server/api/runs";
import type { RunWithCar } from "~/server/api/runs";
import "./index.css";

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
    <main>
      <Suspense fallback={<p>Loading event…</p>}>
        <Show when={event()}>
          {(ev) => (
            <>
              <Title>{ev().track} — Runs — Pit Lane</Title>
              <div>
                <A href="/races" class="back-link">
                  ← All Races
                </A>
                <h1>{ev().track}</h1>
                <p>
                  {ev().eventDate}
                  <Show when={ev().sessionLabel}> — {ev().sessionLabel}</Show>
                </p>
              </div>
            </>
          )}
        </Show>
      </Suspense>

      <div class="event-actions">
        <A href={`/races/${props.eventId}/quick`} class="btn-add">
          + Quick Entry
        </A>
        <A href={`/races/${props.eventId}/batch`} class="btn-secondary">
          Batch Entry
        </A>
      </div>

      <Show when={deleteError()}>
        <p class="error">{deleteError()}</p>
      </Show>

      <Suspense fallback={<p>Loading runs…</p>}>
        <Show when={runs()} fallback={<p>Loading…</p>}>
          <Show when={runs()!.length > 0} fallback={<p>No runs recorded for this event.</p>}>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Heat</th>
                    <th>Car</th>
                    <th>Lane</th>
                    <th>RT</th>
                    <th>60ft</th>
                    <th>ET</th>
                    <th>MPH</th>
                    <th>Dial-In</th>
                    <th>Win</th>
                    <th>Comments</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  <For each={Array.from(groupedRuns().entries())}>
                    {([_key, group]) => (
                      <>
                        <tr class="group-header">
                          <td colspan="11">{group.label}</td>
                        </tr>
                        <For each={group.runs}>
                          {(run) => (
                            <tr>
                              <td>
                                <Show when={run.sessionType === "Elimination"} fallback="Practice">
                                  {`R${run.round}`}
                                </Show>
                              </td>
                              <td>{run.carName}</td>
                              <td>{run.lane ?? "—"}</td>
                              <td>{run.rt?.toFixed(3) ?? "—"}</td>
                              <td>{run.sixtyFt?.toFixed(3) ?? "—"}</td>
                              <td>{run.et?.toFixed(3) ?? "—"}</td>
                              <td>{run.mph?.toFixed(1) ?? "—"}</td>
                              <td>{run.dialIn?.toFixed(3) ?? "—"}</td>
                              <td>
                                <Show when={run.win !== null} fallback="—">
                                  {run.win ? "✓" : "✗"}
                                </Show>
                              </td>
                              <td>{run.comments ?? "—"}</td>
                              <td class="action-cell">
                                <A
                                  href={`/races/${props.eventId}/edit/${run.runId}`}
                                  class="btn-small"
                                >
                                  Edit
                                </A>
                                <button class="btn-danger" onClick={() => setConfirmId(run.runId)}>
                                  Delete
                                </button>
                              </td>
                            </tr>
                          )}
                        </For>
                      </>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>
        </Show>
      </Suspense>

      <Show when={confirmId() !== null}>
        <div class="confirm-dialog">
          <div>
            <p>Delete this run? This cannot be undone.</p>
            <button onClick={() => handleDelete(confirmId()!)}>Confirm Delete</button>
            <button onClick={() => setConfirmId(null)}>Cancel</button>
          </div>
        </div>
      </Show>
    </main>
  );
}
