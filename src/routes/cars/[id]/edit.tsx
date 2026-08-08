import { Title } from "@solidjs/meta";
import { A, useNavigate } from "@solidjs/router";
import { createSignal, Show, createResource, createMemo, createEffect, Suspense } from "solid-js";
import { getCar, updateCar } from "~/server/api/cars";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

function fieldId(name: string) {
  return `field-${name.replace(/\s+/g, "-").toLowerCase()}`;
}

export default function EditCar(props: { id: string }) {
  const navigate = useNavigate();
  const [error, setError] = createSignal<string | null>(null);
  const [success, setSuccess] = createSignal<string | null>(null);
  const [submitting, setSubmitting] = createSignal(false);
  const [car] = createResource(() => getCar(Number(props.id)));

  // Editable signals
  const [name, setName] = createSignal("");
  const [body, setBody] = createSignal("");
  const [bodyType, setBodyType] = createSignal("");
  const [chassis, setChassis] = createSignal("");
  const [motor, setMotor] = createSignal("");
  const [weight, setWeight] = createSignal("");
  const [ampDraw3v, setAmpDraw3v] = createSignal("");
  const [pinion, setPinion] = createSignal("");
  const [crown, setCrown] = createSignal("");
  const [tireDiaMm, setTireDiaMm] = createSignal("");

  // Lazy-init signals once car data arrives
  let initialized = false;
  createEffect(() => {
    const c = car();
    if (!c || initialized) return;
    initialized = true;
    setName(c.name);
    setBody(c.body ?? "");
    setBodyType(c.bodyType ?? "");
    setChassis(c.chassis ?? "");
    setMotor(c.motor ?? "");
    setWeight(c.weightG != null ? String(c.weightG) : "");
    setAmpDraw3v(c.ampDraw3v != null ? String(c.ampDraw3v) : "");
    setPinion(c.pinion != null ? String(c.pinion) : "");
    setCrown(c.crown != null ? String(c.crown) : "");
    setTireDiaMm(c.tireDiaMm != null ? String(c.tireDiaMm) : "");
  });

  const gearRatio = createMemo(() => {
    const p = Number(pinion());
    const c = Number(crown());
    if (c && p && p !== 0) return c / p;
    return null;
  });

  const rollout = createMemo(() => {
    const gr = gearRatio();
    const t = Number(tireDiaMm());
    if (gr !== null && t) return (t * Math.PI) / gr;
    return null;
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    if (!name().trim()) {
      setError("Name is required");
      setSubmitting(false);
      return;
    }

    try {
      await updateCar(Number(props.id), {
        name: name().trim(),
        body: body() || null,
        bodyType: bodyType() || null,
        chassis: chassis() || null,
        motor: motor() || null,
        weightG: weight() ? Number(weight()) : null,
        ampDraw3v: ampDraw3v() ? Number(ampDraw3v()) : null,
        pinion: pinion() ? Number(pinion()) : null,
        crown: crown() ? Number(crown()) : null,
        tireDiaMm: tireDiaMm() ? Number(tireDiaMm()) : null,
      });
      setSuccess("Saved!");
      navigate(`/cars/${props.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div class="p-4 md:p-6 space-y-6">
      <Title>Edit Car — Pit Lane</Title>

      <A
        href={`/cars/${props.id}`}
        class="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Back to Car
      </A>

      <h2 class="text-xl font-semibold">Edit Car</h2>

      <Show when={error()}>
        <p role="alert" class="text-sm text-destructive">
          {error()}
        </p>
      </Show>
      <Show when={success()}>
        <p role="status" class="text-sm text-green-400">
          {success()}
        </p>
      </Show>

      <Suspense fallback={<p class="text-sm text-muted-foreground">Loading…</p>}>
        <Show when={car()}>
          <form onSubmit={handleSubmit} class="space-y-4 max-w-lg">
            <div class="space-y-1.5">
              <Label for={fieldId("car name")}>
                Car Name <span class="text-destructive">*</span>
              </Label>
              <Input
                id={fieldId("car name")}
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
                required
              />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1.5">
                <Label for={fieldId("body")}>Body</Label>
                <Input
                  id={fieldId("body")}
                  value={body()}
                  onInput={(e) => setBody(e.currentTarget.value)}
                />
              </div>
              <div class="space-y-1.5">
                <Label for={fieldId("body type")}>Body Type</Label>
                <Input
                  id={fieldId("body type")}
                  value={bodyType()}
                  onInput={(e) => setBodyType(e.currentTarget.value)}
                />
              </div>
              <div class="space-y-1.5">
                <Label for={fieldId("chassis")}>Chassis</Label>
                <Input
                  id={fieldId("chassis")}
                  value={chassis()}
                  onInput={(e) => setChassis(e.currentTarget.value)}
                />
              </div>
              <div class="space-y-1.5">
                <Label for={fieldId("weight")}>Weight (g)</Label>
                <Input
                  id={fieldId("weight")}
                  type="number"
                  value={weight()}
                  onInput={(e) => setWeight(e.currentTarget.value)}
                />
              </div>
              <div class="space-y-1.5">
                <Label for={fieldId("motor")}>Motor</Label>
                <Input
                  id={fieldId("motor")}
                  value={motor()}
                  onInput={(e) => setMotor(e.currentTarget.value)}
                />
              </div>
              <div class="space-y-1.5">
                <Label for={fieldId("amp draw 3v")}>Amp Draw 3V</Label>
                <Input
                  id={fieldId("amp draw 3v")}
                  type="number"
                  step="0.01"
                  value={ampDraw3v()}
                  onInput={(e) => setAmpDraw3v(e.currentTarget.value)}
                />
              </div>
              <div class="space-y-1.5">
                <Label for={fieldId("pinion")}>Pinion (teeth)</Label>
                <Input
                  id={fieldId("pinion")}
                  type="number"
                  value={pinion()}
                  onInput={(e) => setPinion(e.currentTarget.value)}
                />
              </div>
              <div class="space-y-1.5">
                <Label for={fieldId("crown")}>Crown (teeth)</Label>
                <Input
                  id={fieldId("crown")}
                  type="number"
                  value={crown()}
                  onInput={(e) => setCrown(e.currentTarget.value)}
                />
              </div>
              <div class="space-y-1.5">
                <Label for={fieldId("tire diameter")}>Tire Diameter (mm)</Label>
                <Input
                  id={fieldId("tire diameter")}
                  type="number"
                  step="0.1"
                  value={tireDiaMm()}
                  onInput={(e) => setTireDiaMm(e.currentTarget.value)}
                />
              </div>
            </div>

            {(gearRatio() !== null || rollout() !== null) && (
              <div class="flex gap-4 text-sm text-muted-foreground">
                {gearRatio() !== null && <span>Gear Ratio: {gearRatio()!.toFixed(3)}</span>}
                {rollout() !== null && <span>Rollout: {rollout()!.toFixed(2)}</span>}
              </div>
            )}

            <Button type="submit" disabled={submitting()}>
              {submitting() ? "Saving…" : "Save Changes"}
            </Button>
          </form>
        </Show>
      </Suspense>
    </div>
  );
}
