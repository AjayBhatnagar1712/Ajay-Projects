import React, { useEffect, useRef, useState } from "react";
import OwnerLayout from "@/components/OwnerLayout";
import { PaymentMethodOrDivider, ProfileSectionHeader } from "@/components/profile/ProfileSectionHeader";
import {
  User,
  Phone,
  Landmark,
  CreditCard,
  Check,
  ChevronDown,
  Upload,
  Trash2,
  FileText,
  AlertTriangle,
  QrCode,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { createEmptyOtp, OTP_LAST_INDEX } from "@/lib/otp";
import {
  clearOwnerProfileBank,
  clearOwnerProfileUpi,
  getOwnerProfile,
  hasOwnerBankDetails,
  hasOwnerUpiDetails,
  hasProfilePaymentDetails,
  removeOwnerProfileDocument,
  saveOwnerProfile,
  saveOwnerProfileBank,
  saveOwnerProfileDocument,
  saveOwnerProfileUpiDetails,
  type OwnerDocumentKind,
  type OwnerProfile,
} from "@/lib/ownerProfile";
import { getFileTypeError, isValidAccountNumber, isValidIFSC } from "@/lib/fileValidation";
import { isValidUpiId, sanitizeUpiInput } from "@/lib/upi";

const BANK_NAMES = [
  "State Bank of India", "HDFC Bank", "ICICI Bank", "Axis Bank", "Kotak Mahindra Bank",
  "Punjab National Bank", "Bank of Baroda", "Canara Bank", "Union Bank of India",
  "IndusInd Bank", "Yes Bank", "IDFC First Bank", "Federal Bank", "South Indian Bank",
  "RBL Bank", "Bandhan Bank", "UCO Bank", "Indian Bank", "Central Bank of India",
  "Bank of India", "Other",
];

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").slice(0, 10);
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-medium text-gray-600 mb-1">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function TextInput({
  value, onChange, placeholder, type = "text", disabled,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full h-9 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-gray-50 disabled:text-gray-500 transition-colors"
    />
  );
}

function OtpVerifyModal({
  phone,
  onVerified,
  onClose,
}: {
  phone: string;
  onVerified: () => void;
  onClose: () => void;
}) {
  const [otp, setOtp] = useState(createEmptyOtp);
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleOtpChange = (index: number, value: string) => {
    const v = value.replace(/\D/g, "").slice(0, 1);
    const next = [...otp];
    next[index] = v;
    setOtp(next);
    if (v && index < OTP_LAST_INDEX) {
      document.getElementById(`profile-otp-${index + 1}`)?.focus();
    }
  };

  const complete = otp.every((d) => d !== "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Verify phone number</h3>
        <p className="text-sm text-gray-500 mb-5">
          Enter the OTP sent to <span className="font-semibold text-gray-800">+91 {phone}</span>
        </p>
        <div className="grid grid-cols-6 gap-2 sm:gap-3 mb-4 w-full max-w-md mx-auto">
          {otp.map((digit, i) => (
            <input
              key={i}
              id={`profile-otp-${i}`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleOtpChange(i, e.target.value)}
              className={`w-full h-11 sm:h-12 text-center text-xl font-medium rounded-lg border outline-none transition-colors
                ${digit ? "bg-[#E8F5EE] border-accent border-b-4" : "bg-white border-gray-300 focus:border-primary"}`}
            />
          ))}
        </div>
        <p className="text-sm text-gray-600 text-center mb-5">
          Didn&apos;t receive the OTP?{" "}
          {countdown > 0 ? (
            <span className="font-medium text-primary">Resend in {countdown}s</span>
          ) : (
            <button type="button" onClick={() => setCountdown(30)} className="font-medium text-primary hover:underline">
              Resend OTP
            </button>
          )}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="button"
            disabled={!complete}
            onClick={() => {
              toast({ title: "Phone verified", description: "Your contact number has been updated." });
              onVerified();
            }}
            className="flex-1 h-10 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Verify & Save
          </button>
        </div>
      </div>
    </div>
  );
}

