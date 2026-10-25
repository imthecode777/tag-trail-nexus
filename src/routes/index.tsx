import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Fingerprint, RefreshCw, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/nexus/page-shell";
import {
  AccessBadge,
  AttendanceBadge,
  ConnectionChip,
  DisconnectedCard,
  EmptyState,
  LoadingRows,
} from "@/components/nexus/shared";
import { useEsp32BaseUrl } from "@/hooks/use-esp32-base-url";
import { fetchLogs, fetchStatus, formatUptime, latestByUid, type Esp32Status } from "@/lib/esp32";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RFID Nexus — Home" },
      {
        name: "description",
        content:
          "Live view of the latest RFID punches from your ESP32 reader: who scanned last, access results, and device connection status.",
      },
      { property: "og:title", content: "RFID Nexus — Home" },
      {
        property: "og:description",
        content:
          "Live view of the latest RFID punches from your ESP32 reader: who scanned last, access results, and device connection status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HomePage,
});

const LOGS_LIMIT = 150;
const POLL_MS = 4000;

function HomePage() {
  const baseUrl = useEsp32BaseUrl();
  const logsQuery = useQuery({
    queryKey: ["esp32", "logs", baseUrl],
    queryFn: () => fetchLogs(LOGS_LIMIT),
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
    retry: false,
  });
  const statusQuery = useQuery({
    queryKey: ["esp32", "status", baseUrl],
    queryFn: fetchStatus,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
    retry: false,
  });

  const scans = logsQuery.data ?? [];
  const uniquePunches = useMemo(() => latestByUid(scans), [scans]);
  const status: Esp32Status | null = statusQuery.data ?? null;

  const connected = statusQuery.isSuccess || logsQuery.isSuccess;
  const disconnected = statusQuery.isError && logsQuery.isError;
  const connectionState = connected ? "connected" : disconnected ? "disconnected" : "connecting";

  const lastUpdated = Math.max(statusQuery.dataUpdatedAt, logsQuery.dataUpdatedAt);
  const uptimeLabel = formatUptime(status?.uptimeSeconds ?? null);

  const refresh = async () => {
    await Promise.all([logsQuery.refetch(), statusQuery.refetch()]);
  };

  const isRefreshing = logsQuery.isFetching || statusQuery.isFetching;
  const latest = uniquePunches[0]?.scan ?? null;
  const remaining = uniquePunches.slice(1);

  return (
    <PageShell>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Home</h1>
          <p className="mt-1 text-sm text-muted-foreground">Latest punches from your RFID reader</p>
        </div>
        <Button variant="outline" size="sm" className="rounded-full" onClick={refresh}>
          <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} />
          Refresh
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <ConnectionChip state={connectionState} ip={status?.ip ?? null} />
        {status?.usersCount !== null && status?.usersCount !== undefined && (
          <span className="glass-soft inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium">
            <Users className="size-3.5 text-primary" />
            {status.usersCount} registered
          </span>
        )}
        {uptimeLabel && (
          <span className="glass-soft inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium">
            Uptime {uptimeLabel}
          </span>
        )}
        {uniquePunches.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">
            {uniquePunches.length} unique {uniquePunches.length === 1 ? "user" : "users"} shown
          </span>
        )}
        {lastUpdated > 0 && (
          <span className="sr-only">
            Last updated {new Date(lastUpdated).toLocaleTimeString()}
          </span>
        )}
        {lastUpdated > 0 && (
          <span className={cn("text-xs text-muted-foreground", uniquePunches.length === 0 && "ml-auto")}>
            Updated {new Date(lastUpdated).toLocaleTimeString()}
          </span>
        )}
      </div>

      {logsQuery.isPending && statusQuery.isPending ? (
        <LoadingRows />
      ) : disconnected ? (
        <DisconnectedCard onRetry={refresh} isRetrying={isRefreshing} />
      ) : uniquePunches.length === 0 ? (
        <EmptyState
          title="No punches yet"
          description="When someone taps a card on the reader, their latest scan appears here."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {latest && (
            <div
              key={`latest-${latest.uid}-${latest.timestampLabel}`}
              className="glass relative overflow-hidden rounded-3xl p-6"
            >
              <div
                aria-hidden
                className="absolute -right-16 -top-16 size-48 rounded-full bg-primary/15 blur-3xl"
              />
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-primary">
                <Fingerprint className="size-3.5" />
                Last punch
              </span>
              <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-2xl font-semibold tracking-tight">
                    {latest.name ?? "Unknown user"}
                  </p>
                  <p className="mt-1 font-mono text-sm text-muted-foreground">
                    UID {latest.uid || "unknown"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <AccessBadge granted={latest.granted} />
                  {latest.granted === true && <AttendanceBadge />}
                </div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{latest.timestampLabel}</p>
            </div>
          )}
          <ul className="flex flex-col gap-2">
            {remaining.map((entry, index) => (
              <li
                key={entry.key}
                className="glass-soft row-hover flex animate-rise items-center gap-3 rounded-2xl px-4 py-3"
                style={{ animationDelay: `${Math.min(index * 40, 240)}ms` }}
              >
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    entry.scan.granted === false
                      ? "bg-denied"
                      : entry.scan.granted === true
                        ? "bg-success"
                        : "bg-muted-foreground",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{entry.scan.name ?? "Unknown user"}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {entry.scan.uid || "UID unknown"}
                  </p>
                </div>
                <div className="hidden items-center gap-2 sm:flex">
                  <AccessBadge granted={entry.scan.granted} />
                  {entry.scan.granted === true && <AttendanceBadge />}
                </div>
                <p className="shrink-0 text-xs text-muted-foreground">{entry.scan.timestampLabel}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </PageShell>
  );
}
