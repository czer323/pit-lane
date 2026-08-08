import { Title } from "@solidjs/meta";
import { A, useNavigate, useParams } from "@solidjs/router";
import { For, Show, createResource, createSignal, Suspense } from "solid-js";
import { getCar, deleteCar } from "~/server/api/cars";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";

export default function CarDetail() {
  const params = useParams();
  const navigate = useNavigate();
  const id = () => params.id;
  const [car] = createResource(() => getCar(Number(id())));
  const [confirmDelete, setConfirmDelete] = createSignal(false);
  const [deleteError, setDeleteError] = createSignal<string | null>(null);
  const [deleting, setDeleting] = createSignal(false);

  async function handleDelete() {
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteCar(Number(id()));
      navigate("/cars");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div class="p-4 md:p-6 space-y-6">
      <Title>{car()?.name ?? "Car"} — Pit Lane</Title>

      <A href="/cars" class="text-sm text-muted-foreground hover:text-foreground transition-colors">
        ← Back to Cars
      </A>

      <Suspense fallback={<p class="text-sm text-muted-foreground">Loading…</p>}>
        <Show when={car()}>
          {(c) => (
            <>
              <div class="flex items-center justify-between flex-wrap gap-3">
                <div class="flex items-center gap-3">
                  <h2 class="text-xl font-semibold">{c().name}</h2>
                  {c().atTrack && <Badge variant="default">At track</Badge>}
                </div>
                <div class="flex gap-2">
                  <A href={`/cars/${id()}/edit`}>
                    <Button variant="outline" size="sm">
                      Edit
                    </Button>
                  </A>
                  <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
                    Delete
                  </Button>
                </div>
              </div>

              <Show when={deleteError()}>
                <p role="alert" class="text-sm text-destructive">
                  {deleteError()}
                </p>
              </Show>

              <Card>
                <CardHeader>
                  <CardTitle>Specifications</CardTitle>
                </CardHeader>
                <CardContent>
                  <div class="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                    <Spec label="Body" value={c().body} />
                    <Spec label="Body Type" value={c().bodyType} />
                    <Spec label="Chassis" value={c().chassis} />
                    <Spec label="Weight" value={c().weightG ? `${c().weightG} g` : null} />
                    <Spec label="Motor" value={c().motor} />
                    <Spec
                      label="Amp Draw 3V"
                      value={c().ampDraw3v != null ? String(c().ampDraw3v) : null}
                    />
                    <Spec
                      label="Pinion"
                      value={c().pinion != null ? `${c().pinion} teeth` : null}
                    />
                    <Spec label="Crown" value={c().crown != null ? `${c().crown} teeth` : null} />
                    <Spec label="Gear Ratio" value={c().gearRatio?.toFixed(3) ?? null} />
                    <Spec
                      label="Tire Diameter"
                      value={c().tireDiaMm ? `${c().tireDiaMm} mm` : null}
                    />
                    <Spec label="Rollout" value={c().rollout?.toFixed(2) ?? null} />
                  </div>

                  <Separator class="my-4" />

                  <div class="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                    <div>
                      <span class="text-muted-foreground">Created </span>
                      <span>{c().createdAt}</span>
                    </div>
                    <div>
                      <span class="text-muted-foreground">Updated </span>
                      <span>{c().updatedAt}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Version History</CardTitle>
                </CardHeader>
                <CardContent>
                  <Show
                    when={c().snapshots.length > 0}
                    fallback={<p class="text-sm text-muted-foreground">No version history yet.</p>}
                  >
                    <ul class="space-y-3">
                      <For each={c().snapshots}>
                        {(snap) => (
                          <li class="border-l-2 border-border pl-4 py-1">
                            <div class="text-xs text-muted-foreground mb-1">
                              {snap.snapshotDate}
                            </div>
                            <div class="text-sm space-y-0.5">
                              <Show when={snap.motor}>
                                <div>Motor: {snap.motor}</div>
                              </Show>
                              <Show when={snap.pinion}>
                                <div>Pinion: {snap.pinion}</div>
                              </Show>
                              <Show when={snap.crown}>
                                <div>Crown: {snap.crown}</div>
                              </Show>
                              <Show when={snap.weightG}>
                                <div>Weight: {snap.weightG} g</div>
                              </Show>
                              <Show when={snap.notes}>
                                <div class="text-muted-foreground">{snap.notes}</div>
                              </Show>
                            </div>
                          </li>
                        )}
                      </For>
                    </ul>
                  </Show>
                </CardContent>
              </Card>
            </>
          )}
        </Show>
      </Suspense>

      <Show when={confirmDelete()}>
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setConfirmDelete(false)}
        >
          <div
            class="bg-card border rounded-lg shadow-lg p-6 space-y-4 max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 class="text-lg font-semibold">Delete Car</h3>
            <p class="text-sm text-muted-foreground">Delete this car? This cannot be undone.</p>
            <div class="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting()}>
                {deleting() ? "Deleting…" : "Confirm Delete"}
              </Button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

function Spec(props: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <div class="text-xs text-muted-foreground">{props.label}</div>
      <div class="text-sm">{props.value ?? "—"}</div>
    </div>
  );
}
