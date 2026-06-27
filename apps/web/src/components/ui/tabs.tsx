"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"

// ─── Context ──────────────────────────────────────────────────────────────────

const TabsValueContext = React.createContext<string>("")
const TabsListVariantContext = React.createContext<"default" | "line">("default")
const TabsLayoutIdContext = React.createContext<string>("")

// ─── Tabs Root ────────────────────────────────────────────────────────────────

function Tabs({
  className,
  orientation = "horizontal",
  value: valueProp,
  defaultValue,
  onValueChange,
  ...props
}: TabsPrimitive.Root.Props) {
  const layoutId = React.useId()
  const [internalValue, setInternalValue] = React.useState<string>(
    (valueProp ?? defaultValue ?? "") as string
  )
  const currentValue = (valueProp ?? internalValue) as string

  return (
    <TabsLayoutIdContext.Provider value={layoutId}>
      <TabsValueContext.Provider value={currentValue}>
        <TabsPrimitive.Root
          data-slot="tabs"
          data-orientation={orientation}
          className={cn(
            "group/tabs flex gap-2 data-horizontal:flex-col",
            className
          )}
          value={valueProp}
          defaultValue={defaultValue}
          onValueChange={(v, details) => {
            setInternalValue(v as string)
            onValueChange?.(v, details)
          }}
          {...props}
        />
      </TabsValueContext.Provider>
    </TabsLayoutIdContext.Provider>
  )
}

// ─── Tabs List ────────────────────────────────────────────────────────────────

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsListVariantContext.Provider value={variant ?? "default"}>
      <TabsPrimitive.List
        data-slot="tabs-list"
        data-variant={variant}
        className={cn(tabsListVariants({ variant }), className)}
        {...props}
      />
    </TabsListVariantContext.Provider>
  )
}

// ─── Tabs Trigger ─────────────────────────────────────────────────────────────

function TabsTrigger({
  className,
  value,
  children,
  ...props
}: TabsPrimitive.Tab.Props) {
  const currentValue = React.useContext(TabsValueContext)
  const listVariant = React.useContext(TabsListVariantContext)
  const layoutId = React.useContext(TabsLayoutIdContext)
  const isActive = value !== undefined && String(value) === currentValue

  return (
    <TabsPrimitive.Tab
      value={value}
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap",
        "text-foreground/60 transition-colors hover:text-foreground dark:text-muted-foreground",
        "data-active:text-foreground dark:data-active:text-foreground",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring",
        "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
        "has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1",
        "group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        // line variant: CSS underline indicator via after pseudo-element
        listVariant === "line" && [
          "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent",
          "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity",
          "group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5",
          "group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5",
          "group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        ],
        className
      )}
      {...props}
    >
      {/* Sliding pill indicator — default variant only */}
      {isActive && listVariant === "default" && (
        <motion.div
          layoutId={layoutId}
          className="absolute inset-0 rounded-md bg-background shadow-sm dark:border dark:border-input dark:bg-input/30"
          transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
        />
      )}
      {/* Wrap children so they sit above the indicator */}
      <span className="relative z-10 flex items-center gap-1.5">
        {children}
      </span>
    </TabsPrimitive.Tab>
  )
}

// ─── Tabs Content ─────────────────────────────────────────────────────────────

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
