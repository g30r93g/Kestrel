"use client";

import type { SignalChip } from "@/lib/github/types";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowDown,
  ArrowUp,
  Minus,
  Shield,
  Globe,
  BarChart3,
  Package,
  Brush,
  Eye,
  Bot,
} from "lucide-react";

const KIND_ICON: Record<string, React.ReactNode> = {
  coverage: <BarChart3 className="size-3.5" />,
  bundle: <Package className="size-3.5" />,
  performance: <BarChart3 className="size-3.5" />,
  security: <Shield className="size-3.5" />,
  deploy: <Globe className="size-3.5" />,
  quality: <Brush className="size-3.5" />,
  visual: <Eye className="size-3.5" />,
  dependency: <Package className="size-3.5" />,
  "automated-note": <Bot className="size-3.5" />,
};

const SEVERITY_CLASS: Record<SignalChip["severity"], string> = {
  ok: "border-border text-foreground",
  warning: "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400",
  error: "border-destructive/50 text-destructive",
};

function DeltaIcon({ dir }: { dir?: SignalChip["deltaDirection"] }) {
  if (dir === "up") return <ArrowUp className="size-3" />;
  if (dir === "down") return <ArrowDown className="size-3" />;
  return <Minus className="size-3" />;
}

interface ZoneSignalsProps {
  chips: SignalChip[];
  loading: boolean;
  error: boolean;
}

export function ZoneSignals({ chips, loading, error }: ZoneSignalsProps) {
  if (!loading && !error && chips.length === 0) return null;

  return (
    <div className="rounded-lg border bg-card p-4">
      <h2 className="mb-3 text-sm font-medium">Signals</h2>

      {error && (
        <p className="text-xs text-destructive">Signal data unavailable.</p>
      )}

      {loading && (
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-8 w-28 rounded-full" />
          ))}
        </div>
      )}

      {!loading && !error && (
        <div className="flex flex-wrap gap-2">
          {chips.map((chip, i) => (
            <a
              key={i}
              href={chip.url ?? "#"}
              target={chip.url ? "_blank" : undefined}
              rel="noreferrer"
              className={[
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-opacity",
                SEVERITY_CLASS[chip.severity],
                chip.url ? "hover:opacity-80" : "cursor-default",
              ].join(" ")}
            >
              {KIND_ICON[chip.kind] ?? <Bot className="size-3.5" />}
              <span className="font-medium">{chip.label}</span>
              <span>{chip.value}</span>
              {chip.delta && (
                <span className="flex items-center gap-0.5 opacity-70">
                  <DeltaIcon dir={chip.deltaDirection} />
                  {chip.delta}
                </span>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
