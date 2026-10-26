import { afterEach, describe, expect, it, vi } from "vitest";
import { identityLabel, parseScan, parseUser, registerUser, USER_ROLES } from "@/lib/esp32";

afterEach(() => vi.unstubAllGlobals());

function mockReader(responses: unknown[]) {
  const fetchMock = vi.fn();
  for (const data of responses) {
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify(data) });
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("Reader registration", () => {
  it.each(USER_ROLES)("persists and verifies the %s role", async (role) => {
    const saved = { name: "Karthik", uid: "A1 B2", role };
    const fetchMock = mockReader([[], { success: true }, [saved]]);
    expect(await registerUser(" Karthik ", "A1 B2", role)).toMatchObject(saved);
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1].body)).toEqual(saved);
    expect(fetchMock.mock.calls[2]?.[0]).toContain("/api/users");
  });

  it("rejects explicit firmware failure even with HTTP success", async () => {
    mockReader([[], { success: false, message: "Reader full" }]);
    await expect(registerUser("Karthik", "A1 B2", "Student")).rejects.toThrow("Reader full");
  });

  it("does not claim the role was saved when firmware drops it", async () => {
    mockReader([[], { success: true }, [{ name: "Karthik", uid: "A1 B2" }]]);
    await expect(registerUser("Karthik", "A1 B2", "Staff")).rejects.toThrow("name or role was not saved correctly");
  });

  it("rejects duplicate UIDs regardless of separators and case", async () => {
    const fetchMock = mockReader([[{ name: "Existing", uid: "a1:b2" }]]);
    await expect(registerUser("Karthik", "A1 B2", "Staff")).rejects.toThrow("already registered");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("requires a name before making a request", async () => {
    const fetchMock = mockReader([]);
    await expect(registerUser(" ", "A1 B2", "Student")).rejects.toThrow("required");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never posts when the reader cannot be reached", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(registerUser("Karthik", "A1 B2", "Student")).rejects.toThrow("Cannot reach the ESP32");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("Identity roles", () => {
  it("supports Student and Staff without inventing a role for missing data", () => {
    expect(USER_ROLES).toEqual(["Student", "Staff"]);
    expect(parseUser({ uid: "A1", role: "student" }).role).toBe("Student");
    expect(parseScan({ uid: "B2", user_role: "staff" }).role).toBe("Staff");
    expect(parseUser({ uid: "C3" }).role).toBeNull();
    expect(identityLabel(parseScan({ uid: "C3", name: "Unknown" }).name)).toBe("Undefined");
    expect(identityLabel(parseUser({ uid: "C3" }).role)).toBe("Undefined");
  });
});