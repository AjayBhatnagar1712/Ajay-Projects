import React, { useState, useRef, useEffect } from "react";
import BrokerLayout from "@/components/BrokerLayout";
import { PaymentMethodOrDivider, ProfileSectionHeader } from "@/components/profile/ProfileSectionHeader";
import { getBrokerProfile, saveBrokerProfile } from "@/lib/brokerProfile";
import type { BrokerProfile } from "@/lib/brokerProfile";
import {
  hasProfileBankDetails,
  hasProfileUpiDetails,
} from "@/lib/ownerProfile";
import { isValidUpiId, sanitizeUpiInput } from "@/lib/upi";
import { toast } from "@/hooks/use-toast";
import {
  User, Building2, Phone, Mail, CreditCard, Landmark, QrCode, Check,
  ChevronDown, Upload, Trash2, AlertTriangle,
} from "lucide-react";

const BANK_NAMES = [
  "State Bank of India", "HDFC Bank", "ICICI Bank", "Axis Bank", "Kotak Mahindra Bank",
  "Punjab National Bank", "Bank of Baroda", "Canara Bank", "Union Bank of India",
  "IndusInd Bank", "Yes Bank", "IDFC First Bank", "Federal Bank", "South Indian Bank",
  "RBL Bank", "Bandhan Bank", "UCO Bank", "Indian Bank", "Central Bank of India",
  "Bank of India", "Other",
];

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

