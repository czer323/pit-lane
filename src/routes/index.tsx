import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";

export default function Dashboard() {
  return (
    <div class="p-4 md:p-6 space-y-4">
      <h2 class="text-xl font-semibold">Race Dashboard</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle class="text-sm">Event</CardTitle>
          </CardHeader>
          <CardContent>
            <p class="text-sm text-muted-foreground">No active event</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle class="text-sm">Cars</CardTitle>
          </CardHeader>
          <CardContent>
            <p class="text-sm text-muted-foreground">0 at track</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle class="text-sm">Last Pass</CardTitle>
          </CardHeader>
          <CardContent>
            <p class="text-sm text-muted-foreground">No passes recorded</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent Passes</CardTitle>
        </CardHeader>
        <CardContent>
          <p class="text-sm text-muted-foreground">Pass history will appear here.</p>
        </CardContent>
      </Card>
    </div>
  );
}
