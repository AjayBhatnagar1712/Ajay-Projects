import { describe, expect, it } from "vitest";
import {
  decodeMarketingSessionHash,
  encodeMarketingSessionHash,
} from "./marketingSessionHandoff";

describe("marketingSessionHandoff", () => {
  it("round-trips session tokens in the hash", () => {
    const hash = encodeMarketingSessionHash({
      access_token: "token-a",
      refresh_token: "token-r",
    });
    expect(decodeMarketingSessionHash(hash)).toEqual({
      access_token: "token-a",
      refresh_token: "token-r",
    });
  });
});