export default function BrokerSettings() {
  const [profile, setProfile] = useState<BrokerProfile>(getBrokerProfile);

  const [editingPersonal, setEditingPersonal] = useState(false);
  const [editingBank, setEditingBank] = useState(false);
  const [editingUPI, setEditingUPI] = useState(false);

  const [savedPersonal, setSavedPersonal] = useState(() => !!(getBrokerProfile().name));
  const [savedBank, setSavedBank] = useState(() => hasProfileBankDetails(getBrokerProfile()));
  const [savedUPI, setSavedUPI] = useState(() => hasProfileUpiDetails(getBrokerProfile()));
  const savedPayment = savedBank || savedUPI;

  const [draftPersonal, setDraftPersonal] = useState<Pick<BrokerProfile, "name" | "firm" | "phone" | "email">>({
    name: profile.name, firm: profile.firm, phone: profile.phone, email: profile.email,
  });
  const [draftBank, setDraftBank] = useState<Pick<BrokerProfile, "bankHolderName" | "bankName" | "bankAccountNumber" | "bankIFSC">>({
    bankHolderName: profile.bankHolderName, bankName: profile.bankName,
    bankAccountNumber: profile.bankAccountNumber, bankIFSC: profile.bankIFSC,
  });
  const [draftUPI, setDraftUPI] = useState<Pick<BrokerProfile, "upiId" | "upiQrFileName">>({
    upiId: profile.upiId, upiQrFileName: profile.upiQrFileName,
  });

  const qrRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraftPersonal({ name: profile.name, firm: profile.firm, phone: profile.phone, email: profile.email });
    setDraftBank({ bankHolderName: profile.bankHolderName, bankName: profile.bankName, bankAccountNumber: profile.bankAccountNumber, bankIFSC: profile.bankIFSC });
    setDraftUPI({ upiId: profile.upiId, upiQrFileName: profile.upiQrFileName });
  }, []);

  const savePersonal = () => {
    const updated = { ...profile, ...draftPersonal };
    setProfile(updated); saveBrokerProfile(updated);
    setEditingPersonal(false); setSavedPersonal(true);
  };
  const cancelPersonal = () => {
    setDraftPersonal({ name: profile.name, firm: profile.firm, phone: profile.phone, email: profile.email });
    setEditingPersonal(false);
  };

  const saveBank = () => {
    const updated = { ...profile, ...draftBank };
    setProfile(updated); saveBrokerProfile(updated);
    setEditingBank(false);
    setSavedBank(hasProfileBankDetails(draftBank));
  };
  const cancelBank = () => {
    setDraftBank({ bankHolderName: profile.bankHolderName, bankName: profile.bankName, bankAccountNumber: profile.bankAccountNumber, bankIFSC: profile.bankIFSC });
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
    const updated = { ...profile, ...draftUPI, upiId };
    setProfile(updated);
    saveBrokerProfile(updated);
    setEditingUPI(false);
    setSavedUPI(hasProfileUpiDetails(updated));
  };
  const cancelUPI = () => {
    setDraftUPI({ upiId: profile.upiId, upiQrFileName: profile.upiQrFileName });
    setEditingUPI(false);
  };

  const [confirmDelete, setConfirmDelete] = useState<"bank" | "upi" | null>(null);
  const confirmAndDelete = () => {
    if (confirmDelete === "bank") {
      const updated = { ...profile, bankHolderName: "", bankName: "", bankAccountNumber: "", bankIFSC: "" };
      setProfile(updated); saveBrokerProfile(updated);
      setDraftBank({ bankHolderName: "", bankName: "", bankAccountNumber: "", bankIFSC: "" });
      setSavedBank(false);
    } else if (confirmDelete === "upi") {
      const updated = { ...profile, upiId: "", upiQrFileName: "" };
      setProfile(updated); saveBrokerProfile(updated);
      setDraftUPI({ upiId: "", upiQrFileName: "" });
      setSavedUPI(false);
    }
    setConfirmDelete(null);
  };

  return (
    <BrokerLayout>
      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your profile and payment details</p>
        </div>

        <div className="space-y-4">
          {/* ── Personal Information ── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <ProfileSectionHeader
              icon={User} title="Personal Information"
              editing={editingPersonal} saved={savedPersonal}
              onEdit={() => setEditingPersonal(true)}
              onSave={savePersonal} onCancel={cancelPersonal}
            />
            <div className="px-5 py-4">
              {editingPersonal ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel required>Full Name</FieldLabel>
                    <TextInput value={draftPersonal.name} onChange={(v) => setDraftPersonal((d) => ({ ...d, name: v }))} placeholder="Your full name" />
                  </div>
                  <div>
                    <FieldLabel>Brokerage Firm</FieldLabel>
                    <TextInput value={draftPersonal.firm} onChange={(v) => setDraftPersonal((d) => ({ ...d, firm: v }))} placeholder="e.g. ABC Realty" />
                  </div>
                  <div>
                    <FieldLabel required>Phone</FieldLabel>
                    <TextInput type="tel" value={draftPersonal.phone} onChange={(v) => setDraftPersonal((d) => ({ ...d, phone: v.replace(/\D/g, "").slice(0, 10) }))} placeholder="10-digit number" />
                  </div>
                  <div>
                    <FieldLabel>Email</FieldLabel>
                    <TextInput type="email" value={draftPersonal.email} onChange={(v) => setDraftPersonal((d) => ({ ...d, email: v }))} placeholder="you@example.com" />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                  {[
                    { icon: User, label: "Full Name", value: profile.name || "—" },
                    { icon: Building2, label: "Brokerage Firm", value: profile.firm || "Independent" },
                    { icon: Phone, label: "Phone", value: profile.phone ? `+91 ${profile.phone}` : "—" },
                    { icon: Mail, label: "Email", value: profile.email || "—" },
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
              )}
            </div>
          </div>

          {!savedPayment && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <div className="mt-0.5 w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center shrink-0">
                <span className="text-white text-xs font-semibold">!</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-800">Add payment details</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Save your bank or UPI details once and they&apos;ll be auto-filled every time you generate a rental agreement.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-0">
          {/* ── Bank Account ── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <ProfileSectionHeader
              icon={Landmark} title="Bank Account Details"
              editing={editingBank} saved={savedBank}
              onEdit={() => setEditingBank(true)}
              onSave={saveBank} onCancel={cancelBank}
              onDelete={() => setConfirmDelete("bank")}
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
                  </div>
                  <div>
                    <FieldLabel required>IFSC Code</FieldLabel>
                    <TextInput value={draftBank.bankIFSC} onChange={(v) => setDraftBank((d) => ({ ...d, bankIFSC: v.toUpperCase() }))} placeholder="e.g. SBIN0001234" />
                  </div>
                </div>
              ) : (
                <div>
                  {profile.bankName ? (
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
                      onClick={() => setEditingBank(true)}
                      className="w-full h-16 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center gap-2 text-sm text-gray-400 hover:border-primary/40 hover:text-primary transition-colors"
                    >
                      <Landmark size={16} /> Add bank account details
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <PaymentMethodOrDivider />

          {/* ── UPI Details ── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <ProfileSectionHeader
              icon={QrCode} title="UPI Details"
              editing={editingUPI} saved={savedUPI}
              onEdit={() => setEditingUPI(true)}
              onSave={saveUPI} onCancel={cancelUPI}
              onDelete={() => setConfirmDelete("upi")}
            />
            <div className="px-5 py-4">
              {editingUPI ? (
                <div className="space-y-4">
                  <div>
                    <FieldLabel>UPI ID</FieldLabel>
                    <TextInput value={draftUPI.upiId} onChange={(v) => setDraftUPI((d) => ({ ...d, upiId: sanitizeUpiInput(v) }))} placeholder="yourname@bank" />
                  </div>
                  <p className="text-xs text-gray-400 text-center font-medium">OR</p>
                  <div>
                    <FieldLabel>QR Code</FieldLabel>
                    <button
                      onClick={() => qrRef.current?.click()}
                      className="w-full h-20 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1.5 hover:border-primary/50 hover:bg-gray-50 transition-colors"
                    >
                      {draftUPI.upiQrFileName ? (
                        <><Check size={16} className="text-green-500" /><span className="text-xs text-green-600 font-medium">{draftUPI.upiQrFileName}</span></>
                      ) : (
                        <><Upload size={16} className="text-gray-400" /><span className="text-xs text-gray-500">Upload QR Code image or PDF</span></>
                      )}
                    </button>
                    <input ref={qrRef} type="file" accept=".pdf,.png,.jpeg,.jpg" className="hidden"
                      onChange={(e) => { if (e.target.files?.[0]) setDraftUPI((d) => ({ ...d, upiQrFileName: e.target.files![0].name })); }} />
                  </div>
                </div>
              ) : (
                <div>
                  {(profile.upiId || profile.upiQrFileName) ? (
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
                            <p className="text-sm font-medium text-green-600 flex items-center gap-1"><Check size={12} />{profile.upiQrFileName}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => setEditingUPI(true)}
                      className="w-full h-16 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center gap-2 text-sm text-gray-400 hover:border-primary/40 hover:text-primary transition-colors"
                    >
                      <QrCode size={16} /> Add UPI ID or QR Code
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-50 mx-auto mb-4">
              <AlertTriangle size={22} className="text-red-500" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 text-center mb-1">
              Delete {confirmDelete === "bank" ? "Bank Account" : "UPI"} Details?
            </h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              {confirmDelete === "bank"
                ? "Your saved bank account information will be removed. You'll need to re-enter it for future agreements."
                : "Your saved UPI ID and QR code will be removed. You'll need to re-enter them for future agreements."}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={confirmAndDelete} className="flex-1 h-10 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors">
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </BrokerLayout>
  );
}
