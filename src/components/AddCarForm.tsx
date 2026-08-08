import { createSignal, createMemo } from "solid-js";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { createCar } from "~/server/api/cars";

function fieldId(name: string) {
  return `field-${name.replace(/\s+/g, "-").toLowerCase()}`;
}

interface AddCarFormProps {
  onCarAdded?: (car: { carId: number; name: string }) => void;
}

export default function AddCarForm(props: AddCarFormProps) {
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
  const [error, setError] = createSignal("");
  const [success, setSuccess] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);

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

  function validate(): boolean {
    if (!name().trim()) {
      setError("Name is required");
      return false;
    }
    setError("");
    return true;
  }

  function resetForm() {
    setName("");
    setBody("");
    setBodyType("");
    setChassis("");
    setMotor("");
    setWeight("");
    setAmpDraw3v("");
    setPinion("");
    setCrown("");
    setTireDiaMm("");
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!validate()) return;

    setSubmitting(true);
    try {
      const created = await createCar({
        name: name().trim(),
        body: body() || undefined,
        bodyType: bodyType() || undefined,
        chassis: chassis() || undefined,
        motor: motor() || undefined,
        weightG: weight() ? Number(weight()) : undefined,
        ampDraw3v: ampDraw3v() ? Number(ampDraw3v()) : undefined,
        pinion: pinion() ? Number(pinion()) : undefined,
        crown: crown() ? Number(crown()) : undefined,
        tireDiaMm: tireDiaMm() ? Number(tireDiaMm()) : undefined,
      });
      setSuccess(`${name()} added!`);
      resetForm();
      props.onCarAdded?.(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add car");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} class="space-y-4">
      <div class="space-y-1.5">
        <Label for={fieldId("car name")}>
          Car Name <span class="text-destructive">*</span>
        </Label>
        <Input
          id={fieldId("car name")}
          value={name()}
          onInput={(e) => setName(e.currentTarget.value)}
          placeholder="e.g. Lightning"
          aria-label="Car Name"
        />
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="space-y-1.5">
          <Label for={fieldId("body")}>Body</Label>
          <Input
            id={fieldId("body")}
            value={body()}
            onInput={(e) => setBody(e.currentTarget.value)}
            placeholder="e.g. S10"
            aria-label="Body"
          />
        </div>
        <div class="space-y-1.5">
          <Label for={fieldId("body type")}>Body Type</Label>
          <Input
            id={fieldId("body type")}
            value={bodyType()}
            onInput={(e) => setBodyType(e.currentTarget.value)}
            placeholder="lexan, hardbody"
            aria-label="Body Type"
          />
        </div>
        <div class="space-y-1.5">
          <Label for={fieldId("chassis")}>Chassis</Label>
          <Input
            id={fieldId("chassis")}
            value={chassis()}
            onInput={(e) => setChassis(e.currentTarget.value)}
            placeholder="e.g. wire"
            aria-label="Chassis"
          />
        </div>
        <div class="space-y-1.5">
          <Label for={fieldId("motor")}>Motor</Label>
          <Input
            id={fieldId("motor")}
            value={motor()}
            onInput={(e) => setMotor(e.currentTarget.value)}
            placeholder="e.g. FK-180SH"
            aria-label="Motor"
          />
        </div>
        <div class="space-y-1.5">
          <Label for={fieldId("weight")}>Weight (g)</Label>
          <Input
            id={fieldId("weight")}
            type="number"
            value={weight()}
            onInput={(e) => setWeight(e.currentTarget.value)}
            placeholder="85"
            aria-label="Weight (g)"
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
            placeholder="0.48"
            aria-label="Amp Draw 3V"
          />
        </div>
        <div class="space-y-1.5">
          <Label for={fieldId("pinion")}>Pinion (teeth)</Label>
          <Input
            id={fieldId("pinion")}
            type="number"
            value={pinion()}
            onInput={(e) => setPinion(e.currentTarget.value)}
            placeholder="9"
            aria-label="Pinion"
          />
        </div>
        <div class="space-y-1.5">
          <Label for={fieldId("crown")}>Crown (teeth)</Label>
          <Input
            id={fieldId("crown")}
            type="number"
            value={crown()}
            onInput={(e) => setCrown(e.currentTarget.value)}
            placeholder="27"
            aria-label="Crown"
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
            placeholder="22.5"
            aria-label="Tire Diameter (mm)"
          />
        </div>
      </div>

      {(gearRatio() !== null || rollout() !== null) && (
        <div class="flex gap-4 text-sm text-muted-foreground">
          {gearRatio() !== null && <span>Gear Ratio: {gearRatio()!.toFixed(3)}</span>}
          {rollout() !== null && <span>Rollout: {rollout()!.toFixed(2)}</span>}
        </div>
      )}

      {error() && (
        <p role="alert" class="text-sm text-destructive">
          {error()}
        </p>
      )}

      {success() && (
        <p role="status" class="text-sm text-green-400">
          {success()}
        </p>
      )}

      <Button type="submit" disabled={submitting()}>
        {submitting() ? "Adding..." : "Add Car"}
      </Button>
    </form>
  );
}
