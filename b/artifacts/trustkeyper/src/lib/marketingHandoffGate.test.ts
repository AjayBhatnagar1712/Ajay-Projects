import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyMarketingHandoff,
  clearMarketingHandoffFromUrl,
  decodeMarketingSessionHash,
  parseMarketingHandoffFromWindow,
  type MarketingHandoffParams,
} from "./marketingHandoff";
import { readPendingMarketingHandoff } from "@/components/MarketingHandoffGate";

vi.mock("./supabaseClient", () => ({
  supabase: {
    auth: {
      setSession: vi.fn(),
      getSession: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

vi.mock("./auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./auth")>();
  return {
    ...actual,
    loginSuccess: vi.fn(),
    persistSessionToLocalStorage: vi.fn(),
  };
});

import { loginSuccess, persistSessionToLocalStorage, setActiveSession } from "./auth";
import { supabase } from "./supabaseClient";

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

function encodeHandoffHash(accessToken: string, refreshToken = "refresh-token"): string {
  const payload = btoa(JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }));
  return `#tk_session=${encodeURIComponent(payload)}`;
}

function stubWindowLocation(location: {
  pathname: string;
  search: string;
  hash: string;
  href: string;
}): void {
  const history = {
    replaceState: (_state: unknown, _title: string, url?: string | null) => {
      if (typeof url !== "string") return;
      if (url.startsWith("/")) {
        const [pathAndQuery, hashPart = ""] = url.split("#");
        const [pathname, search = ""] = pathAndQuery.split("?");
        location.pathname = pathname;
        location.search = search ? `?${search}` : "";
        location.hash = hashPart ? `#${hashPart}` : "";
        location.href = `https://app.trustkeyper.com${url}`;
      }
    },
    pushState: vi.fn(),
  };

  vi.stubGlobal("window", {
    location,
    history,
    document: { title: "TrustKeyper" },
  });
  vi.stubGlobal("location", location);
  vi.stubGlobal("history", history);
  vi.stubGlobal("document", { title: "TrustKeyper" });
}

function stubHandoffLocation(options: {
  pathname?: string;
  phone?: string;
  role?: string;
  remember?: boolean;
  hash?: string;
}): void {
  const phone = options.phone ?? "9876543210";
  const role = options.role ?? "owner";
  const params = new URLSearchParams({
    phone,
    role,
    from: "marketing",
  });
  if (options.remember) params.set("remember", "1");
  const search = `?${params.toString()}`;
  const pathname = options.pathname ?? "/owner/dashboard";
  const hash = options.hash ?? encodeHandoffHash("access-token");

  stubWindowLocation({
    pathname,
    search,
    hash,
    href: `https://app.trustkeyper.com${pathname}${search}${hash}`,
  });
}

describe("marketing handoff URL shape", () => {
  it("carries session tokens in the hash fragment only (not the query string)", () => {
    const payload = btoa(JSON.stringify({ access_token: "abc", refresh_token: "def" }));
    const hash = `#tk_session=${encodeURIComponent(payload)}`;
    expect(decodeMarketingSessionHash(hash)).toEqual({
      access_token: "abc",
      refresh_token: "def",
    });
    expect(decodeMarketingSessionHash("")).toBeNull();
  });
});

describe("parseMarketingHandoffFromWindow", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads phone/role/from from the query and tokens from the hash", () => {
    stubHandoffLocation({ remember: true });
    const handoff = parseMarketingHandoffFromWindow();
    expect(handoff).toEqual({
      phone: "9876543210",
      role: "owner",
      rememberMe: true,
      tokens: { access_token: "access-token", refresh_token: "refresh-token" },
    });
  });

  it("returns null when from=marketing is absent", () => {
    stubWindowLocation({
      pathname: "/owner/dashboard",
      search: "?phone=9876543210&role=owner",
      hash: encodeHandoffHash("access-token"),
      href: "https://app.trustkeyper.com/owner/dashboard",
    });
    expect(parseMarketingHandoffFromWindow()).toBeNull();
  });
});

