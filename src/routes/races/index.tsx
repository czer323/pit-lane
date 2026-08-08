import { Title } from "@solidjs/meta";
import { A } from "@solidjs/router";
import { For, Show, createResource, Suspense } from "solid-js";
import { listEvents } from "~/server/api/events";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";

export default function RaceList() {
  const [events] = createResource(() => listEvents());

  return (
    <div class="p-4 md:p-6 space-y-6">
      <Title>Races — Pit Lane</Title>
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-semibold">Races</h2>
        <A href="/races/new">
          <Button size="sm">New Event</Button>
        </A>
      </div>
      <Suspense fallback={<p class="text-sm text-muted-foreground">Loading…</p>}>
        <Show
          when={events() && events()!.length > 0}
          fallback={
            <div class="py-8 text-center" role="status">
              <p class="text-sm text-muted-foreground">No race events yet.</p>
            </div>
          }
        >
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <For each={events()}>
              {(event) => (
                <A href={`/races/${event.eventId}`} class="block">
                  <Card class="h-full hover:border-primary/50 transition-colors">
                    <CardHeader>
                      <CardTitle class="text-base">{event.track}</CardTitle>
                      <CardDescription>{event.eventDate}</CardDescription>
                    </CardHeader>
                    <CardContent class="flex items-center justify-between gap-2">
                      <span class="text-sm text-muted-foreground">{event.sessionLabel ?? "—"}</span>
                      <Badge variant="secondary" class="shrink-0">
                        {event.runCount} run{event.runCount === 1 ? "" : "s"}
                      </Badge>
                    </CardContent>
                  </Card>
                </A>
              )}
            </For>
          </div>
        </Show>
      </Suspense>
    </div>
  );
}
