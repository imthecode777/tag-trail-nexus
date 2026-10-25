import { RefreshCw, ScanLine, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Esp32ConnectionState } from "@/lib/esp32";

export function AccessBadge({ granted }: { granted: boolean | null }) {
  if (granted === true) {
    return <Badge className="border-success/30 bg-success/15 text-success">GRANTED</Badge>;
  }
  if (granted === false) {
    return <Badge className="border-denied/30 bg-denied/15 text-denied">DENIED</Badge>;
  }
  return <Badge variant="secondary">UNKNOWN</Badge>;
}

export function AttendanceBadge() {
  return <Badge className="border-primary/30 bg-primary/15 text-primary">PRESENT</Badge>;
}

export function ConnectionChip({ state, ip }: { state: Esp32ConnectionState; ip: string | null }) {
  return (
    <span className="glass-soft inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium">
      <span
        className={cn(
          "size-2 rounded-full",
          state === "connected" && "pulse-ring bg-success text-success",
          state === "connecting" && "pulse-ring bg-primary text-primary",
          state === "disconnected" && "bg-denied text-denied",
        )}
      />
      {state === "connected" ? "Connected" : state === "connecting" ? "Connecting…" : "Disconnected"}
      {state === "connected" && ip && <span className="font-mono text-muted-foreground">{ip}</span>}
    </span>
  );
}

export function DisconnectedCard({ onRetry, isRetrying }: { onRetry: () => void; isRetrying?: boolean }) {
  return (
    <div className="glass animate-rise rounded-3xl p-8 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-denied/15 text-denied">
        <WifiOff className="size-6" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">ESP32 disconnected</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        The browser couldn't reach the reader. Make sure this device is on the same network as the
        ESP32, that the firmware allows cross-origin requests (Access-Control-Allow-Origin), and
        that the base URL in the connection settings (top of the page) matches the Serial Monitor.
      </p>
      <Button variant="outline" size="sm" className="mt-5" onClick={onRetry} disabled={isRetrying}>
        <RefreshCw className={cn("size-4", isRetrying && "animate-spin")} />
        Try again
      </Button>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="glass animate-rise rounded-3xl p-10 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
        <ScanLine className="size-6" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      {description && <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

export function LoadingRows() {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      <Skeleton className="h-44 rounded-3xl" />
      {[0, 1, 2, 3].map((index) => (
        <Skeleton key={index} className="h-16 rounded-2xl" />
      ))}
    </div>
  );
}
