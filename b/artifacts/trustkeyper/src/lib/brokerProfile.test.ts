import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBrokerProfile, saveBrokerProfileDocument } from "./brokerProfile";

function createMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    key(index: number) {
      return [...data.keys()][index] ?? null;
    },
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
    removeItem(key: string) {
      data.delete(key);
    },
    clear() {
      data.clear();
    },
  };
}

describe("brokerProfile document storage", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage());
    vi.stubGlobal("sessionStorage", createMemoryStorage());
    sessionStorage.setItem("tk_active_phone", "9876543210");
    sessionStorage.setItem("tk_active_role", "broker");
  });

  it("stores only metadata for saved broker documents", () => {
    const file = new File(["broker-pan"], "broker-pan.pdf", { type: "application/pdf" });

    saveBrokerProfileDocument("pan", file);

    const profile = getBrokerProfile();
    expect(profile.pan?.fileName).toBe("broker-pan.pdf");
    expect(profile.pan?.fileSize).toBe(file.size);
    expect(profile.pan?.dataUrl).toBeUndefined();
  });
});
