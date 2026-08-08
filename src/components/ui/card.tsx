import { cn } from "./cn";
import type { ComponentProps } from "solid-js";
import { splitProps } from "solid-js";

type CardProps = ComponentProps<"div">;

export function Card(props: CardProps) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      class={cn("rounded-lg border bg-card text-card-foreground shadow-sm", local.class)}
      {...rest}
    />
  );
}

export function CardHeader(props: CardProps) {
  const [local, rest] = splitProps(props, ["class"]);
  return <div class={cn("flex flex-col space-y-1.5 p-6", local.class)} {...rest} />;
}

export function CardTitle(props: ComponentProps<"h3">) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <h3 class={cn("text-2xl font-semibold leading-none tracking-tight", local.class)} {...rest} />
  );
}

export function CardDescription(props: ComponentProps<"p">) {
  const [local, rest] = splitProps(props, ["class"]);
  return <p class={cn("text-sm text-muted-foreground", local.class)} {...rest} />;
}

export function CardContent(props: CardProps) {
  const [local, rest] = splitProps(props, ["class"]);
  return <div class={cn("p-6 pt-0", local.class)} {...rest} />;
}

export function CardFooter(props: CardProps) {
  const [local, rest] = splitProps(props, ["class"]);
  return <div class={cn("flex items-center p-6 pt-0", local.class)} {...rest} />;
}
