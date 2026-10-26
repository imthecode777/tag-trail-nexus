import { format } from "date-fns";

/**
 * ESP32 API service module.
 *
 * The device is the single source of truth. Every value shown in the UI comes
 * from these calls — nothing is mocked and no data is stored in a backend.
 *
 * Known firmware endpoints (read-only):
 *   GET /api/status        device status, Wi-Fi, IP, uptime, clock sync, user count
 *   GET /api/users         registered RFID UIDs and names
 *   GET /api/logs          timestamped scan records, newest first
 *   GET /api/logs?limit=N  limited recent scan records
 *   POST /api/register     OPTIONAL — only works if the firmware implements it
 *
 * Because responses are parsed tolerantly (the exact field names can vary per
 * firmware build), missing fields surface as "unknown" in the UI instead of
 * invented data.
 */

export const DEFAULT_ESP32_BASE_URL = "http://192.168.220.10";

const BASE_URL_STORAGE_KEY = "rfid-nexus:esp32-base-url";
export const BASE_URL_EVENT = "rfid-nexus:base-url-changed";

export const USER_ROLES = ["Student", "Staff"] as const;
export type UserRole = (typeof USER_ROLES)[number];

function identityValue(value: unknown): string | null {
  const text = asString(value)?.trim();
  return text && !["unknown", "unknown user", "undefined", "null", "guest"].includes(text.toLowerCase())
    ? text
    : null;
}

export function identityLabel(value: string | null): string {
  return identityValue(value) ?? "Undefined";
}

function parseRole(record: Json): string | null {
  const role = identityValue(pick(record, ["role", "user_role", "userRole", "category", "type"]));
  return USER_ROLES.find((option) => option.toLowerCase() === role?.toLowerCase()) ?? role;
}

export type Esp32FailureKind = "offline" | "http" | "parse";
export type Esp32ConnectionState = "connecting" | "connected" | "disconnected";

export class Esp32Error extends Error {
  kind: Esp32FailureKind;

  constructor(kind: Esp32FailureKind, message: string) {
    super(message);
    this.kind = kind;
    this.name = "Esp32Error";
  }
}

export function getEsp32BaseUrl(): string {
  if (typeof window === "undefined") return DEFAULT_ESP32_BASE_URL;
  const stored = window.localStorage.getItem(BASE_URL_STORAGE_KEY);
  const value = stored?.trim();
  return value ? value.replace(/\/+$/, "") : DEFAULT_ESP32_BASE_URL;
}

export function setEsp32BaseUrl(url: string): string {
  const clean = url.trim().replace(/\/+$/, "");
  if (clean) {
    window.localStorage.setItem(BASE_URL_STORAGE_KEY, clean);
  } else {
    window.localStorage.removeItem(BASE_URL_STORAGE_KEY);
  }
  window.dispatchEvent(new Event(BASE_URL_EVENT));
  return clean || DEFAULT_ESP32_BASE_URL;
}

// ---------- tolerant response parsing ----------

type Json = Record<string, unknown>;

function asRecord(value: unknown): Json | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null;
}

