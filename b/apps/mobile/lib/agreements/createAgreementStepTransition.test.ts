import { describe, expect, it, vi } from "vitest";
import { navigateCreateAgreementStep as navigateDefault } from "./createAgreementStepTransition";
import { navigateCreateAgreementStep as navigateAndroid } from "./createAgreementStepTransition.android";

describe("create-agreement step transition", () => {
  it("replaces the current step by default", () => {
    const push = vi.fn();
    const replace = vi.fn();

    navigateDefault({ push, replace } as never, "/(create-agreement)/owners");

    expect(replace).toHaveBeenCalledWith("/(create-agreement)/owners");
    expect(push).not.toHaveBeenCalled();
  });

  it("pushes on Android to avoid Fabric duplicate-parent crashes", () => {
    const push = vi.fn();
    const replace = vi.fn();

    navigateAndroid({ push, replace } as never, "/(create-agreement)/owners");

    expect(push).toHaveBeenCalledWith("/(create-agreement)/owners");
    expect(replace).not.toHaveBeenCalled();
  });
});
