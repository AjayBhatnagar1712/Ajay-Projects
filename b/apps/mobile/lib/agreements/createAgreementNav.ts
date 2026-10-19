import type { Href, Router } from "expo-router";
import { replaceRoot } from "../navigation/replaceRoot";
import {
  clearCreateAgreementStepReplaceAnimation,
  setCreateAgreementReplaceAnimation,
  type CreateAgreementReplaceAnimation,
} from "./createAgreementReplaceAnimation";
import {
  navigateCreateAgreementStep,
  type CreateAgreementStepRouter,
} from "./createAgreementStepTransition";
import { endPreviewEditAutosaveSession } from "./previewEditAutosaveRegistry";
import { clearPreviewEditSnapshot } from "./previewEditSession";

/**
 * Where the broker opened create-agreement from this session.
 * Propagated as the `entry` search param on every step so Back can exit
 * to the real origin after walking back through steps 5→1.
 */
export type CreateAgreementEntry = "home" | "agreements";

export type CreateAgreementStep = 1 | 2 | 3 | 4 | 5;

export function parseCreateAgreementEntry(
  raw: string | string[] | undefined,
): CreateAgreementEntry {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "agreements" ? "agreements" : "home";
}

export function createAgreementEntryHref(
  entry: CreateAgreementEntry,
): "/(tabs)/home" | "/(tabs)/agreements" {
  return entry === "agreements" ? "/(tabs)/agreements" : "/(tabs)/home";
}

/** Label for leaving create/preview flows back to the entry tab. */
export function backToEntryLabel(entry: CreateAgreementEntry): string {
  return entry === "agreements" ? "Back to agreements" : "Back to home";
}

export function createAgreementStepPath(
  step: CreateAgreementStep,
):
  | "/(create-agreement)/property"
  | "/(create-agreement)/owners"
  | "/(create-agreement)/tenants"
  | "/(create-agreement)/inventory"
  | "/(create-agreement)/terms" {
  if (step === 1) return "/(create-agreement)/property";
  if (step === 2) return "/(create-agreement)/owners";
  if (step === 3) return "/(create-agreement)/tenants";
  if (step === 4) return "/(create-agreement)/inventory";
  return "/(create-agreement)/terms";
}

/**
 * Snapshot Edit-draft session origin. Distinct route flags so Cancel / Step 1
 * Back return to the right screen — never conflate Preview with Review.
 * Omitted on Home / Agreements / resume (standard create).
 */
export type CreateAgreementEditOrigin = "preview" | "review";

export type CreateAgreementRouteParams = {
  agreementId?: string;
  entry: CreateAgreementEntry;
  /** Set only for Preview → Edit draft. */
  fromPreview?: string;
  /** Set only for agreement-detail Review screen → Edit draft. */
  fromReview?: string;
};

export function parseFromPreviewFlag(
  raw: string | string[] | undefined,
): boolean {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "1";
}

export function parseFromReviewFlag(
  raw: string | string[] | undefined,
): boolean {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "1";
}

/**
 * Preview and Review flags are mutually exclusive. If both were set (should
 * not happen), Preview wins so the existing Preview path stays intact.
 */
export function parseCreateAgreementEditOrigin(params: {
  fromPreview?: string | string[];
  fromReview?: string | string[];
}): CreateAgreementEditOrigin | undefined {
  if (parseFromPreviewFlag(params.fromPreview)) return "preview";
  if (parseFromReviewFlag(params.fromReview)) return "review";
  return undefined;
}

export function isSnapshotEditOrigin(
  origin: CreateAgreementEditOrigin | undefined,
): origin is CreateAgreementEditOrigin {
  return origin === "preview" || origin === "review";
}

/**
 * Build params for create-agreement routes. Always includes `entry` so Back
 * can exit to Home vs Agreements after the last in-flow step.
 * `fromPreview` / `fromReview` are omitted unless this session started from
 * that screen's Edit draft — never both.
 */
export function createAgreementParams(
  entry: CreateAgreementEntry,
  agreementId?: string,
  editOrigin?: CreateAgreementEditOrigin,
): CreateAgreementRouteParams {
  const params: CreateAgreementRouteParams = agreementId
    ? { agreementId, entry }
    : { entry };
  if (editOrigin === "preview") params.fromPreview = "1";
  if (editOrigin === "review") params.fromReview = "1";
  return params;
}

/**
 * Enter the flow from a tab/detail screen (pushes onto the root stack).
 */
