import { cn } from "./cn";
import {
  createSignal,
  createContext,
  useContext,
  For,
  type ComponentProps,
  type JSX,
} from "solid-js";
import { splitProps } from "solid-js";

// --- Context ---
type SelectContextValue = {
  value: () => string;
  setValue: (v: string) => void;
  open: () => boolean;
  setOpen: (v: boolean) => void;
  placeholder: string;
};
const SelectContext = createContext<SelectContextValue>();

// --- Root ---
type SelectProps = {
  options: string[];
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  onValueChange?: (v: string) => void;
  children: JSX.Element;
};

export function Select(props: SelectProps) {
  const [internalValue, setInternalValue] = createSignal(props.defaultValue ?? "");
  const [open, setOpen] = createSignal(false);
  const placeholder = props.placeholder ?? "Select...";

  const value = () => props.value ?? internalValue();
  const setValue = (v: string) => {
    if (props.value !== undefined) {
      props.onValueChange?.(v);
    } else {
      setInternalValue(v);
      props.onValueChange?.(v);
    }
    setOpen(false);
  };

  return (
    <SelectContext.Provider value={{ value, setValue, open, setOpen, placeholder }}>
      <div class="relative">{props.children}</div>
    </SelectContext.Provider>
  );
}

// --- Trigger ---
type SelectTriggerProps = ComponentProps<"button">;

export function SelectTrigger(props: SelectTriggerProps) {
  const [local, rest] = splitProps(props, ["class"]);
  const ctx = useContext(SelectContext)!;

  return (
    <button
      type="button"
      class={cn(
        "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        local.class,
      )}
      onClick={() => ctx.setOpen(!ctx.open())}
      {...rest}
    >
      <span class={ctx.value() ? "" : "text-muted-foreground"}>
        {ctx.value() || ctx.placeholder}
      </span>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="opacity-50"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
  );
}

// --- Content ---
type SelectContentProps = ComponentProps<"div">;

export function SelectContent(props: SelectContentProps) {
  const [local, rest] = splitProps(props, ["class"]);
  const ctx = useContext(SelectContext)!;

  return (
    <div
      class={cn(
        "absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md",
        !ctx.open() && "hidden",
        local.class,
      )}
      {...rest}
    />
  );
}

// --- Item ---
type SelectItemProps = ComponentProps<"div"> & {
  value: string;
};

export function SelectItem(props: SelectItemProps) {
  const [local, rest] = splitProps(props, ["class", "value"]);
  const ctx = useContext(SelectContext)!;

  return (
    <div
      class={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        ctx.value() === local.value && "bg-accent text-accent-foreground",
        local.class,
      )}
      onClick={() => ctx.setValue(local.value)}
      {...rest}
    />
  );
}
