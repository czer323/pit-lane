import { cn } from "./cn";
import { createSignal, type ComponentProps } from "solid-js";
import { splitProps } from "solid-js";

type SwitchProps = ComponentProps<"button"> & {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

export function Switch(props: SwitchProps) {
  const [local, rest] = splitProps(props, [
    "class",
    "checked",
    "defaultChecked",
    "onCheckedChange",
  ]);
  const [checked, setChecked] = createSignal(local.defaultChecked ?? local.checked ?? false);

  const isControlled = () => local.checked !== undefined;
  const isChecked = () => (isControlled() ? local.checked! : checked());

  const toggle = () => {
    if (isControlled()) {
      local.onCheckedChange?.(!local.checked);
      const next = !checked();
      setChecked(next);
      local.onCheckedChange?.(next);
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isChecked()}
      data-state={isChecked() ? "checked" : "unchecked"}
      class={cn(
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        isChecked() ? "bg-primary" : "bg-input",
        local.class,
      )}
      onClick={toggle}
      {...rest}
    >
      <span
        data-state={isChecked() ? "checked" : "unchecked"}
        class={cn(
          "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform",
          isChecked() ? "translate-x-4" : "translate-x-0",
        )}
      />
    </button>
  );
}
