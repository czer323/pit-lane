import { Title } from "@solidjs/meta";
import { A, useNavigate } from "@solidjs/router";
import { createSignal, Show } from "solid-js";
import { createCar } from "~/server/api/cars";
import "./form.css";

export default function NewCar() {
  const navigate = useNavigate();
  const [error, setError] = createSignal<string | null>(null);
  const [submitting, setSubmitting] = createSignal(false);
  const [gearRatio, setGearRatio] = createSignal<number | null>(null);
  const [rollout, setRollout] = createSignal<number | null>(null);

  function computeDerived(formData: FormData) {
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

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const input: Record<string, unknown> = {};
    for (const [key, value] of formData.entries()) {
      if (value === "") continue;
      const num = Number(value);
      input[key] = Number.isNaN(num) ? value : num;
    }
    try {
      const car = await createCar(input);
      navigate(`/cars/${car.carId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <Title>New Car — Pit Lane</Title>
      <h1>Register New Car</h1>
      <A href="/cars" class="back-link">
        ← Back to Cars
      </A>
      <Show when={error()}>
        <p class="error">{error()}</p>
      </Show>
      <form onSubmit={handleSubmit} class="car-form">
        <label>
          Name <span class="req">*</span>
          <input name="name" required />
        </label>
        <label>
          Body
          <input name="body" />
        </label>
        <label>
          Body Type
          <input name="bodyType" placeholder="lexan, hardbody, …" />
        </label>
        <label>
          Chassis
          <input name="chassis" placeholder="wire, carbon fiber, …" />
        </label>
        <label>
          Weight (g)
          <input name="weightG" type="number" />
        </label>
        <label>
          Motor
          <input name="motor" />
        </label>
        <label>
          Amp Draw 3V
          <input name="ampDraw3v" type="number" step="0.01" />
        </label>
        <label>
          Pinion (teeth)
          <input
            name="pinion"
            type="number"
            onInput={(e) => computeDerived(new FormData(e.currentTarget.form!))}
          />
        </label>
        <label>
          Crown (teeth)
          <input
            name="crown"
            type="number"
            onInput={(e) => computeDerived(new FormData(e.currentTarget.form!))}
          />
        </label>
        <label>
          Tire Diameter (mm)
          <input
            name="tireDiaMm"
            type="number"
            step="0.1"
            onInput={(e) => computeDerived(new FormData(e.currentTarget.form!))}
          />
        </label>
        <div class="computed">
          <span>Gear Ratio: {gearRatio() ?? "—"}</span>
          <span>Rollout: {rollout() ? rollout()!.toFixed(2) : "—"}</span>
        </div>
        <button type="submit" disabled={submitting()}>
          {submitting() ? "Saving…" : "Create Car"}
        </button>
      </form>
    </main>
  );
}
