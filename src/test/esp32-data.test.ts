import { describe, expect, it } from "vitest";
import { latestByUid, parseScan, type Esp32Scan } from "@/lib/esp32";

function makeScan(uid: string, ms: number, granted: boolean | null = true): Esp32Scan {
  return {
    uid,
    name: `User ${uid}`,
    granted,
    timestampLabel: "",
    timestampDate: new Date(ms),
    raw: {},
  };
}

describe("latestByUid", () => {
  it("keeps only each UID's newest scan and sorts newest first", () => {
    const scans = [makeScan("A1", 3000), makeScan("B2", 1000), makeScan("A1", 5000)];
    const latest = latestByUid(scans);

    expect(latest).toHaveLength(2);
    expect(latest[0]!.scan.uid).toBe("A1");
    expect(latest[0]!.scan.timestampDate!.getTime()).toBe(5000);
    expect(latest[1]!.scan.uid).toBe("B2");
  });

  it("uses the device's newest-first order when timestamps are not parseable", () => {
    const scans = [
      { ...makeScan("A1", 0), timestampDate: null },
      { ...makeScan("B2", 0), timestampDate: null },
      { ...makeScan("A1", 0), timestampDate: null },
    ];
    const latest = latestByUid(scans);

    expect(latest).toHaveLength(2);
    expect(latest[0]!.scan.uid).toBe("A1");
    expect(latest[1]!.scan.uid).toBe("B2");
  });

  it("falls back to the name as the identity when the UID is missing", () => {
    const scans = [
      { ...makeScan("", 1000), name: "Aarav" },
      { ...makeScan("", 2000), name: "Aarav" },
    ];
    expect(latestByUid(scans)).toHaveLength(1);
  });
});

describe("parseScan", () => {
  it("maps common granted/denied field spellings", () => {
    expect(parseScan({ uid: "A1", name: "Aarav", access: "GRANTED" }).granted).toBe(true);
    expect(parseScan({ uid: "A1", status: "DENIED" }).granted).toBe(false);
    expect(parseScan({ uid: "A1", granted: true }).granted).toBe(true);
    expect(parseScan({ uid: "A1" }).granted).toBeNull();
  });

  it("converts epoch seconds to a date without inventing timestamps", () => {
    const scan = parseScan({ uid: "A1", timestamp: 1761427181 });
    expect(scan.timestampDate).toBeInstanceOf(Date);
    expect(scan.timestampDate!.getTime()).toBe(1761427181 * 1000);
  });

  it("shows the raw device string when the timestamp cannot be parsed", () => {
    const scan = parseScan({ uid: "A1", timestamp: "not-a-clock" });
    expect(scan.timestampDate).toBeNull();
    expect(scan.timestampLabel).toBe("not-a-clock");
  });
});
