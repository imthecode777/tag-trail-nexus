import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageShell } from "@/components/nexus/page-shell";
import {
  AccessBadge,
  DisconnectedCard,
  EmptyState,
  LoadingRows,
} from "@/components/nexus/shared";
import { useEsp32BaseUrl } from "@/hooks/use-esp32-base-url";
import { fetchLogs, identityLabel } from "@/lib/esp32";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "RFID Nexus — Scan History" },
      {
        name: "description",
        content:
          "Every timestamped RFID scan record from your ESP32 reader, newest first — repeated scans included.",
      },
      { property: "og:title", content: "RFID Nexus — Scan History" },
      {
        property: "og:description",
        content:
          "Every timestamped RFID scan record from your ESP32 reader, newest first — repeated scans included.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HistoryPage,
});

const LOGS_LIMIT = 300;
const POLL_MS = 5000;

type ScanFilter = "all" | "granted" | "denied";

const FILTERS: Array<{ value: ScanFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "granted", label: "Granted" },
  { value: "denied", label: "Denied" },
];

function HistoryPage() {
  const baseUrl = useEsp32BaseUrl();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ScanFilter>("all");

  const logsQuery = useQuery({
    queryKey: ["esp32", "history-logs", baseUrl],
    queryFn: () => fetchLogs(LOGS_LIMIT),
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
    retry: false,
  });

  const scans = logsQuery.data ?? [];

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return scans.filter((scan) => {
      if (filter === "granted" && scan.granted !== true) return false;
      if (filter === "denied" && scan.granted !== false) return false;
      if (!query) return true;
      return (
        (scan.name?.toLowerCase().includes(query) ?? false) ||
        (scan.role?.toLowerCase().includes(query) ?? false) ||
        scan.uid.toLowerCase().includes(query)
      );
    });
  }, [scans, search, filter]);

  const isRefreshing = logsQuery.isFetching;

  return (
    <PageShell>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Scan History</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every scan record from the device, newest first — repeats kept
          </p>
        </div>
        <Button variant="outline" size="sm" className="rounded-full" onClick={() => logsQuery.refetch()}>
          <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} />
          Refresh
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, role or UID"
            className="rounded-full pl-9"
            aria-label="Search scans by name, role or UID"
          />
        </div>
        <div className="glass-soft inline-flex rounded-full p-1" role="group" aria-label="Filter by access result">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                filter === option.value
                  ? "bg-primary/20 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {logsQuery.isPending ? (
        <LoadingRows />
      ) : logsQuery.isError ? (
        <DisconnectedCard onRetry={() => logsQuery.refetch()} isRetrying={isRefreshing} />
      ) : scans.length === 0 ? (
        <EmptyState
          title="No scan records yet"
          description="Timestamped scans logged by the reader will appear here."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No scans match"
          description="Try a different name, UID, or access filter."
        />
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Showing {filtered.length} of {scans.length} records
          </p>
          <ul className="flex flex-col gap-2">
            {filtered.map((scan, index) => (
              <li
                key={`${scan.uid}-${scan.timestampLabel}-${index}`}
                className="glass-soft row-hover animate-rise rounded-2xl px-4 py-3"
                style={{ animationDelay: `${Math.min(index * 25, 300)}ms` }}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <p className="font-mono text-xs text-muted-foreground sm:w-44 sm:shrink-0">
                    {scan.timestampLabel}
                  </p>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{identityLabel(scan.name)}</p>
                    <p className="text-xs text-muted-foreground">{identityLabel(scan.role)}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {scan.uid || "UID unknown"}
                    </p>
                  </div>
                  <div className="sm:w-28">
                    <AccessBadge granted={scan.granted} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </PageShell>
  );
}
