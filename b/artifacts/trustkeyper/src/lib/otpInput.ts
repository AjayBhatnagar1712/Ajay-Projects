import type { Dispatch, KeyboardEvent, SetStateAction } from "react";
import { OTP_LAST_INDEX } from "./otp";

function focusOtpInput(prefix: string, index: number): void {
  document.getElementById(`${prefix}-${index}`)?.focus();
}

export function handleOtpKeyDown(
  index: number,
  e: KeyboardEvent<HTMLInputElement>,
  otp: string[],
  setOtp: Dispatch<SetStateAction<string[]>>,
  inputIdPrefix: string,
  onSubmit?: () => void,
): void {
  if (e.key === "Enter") {
    const isComplete = otp.every((d) => d.length === 1);
    if (isComplete && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
    return;
  }
  if (e.key === "Backspace") {
    if (otp[index]) {
      const next = [...otp];
      next[index] = "";
      setOtp(next);
      e.preventDefault();
    } else if (index > 0) {
      focusOtpInput(inputIdPrefix, index - 1);
      e.preventDefault();
    }
  } else if (e.key === "ArrowLeft" && index > 0) {
    focusOtpInput(inputIdPrefix, index - 1);
    e.preventDefault();
  } else if (e.key === "ArrowRight" && index < OTP_LAST_INDEX) {
    focusOtpInput(inputIdPrefix, index + 1);
    e.preventDefault();
  }
}
