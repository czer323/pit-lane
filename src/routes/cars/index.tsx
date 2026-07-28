import { Title } from "@solidjs/meta";
import { A } from "@solidjs/router";
import { For, Show, createResource, Suspense } from "solid-js";
import { listCars } from "~/server/api/cars";
import "./index.css";

export default function CarList() {
  const [cars] = createResource(() => listCars());

  return (
    <main>
      <Title>Cars — Pit Lane</Title>
      <div class="cars-header">
        <h1>Cars</h1>
        <A href="/cars/new" class="btn-add">
          + Add Car
        </A>
      </div>
      <Suspense fallback={<p>Loading…</p>}>
        <Show when={cars() && cars()!.length > 0} fallback={<p>No cars registered yet.</p>}>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Body</th>
                  <th>Motor</th>
                  <th>Weight (g)</th>
                </tr>
              </thead>
              <tbody>
                <For each={cars()}>
                  {(car) => (
                    <tr>
                      <td>
                        <A href={`/cars/${car.carId}`}>{car.name}</A>
                      </td>
                      <td>{car.body ?? "—"}</td>
                      <td>{car.motor ?? "—"}</td>
                      <td>{car.weightG ?? "—"}</td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Show>
      </Suspense>
    </main>
  );
}
