import { Title } from "@solidjs/meta";
import { A } from "@solidjs/router";
import { For, Show, createResource, Suspense } from "solid-js";
import { listEvents } from "~/server/api/events";
import "./index.css";

export default function RaceList() {
  const [events] = createResource(() => listEvents());

  return (
    <main>
      <Title>Races — Pit Lane</Title>
      <div class="race-list-header">
        <h1>Races</h1>
      </div>
      <Suspense fallback={<p>Loading…</p>}>
        <Show when={events() && events()!.length > 0} fallback={<p>No race events yet.</p>}>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Track</th>
                  <th>Session</th>
                  <th>Runs</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                <For each={events()}>
                  {(event) => (
                    <tr>
                      <td>{event.eventDate}</td>
                      <td>{event.track}</td>
                      <td>{event.sessionLabel ?? "—"}</td>
                      <td>{event.runCount}</td>
                      <td>
                        <A href={`/races/${event.eventId}`} class="btn-small">
                          View Runs
                        </A>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Show>
      </Suspense>
    </main>
  );
}
