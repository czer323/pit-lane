import { Title } from "@solidjs/meta";
import { useNavigate } from "@solidjs/router";
import { createSignal, Show } from "solid-js";
import { createEvent } from "~/server/api/events";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

export default function NewEvent() {
  const navigate = useNavigate();
  const [track, setTrack] = createSignal("");
  const [eventDate, setEventDate] = createSignal("");
  const [sessionLabel, setSessionLabel] = createSignal("");
  const [temperatureF, setTemperatureF] = createSignal("");
  const [humidityPct, setHumidityPct] = createSignal("");
  const [error, setError] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError("");
    if (!track().trim() || !eventDate()) {
      setError("Track and date are required.");
      return;
    }
    setSubmitting(true);
    try {
      const created = await createEvent({
        track: track().trim(),
        eventDate: eventDate(),
        sessionLabel: sessionLabel() || undefined,
        temperatureF: temperatureF() ? Number(temperatureF()) : undefined,
        humidityPct: humidityPct() ? Number(humidityPct()) : undefined,
      });
      navigate(`/races/${created.eventId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create event.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div class="p-4 md:p-6 space-y-6">
      <Title>New Event — Pit Lane</Title>
      <h2 class="text-xl font-semibold">New Race Event</h2>
      <Card>
        <CardContent class="pt-6">
          <form onSubmit={handleSubmit} class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="space-y-1.5">
                <Label for="event-track">Track *</Label>
                <Input
                  id="event-track"
                  value={track()}
                  onInput={(e) => setTrack(e.currentTarget.value)}
                  placeholder="e.g. Slot Car Speedway"
                  aria-label="Track"
                />
              </div>
              <div class="space-y-1.5">
                <Label for="event-date">Date *</Label>
                <Input
                  id="event-date"
                  type="date"
                  value={eventDate()}
                  onInput={(e) => setEventDate(e.currentTarget.value)}
                  aria-label="Event Date"
                />
              </div>
              <div class="space-y-1.5">
                <Label for="event-session">Session Label</Label>
                <Input
                  id="event-session"
                  value={sessionLabel()}
                  onInput={(e) => setSessionLabel(e.currentTarget.value)}
                  placeholder="e.g. Friday Night"
                />
              </div>
              <div class="space-y-1.5">
                <Label for="event-temp">Temperature (°F)</Label>
                <Input
                  id="event-temp"
                  type="number"
                  value={temperatureF()}
                  onInput={(e) => setTemperatureF(e.currentTarget.value)}
                  placeholder="72"
                />
              </div>
              <div class="space-y-1.5">
                <Label for="event-humidity">Humidity (%)</Label>
                <Input
                  id="event-humidity"
                  type="number"
                  value={humidityPct()}
                  onInput={(e) => setHumidityPct(e.currentTarget.value)}
                  placeholder="45"
                />
              </div>
            </div>
            <Show when={error()}>
              <p role="alert" class="text-sm text-red-400">
                {error()}
              </p>
            </Show>
            <div class="flex gap-3">
              <Button type="submit" disabled={submitting()}>
                {submitting() ? "Creating…" : "Create Event"}
              </Button>
              <Button variant="outline" onClick={() => navigate("/races")}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
