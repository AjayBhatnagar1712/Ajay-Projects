import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const scriptPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "assert-static-expo-public-env.mjs",
);

describe("assert-static-expo-public-env", () => {
  it("passes for the current apps/mobile tree", () => {
    const output = execFileSync(process.execPath, [scriptPath], {
      encoding: "utf8",
    });
    expect(output).toContain("ok");
  });
});
