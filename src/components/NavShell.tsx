import { A, useLocation } from "@solidjs/router";
import { For, type JSX } from "solid-js";
import { cn } from "./ui/cn";

interface NavItem {
  href: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard" },
  { href: "/fleet", label: "Fleet" },
  { href: "/races", label: "Races" },
  { href: "/analytics", label: "Analytics" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

function mobileIcon(label: string): string {
  if (label === "Dashboard") return "\u25A4";
  if (label === "Fleet") return "\u2699";
  return "\u25A5";
}

/** Bottom tab bar — visible on mobile, hidden on desktop */
function MobileNav(props: { pathname: string }) {
  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      class="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background lg:hidden"
    >
      <div class="flex h-14 items-center justify-around">
        <For each={NAV_ITEMS}>
          {(item) => {
            const active = isActive(props.pathname, item.href);
            return (
              <A
                href={item.href}
                class={cn(
                  "flex flex-col items-center justify-center gap-0.5 rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                <span class="text-base leading-none">{mobileIcon(item.label)}</span>
                {item.label}
              </A>
            );
          }}
        </For>
      </div>
    </nav>
  );
}

/** Sidebar — hidden on mobile, visible on desktop */
function DesktopSidebar(props: { pathname: string }) {
  return (
    <aside
      role="navigation"
      aria-label="Sidebar navigation"
      class="hidden lg:flex lg:w-56 lg:shrink-0 lg:flex-col lg:border-r lg:border-border lg:bg-background lg:min-h-screen lg:sticky lg:top-0"
    >
      <div class="flex flex-col gap-1 p-4">
        <h1 class="mb-4 text-lg font-bold text-primary">Pit Lane</h1>
        <For each={NAV_ITEMS}>
          {(item) => (
            <A
              href={item.href}
              class={cn(
                "inline-flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive(props.pathname, item.href)
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
              aria-current={isActive(props.pathname, item.href) ? "page" : undefined}
            >
              {item.label}
            </A>
          )}
        </For>
      </div>
    </aside>
  );
}

export default function NavShell(props: { children: JSX.Element }) {
  const location = useLocation();

  return (
    <div class="flex min-h-screen flex-col lg:flex-row">
      <DesktopSidebar pathname={location.pathname} />
      <main class="flex-1 pb-14 lg:pb-0">{props.children}</main>
      <MobileNav pathname={location.pathname} />
    </div>
  );
}
