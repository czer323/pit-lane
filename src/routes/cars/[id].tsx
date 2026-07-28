import { Title } from "@solidjs/meta";
import { A, useNavigate } from "@solidjs/router";
import { For, Show, createResource, createSignal, Suspense } from "solid-js";
import { getCar, deleteCar } from "~/server/api/cars";
import "./form.css";

export default function CarDetail(props: { id: string }) {
  const navigate = useNavigate();
  const [car] = createResource(() => getCar(Number(props.id)));
  const [confirmDelete, setConfirmDelete] = createSignal(false);
  const [deleteError, setDeleteError] = createSignal<string | null>(null);

  async function handleDelete() {
    setDeleteError(null);
    try {
      await deleteCar(Number(props.id));
      navigate("/cars");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
      setConfirmDelete(false);
    }
  }

  return (
    <main>
      <Title>{car()?.name ?? "Car"} — Pit Lane</Title>
      <div class="car-detail">
        <A href="/cars" class="back-link">
          ← Back to Cars
        </A>
        <Suspense fallback={<p>Loading…</p>}>
          <Show when={car()}>
            {(c) => (
              <>
                <h1>{c().name}</h1>
                <div class="detail-actions">
                  <A href={`/cars/${props.id}/edit`}>Edit</A>
                  <button class="btn-danger" onClick={() => setConfirmDelete(true)}>
                    Delete
                  </button>
                </div>
                <Show when={deleteError()}>
                  <p class="error">{deleteError()}</p>
                </Show>
                <dl>
                  <dt>Body</dt>
                  <dd>{c().body ?? "—"}</dd>
                  <dt>Body Type</dt>
                  <dd>{c().bodyType ?? "—"}</dd>
                  <dt>Chassis</dt>
                  <dd>{c().chassis ?? "—"}</dd>
                  <dt>Weight</dt>
                  <dd>{c().weightG ? `${c().weightG} g` : "—"}</dd>
                  <dt>Motor</dt>
                  <dd>{c().motor ?? "—"}</dd>
                  <dt>Amp Draw 3V</dt>
                  <dd>{c().ampDraw3v ?? "—"}</dd>
                  <dt>Pinion</dt>
                  <dd>{c().pinion ?? "—"}</dd>
                  <dt>Crown</dt>
                  <dd>{c().crown ?? "—"}</dd>
                  <dt>Gear Ratio</dt>
                  <dd>{c().gearRatio?.toFixed(3) ?? "—"}</dd>
                  <dt>Tire Diameter</dt>
                  <dd>{c().tireDiaMm ? `${c().tireDiaMm} mm` : "—"}</dd>
                  <dt>Rollout</dt>
                  <dd>{c().rollout?.toFixed(2) ?? "—"}</dd>
                  <dt>Created</dt>
                  <dd>{c().createdAt}</dd>
                  <dt>Updated</dt>
                  <dd>{c().updatedAt}</dd>
                </dl>

                <div class="timeline">
                  <h2>Version History</h2>
                  <Show when={c().snapshots.length > 0} fallback={<p>No version history yet.</p>}>
                    <ul class="timeline-list">
                      <For each={c().snapshots}>
                        {(snap, i) => (
                          <li class="timeline-item">
                            <div class="timeline-date">{snap.snapshotDate}</div>
                            <Show when={snap.motor}>
                              <div class="timeline-diff">Motor: {snap.motor}</div>
                            </Show>
                            <Show when={snap.pinion}>
                              <div class="timeline-diff">Pinion: {snap.pinion}</div>
                            </Show>
                            <Show when={snap.crown}>
                              <div class="timeline-diff">Crown: {snap.crown}</div>
                            </Show>
                            <Show when={snap.weightG}>
                              <div class="timeline-diff">Weight: {snap.weightG} g</div>
                            </Show>
                            <Show when={snap.notes}>
                              <div class="timeline-notes">{snap.notes}</div>
                            </Show>
                          </li>
                        )}
                      </For>
                    </ul>
                  </Show>
                </div>
              </>
            )}
          </Show>
        </Suspense>

        <Show when={confirmDelete()}>
          <div class="confirm-dialog">
            <div>
              <p>Delete this car? This cannot be undone.</p>
              <button onClick={handleDelete}>Confirm Delete</button>
              <button onClick={() => setConfirmDelete(false)}>Cancel</button>
            </div>
          </div>
        </Show>
      </div>
    </main>
  );
}