function pick(entry: Json, keys: string[]): unknown {
  for (const key of keys) {
    const value = entry[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function asString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const text = value.toUpperCase();
    if (text.includes("NOT") || text.includes("FALSE") || text.includes("FAIL") || text.includes("DIS")) {
      return false;
    }
    if (text.includes("TRUE") || text.includes("OK") || text.includes("SYNC") || text.includes("CONNECT")) {
      return true;
    }
  }
  return null;
}

function extractArray(payload: unknown, keys: string[]): unknown[] {
  if (Array.isArray(payload)) return payload;
  const record = asRecord(payload);
  if (record) {
    for (const key of keys) {
      const value = record[key];
      if (Array.isArray(value)) return value;
    }
  }
  return [];
}

export interface Esp32Scan {
  uid: string;
  name: string | null;
  role: string | null;
  granted: boolean | null;
  timestampLabel: string;
  timestampDate: Date | null;
  raw: Json;
}

function formatTimestampDate(date: Date): string {
  return format(date, "MMM d, yyyy · HH:mm:ss");
}

export function parseTimestamp(value: unknown): { date: Date | null; label: string } {
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value < 1e11 ? value * 1000 : value;
    const date = new Date(ms);
    if (!Number.isNaN(date.getTime())) return { date, label: formatTimestampDate(date) };
  }
  if (typeof value === "string") {
    const text = value.trim();
    if (text) {
      const numeric = Number(text);
      if (Number.isFinite(numeric)) {
        const ms = numeric < 1e11 ? numeric * 1000 : numeric;
        const date = new Date(ms);
        if (!Number.isNaN(date.getTime())) return { date, label: formatTimestampDate(date) };
      }
      const parsed = new Date(text);
      if (!Number.isNaN(parsed.getTime())) return { date: parsed, label: formatTimestampDate(parsed) };
      // Not parseable — show exactly what the device sent, never a fake time.
      return { date: null, label: text };
    }
  }
  return { date: null, label: "—" };
}

export function parseScan(entry: unknown): Esp32Scan {
  const record = asRecord(entry) ?? {};
  const uid = asString(pick(record, ["uid", "card_uid", "rfid_uid", "rfid", "tag", "card", "id"])) ?? "";
  const name = identityValue(pick(record, ["name", "user_name", "username", "user", "owner", "holder"]));
  const granted = asBoolean(
    pick(record, ["granted", "access_granted", "access_result", "access", "allowed", "result", "status"]),
  );
  const { date, label } = parseTimestamp(
    pick(record, ["timestamp", "time", "epoch", "unix", "ts", "datetime", "date_time", "logged_at", "created_at"]),
  );
  return { uid, name, role: parseRole(record), granted, timestampLabel: label, timestampDate: date, raw: record };
}

export interface Esp32User {
  uid: string;
  name: string | null;
  role: string | null;
  registered: boolean;
}

export function parseUser(entry: unknown): Esp32User {
  const record = asRecord(entry) ?? {};
  const uid = asString(pick(record, ["uid", "card_uid", "rfid_uid", "rfid", "tag", "card", "id"])) ?? "";
  const name = identityValue(pick(record, ["name", "user_name", "username", "user", "owner", "holder"]));
  return { uid, name, role: parseRole(record), registered: true };
}

export function normalizeUid(uid: string): string {
  return uid.trim().replace(/[\s:-]+/g, "").toUpperCase();
}

export interface Esp32Status {
  ip: string | null;
  usersCount: number | null;
  clockSynced: boolean | null;
  uptimeSeconds: number | null;
  raw: Json;
}

