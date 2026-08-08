import { createResource, For, Show, Suspense } from "solid-js";
import { A } from "@solidjs/router";
import { listCars } from "~/server/api/cars";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";

export default function CarList() {
  const [cars] = createResource(() => listCars());

  return (
    <Suspense fallback={<p class="text-sm text-muted-foreground">Loading…</p>}>
      <Show
        when={cars() && cars()!.length > 0}
        fallback={
          <div class="py-8 text-center" role="status">
            <p class="text-sm text-muted-foreground">No cars yet.</p>
            <p class="mt-1 text-sm text-muted-foreground">Add your first car to get started.</p>
          </div>
        }
      >
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <For each={cars()}>
            {(car) => (
              <A href={`/cars/${car.carId}`} class="block">
                <Card class="hover:border-primary/50 transition-colors">
                  <CardContent class="p-4 space-y-2">
                    <div class="flex items-center justify-between">
                      <h3 class="font-medium">{car.name}</h3>
                      {car.atTrack && (
                        <Badge variant="default" class="text-xs">
                          At track
                        </Badge>
                      )}
                    </div>
                    <div class="flex gap-4 text-sm text-muted-foreground">
                      {car.body && <span>{car.body}</span>}
                      {car.motor && <span>{car.motor}</span>}
                      {car.weightG != null && <span>{car.weightG}g</span>}
                    </div>
                  </CardContent>
                </Card>
              </A>
            )}
          </For>
        </div>
      </Show>
    </Suspense>
  );
}
