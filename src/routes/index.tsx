import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { Switch } from "~/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { Select, SelectTrigger, SelectContent, SelectItem } from "~/components/ui/select";

export default function Home() {
  return (
    <main class="min-h-screen bg-background text-foreground p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <h1 class="text-2xl font-bold text-primary">Pit Lane — Component Demo</h1>

      <Card>
        <CardHeader>
          <CardTitle>Buttons</CardTitle>
        </CardHeader>
        <CardContent class="flex flex-wrap gap-2">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inputs</CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="space-y-1">
            <Label for="demo-input">Car Name</Label>
            <Input id="demo-input" placeholder="Enter car name" />
          </div>
          <div class="space-y-1">
            <Label for="demo-textarea">Notes</Label>
            <Textarea id="demo-textarea" placeholder="Felt loose, flinched..." />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tabs</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="racing">
            <TabsList>
              <TabsTrigger value="racing">Racing</TabsTrigger>
              <TabsTrigger value="log">Runs Log</TabsTrigger>
            </TabsList>
            <TabsContent value="racing">
              <p class="text-sm text-muted-foreground mt-2">Entry form content here</p>
            </TabsContent>
            <TabsContent value="log">
              <p class="text-sm text-muted-foreground mt-2">Run history goes here</p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Switch</CardTitle>
          </CardHeader>
          <CardContent class="flex items-center gap-2">
            <Switch />
            <Label>Active</Label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Select</CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              options={["HellFire", "Mirage", "E-Ticket", "Golden Bug", "Red Shift"]}
              placeholder="Choose car"
            >
              <SelectTrigger />
              <SelectContent>
                <SelectItem value="HellFire">HellFire</SelectItem>
                <SelectItem value="Mirage">Mirage</SelectItem>
                <SelectItem value="E-Ticket">E-Ticket</SelectItem>
                <SelectItem value="Golden Bug">Golden Bug</SelectItem>
                <SelectItem value="Red Shift">Red Shift</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Badges</CardTitle>
        </CardHeader>
        <CardContent class="flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="outline">Outline</Badge>
          <Separator class="my-2" />
          <Badge variant="outline">Practice</Badge>
          <Badge>Elimination</Badge>
        </CardContent>
      </Card>
    </main>
  );
}
