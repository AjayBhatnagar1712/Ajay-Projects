import { afterEach, describe, expect, it, vi } from "vitest";
import {
  backToEntryLabel,
  createAgreementEntryHref,
  createAgreementParams,
  createAgreementStepPath,
  completeCreateAgreementToDetail,
  exitCreateAgreementToEntry,
  goToPreviousCreateStep,
  parseCreateAgreementEditOrigin,
  parseCreateAgreementEntry,
  parseFromPreviewFlag,
  parseFromReviewFlag,
  pushCreateAgreementStep,
  replaceCreateAgreementStep,
  returnToAgreementDetail,
  returnToAgreementPreview,
  returnToCreateAgreementEditOrigin,
} from "./createAgreementNav";
import {
  clearCreateAgreementStepReplaceAnimation,
  peekCreateAgreementReplaceAnimation,
  setCreateAgreementReplaceAnimation,
} from "./createAgreementReplaceAnimation";

afterEach(() => {
  clearCreateAgreementStepReplaceAnimation();
});

describe("parseCreateAgreementEntry", () => {
  it("parses agreements; defaults everything else to home", () => {
    expect(parseCreateAgreementEntry("agreements")).toBe("agreements");
    expect(parseCreateAgreementEntry(["agreements"])).toBe("agreements");
    expect(parseCreateAgreementEntry("home")).toBe("home");
    expect(parseCreateAgreementEntry(undefined)).toBe("home");
    expect(parseCreateAgreementEntry("nope")).toBe("home");
    expect(parseCreateAgreementEntry("preview")).toBe("home");
  });
});

describe("parseFromPreviewFlag", () => {
  it("is true only for the Preview Edit draft param", () => {
    expect(parseFromPreviewFlag("1")).toBe(true);
    expect(parseFromPreviewFlag(["1"])).toBe(true);
    expect(parseFromPreviewFlag(undefined)).toBe(false);
    expect(parseFromPreviewFlag("home")).toBe(false);
    expect(parseFromPreviewFlag("true")).toBe(false);
  });
});

describe("parseFromReviewFlag", () => {
  it("is true only for the Review-screen Edit draft param", () => {
    expect(parseFromReviewFlag("1")).toBe(true);
    expect(parseFromReviewFlag(["1"])).toBe(true);
    expect(parseFromReviewFlag(undefined)).toBe(false);
    expect(parseFromReviewFlag("true")).toBe(false);
  });
});

describe("parseCreateAgreementEditOrigin", () => {
  it("is undefined for standard Home / resume entry", () => {
    expect(parseCreateAgreementEditOrigin({})).toBeUndefined();
    expect(
      parseCreateAgreementEditOrigin({ fromPreview: "0", fromReview: "0" }),
    ).toBeUndefined();
  });

  it("reads Preview and Review as distinct origins", () => {
    expect(parseCreateAgreementEditOrigin({ fromPreview: "1" })).toBe("preview");
    expect(parseCreateAgreementEditOrigin({ fromReview: "1" })).toBe("review");
  });

  it("does not treat a Review session as Preview", () => {
    expect(
      parseCreateAgreementEditOrigin({ fromReview: "1", fromPreview: undefined }),
    ).toBe("review");
  });

  it("keeps Preview if both flags were set", () => {
    expect(
      parseCreateAgreementEditOrigin({ fromPreview: "1", fromReview: "1" }),
    ).toBe("preview");
  });
});

describe("createAgreementParams", () => {
  it("omits origin flags on standard entry so resume/Home stay unchanged", () => {
    expect(createAgreementParams("home", "a1")).toEqual({
      agreementId: "a1",
      entry: "home",
    });
    expect(createAgreementParams("agreements")).toEqual({
      entry: "agreements",
    });
  });

  it("sets fromPreview=1 only for Preview Edit draft", () => {
    expect(createAgreementParams("agreements", "a1", "preview")).toEqual({
      agreementId: "a1",
      entry: "agreements",
      fromPreview: "1",
    });
  });

  it("sets fromReview=1 only for Review-screen Edit draft, never fromPreview", () => {
    expect(createAgreementParams("agreements", "a1", "review")).toEqual({
      agreementId: "a1",
      entry: "agreements",
      fromReview: "1",
    });
  });
});

describe("createAgreementEntryHref", () => {
  it("maps entry to the matching tab", () => {
    expect(createAgreementEntryHref("home")).toBe("/(tabs)/home");
    expect(createAgreementEntryHref("agreements")).toBe("/(tabs)/agreements");
  });
});

