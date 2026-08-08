import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";

export default function Analytics() {
  return (
    <div class="p-4 md:p-6 space-y-4">
      <h2 class="text-xl font-semibold">Analytics</h2>
      <Card>
        <CardHeader>
          <CardTitle>Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <p class="text-sm text-muted-foreground">Analytics dashboard coming in Phase 2.</p>
        </CardContent>
      </Card>
    </div>
  );
}
