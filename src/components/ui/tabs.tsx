"use client";

// TRIM-T1 (2026-11-22): cut to what the site renders, on purpose. Both tab
// strips are horizontal and use the indicator variant, so the vertical option
// and the two other list variants are gone; a registry re-sync would bring
// them back.
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

function Tabs({ className, ...props }: Omit<TabsPrimitive.Root.Props, "orientation">) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation="horizontal"
      className={cn("group/tabs flex gap-2 data-horizontal:flex-col", className)}
      {...props}
    />
  );
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-8",
  {
    variants: {
      variant: {
        // R3 (F11): a bare strip whose active mark is the sliding TabsIndicator.
        indicator: "relative gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "indicator",
    },
  },
);

function TabsList({
  className,
  variant = "indicator",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-all hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "data-active:bg-background data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-foreground",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5",
        "group-data-[variant=indicator]/tabs-list:z-10 group-data-[variant=indicator]/tabs-list:bg-transparent group-data-[variant=indicator]/tabs-list:after:hidden group-data-[variant=indicator]/tabs-list:data-active:bg-transparent group-data-[variant=indicator]/tabs-list:data-active:shadow-none dark:group-data-[variant=indicator]/tabs-list:data-active:border-transparent dark:group-data-[variant=indicator]/tabs-list:data-active:bg-transparent",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The sliding active-tab mark (R3, F11). Base UI positions it through the
 * `--active-tab-left` / `--active-tab-width` variables it sets on the element
 * (plus -top / -height for vertical lists); the slide is `motion-safe:` only.
 * Pair with `TabsList variant="indicator"`, which drops the per-trigger
 * underline so the strip has exactly one active mark.
 */
function TabsIndicator({ className, ...props }: TabsPrimitive.Indicator.Props) {
  return (
    <TabsPrimitive.Indicator
      data-slot="tabs-indicator"
      className={cn(
        "bg-accent-game pointer-events-none absolute bottom-0 left-(--active-tab-left) z-0 h-0.5 w-(--active-tab-width) rounded-full motion-safe:transition-[left,width] motion-safe:duration-[120ms] motion-safe:ease-settle-120",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsIndicator, TabsContent, tabsListVariants };
