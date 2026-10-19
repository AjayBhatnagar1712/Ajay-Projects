import re
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
TARGET = REPO / "artifacts/trustkeyper/src/components/BrokerForm.tsx"

content = subprocess.check_output(
    ["git", "-C", str(REPO), "show", "c4a201c:artifacts/trustkeyper/src/components/BrokerForm.tsx"],
    text=True,
)

content = re.sub(
    r"\n    if \(next\.every\(\(d\) => d !== \"\"\)\) \{.*?      \}, 300\);\n    \}",
    "",
    content,
    count=1,
    flags=re.DOTALL,
)

handler = """
  const isOtpComplete = otp.every((d) => d !== "");

  const handleContinue = () => {
    if (!isOtpComplete) return;
    const pending = sessionStorage.getItem("tk_pending_role") || "broker";
    const role = (ALL_ROLES.includes(pending as Role) ? pending : "broker") as Role;
    if (profileExists(phoneDigits, role)) {
      toast({
        title: "An account already exists for this number.",
        variant: "destructive",
      });
      setOtp(createEmptyOtp());
      return;
    }
    signUpSuccess(phoneDigits, role, {
      name: fullName,
      firm,
      phone: phoneDigits,
      email: "",
      bankHolderName: "",
      bankName: "",
      bankAccountNumber: "",
      bankIFSC: "",
      upiId: "",
      upiQrFileName: "",
    });
    onComplete?.();
    setLocation(dashboardRouteFor(role));
  };

"""

if "const isOtpComplete" not in content:
    content = content.replace(
        "  const handleOtpChange = (index: number, value: string) => {",
        handler + "  const handleOtpChange = (index: number, value: string) => {",
        1,
    )
    content = content.replace(
        "      const el = document.getElementById(`broker-otp-${index + 1}`);\n      el?.focus();",
        "      document.getElementById(`broker-otp-${index + 1}`)?.focus();",
    )

d = "div"
otp_ui = f"""      {{otpStage && (
        <>
          <{d} className="mb-8">
            <p className="text-gray-600 mb-4">
              Enter the OTP that we have sent to{{" "}}
              <span className="font-semibold text-gray-900">+91 {{phoneDigits}}</span>
            </p>

            <{d} className="flex gap-4 mb-6">
              {{otp.map((d, i) => (
                <input
                  key={{i}}
                  id={{`broker-otp-${{i}}`}}
                  type="text"
                  inputMode="numeric"
                  maxLength={{1}}
                  value={{d}}
                  onChange={{(e) => handleOtpChange(i, e.target.value)}}
                  className={{`w-14 h-14 text-center text-xl font-medium rounded-lg border outline-none transition-colors
                    ${{
                      d
                        ? "bg-[#E8F5EE] border-accent border-b-4"
                        : "bg-white border-gray-300 focus:border-primary"
                    }}`}}
                />
              ))}}
            </{d}>

            <p className="text-sm text-gray-600">
              Didn&apos;t receive the verification OTP?{{" "}}
              {{countdown > 0 ? (
                <span className="font-medium text-[#2563EB]">Resend otp in {{countdown}}s</span>
              ) : (
                <button
                  type="button"
                  onClick={{() => setCountdown(10)}}
                  className="font-medium text-[#2563EB] hover:underline"
                >
                  Resend otp
                </button>
              )}}
            </p>
          </{d}>

          <{d} className="hidden sm:block">
            <Button
              size="lg"
              onClick={{handleContinue}}
              disabled={{!isOtpComplete}}
              className="w-48 bg-primary hover:bg-primary/90 mb-6"
            >
              Continue &rarr;
            </Button>

            <p className="text-sm text-gray-500">
              By continuing, you agree to TrustKeyper{{" "}}
              <a href="#" className="text-accent hover:underline">
                Terms and Conditions
              </a>
            </p>
          </{d}>

          <{d} className="sm:hidden fixed inset-x-0 bottom-0 z-40 bg-white border-t border-gray-200 p-4 shadow-[0_-12px_28px_rgba(15,23,42,0.08)] safe-area-bottom">
            <Button
              size="lg"
              onClick={{handleContinue}}
              disabled={{!isOtpComplete}}
              className="w-full bg-primary hover:bg-primary/90"
            >
              Continue &rarr;
            </Button>
          </{d}>
        </>
      )}}"""

# f-string doubled braces produce single braces in output for JSX
content = re.sub(
    r"      \{otpStage && \(.*?\n      \)\}",
    otp_ui,
    content,
    count=1,
    flags=re.DOTALL,
)

TARGET.write_text(content, encoding="utf-8", newline="\n")
print("Patched", TARGET)
