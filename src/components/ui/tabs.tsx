import { cn } from "./cn";
import { createSignal, createContext, useContext, type ComponentProps, type JSX } from "solid-js";
import { splitProps } from "solid-js";

// --- Context ---
type TabsContextValue = {
  value: () => string;
  setValue: (v: string) => void;
};
const TabsContext = createContext<TabsContextValue>();

// --- Root ---
type TabsProps = ComponentProps<"div"> & {
  defaultValue: string;
  value?: string;
  onValueChange?: (v: string) => void;
  children: JSX.Element;
};

export function Tabs(props: TabsProps) {
  const [local, rest] = splitProps(props, ["class", "defaultValue", "value", "onValueChange"]);
  const [internalValue, setInternalValue] = createSignal(local.defaultValue);

  const value = () => local.value ?? internalValue();
  const setValue = (v: string) => {
    if (local.value !== undefined) {
      local.onValueChange?.(v);
    } else {
      setInternalValue(v);
      local.onValueChange?.(v);
    }
  };

  return (
    <TabsContext.Provider value={{ value, setValue }}>
      <div class={cn("", local.class)} {...rest} />
    </TabsContext.Provider>
  );
}

// --- List ---
type TabsListProps = ComponentProps<"div">;

export function TabsList(props: TabsListProps) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      class={cn(
        "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
        local.class,
      )}
      {...rest}
    />
  );
}

// --- Trigger ---
type TabsTriggerProps = ComponentProps<"button"> & {
  value: string;
};

export function TabsTrigger(props: TabsTriggerProps) {
  const [local, rest] = splitProps(props, ["class", "value"]);
  const ctx = useContext(TabsContext)!;
  const isActive = () => ctx.value() === local.value;

  return (
    <button
      type="button"
      data-state={isActive() ? "active" : "inactive"}
      class={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        isActive() && "bg-background text-foreground shadow",
        local.class,
      )}
      onClick={() => ctx.setValue(local.value)}
      {...rest}
    />
  );
}

// --- Content ---
type TabsContentProps = ComponentProps<"div"> & {
  value: string;
};

export function TabsContent(props: TabsContentProps) {
  const [local, rest] = splitProps(props, ["class", "value"]);
  const ctx = useContext(TabsContext)!;

  return (
    <div
      data-state={ctx.value() === local.value ? "active" : "inactive"}
      class={cn(
        "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        ctx.value() !== local.value && "hidden",
        local.class,
      )}
      {...rest}
    />
  );
}
