"use client"

import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"

function Collapsible({
  className,
  ...props
}: CollapsiblePrimitive.Root.Props) {
  return (
    <CollapsiblePrimitive.Root
      data-slot="collapsible"
      className={cn(className)}
      {...props}
    />
  )
}

function CollapsibleTrigger({
  className,
  ...props
}: CollapsiblePrimitive.Trigger.Props) {
  return (
    <CollapsiblePrimitive.Trigger
      data-slot="collapsible-trigger"
      className={cn(className)}
      {...props}
    />
  )
}

function CollapsibleContent({
  className,
  children,
  ...props
}: CollapsiblePrimitive.Panel.Props) {
  return (
    <CollapsiblePrimitive.Panel
      {...props}
      keepMounted
      render={(_, { open }) => (
        <motion.div
          data-slot="collapsible-content"
          initial={false}
          animate={open ? "open" : "closed"}
          variants={{
            open: { height: "auto" },
            closed: { height: 0 },
          }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          className={cn("overflow-hidden", className)}
          aria-hidden={open ? undefined : true}
        >
          {children}
        </motion.div>
      )}
    />
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
