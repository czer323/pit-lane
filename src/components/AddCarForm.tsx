import { createSignal, type JSX } from "solid-js";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

function fieldId(name: string) {
  return `field-${name.replace(/\s+/g, "-").toLowerCase()}`;
}

export default function AddCarForm() {
  const [name, setName] = createSignal("");
  const [body, setBody] = createSignal("");
  const [chassis, setChassis] = createSignal("");
  const [motor, setMotor] = createSignal("");
  const [weight, setWeight] = createSignal("");
  const [error, setError] = createSignal("");

  function validate(): boolean {
    if (!name().trim()) {
      setError("Name is required");
      return false;
    }
    setError("");
    return true;
  }

  function handleSubmit(e: Event) {
    e.preventDefault();
    if (!validate()) return;
    // Submit logic in next increment
  }

  return (
    <form onSubmit={handleSubmit} class="space-y-3">
      <div class="space-y-1.5">
        <Label for={fieldId("car name")}>Car Name</Label>
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
      </div>

      {error() && (
        <p role="alert" class="text-sm text-red-400">
          {error()}
        </p>
      )}

      <Button type="submit">Add Car</Button>
    </form>
  );
}
