import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveApiBase } from "@/lib/apiBase";

describe("resolveApiBase", () => {
  it("defaults to same-origin /api when VITE_API_URL is unset", () => {
    const original = import.meta.env.VITE_API_URL;
    import.meta.env.VITE_API_URL = "";
    expect(resolveApiBase()).toBe("/api");
    import.meta.env.VITE_API_URL = original;
  });

  it("appends /api when host is provided without it", () => {
    const original = import.meta.env.VITE_API_URL;
    const originalWindow = globalThis.window;
    import.meta.env.VITE_API_URL = "http://localhost:8080";
    vi.stubGlobal("window", { location: { hostname: "localhost" } });
    expect(resolveApiBase()).toBe("http://localhost:8080/api");
    import.meta.env.VITE_API_URL = original;
    vi.stubGlobal("window", originalWindow);
  });

  it("keeps /api when already present", () => {
    const original = import.meta.env.VITE_API_URL;
    const originalWindow = globalThis.window;
    import.meta.env.VITE_API_URL = "http://localhost:8080/api";
    vi.stubGlobal("window", { location: { hostname: "localhost" } });
    expect(resolveApiBase()).toBe("http://localhost:8080/api");
    import.meta.env.VITE_API_URL = original;
    vi.stubGlobal("window", originalWindow);
  });

  it("ignores localhost VITE_API_URL when page is not served from localhost", () => {
    const originalEnv = import.meta.env.VITE_API_URL;
    const originalWindow = globalThis.window;
    import.meta.env.VITE_API_URL = "http://localhost:8080/api";
    vi.stubGlobal("window", { location: { hostname: "app.trustkeyper.com" } });
    expect(resolveApiBase()).toBe("/api");
    import.meta.env.VITE_API_URL = originalEnv;
    vi.stubGlobal("window", originalWindow);
  });
});
