import { Title } from "@solidjs/meta";
import { A } from "@solidjs/router";
import { For, Show, createResource, Suspense } from "solid-js";
import { listCars } from "~/server/api/cars";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";

export default function CarList() {
  const [cars] = createResource(() => listCars());

  return (
    <div class="p-4 md:p-6 space-y-6">
      <Title>Cars — Pit Lane</Title>

      <div class="flex items-center justify-between">
        <h2 class="text-xl font-semibold">Cars</h2>
        <A href="/cars/new">
          <Button size="sm">+ Add Car</Button>
        </A>
      </div>

      <Suspense fallback={<p class="text-sm text-muted-foreground">Loading…</p>}>
        <Show
          when={cars() && cars()!.length > 0}
          fallback={
            <div class="py-12 text-center" role="status">
              <p class="text-sm text-muted-foreground">No cars registered yet.</p>
              <p class="mt-1 text-sm text-muted-foreground">
                <A href="/cars/new" class="text-primary hover:underline">
                  Add your first car
                </A>{" "}
                to get started.
              </p>
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
    </div>
  );
}
