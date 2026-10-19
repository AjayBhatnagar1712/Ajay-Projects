import React, { useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import { FlowSegmentTabs } from "@/components/FlowSegmentTabs";
import { getOwnerProfile, saveOwnerProfile } from "@/lib/ownerProfile";
import { isValidUpiId, sanitizeUpiInput } from "@/lib/upi";
import { isValidAccountNumber, isValidIFSC } from "@/lib/fileValidation";

export type BankDetailsData =
  | {
      mode: "bank";
      holderName: string;
      bankName: string;
      accountNumber: string;
      ifscCode: string;
      upiId?: string;
      upiQrFileName?: string;
    }
  | {
      mode: "upi";
      holderName?: string;
      bankName?: string;
      accountNumber?: string;
      ifscCode?: string;
      upiId: string;
      upiQrFileName?: string;
    };

export const BANK_NAMES = [
  "State Bank of India",
  "HDFC Bank",
  "ICICI Bank",
  "Axis Bank",
  "Kotak Mahindra Bank",
  "Punjab National Bank",
  "Bank of Baroda",
  "Canara Bank",
  "Union Bank of India",
  "IndusInd Bank",
  "Yes Bank",
] as const;

export function BankDetailsModal({
  onSave,
  onClose,
  prefillOwnerProfile = false,
  title = "Add Bank Details",
}: {
  onSave: (data: BankDetailsData) => void;
  onClose: () => void;
  prefillOwnerProfile?: boolean;
  title?: string;
}) {
  const saved = prefillOwnerProfile ? getOwnerProfile() : null;
  const defaultTab: "bank" | "upi" =
    saved?.upiId && !(saved.bankAccountNumber && saved.bankIFSC) ? "upi" : "bank";
  const [tab, setTab] = useState<"bank" | "upi">(defaultTab);
  const [holderName, setHolderName] = useState(saved?.bankHolderName ?? "");
  const [bankName, setBankName] = useState(saved?.bankName ?? "");
  const [accountNumber, setAccountNumber] = useState(saved?.bankAccountNumber ?? "");
  const [confirmAccountNumber, setConfirmAccountNumber] = useState(saved?.bankAccountNumber ?? "");
  const [ifscCode, setIfscCode] = useState(saved?.bankIFSC ?? "");
  const [upiId, setUpiId] = useState(saved?.upiId ?? "");
  const qrRef = useRef<HTMLInputElement>(null);
  const [qrFile, setQrFile] = useState(saved?.upiQrFileName ?? "");

  const accountsMatch =
    accountNumber.length > 0 && accountNumber === confirmAccountNumber;
  const bankValid = !!(
    holderName &&
    bankName &&
    accountNumber &&
    ifscCode &&
    accountsMatch &&
    isValidAccountNumber(accountNumber) &&
    isValidIFSC(ifscCode)
  );
  const upiIdValid = isValidUpiId(upiId);
  const upiValid = upiIdValid || !!qrFile;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md relative max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
        >
          <X size={14} className="text-gray-600" />
        </button>
        <div className="px-6 pt-6 pb-2 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900 text-center mb-5">{title}</h3>
          <FlowSegmentTabs
            value={tab}
            onChange={(v) => setTab(v)}
            options={[
              { value: "bank", label: "Bank account" },
              { value: "upi", label: "UPI" },
            ]}
            className="mx-auto"
          />
        </div>

        <div className="px-6 py-5 space-y-4">
          {tab === "bank" ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Account Holder Name*</label>
                  <input
                    value={holderName}
                    onChange={(e) => setHolderName(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Bank Name*</label>
                  <div className="relative">
                    <select
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className={`w-full h-9 px-3 pr-7 rounded-lg border border-gray-300 text-sm text-gray-900 appearance-none focus:outline-none focus:border-primary bg-white ${!bankName ? "text-gray-400" : ""}`}
                    >
                      <option value=""></option>
                      {BANK_NAMES.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Account Number*</label>
                  <input
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  {accountNumber && !isValidAccountNumber(accountNumber) ? (
                    <p className="text-[11px] text-red-500 mt-1">Enter a valid account number</p>
                  ) : null}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Confirm Account Number*</label>
                  <input
                    value={confirmAccountNumber}
                    onChange={(e) => setConfirmAccountNumber(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  {confirmAccountNumber && !accountsMatch ? (
                    <p className="text-[11px] text-red-500 mt-1">Account numbers do not match</p>
                  ) : null}
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">IFSC Code*</label>
                  <input
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                    className="w-full h-9 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  {ifscCode && !isValidIFSC(ifscCode) ? (
                    <p className="text-[11px] text-red-500 mt-1">Enter a valid IFSC code</p>
                  ) : null}
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">UPI ID</label>
                <input
                  value={upiId}
                  onChange={(e) => setUpiId(sanitizeUpiInput(e.target.value))}
                  placeholder="name@upi"
                  className="w-full h-9 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => qrRef.current?.click()}
                  className="w-full h-20 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1.5 hover:border-primary/50 hover:bg-gray-50 transition-colors"
                >
                  {qrFile ? (
                    <>
                      <Check size={18} className="text-green-500" />
                      <span className="text-xs text-green-600 font-medium">QR uploaded: {qrFile}</span>
                    </>
                  ) : (
                    <>
                      <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                        <Plus size={12} className="text-gray-600" />
                      </div>
                      <span className="text-xs text-gray-600">Upload QR Code</span>
                      <span className="text-[10px] text-gray-400">(pdf, png, jpeg)</span>
                    </>
                  )}
                </button>
                <input
                  ref={qrRef}
                  type="file"
                  accept=".pdf,.png,.jpeg,.jpg"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) setQrFile(e.target.files[0].name);
                  }}
                />
              </div>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              if (tab === "bank" ? bankValid : upiValid) {
                onSave({
                  mode: tab,
                  holderName,
                  bankName,
                  accountNumber,
                  ifscCode,
                  upiId,
                  upiQrFileName: qrFile || undefined,
                } as BankDetailsData);
                if (prefillOwnerProfile && tab === "upi" && qrFile) {
                  saveOwnerProfile({ ...getOwnerProfile(), upiQrFileName: qrFile });
                }
              }
            }}
            disabled={tab === "bank" ? !bankValid : !upiValid}
            className={`flex items-center justify-center gap-2 w-full h-10 rounded-xl text-sm font-semibold transition-colors ${(tab === "bank" ? bankValid : upiValid) ? "bg-primary text-white hover:bg-primary/90" : "bg-gray-200 text-gray-400 cursor-not-allowed"}`}
          >
            Continue <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