export function pushCreateAgreementStep(
  router: Pick<Router, "push">,
  step: CreateAgreementStep,
  entry: CreateAgreementEntry,
  agreementId?: string,
  editOrigin?: CreateAgreementEditOrigin,
): void {
  router.push({
    pathname: createAgreementStepPath(step),
    params: createAgreementParams(entry, agreementId, editOrigin),
  });
}

/**
 * Move between steps inside the flow without relying on native Back.
 *
 * Resume jumps straight to step N with only [tabs → step N] on the stack.
 * Using `back()` there would pop to the tab (Home/Agreements) and skip
 * earlier steps.
 *
 * iOS/web replace the current step. Android pushes because Fabric can crash
 * while re-parenting mounted form views during a native-stack replace.
 */
export function replaceCreateAgreementStep(
  router: CreateAgreementStepRouter,
  step: CreateAgreementStep,
  entry: CreateAgreementEntry,
  agreementId: string,
  editOrigin?: CreateAgreementEditOrigin,
): void {
  replaceCreateAgreementStepWithAnimation(
    router,
    step,
    entry,
    agreementId,
    "push",
    editOrigin,
  );
}

function replaceCreateAgreementStepWithAnimation(
  router: CreateAgreementStepRouter,
  step: CreateAgreementStep,
  entry: CreateAgreementEntry,
  agreementId: string,
  animation: CreateAgreementReplaceAnimation,
  editOrigin?: CreateAgreementEditOrigin,
): void {
  setCreateAgreementReplaceAnimation(animation);
  navigateCreateAgreementStep(router, {
    pathname: createAgreementStepPath(step),
    params: createAgreementParams(entry, agreementId, editOrigin),
  });
}

/**
 * In-flow Back for steps 2–5: previous create-agreement step (same draft + entry).
 */
export function goToPreviousCreateStep(
  router: CreateAgreementStepRouter,
  step: 2 | 3 | 4 | 5,
  entry: CreateAgreementEntry,
  agreementId: string,
  editOrigin?: CreateAgreementEditOrigin,
): void {
  const previous = (step - 1) as CreateAgreementStep;
  replaceCreateAgreementStepWithAnimation(
    router,
    previous,
    entry,
    agreementId,
    "pop",
    editOrigin,
  );
}

/**
 * Leave create-agreement to the tab the broker entered from.
 * Clears any leftover Back-pop so this root exit is not a step transition.
 */
export function exitCreateAgreementToEntry(
  router: Router,
  entry: CreateAgreementEntry,
): void {
  clearCreateAgreementStepReplaceAnimation();
  replaceRoot(router, createAgreementEntryHref(entry) as Href);
}

/**
 * Complete a newly-created agreement flow with a clean stack:
 * entry tab -> agreement detail. This prevents Back from exposing wizard steps.
 */
export function completeCreateAgreementToDetail(
  router: Router,
  agreementId: string,
  entry: CreateAgreementEntry,
): void {
  clearCreateAgreementStepReplaceAnimation();
  replaceRoot(router, createAgreementEntryHref(entry) as Href);
  router.push({
    pathname: "/agreements/[agreementId]",
    params: { agreementId },
  });
}

/**
 * End a Preview → Edit draft session: drop the create-agreement step and
 * return to Preview. Prefers `back()` so the existing Preview screen (under
 * the push) is reused; falls back to replace if the stack was rebuilt.
 */
export function returnToAgreementPreview(
  router: Router,
  agreementId: string,
  entry: CreateAgreementEntry,
): void {
  clearCreateAgreementStepReplaceAnimation();
  clearPreviewEditSnapshot(agreementId);
  endPreviewEditAutosaveSession(agreementId);
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace({
    pathname: "/agreements/[agreementId]/preview",
    params: { agreementId, entry },
  });
}

/**
 * End a Review-screen → Edit draft session: drop the create-agreement step
 * and return to agreement detail. Prefers `back()` so the existing detail
 * screen (under the push) is reused.
 */
export function returnToAgreementDetail(
  router: Router,
  agreementId: string,
): void {
  clearCreateAgreementStepReplaceAnimation();
  clearPreviewEditSnapshot(agreementId);
  endPreviewEditAutosaveSession(agreementId);
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace({
    pathname: "/agreements/[agreementId]",
    params: { agreementId },
  });
}

/** Cancel / Step 1 Back destination for a snapshot Edit-draft session. */
export function returnToCreateAgreementEditOrigin(
  router: Router,
  agreementId: string,
  entry: CreateAgreementEntry,
  origin: CreateAgreementEditOrigin,
): void {
  if (origin === "preview") {
    returnToAgreementPreview(router, agreementId, entry);
    return;
  }
  returnToAgreementDetail(router, agreementId);
}
