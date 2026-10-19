import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearPreviewEditAutosaveRegistry,
  endPreviewEditAutosaveSession,
  flushPreviewEditAutosaves,
  isPreviewEditDiscarding,
  markPreviewEditDiscarding,
  registerPreviewEditAutosave,
} from "./previewEditAutosaveRegistry";

afterEach(() => {
  clearPreviewEditAutosaveRegistry();
});

describe("previewEditAutosaveRegistry", () => {
  it("flushes every registered step, not only the last one", async () => {
    const property = vi.fn(async () => undefined);
    const owners = vi.fn(async () => undefined);
    const inventory = vi.fn(async () => undefined);
    registerPreviewEditAutosave("a1", "property", property);
    registerPreviewEditAutosave("a1", "owners", owners);
    registerPreviewEditAutosave("a1", "inventory", inventory);

    await flushPreviewEditAutosaves("a1");

    expect(property).toHaveBeenCalledOnce();
    expect(owners).toHaveBeenCalledOnce();
    expect(inventory).toHaveBeenCalledOnce();
  });

  it("does not flush another agreement's steps", async () => {
    const keep = vi.fn(async () => undefined);
    const other = vi.fn(async () => undefined);
    registerPreviewEditAutosave("a1", "owners", keep);
    registerPreviewEditAutosave("a2", "owners", other);

    await flushPreviewEditAutosaves("a1");

    expect(keep).toHaveBeenCalledOnce();
    expect(other).not.toHaveBeenCalled();
  });

  it("stops flushing a step after unregister", async () => {
    const owners = vi.fn(async () => undefined);
    const unregister = registerPreviewEditAutosave("a1", "owners", owners);
    unregister();

    await flushPreviewEditAutosaves("a1");

    expect(owners).not.toHaveBeenCalled();
  });

  it("tracks discarding so unmount flush can skip after Discard", () => {
    expect(isPreviewEditDiscarding("a1")).toBe(false);
    markPreviewEditDiscarding("a1");
    expect(isPreviewEditDiscarding("a1")).toBe(true);
    endPreviewEditAutosaveSession("a1");
    expect(isPreviewEditDiscarding("a1")).toBe(false);
  });
});