describe("backToEntryLabel", () => {
  it("labels the exit action from entry origin", () => {
    expect(backToEntryLabel("home")).toBe("Back to home");
    expect(backToEntryLabel("agreements")).toBe("Back to agreements");
  });
});

describe("createAgreementStepPath", () => {
  it("maps 5 steps Property → Owners → Tenants → Fixtures & Fittings → Agreement details", () => {
    expect(createAgreementStepPath(1)).toBe("/(create-agreement)/property");
    expect(createAgreementStepPath(2)).toBe("/(create-agreement)/owners");
    expect(createAgreementStepPath(3)).toBe("/(create-agreement)/tenants");
    expect(createAgreementStepPath(4)).toBe("/(create-agreement)/inventory");
    expect(createAgreementStepPath(5)).toBe("/(create-agreement)/terms");
  });
});

describe("goToPreviousCreateStep", () => {
  it("always replaces to the previous step — never router.back()", () => {
    const push = vi.fn();
    const replace = vi.fn();
    const back = vi.fn();
    goToPreviousCreateStep(
      { push, replace, back } as never,
      2,
      "home",
      "agreement-1",
    );
    expect(back).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith({
      pathname: "/(create-agreement)/property",
      params: { agreementId: "agreement-1", entry: "home" },
    });
  });

  it("sets pop replace animation so Back slides from the left", () => {
    goToPreviousCreateStep(
      { push: vi.fn(), replace: vi.fn() },
      3,
      "home",
      "agreement-1",
    );
    expect(peekCreateAgreementReplaceAnimation()).toBe("pop");
  });

  it("preserves agreements entry when stepping Tenants → Owners", () => {
    const push = vi.fn();
    const replace = vi.fn();
    goToPreviousCreateStep({ push, replace }, 3, "agreements", "agreement-1");
    expect(replace).toHaveBeenCalledWith({
      pathname: "/(create-agreement)/owners",
      params: { agreementId: "agreement-1", entry: "agreements" },
    });
  });

  it("preserves fromPreview when stepping back inside a Preview edit session", () => {
    const push = vi.fn();
    const replace = vi.fn();
    goToPreviousCreateStep(
      { push, replace },
      3,
      "agreements",
      "agreement-1",
      "preview",
    );
    expect(replace).toHaveBeenCalledWith({
      pathname: "/(create-agreement)/owners",
      params: {
        agreementId: "agreement-1",
        entry: "agreements",
        fromPreview: "1",
      },
    });
  });

  it("preserves fromReview when stepping back inside a Review edit session", () => {
    const push = vi.fn();
    const replace = vi.fn();
    goToPreviousCreateStep(
      { push, replace },
      3,
      "agreements",
      "agreement-1",
      "review",
    );
    expect(replace).toHaveBeenCalledWith({
      pathname: "/(create-agreement)/owners",
      params: {
        agreementId: "agreement-1",
        entry: "agreements",
        fromReview: "1",
      },
    });
  });

  it("Fixtures & Fittings Back goes to Tenants", () => {
    const push = vi.fn();
    const replace = vi.fn();
    goToPreviousCreateStep({ push, replace }, 4, "home", "agreement-1");
    expect(replace).toHaveBeenCalledWith({
      pathname: "/(create-agreement)/tenants",
      params: { agreementId: "agreement-1", entry: "home" },
    });
  });
});

describe("pushCreateAgreementStep", () => {
  it("does not attach origin flags for Home/resume entry", () => {
    const push = vi.fn();
    pushCreateAgreementStep({ push }, 5, "home", "a1");
    expect(push).toHaveBeenCalledWith({
      pathname: "/(create-agreement)/terms",
      params: { agreementId: "a1", entry: "home" },
    });
  });

  it("opens Property (step 1) with fromPreview for Preview Edit draft", () => {
    const push = vi.fn();
    pushCreateAgreementStep({ push }, 1, "agreements", "a1", "preview");
    expect(push).toHaveBeenCalledWith({
      pathname: "/(create-agreement)/property",
      params: {
        agreementId: "a1",
        entry: "agreements",
        fromPreview: "1",
      },
    });
  });

  it("opens Property (step 1) with fromReview for Review-screen Edit draft", () => {
    const push = vi.fn();
    pushCreateAgreementStep({ push }, 1, "agreements", "a1", "review");
    expect(push).toHaveBeenCalledWith({
      pathname: "/(create-agreement)/property",
      params: {
        agreementId: "a1",
        entry: "agreements",
        fromReview: "1",
      },
    });
  });
});

