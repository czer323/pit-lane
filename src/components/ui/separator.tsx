import { cn } from "./cn";
import type { ComponentProps } from "solid-js";
import { splitProps } from "solid-js";

type SeparatorProps = ComponentProps<"hr"> & {
  orientation?: "horizontal" | "vertical";
};

export function Separator(props: SeparatorProps) {
  const [local, rest] = splitProps(props, ["class", "orientation"]);
  return (
    <hr
      class={cn(
        "shrink-0 bg-border",
        local.orientation === "vertical" ? "h-full w-px" : "h-px w-full",
        local.class,
      )}
      {...rest}
    />
  );
}
