import AddCarForm from "~/components/AddCarForm";
import CarList from "~/components/CarList";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";

export default function Fleet() {
  return (
    <div class="p-4 md:p-6 space-y-6">
      <h2 class="text-xl font-semibold">Fleet Manager</h2>

      <Card>
        <CardHeader>
          <CardTitle>Add a Car</CardTitle>
        </CardHeader>
        <CardContent>
          <AddCarForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Cars</CardTitle>
        </CardHeader>
        <CardContent>
          <CarList />
        </CardContent>
      </Card>
    </div>
  );
}
