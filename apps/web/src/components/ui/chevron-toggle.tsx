import { cn } from "@/lib/utils";

export function ChevronToggle({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("pointer-events-none shrink-0", className)}
    >
      <g
        style={{
          transform: open ? "translateY(3px)" : "translateY(0)",
          transition: "transform 0.1s linear",
        }}
      >
        <path
          d="M6,9 L12,15"
          style={{
            transformOrigin: "6px 9px",
            transform: open ? "rotate(-90deg)" : "rotate(0deg)",
            transition: "transform 0.1s linear",
          }}
        />
        <path
          d="M12,15 L18,9"
          style={{
            transformOrigin: "18px 9px",
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.1s linear",
          }}
        />
      </g>
    </svg>
  );
}