export function formatUptime(seconds: number | null): string | null {
  if (seconds === null || seconds < 0) return null;
  const totalMinutes = Math.floor(seconds / 60);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// ---------- network layer ----------

async function requestJson(path: string, init?: Omit<RequestInit, "signal"> & { timeoutMs?: number }) {
  const base = getEsp32BaseUrl();
  const { timeoutMs = 8000, ...rest } = init ?? {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(base + path, {
      cache: "no-store",
      ...rest,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Esp32Error("http", `The device responded with HTTP ${response.status}.`);
    }
    const text = await response.text();
    if (!text.trim()) return null;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new Esp32Error("parse", "The device returned a response that is not valid JSON.");
    }
  } catch (error) {
    if (error instanceof Esp32Error) throw error;
    throw new Esp32Error("offline", "Cannot reach the ESP32. Check its address in connection settings and use the same Wi-Fi as the reader. HTTPS pages may block an HTTP reader; use a trusted HTTPS address for the device. The reader must also allow this page's origin (CORS).");
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchStatus(): Promise<Esp32Status> {
  const payload = await requestJson("/api/status");
  const record = asRecord(payload) ?? {};
  const uptimeRaw = asNumber(pick(record, ["uptime", "uptime_s", "uptime_seconds", "uptimeSec"]));
  const uptimeSeconds =
    uptimeRaw === null ? null : uptimeRaw > 1e6 ? Math.round(uptimeRaw / 1000) : Math.round(uptimeRaw);
  return {
    ip: asString(pick(record, ["ip", "ip_address", "wifi_ip", "local_ip", "ipAddress"])),
    usersCount: asNumber(pick(record, ["registered_users", "user_count", "users_count", "registered_count"])),
    clockSynced: asBoolean(pick(record, ["clock_synced", "ntp_synced", "time_synced", "clock_sync", "ntp"])),
    uptimeSeconds,
    raw: record,
  };
}

export async function fetchUsers(): Promise<Esp32User[]> {
  const payload = await requestJson("/api/users");
  return extractArray(payload, ["users", "data", "registered", "list"])
    .map(parseUser)
    .filter((user) => user.uid || user.name);
}

export async function fetchLogs(limit?: number): Promise<Esp32Scan[]> {
  const payload = await requestJson(limit ? `/api/logs?limit=${limit}` : "/api/logs");
  return extractArray(payload, ["logs", "data", "scans", "records", "list"])
    .map(parseScan)
    .filter((scan) => scan.uid || scan.name);
}

/**
 * Attempts firmware-side registration via POST /api/register.
 * Only resolves when the device itself accepted the request — there is never a
 * browser-only "fake success".
 */
export async function registerUser(name: string, uid: string, role: UserRole): Promise<Esp32User> {
  const cleanName = name.trim();
  const cleanUid = normalizeUid(uid);
  if (!cleanName || !cleanUid || !USER_ROLES.includes(role)) {
    throw new Esp32Error("parse", "Name, RFID UID and a Student or Staff role are required.");
  }
  const existing = await fetchUsers();
  if (existing.some((user) => normalizeUid(user.uid) === cleanUid)) {
    throw new Esp32Error("http", `UID ${uid.trim()} is already registered.`);
  }
  const payload = await requestJson("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ name: cleanName, uid: uid.trim().replace(/\s+/g, " "), role }),
    timeoutMs: 12000,
  });
  const record = asRecord(payload);
  if (record && (record["success"] === false || record["ok"] === false || record["error"] ||
    ["error", "failed", "failure", "rejected"].includes(String(record["status"] ?? record["result"]).toLowerCase()))) {
    throw new Esp32Error("http", asString(record["message"] ?? record["error"]) ?? "The reader rejected registration.");
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 500));
    const users = await fetchUsers();
    const saved = users.find((user) => normalizeUid(user.uid) === cleanUid);
    if (saved) {
      if (saved.name !== cleanName || saved.role !== role) {
        throw new Esp32Error("parse", "The card exists on the reader, but its name or role was not saved correctly. The ESP32 firmware must store and return both name and role.");
      }
      return saved;
    }
  }
  throw new Esp32Error("parse", "Registration could not be confirmed in the reader's user list. Check that the ESP32 implements POST /api/register and saves the user.");
}

// ---------- Home-page derivation: unique latest punches ----------

export interface LatestPunch {
  key: string;
  scan: Esp32Scan;
}

/**
 * Builds the Home list: one entry per UID, keeping only the newest scan.
 * The firmware returns logs newest-first, so the first occurrence of a UID is
 * its latest punch. When every entry carries a parseable timestamp the list is
 * re-sorted by time; otherwise the device order is trusted as-is.
 */
export function latestByUid(scans: Esp32Scan[]): LatestPunch[] {
  const map = new Map<string, Esp32Scan>();
  for (const scan of scans) {
    const key = scan.uid || scan.name || "unknown";
    const previous = map.get(key);
    if (!previous || (scan.timestampDate && previous.timestampDate && scan.timestampDate > previous.timestampDate)) {
      map.set(key, scan);
    }
  }
  const entries = [...map.entries()].map(([key, scan]) => ({ key, scan }));
  if (entries.length > 1 && entries.every((entry) => entry.scan.timestampDate)) {
    entries.sort(
      (a, b) => (b.scan.timestampDate?.getTime() ?? 0) - (a.scan.timestampDate?.getTime() ?? 0),
    );
  }
  return entries;
}
