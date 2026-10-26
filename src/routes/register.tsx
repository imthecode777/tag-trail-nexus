import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Info, RefreshCw, UserPlus, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageShell } from "@/components/nexus/page-shell";
import { DisconnectedCard, EmptyState, LoadingRows } from "@/components/nexus/shared";
import { useEsp32BaseUrl } from "@/hooks/use-esp32-base-url";
import { Esp32Error, fetchUsers, identityLabel, normalizeUid, registerUser, USER_ROLES, type UserRole, type Esp32User } from "@/lib/esp32";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "RFID Nexus — Register Users" },
      {
        name: "description",
        content: "Registered RFID users on your ESP32 reader, with firmware-backed registration.",
      },
      { property: "og:title", content: "RFID Nexus — Register Users" },
      {
        property: "og:description",
        content: "Registered RFID users on your ESP32 reader, with firmware-backed registration.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RegisterPage,
});

type FormFeedback = { tone: "success" | "error"; message: string };

function CopyUidButton({ uid }: { uid: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(uid);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — nothing to report honestly here.
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8 rounded-full text-muted-foreground hover:text-foreground"
      onClick={copy}
      aria-label={`Copy UID ${uid}`}
    >
      {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
    </Button>
  );
}

function UserActions({ user }: { user: Esp32User }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 rounded-full text-muted-foreground hover:text-foreground" aria-label={`Actions for ${user.name ?? user.uid}`}>
          <span className="text-lg leading-none">⋯</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-xl">
        <DropdownMenuItem onClick={() => navigator.clipboard?.writeText(user.uid).catch(() => undefined)}>
          <Copy className="size-3.5" /> Copy UID
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserRow({ user }: { user: Esp32User }) {
  return (
    <TableRow className="border-border/60">
      <TableCell className="font-medium">{identityLabel(user.name)}</TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">{user.uid || "—"}</TableCell>
      <TableCell>{identityLabel(user.role)}</TableCell>
      <TableCell>
        <Badge className="border-success/30 bg-success/15 text-success">REGISTERED</Badge>
      </TableCell>
      <TableCell className="text-right">
        <UserActions user={user} />
      </TableCell>
    </TableRow>
  );
}

function RegisterPage() {
  const baseUrl = useEsp32BaseUrl();
  const queryClient = useQueryClient();
  const usersQuery = useQuery({
    queryKey: ["esp32", "users", baseUrl],
    queryFn: fetchUsers,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
    retry: false,
  });

  const [name, setName] = useState("");
  const [uid, setUid] = useState("");
  const [role, setRole] = useState<UserRole>("Student");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FormFeedback | null>(null);

  const users = usersQuery.data ?? [];
  const registeredCount = users.length;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const cleanName = name.trim();
    const cleanUid = uid.trim().replace(/\s+/g, " ");

    if (!cleanName || !cleanUid) {
      setFeedback({ tone: "error", message: "Name and UID are both required." });
      return;
    }
    if (users.some((user) => normalizeUid(user.uid) === normalizeUid(cleanUid))) {
      setFeedback({ tone: "error", message: `UID ${cleanUid} is already registered.` });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      const saved = await registerUser(cleanName, cleanUid, role);
      setFeedback({ tone: "success", message: `Registered ${saved.name} as ${saved.role} (${saved.uid}). Confirmed on the reader.` });
      setName("");
      setUid("");
      await queryClient.invalidateQueries({ queryKey: ["esp32"] });
    } catch (error) {
      const detail = error instanceof Esp32Error ? error.message : "The registration request failed.";
      setFeedback({
        tone: "error",
        message: detail,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isFetchingUsers = usersQuery.isFetching;

  return (
    <PageShell>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Register Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">Users stored on the ESP32 reader</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => usersQuery.refetch()}
        >
          <RefreshCw className={cn("size-4", isFetchingUsers && "animate-spin")} />
          Refresh
        </Button>
      </header>

      <div className="glass-soft flex gap-3 rounded-2xl p-4 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          {usersQuery.isError
            ? (usersQuery.error instanceof Esp32Error ? usersQuery.error.message : "The reader is unavailable.")
            : "ESP32 reader: " + baseUrl}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="glass rounded-3xl p-6" noValidate>
        <h2 className="text-lg font-semibold">Register a user</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="register-name">Full name</Label>
            <Input
              id="register-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Aarav Sharma"
              autoComplete="off"
              disabled={submitting}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="register-uid">RFID UID</Label>
            <Input
              id="register-uid"
              value={uid}
              onChange={(event) => setUid(event.target.value)}
              placeholder="e.g. A1 B2 C3 D4"
              className="font-mono"
              autoComplete="off"
              spellCheck={false}
              disabled={submitting}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="register-role">Role</Label>
            <Select value={role} disabled={submitting} onValueChange={(value) => {
              const selected = USER_ROLES.find((option) => option === value);
              if (selected) setRole(selected);
            }}>
              <SelectTrigger id="register-role"><SelectValue /></SelectTrigger>
              <SelectContent>{USER_ROLES.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        {feedback && (
          <p
            role="status"
            className={cn(
              "mt-4 text-sm",
              feedback.tone === "success" ? "text-success" : "text-denied",
            )}
          >
            {feedback.message}
          </p>
        )}
        <Button type="submit" disabled={submitting} className="mt-5 rounded-full sm:w-auto">
          {submitting ? <RefreshCw className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
          Register user
        </Button>
      </form>

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Registered users</h2>
          {usersQuery.isSuccess && (
            <span className="glass-soft inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-muted-foreground">
              <Users className="size-3.5 text-primary" />
              {registeredCount}
            </span>
          )}
        </div>

        {usersQuery.isPending ? (
          <LoadingRows />
        ) : usersQuery.isError ? (
          <DisconnectedCard onRetry={() => usersQuery.refetch()} isRetrying={isFetchingUsers} />
        ) : users.length === 0 ? (
          <EmptyState
            title="No registered users yet"
            description="Users registered on the device will be listed here."
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="glass hidden overflow-hidden rounded-3xl md:block">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60 hover:bg-transparent">
                    <TableHead>Name</TableHead>
                    <TableHead>RFID UID</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <UserRow key={`${user.uid}-${user.name ?? ""}`} user={user} />
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <ul className="flex flex-col gap-2 md:hidden">
              {users.map((user, index) => (
                <li
                  key={`${user.uid}-${user.name ?? ""}`}
                  className="glass-soft row-hover flex animate-rise items-center gap-3 rounded-2xl px-4 py-3"
                  style={{ animationDelay: `${Math.min(index * 40, 240)}ms` }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{identityLabel(user.name)}</p>
                    <p className="text-xs text-muted-foreground">{identityLabel(user.role)}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {user.uid || "UID unknown"}
                    </p>
                  </div>
                  <Badge className="border-success/30 bg-success/15 text-success">REGISTERED</Badge>
                  <UserActions user={user} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </PageShell>
  );
}
