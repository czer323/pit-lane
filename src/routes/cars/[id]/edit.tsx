import { Title } from "@solidjs/meta";
import { A, useNavigate } from "@solidjs/router";
import { createSignal, Show, createResource, Suspense } from "solid-js";
import { getCar, updateCar } from "~/server/api/cars";
import "../form.css";

export default function EditCar(props: { id: string }) {
  const navigate = useNavigate();
  const [error, setError] = createSignal<string | null>(null);
  const [submitting, setSubmitting] = createSignal(false);
  const [gearRatio, setGearRatio] = createSignal<number | null>(null);
  const [rollout, setRollout] = createSignal<number | null>(null);
  const [car] = createResource(() => getCar(Number(props.id)));

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const input: Record<string, unknown> = {};
    for (const [key, value] of formData.entries()) {
      // Empty string means user deliberately cleared the field → send null
      if (value === "") {
        input[key] = null;
        continue;
      }
      const num = Number(value);
      input[key] = Number.isNaN(num) ? value : num;
    }
    try {
      await updateCar(Number(props.id), input);
      navigate(`/cars/${props.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  function computeDerived(e: InputEvent) {
    const form = (e.target as HTMLElement).closest("form")!;
    const formData = new FormData(form);
    const pinion = Number(formData.get("pinion"));
    const crown = Number(formData.get("crown"));
    const tireDiaMm = Number(formData.get("tireDiaMm"));
    if (crown && pinion && pinion !== 0) {
      const gr = crown / pinion;
      setGearRatio(gr);
      if (tireDiaMm) {
        setRollout((tireDiaMm * Math.PI) / gr);
      }
    }
  }

  return (
    <main>
      <Title>Edit Car — Pit Lane</Title>
      <div class="car-detail">
        <A href={`/cars/${props.id}`} class="back-link">
          ← Back to Car
        </A>
        <h1>Edit Car</h1>
        <Show when={error()}>
          <p class="error">{error()}</p>
        </Show>
        <Suspense fallback={<p>Loading…</p>}>
          <Show when={car()}>
            {(c) => (
              <form onSubmit={handleSubmit} class="car-form">
                <label>
                  Name <span class="req">*</span>
                  <input name="name" value={c().name} required />
                </label>
                <label>
                  Body
                  <input name="body" value={c().body ?? ""} />
                </label>
                <label>
                  Body Type
                  <input name="bodyType" value={c().bodyType ?? ""} />
                </label>
                <label>
                  Chassis
                  <input name="chassis" value={c().chassis ?? ""} />
                </label>
                <label>
                  Weight (g)
                  <input name="weightG" type="number" value={c().weightG ?? ""} />
                </label>
                <label>
                  Motor
                  <input name="motor" value={c().motor ?? ""} />
                </label>
                <label>
                  Amp Draw 3V
                  <input name="ampDraw3v" type="number" step="0.01" value={c().ampDraw3v ?? ""} />
                </label>
                <label>
                  Pinion (teeth)
                  <input
                    name="pinion"
                    type="number"
                    value={c().pinion ?? ""}
                    onInput={computeDerived}
                  />
                </label>
                <label>
                  Crown (teeth)
                  <input
                    name="crown"
                    type="number"
                    value={c().crown ?? ""}
                    onInput={computeDerived}
                  />
                </label>
                <label>
                  Tire Diameter (mm)
                  <input
                    name="tireDiaMm"
                    type="number"
                    step="0.1"
                    value={c().tireDiaMm ?? ""}
                    onInput={computeDerived}
                  />
                </label>
                <div class="computed">
                  <span>Gear Ratio: {gearRatio() ?? c().gearRatio?.toFixed(3) ?? "—"}</span>
                  <span>
                    Rollout: {rollout() ? rollout()!.toFixed(2) : (c().rollout?.toFixed(2) ?? "—")}
                  </span>
                </div>
                <button type="submit" disabled={submitting()}>
                  {submitting() ? "Saving…" : "Save Changes"}
                </button>
              </form>
            )}
          </Show>
        </Suspense>
      </div>
    </main>
  );
}
