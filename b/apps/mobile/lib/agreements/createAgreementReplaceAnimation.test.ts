import { afterEach, describe, expect, it } from "vitest";
import {
  clearCreateAgreementStepReplaceAnimation,
  peekCreateAgreementReplaceAnimation,
  setCreateAgreementReplaceAnimation,
} from "./createAgreementReplaceAnimation";

afterEach(() => {
  clearCreateAgreementStepReplaceAnimation();
});

describe("createAgreementReplaceAnimation", () => {
  it("defaults to push (forward replace)", () => {
    expect(peekCreateAgreementReplaceAnimation()).toBe("push");
  });

  it("stores pop for in-flow Back until cleared", () => {
    setCreateAgreementReplaceAnimation("pop");
    expect(peekCreateAgreementReplaceAnimation()).toBe("pop");
    clearCreateAgreementStepReplaceAnimation();
    expect(peekCreateAgreementReplaceAnimation()).toBe("push");
  });
});
