import { Title } from "@solidjs/meta";
import { A, useNavigate } from "@solidjs/router";
import AddCarForm from "~/components/AddCarForm";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "~/components/ui/card";

export default function NewCar() {
  const navigate = useNavigate();

  function handleCarAdded(car: { carId: number }) {
    navigate(`/cars/${car.carId}`);
  }

  return (
    <div class="p-4 md:p-6 space-y-6">
      <Title>New Car — Pit Lane</Title>

      <A href="/cars" class="text-sm text-muted-foreground hover:text-foreground transition-colors">
        ← Back to Cars
      </A>

      <Card class="max-w-lg">
        <CardHeader>
          <CardTitle>Register New Car</CardTitle>
          <CardDescription>Enter your car's specs to start tracking it.</CardDescription>
        </CardHeader>
        <CardContent>
          <AddCarForm onCarAdded={handleCarAdded} />
        </CardContent>
      </Card>
    </div>
  );
}
