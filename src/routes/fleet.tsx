import { createSignal } from "solid-js";
import AddCarForm from "~/components/AddCarForm";
import CarList from "~/components/CarList";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";

export default function Fleet() {
  const [refreshKey, setRefreshKey] = createSignal(0);

  function handleCarAdded() {
    setRefreshKey((k) => k + 1);
  }

  return (
    <div class="p-4 md:p-6 space-y-6">
      <h2 class="text-xl font-semibold">Fleet Manager</h2>

      <Card>
        <CardHeader>
          <CardTitle>Add a Car</CardTitle>
        </CardHeader>
        <CardContent>
          <AddCarForm onCarAdded={handleCarAdded} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Cars</CardTitle>
        </CardHeader>
        <CardContent>
          <CarList refreshKey={refreshKey} />
        </CardContent>
      </Card>
    </div>
  );
}