function DocumentRow({
  label,
  meta,
  onUpload,
  onDelete,
}: {
  label: string;
  meta?: { fileName?: string; fileSize?: number; uploadedAt?: number };
  onUpload: (file: File) => void;
  onDelete: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const uploaded = !!meta?.fileName;

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border px-4 py-3 ${uploaded ? "bg-white border-gray-200" : "bg-amber-50/40 border-amber-100"}`}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <FileText size={18} className={uploaded ? "text-green-500" : "text-amber-500"} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">{label}</p>
          {uploaded ? (
            <p className="text-xs text-gray-500 truncate">{meta?.fileName}</p>
          ) : (
            <p className="text-xs text-amber-700">Not uploaded yet</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1 text-xs bg-primary text-white rounded-lg px-3 py-1.5 font-medium hover:bg-primary/90 transition-colors"
        >
          <Upload size={11} /> {uploaded ? "Re-upload" : "Upload"}
        </button>
        {uploaded && (
          <button
            type="button"
            onClick={onDelete}
            className="flex items-center gap-1 text-xs text-red-500 border border-red-100 rounded-lg px-2.5 py-1.5 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={11} /> Delete
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

export default function OwnerProfile() {
  const [profile, setProfile] = useState<OwnerProfile>(() => getOwnerProfile());
  const [editingBasic, setEditingBasic] = useState(false);
  const [editingBank, setEditingBank] = useState(false);
  const [editingUPI, setEditingUPI] = useState(false);
  const [draftBasic, setDraftBasic] = useState({ name: profile.name, phone: profile.phone });
  const [draftBank, setDraftBank] = useState({
    bankHolderName: profile.bankHolderName,
    bankName: profile.bankName,
    bankAccountNumber: profile.bankAccountNumber,
    bankIFSC: profile.bankIFSC,
  });
  const [draftUPI, setDraftUPI] = useState({
    upiId: profile.upiId,
    upiQrFileName: profile.upiQrFileName,
  });
  const [otpPhone, setOtpPhone] = useState<string | null>(null);
  const [confirmDeleteBank, setConfirmDeleteBank] = useState(false);
  const [confirmDeleteUpi, setConfirmDeleteUpi] = useState(false);
  const qrRef = useRef<HTMLInputElement>(null);

  const savedBasic = !!(profile.name && profile.phone);
  const savedBank = hasOwnerBankDetails();
  const savedUPI = hasOwnerUpiDetails();
  const savedPayment = hasProfilePaymentDetails(profile);
  const savedAadhaar = !!profile.aadhaar?.fileName;
  const savedPan = !!profile.pan?.fileName;

  const persistProfile = (next: OwnerProfile) => {
    setProfile(next);
    saveOwnerProfile(next);
  };

  const commitBasic = (phone: string) => {
    const next = { ...profile, name: draftBasic.name.trim(), phone: normalizePhone(phone) };
    if (!next.name || next.phone.length !== 10) {
      toast({ title: "Missing details", description: "Enter your name and a valid 10-digit phone number.", variant: "destructive" });
      return;
    }
    persistProfile(next);
    setEditingBasic(false);
    toast({ title: "Profile updated", description: "Your basic details have been saved." });
  };

  const saveBasic = () => {
    const newPhone = normalizePhone(draftBasic.phone);
    const oldPhone = normalizePhone(profile.phone);
    if (!draftBasic.name.trim() || newPhone.length !== 10) {
      toast({ title: "Missing details", description: "Enter your name and a valid 10-digit phone number.", variant: "destructive" });
      return;
    }
    if (newPhone !== oldPhone) {
      setOtpPhone(newPhone);
      return;
    }
    commitBasic(newPhone);
  };

  const cancelBasic = () => {
    setDraftBasic({ name: profile.name, phone: profile.phone });
    setEditingBasic(false);
  };

  const saveBank = () => {
    if (!draftBank.bankHolderName || !draftBank.bankName || !draftBank.bankAccountNumber || !draftBank.bankIFSC) {
      toast({ title: "Incomplete bank details", description: "Fill all required bank fields.", variant: "destructive" });
      return;
    }
    if (!isValidAccountNumber(draftBank.bankAccountNumber)) {
      toast({ title: "Invalid account number", description: "Account number must be 9–18 digits.", variant: "destructive" });
      return;
    }
    if (!isValidIFSC(draftBank.bankIFSC)) {
      toast({ title: "Invalid IFSC code", description: "Invalid IFSC code (e.g. HDFC0001234).", variant: "destructive" });
      return;
    }
    saveOwnerProfileBank({
      holderName: draftBank.bankHolderName,
      bankName: draftBank.bankName,
      accountNumber: draftBank.bankAccountNumber,
      ifscCode: draftBank.bankIFSC,
    });
    const next = getOwnerProfile();
    setProfile(next);
    setDraftBank({
      bankHolderName: next.bankHolderName,
      bankName: next.bankName,
      bankAccountNumber: next.bankAccountNumber,
      bankIFSC: next.bankIFSC,
    });
    setEditingBank(false);
    toast({ title: "Bank details saved", description: "Used automatically when you generate agreements." });
  };

  const cancelBank = () => {
    setDraftBank({
      bankHolderName: profile.bankHolderName,
      bankName: profile.bankName,
      bankAccountNumber: profile.bankAccountNumber,
      bankIFSC: profile.bankIFSC,
    });
    setEditingBank(false);
  };

  const saveUPI = () => {
    const upiId = draftUPI.upiId.trim();
    const hasQr = !!draftUPI.upiQrFileName?.trim();
    if (!upiId && !hasQr) {
      toast({ title: "UPI details required", description: "Enter a valid UPI ID or upload a QR code.", variant: "destructive" });
      return;
    }
    if (upiId && !isValidUpiId(upiId)) {
      toast({ title: "Invalid UPI ID", description: "Enter a valid UPI ID (e.g. name@bank).", variant: "destructive" });
      return;
    }
    saveOwnerProfileUpiDetails({ upiId, upiQrFileName: draftUPI.upiQrFileName });
    const next = getOwnerProfile();
    setProfile(next);
    setDraftUPI({ upiId: next.upiId, upiQrFileName: next.upiQrFileName });
    setEditingUPI(false);
    toast({ title: "UPI details saved", description: "Used automatically when you generate agreements." });
  };

  const cancelUPI = () => {
    setDraftUPI({ upiId: profile.upiId, upiQrFileName: profile.upiQrFileName });
    setEditingUPI(false);
  };

  const handleDocUpload = (kind: OwnerDocumentKind, file: File) => {
    const error = getFileTypeError(file);
    if (error) {
      toast({ title: "Invalid file", description: error, variant: "destructive" });
      return;
    }
    saveOwnerProfileDocument(kind, file, {
      onSuccess: () => {
        setProfile(getOwnerProfile());
        toast({
          title: "Document uploaded",
          description: `${kind === "aadhaar" ? "Aadhaar" : "PAN"} card saved to your profile.`,
        });
      },
      onError: (message) => {
        toast({ title: "Could not save document", description: message, variant: "destructive" });
      },
    });
  };

  const handleDocDelete = (kind: OwnerDocumentKind) => {
    removeOwnerProfileDocument(kind);
    setProfile(getOwnerProfile());
    toast({ title: "Document removed" });
  };

  const deleteBank = () => {
    clearOwnerProfileBank();
    const next = getOwnerProfile();
    setProfile(next);
    setDraftBank({ bankHolderName: "", bankName: "", bankAccountNumber: "", bankIFSC: "" });
    setConfirmDeleteBank(false);
    setEditingBank(false);
    toast({ title: "Bank details removed" });
  };

  const deleteUpi = () => {
    clearOwnerProfileUpi();
    const next = getOwnerProfile();
    setProfile(next);
    setDraftUPI({ upiId: "", upiQrFileName: "" });
    setConfirmDeleteUpi(false);
    setEditingUPI(false);
    toast({ title: "UPI details removed" });
  };

  return (
    <OwnerLayout>
      <div className="p-6 sm:p-10 max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">My Profile</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your contact details, identity documents, and bank information. Details from agreement generation are saved here automatically.
          </p>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <ProfileSectionHeader
              icon={User}
              title="Basic Details"
              editing={editingBasic}
              saved={savedBasic}
              onEdit={() => setEditingBasic(true)}
              onSave={saveBasic}
              onCancel={cancelBasic}
            />
            <div className="px-5 py-4">
              {editingBasic ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel required>Full Name</FieldLabel>
                    <TextInput value={draftBasic.name} onChange={(v) => setDraftBasic((d) => ({ ...d, name: v }))} placeholder="Your full name" />
                  </div>
                  <div>
                    <FieldLabel required>Phone Number</FieldLabel>
                    <TextInput
                      type="tel"
                      value={draftBasic.phone}
                      onChange={(v) => setDraftBasic((d) => ({ ...d, phone: v.replace(/\D/g, "").slice(0, 10) }))}
                      placeholder="10-digit number"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">OTP verification is required when you change your phone number.</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                  <div className="flex items-start gap-2">
                    <User size={14} className="text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Full Name</p>
                      <p className="text-sm font-medium text-gray-800">{profile.name || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Phone size={14} className="text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Phone</p>
                      <p className="text-sm font-medium text-gray-800">{profile.phone ? `+91 ${profile.phone}` : "—"}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <ProfileSectionHeader
              icon={FileText}
              title="Documents"
              editing={false}
              saved={savedAadhaar && savedPan}
            />
            <div className="px-5 py-4 space-y-3">
              <p className="text-xs text-gray-500 mb-2">
                Upload Aadhaar and PAN here, or they will be saved when you upload them during agreement generation.
              </p>
              <DocumentRow
                label="Aadhaar Card"
                meta={profile.aadhaar}
                onUpload={(f) => handleDocUpload("aadhaar", f)}
                onDelete={() => handleDocDelete("aadhaar")}
              />
              <DocumentRow
                label="PAN Card"
                meta={profile.pan}
                onUpload={(f) => handleDocUpload("pan", f)}
                onDelete={() => handleDocDelete("pan")}
              />
            </div>
          </div>

          {!savedPayment && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Add payment details</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Save your bank or UPI details once and they will be pre-filled when you generate rental agreements.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-0">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <ProfileSectionHeader
              icon={Landmark}
              title="Bank Details"
              editing={editingBank}
              saved={savedBank}
              onEdit={() => setEditingBank(true)}
              onSave={saveBank}
              onCancel={cancelBank}
              onDelete={() => setConfirmDeleteBank(true)}
            />
            <div className="px-5 py-4">
              {editingBank ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel required>Account Holder Name</FieldLabel>
                    <TextInput value={draftBank.bankHolderName} onChange={(v) => setDraftBank((d) => ({ ...d, bankHolderName: v }))} placeholder="Full name on account" />
                  </div>
                  <div>
                    <FieldLabel required>Bank Name</FieldLabel>
                    <div className="relative">
                      <select
                        value={draftBank.bankName}
                        onChange={(e) => setDraftBank((d) => ({ ...d, bankName: e.target.value }))}
                        className={`w-full h-9 px-3 pr-7 rounded-lg border border-gray-300 text-sm text-gray-900 appearance-none focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-white ${!draftBank.bankName ? "text-gray-400" : ""}`}
                      >
                        <option value=""></option>
                        {BANK_NAMES.map((b) => <option key={b} value={b}>{b}</option>)}
                      </select>
                      <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <FieldLabel required>Account Number</FieldLabel>
                    <TextInput value={draftBank.bankAccountNumber} onChange={(v) => setDraftBank((d) => ({ ...d, bankAccountNumber: v }))} placeholder="Enter account number" />
                    {draftBank.bankAccountNumber && !isValidAccountNumber(draftBank.bankAccountNumber) ? (
                      <p className="text-xs text-red-500 mt-1">Account number must be 9–18 digits</p>
                    ) : null}
                  </div>
                  <div>
                    <FieldLabel required>IFSC Code</FieldLabel>
                    <TextInput value={draftBank.bankIFSC} onChange={(v) => setDraftBank((d) => ({ ...d, bankIFSC: v.toUpperCase() }))} placeholder="e.g. SBIN0001234" />
                    {draftBank.bankIFSC && !isValidIFSC(draftBank.bankIFSC) ? (
                      <p className="text-xs text-red-500 mt-1">Invalid IFSC code (e.g. HDFC0001234)</p>
                    ) : null}
                  </div>
                </div>
              ) : profile.bankName ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                  {[
                    { icon: User, label: "Account Holder", value: profile.bankHolderName || "—" },
                    { icon: Landmark, label: "Bank", value: profile.bankName },
                    { icon: CreditCard, label: "Account Number", value: profile.bankAccountNumber ? `••••${profile.bankAccountNumber.slice(-4)}` : "—" },
                    { icon: CreditCard, label: "IFSC Code", value: profile.bankIFSC || "—" },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-start gap-2">
                      <Icon size={14} className="text-gray-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
                        <p className="text-sm font-medium text-gray-800">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingBank(true)}
                  className="w-full h-16 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center gap-2 text-sm text-gray-400 hover:border-primary/40 hover:text-primary transition-colors"
                >
                  <Landmark size={16} /> Add bank account details
                </button>
              )}
            </div>
          </div>

          <PaymentMethodOrDivider />

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <ProfileSectionHeader
              icon={QrCode}
              title="UPI Details"
              editing={editingUPI}
              saved={savedUPI}
              onEdit={() => setEditingUPI(true)}
              onSave={saveUPI}
              onCancel={cancelUPI}
              onDelete={() => setConfirmDeleteUpi(true)}
            />
            <div className="px-5 py-4">
              {editingUPI ? (
                <div className="space-y-4">
                  <div>
                    <FieldLabel>UPI ID</FieldLabel>
                    <TextInput
                      value={draftUPI.upiId}
                      onChange={(v) => setDraftUPI((d) => ({ ...d, upiId: sanitizeUpiInput(v) }))}
                      placeholder="yourname@bank"
                    />
                  </div>
                  <p className="text-xs text-gray-400 text-center font-medium">OR</p>
                  <div>
                    <FieldLabel>QR Code</FieldLabel>
                    <button
                      type="button"
                      onClick={() => qrRef.current?.click()}
                      className="w-full h-20 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1.5 hover:border-primary/50 hover:bg-gray-50 transition-colors"
                    >
                      {draftUPI.upiQrFileName ? (
                        <>
                          <Check size={16} className="text-green-500" />
                          <span className="text-xs text-green-600 font-medium">{draftUPI.upiQrFileName}</span>
                        </>
                      ) : (
                        <>
                          <Upload size={16} className="text-gray-400" />
                          <span className="text-xs text-gray-500">Upload QR Code image or PDF</span>
                        </>
                      )}
                    </button>
                    <input
                      ref={qrRef}
                      type="file"
                      accept=".pdf,.png,.jpeg,.jpg"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          setDraftUPI((d) => ({ ...d, upiQrFileName: e.target.files![0].name }));
                        }
                      }}
                    />
                  </div>
                </div>
              ) : (profile.upiId || profile.upiQrFileName) ? (
                <div className="space-y-3">
                  {profile.upiId && (
                    <div className="flex items-start gap-2">
                      <QrCode size={14} className="text-gray-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">UPI ID</p>
                        <p className="text-sm font-medium text-gray-800">{profile.upiId}</p>
                      </div>
                    </div>
                  )}
                  {profile.upiQrFileName && (
                    <div className="flex items-start gap-2">
                      <QrCode size={14} className="text-gray-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">QR Code</p>
                        <p className="text-sm font-medium text-green-600 flex items-center gap-1">
                          <Check size={12} />
                          {profile.upiQrFileName}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingUPI(true)}
                  className="w-full h-16 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center gap-2 text-sm text-gray-400 hover:border-primary/40 hover:text-primary transition-colors"
                >
                  <QrCode size={16} /> Add UPI ID or QR Code
                </button>
              )}
            </div>
          </div>
          </div>
        </div>
      </div>

      {otpPhone && (
        <OtpVerifyModal
          phone={otpPhone}
          onClose={() => setOtpPhone(null)}
          onVerified={() => {
            commitBasic(otpPhone);
            setOtpPhone(null);
          }}
        />
      )}

      {confirmDeleteBank && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <AlertTriangle size={28} className="text-amber-500 mx-auto mb-3" />
            <p className="font-semibold text-gray-900 mb-1">Delete bank details?</p>
            <p className="text-sm text-gray-500 mb-5">You can add them again anytime from this page or during agreement generation.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmDeleteBank(false)} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-600">
                Cancel
              </button>
              <button type="button" onClick={deleteBank} className="flex-1 h-10 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmDeleteUpi && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <AlertTriangle size={28} className="text-amber-500 mx-auto mb-3" />
            <p className="font-semibold text-gray-900 mb-1">Delete UPI details?</p>
            <p className="text-sm text-gray-500 mb-5">You can add them again anytime from this page or during agreement generation.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmDeleteUpi(false)} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-600">
                Cancel
              </button>
              <button type="button" onClick={deleteUpi} className="flex-1 h-10 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </OwnerLayout>
  );
}
