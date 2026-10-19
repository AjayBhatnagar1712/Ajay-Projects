import { describe, expect, it } from "vitest";
import { MIN_ICON_BUTTON_TOUCH_PT } from "./iconButtonTouchTarget";
import {
  QUANTITY_STEPPER_BUTTON,
  QUANTITY_STEPPER_PILL_HEIGHT,
  QUANTITY_STEPPER_PILL_INSET,
} from "./quantityStepperChrome";

describe("QuantityStepper chrome", () => {
  it("keeps +/− circles at the 44pt minimum touch target", () => {
    expect(QUANTITY_STEPPER_BUTTON).toBe(MIN_ICON_BUTTON_TOUCH_PT);
  });

  it("uses a true pill (radius = height / 2), same rule as Button and RecordsSearchField", () => {
    expect(QUANTITY_STEPPER_PILL_HEIGHT).toBe(
      QUANTITY_STEPPER_BUTTON + QUANTITY_STEPPER_PILL_INSET * 2,
    );
    expect(QUANTITY_STEPPER_PILL_HEIGHT / 2).toBe(26);
  });
});