describe("applyMarketingHandoff storage writes", () => {
  let sessionStorageMock: Storage;
  let localStorageMock: Storage;

  beforeEach(() => {
    sessionStorageMock = createMemoryStorage();
    localStorageMock = createMemoryStorage();
    vi.stubGlobal("sessionStorage", sessionStorageMock);
    vi.stubGlobal("localStorage", localStorageMock);
    vi.mocked(supabase.auth.setSession).mockReset();
    vi.mocked(supabase.auth.getSession).mockReset();
    vi.mocked(supabase.auth.signOut).mockReset();
    vi.mocked(loginSuccess).mockReset();
    vi.mocked(persistSessionToLocalStorage).mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls setSession and populates tk_active_* keys the layout guards read", async () => {
    vi.mocked(supabase.auth.setSession).mockResolvedValue({ data: { session: null, user: null }, error: null });
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          user: { phone: "919876543210" },
        },
      },
      error: null,
    } as never);
    vi.mocked(loginSuccess).mockImplementation(async (phone, role) => {
      setActiveSession(phone, role);
      return true;
    });

    const handoff: MarketingHandoffParams = {
      phone: "9876543210",
      role: "owner",
      rememberMe: true,
      tokens: { access_token: "access-token", refresh_token: "refresh-token" },
    };

    const result = await applyMarketingHandoff(handoff);
    expect(result).toEqual({ ok: true });
    expect(supabase.auth.setSession).toHaveBeenCalledWith({
      access_token: "access-token",
      refresh_token: "refresh-token",
    });
    expect(loginSuccess).toHaveBeenCalledWith("9876543210", "owner", "access-token");
    expect(sessionStorageMock.getItem("tk_active_phone")).toBe("9876543210");
    expect(sessionStorageMock.getItem("tk_active_role")).toBe("owner");
    expect(persistSessionToLocalStorage).toHaveBeenCalledWith("9876543210", "owner");
  });

  it("returns a surfaced error when tokens are missing", async () => {
    const result = await applyMarketingHandoff({
      phone: "9876543210",
      role: "owner",
      rememberMe: false,
      tokens: null,
    });
    expect(result).toEqual({
      ok: false,
      error: "Missing verification session. Please log in again.",
    });
    expect(supabase.auth.setSession).not.toHaveBeenCalled();
  });
});

describe("marketing handoff gate race regression", () => {
  let sessionStorageMock: Storage;
  let historyCalls: Array<{ type: "push" | "replace"; url: string }>;

  beforeEach(() => {
    sessionStorageMock = createMemoryStorage();
    vi.stubGlobal("sessionStorage", sessionStorageMock);
    vi.stubGlobal("localStorage", createMemoryStorage());
    historyCalls = [];

    stubHandoffLocation({});

    const originalReplace = window.history.replaceState.bind(window.history);
    window.history.replaceState = ((_state: unknown, _title: string, url?: string | null) => {
      historyCalls.push({ type: "replace", url: String(url ?? "") });
      originalReplace(_state, _title, url);
    }) as History["replaceState"];
    window.history.pushState = ((_state: unknown, _title: string, url?: string | null) => {
      historyCalls.push({ type: "push", url: String(url ?? "") });
    }) as History["pushState"];

    vi.mocked(supabase.auth.setSession).mockReset();
    vi.mocked(supabase.auth.getSession).mockReset();
    vi.mocked(loginSuccess).mockReset();
    vi.mocked(persistSessionToLocalStorage).mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("detects a pending handoff synchronously before any router mount", () => {
    expect(readPendingMarketingHandoff()?.phone).toBe("9876543210");
    expect(sessionStorageMock.getItem("tk_active_phone")).toBeNull();
    expect(sessionStorageMock.getItem("tk_active_role")).toBeNull();
  });

  it("applies handoff without navigating to /login, then clears sensitive URL params", async () => {
    let resolveSetSession: (value: unknown) => void = () => undefined;
    const setSessionPending = new Promise((resolve) => {
      resolveSetSession = resolve;
    });

    vi.mocked(supabase.auth.setSession).mockImplementation(async () => {
      await setSessionPending;
      return { data: { session: null, user: null }, error: null };
    });
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          user: { phone: "919876543210" },
        },
      },
      error: null,
    } as never);
    vi.mocked(loginSuccess).mockImplementation(async (phone, role) => {
      setActiveSession(phone, role);
      return true;
    });

    const pending = readPendingMarketingHandoff();
    expect(pending).not.toBeNull();

    const applyPromise = applyMarketingHandoff(pending!);

    // While setSession is in flight, a racing layout would have pushed /login.
    // The gate must not mount layouts — assert no /login navigation happened yet.
    expect(historyCalls.some((call) => call.url === "/login")).toBe(false);
    expect(sessionStorageMock.getItem("tk_active_phone")).toBeNull();

    resolveSetSession(undefined);
    const result = await applyPromise;
    expect(result).toEqual({ ok: true });
    expect(supabase.auth.setSession).toHaveBeenCalledWith({
      access_token: "access-token",
      refresh_token: "refresh-token",
    });
    expect(sessionStorageMock.getItem("tk_active_phone")).toBe("9876543210");
    expect(sessionStorageMock.getItem("tk_active_role")).toBe("owner");

    clearMarketingHandoffFromUrl();
    expect(historyCalls.some((call) => call.type === "replace" && call.url === "/owner/dashboard")).toBe(
      true,
    );
    expect(historyCalls.some((call) => call.url === "/login")).toBe(false);
  });

  it("on failure replaces the URL with /login and keeps a real error message", async () => {
    vi.mocked(supabase.auth.setSession).mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "invalid" },
    } as never);

    const pending = readPendingMarketingHandoff();
    expect(pending).not.toBeNull();
    const result = await applyMarketingHandoff(pending!);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");

    clearMarketingHandoffFromUrl();
    window.history.replaceState({}, "", "/login");
    sessionStorageMock.setItem("tk_marketing_handoff_error", result.error);

    expect(historyCalls.some((call) => call.url === "/login")).toBe(true);
    expect(sessionStorageMock.getItem("tk_marketing_handoff_error")).toBe(
      "Could not restore your session. Please log in again.",
    );
    expect(sessionStorageMock.getItem("tk_active_phone")).toBeNull();
  });
});
