import { beforeEach, describe, it, expect, vi } from "vitest";
import {
  appendPropertyImagesFromFiles,
  dataUrlByteLength,
  normalizePropertyImages,
  preparePropertyImagesForStorage,
  propertyImagesEqual,
} from "./propertyMedia";

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

beforeEach(() => {
  vi.stubGlobal("localStorage", createMemoryStorage());
  vi.stubGlobal("sessionStorage", createMemoryStorage());
});

describe("normalizePropertyImages", () => {
  it("deduplicates and caps images", () => {
    const urls = ["a", "b", "a", "c", "d", "e", "f"];
    const result = normalizePropertyImages(urls);
    expect(result.images).toEqual(["a", "b", "c", "d", "e"]);
    expect(result.imageCount).toBe(5);
  });
});

describe("propertyImagesEqual", () => {
  it("treats duplicate entries as equal", () => {
    expect(propertyImagesEqual(["a", "b"], ["a", "a", "b"])).toBe(true);
  });
});

describe("appendPropertyImagesFromFiles", () => {
  it("skips non-image files", async () => {
    const textFile = new File(["hello"], "notes.txt", { type: "text/plain" });
    const result = await appendPropertyImagesFromFiles([textFile], ["existing"]);
    expect(result.images).toEqual(["existing"]);
    expect(result.failedCount).toBe(1);
  });
});

describe("dataUrlByteLength", () => {
  it("estimates decoded bytes from base64 payload", () => {
    const dataUrl = "data:image/png;base64,QUJD";
    expect(dataUrlByteLength(dataUrl)).toBe(3);
  });
});

describe("preparePropertyImagesForStorage", () => {
  it("returns normalized images in node test environment", async () => {
    const images = ["data:image/jpeg;base64,abc", "data:image/jpeg;base64,def"];
    const prepared = await preparePropertyImagesForStorage(images);
    expect(prepared.imageCount).toBe(2);
    expect(prepared.images).toHaveLength(2);
  });
});
