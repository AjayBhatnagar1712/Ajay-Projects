import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOwnerProfile, saveOwnerProfileDocument } from "./ownerProfile";

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

describe("ownerProfile document storage", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage());
    vi.stubGlobal("sessionStorage", createMemoryStorage());
    vi.stubGlobal("window", {});
    sessionStorage.setItem("tk_active_phone", "9876543210");
    sessionStorage.setItem("tk_active_role", "owner");
  });

  it("stores only metadata for saved owner documents", () => {
    const file = new File(["owner-aadhaar"], "owner-aadhaar.pdf", { type: "application/pdf" });

    saveOwnerProfileDocument("aadhaar", file);

    const profile = getOwnerProfile();
    expect(profile.aadhaar?.fileName).toBe("owner-aadhaar.pdf");
    expect(profile.aadhaar?.fileSize).toBe(file.size);
    expect(profile.aadhaar?.dataUrl).toBeUndefined();
  });
});
