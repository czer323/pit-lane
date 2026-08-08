import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";

export default function Fleet() {
  return (
    <div class="p-4 md:p-6 space-y-4">
      <h2 class="text-xl font-semibold">Fleet Manager</h2>
      <Card>
        <CardHeader>
          <CardTitle>Cars</CardTitle>
        </CardHeader>
        <CardContent>
          <p class="text-sm text-muted-foreground">Fleet management coming soon.</p>
        </CardContent>
      </Card>
    </div>
  );
}
