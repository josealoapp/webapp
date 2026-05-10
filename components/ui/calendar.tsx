"use client"

import * as React from "react"
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        root: "w-fit",
        months: "flex flex-col gap-4 sm:flex-row",
        month: "space-y-4",
        month_caption: "relative flex h-8 items-center justify-center",
        caption_label: "text-sm font-semibold",
        nav: "absolute inset-x-0 top-0 flex items-center justify-between",
        button_previous: cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "h-8 w-8 p-0 text-neutral-400 hover:text-neutral-50"
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "h-8 w-8 p-0 text-neutral-400 hover:text-neutral-50"
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "w-9 rounded-md text-center text-[0.8rem] font-medium text-neutral-500",
        week: "mt-2 flex w-full",
        day: "relative flex h-9 w-9 items-center justify-center p-0 text-center text-sm",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 rounded-md p-0 font-normal text-neutral-200 hover:bg-neutral-800 hover:text-neutral-50"
        ),
        selected:
          "[&_button]:bg-orange-500 [&_button]:text-neutral-950 [&_button]:hover:bg-orange-500 [&_button]:hover:text-neutral-950",
        today: "[&_button]:border [&_button]:border-orange-400 [&_button]:text-orange-300",
        outside: "[&_button]:text-neutral-600",
        disabled: "pointer-events-none opacity-40",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className, ...chevronProps }) => {
          if (orientation === "left") {
            return <ChevronLeft className={cn("h-4 w-4", className)} {...chevronProps} />
          }

          if (orientation === "right") {
            return <ChevronRight className={cn("h-4 w-4", className)} {...chevronProps} />
          }

          return <ChevronDown className={cn("h-4 w-4", className)} {...chevronProps} />
        },
        ...components,
      }}
      {...props}
    />
  )
}

export { Calendar }