describe("replaceCreateAgreementStep", () => {
  it("includes entry on every in-flow navigation", () => {
    const push = vi.fn();
    const replace = vi.fn();
    replaceCreateAgreementStep({ push, replace }, 2, "home", "a1");
    expect(replace).toHaveBeenCalledWith({
      pathname: createAgreementStepPath(2),
      params: createAgreementParams("home", "a1"),
    });
  });

  it("sets push replace animation so Next slides from the right", () => {
    setCreateAgreementReplaceAnimation("pop");
    replaceCreateAgreementStep(
      { push: vi.fn(), replace: vi.fn() },
      3,
      "home",
      "a1",
    );
    expect(peekCreateAgreementReplaceAnimation()).toBe("push");
  });
});

describe("exitCreateAgreementToEntry", () => {
  it("clears leftover Back-pop before replaceRoot so Property Back is not a step pop", () => {
    setCreateAgreementReplaceAnimation("pop");
    const replace = vi.fn();
    exitCreateAgreementToEntry(
      { replace, canDismiss: () => false } as never,
      "home",
    );
    expect(peekCreateAgreementReplaceAnimation()).toBe("push");
    expect(replace).toHaveBeenCalledWith("/(tabs)/home");
  });
});

describe("completeCreateAgreementToDetail", () => {
  it("clears the wizard stack, restores the entry tab, then pushes detail", () => {
    const dismissAll = vi.fn();
    const replace = vi.fn();
    const push = vi.fn();
    completeCreateAgreementToDetail(
      {
        canDismiss: () => true,
        dismissAll,
        replace,
        push,
      } as never,
      "a1",
      "agreements",
    );
    expect(dismissAll).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledWith("/(tabs)/agreements");
    expect(push).toHaveBeenCalledWith({
      pathname: "/agreements/[agreementId]",
      params: { agreementId: "a1" },
    });
  });
});

describe("returnToAgreementPreview", () => {
  it("pops back to the Preview under the create-agreement push", () => {
    const back = vi.fn();
    const replace = vi.fn();
    returnToAgreementPreview(
      { back, replace, canGoBack: () => true } as never,
      "a1",
      "agreements",
    );
    expect(back).toHaveBeenCalledOnce();
    expect(replace).not.toHaveBeenCalled();
  });

  it("replaces to Preview when the stack cannot go back", () => {
    const back = vi.fn();
    const replace = vi.fn();
    returnToAgreementPreview(
      { back, replace, canGoBack: () => false } as never,
      "a1",
      "home",
    );
    expect(back).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith({
      pathname: "/agreements/[agreementId]/preview",
      params: { agreementId: "a1", entry: "home" },
    });
  });
});

describe("returnToAgreementDetail", () => {
  it("pops back to the Review screen under the create-agreement push", () => {
    const back = vi.fn();
    const replace = vi.fn();
    returnToAgreementDetail(
      { back, replace, canGoBack: () => true } as never,
      "a1",
    );
    expect(back).toHaveBeenCalledOnce();
    expect(replace).not.toHaveBeenCalled();
  });

  it("replaces to agreement detail, never Preview, when the stack cannot go back", () => {
    const back = vi.fn();
    const replace = vi.fn();
    returnToAgreementDetail(
      { back, replace, canGoBack: () => false } as never,
      "a1",
    );
    expect(back).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith({
      pathname: "/agreements/[agreementId]",
      params: { agreementId: "a1" },
    });
  });
});

describe("returnToCreateAgreementEditOrigin", () => {
  it("sends Preview origin to Preview, not detail", () => {
    const back = vi.fn();
    const replace = vi.fn();
    returnToCreateAgreementEditOrigin(
      { back, replace, canGoBack: () => false } as never,
      "a1",
      "agreements",
      "preview",
    );
    expect(replace).toHaveBeenCalledWith({
      pathname: "/agreements/[agreementId]/preview",
      params: { agreementId: "a1", entry: "agreements" },
    });
  });

  it("sends Review origin to detail, not Preview", () => {
    const back = vi.fn();
    const replace = vi.fn();
    returnToCreateAgreementEditOrigin(
      { back, replace, canGoBack: () => false } as never,
      "a1",
      "agreements",
      "review",
    );
    expect(replace).toHaveBeenCalledWith({
      pathname: "/agreements/[agreementId]",
      params: { agreementId: "a1" },
    });
  });
});
