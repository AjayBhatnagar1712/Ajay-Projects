import React, { useState, useRef } from "react";
import { AuthSignupScreenFooter } from "@/components/auth/AuthSignupScreenFooter";
import { authMobileScrollPadClass, authPrimaryButtonClass } from "@/components/auth/authStyles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";

interface Step4KYCProps {
  onComplete: () => void;
}

export default function Step4KYC({ onComplete }: Step4KYCProps) {
  const [uploads, setUploads] = useState<Record<string, string | null>>({
    pan: null,
    aadhaarFront: null,
    aadhaarBack: null,
    cheque: null,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentUploadKey, setCurrentUploadKey] = useState<string | null>(null);

  const handleUploadClick = (key: string) => {
    setCurrentUploadKey(key);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && currentUploadKey) {
      const url = URL.createObjectURL(file);
      setUploads(prev => ({ ...prev, [currentUploadKey]: url }));
    }
    // reset
    if (fileInputRef.current) fileInputRef.current.value = '';
    setCurrentUploadKey(null);
  };

  const removeUpload = (key: string) => {
    setUploads(prev => ({ ...prev, [key]: null }));
  };

  const isComplete = uploads.pan && uploads.aadhaarFront && uploads.aadhaarBack;

  const UploadCard = ({ title, uploadKey, required = false }: { title: string, uploadKey: string, required?: boolean }) => {
    const url = uploads[uploadKey];

    if (url) {
      return (
        <div className="space-y-2 flex-1">
          <Label className="text-gray-700">{title}{required && "*"}</Label>
          <div className="relative rounded-xl border border-gray-200 bg-white p-3 flex items-center justify-between shadow-sm overflow-hidden h-24">
            <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: `url(${url})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
            <div className="flex items-center gap-3 z-10">
              <div className="w-12 h-12 rounded bg-gray-100 overflow-hidden flex-shrink-0 border border-gray-200">
                <img src={url} alt="preview" className="w-full h-full object-cover" />
              </div>
              <div className="truncate">
                <p className="font-medium text-gray-900 truncate">Uploaded File</p>
                <p className="text-xs text-gray-500">Image</p>
              </div>
            </div>
            <button 
              onClick={() => removeUpload(uploadKey)}
              className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors z-10"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-2 flex-1">
        <Label className="text-gray-700">{title}{required && "*"}</Label>
        <button 
          onClick={() => handleUploadClick(uploadKey)}
          className="w-full rounded-xl border-2 border-dashed border-gray-300 hover:border-primary/50 hover:bg-gray-50 transition-colors p-4 flex flex-col items-center justify-center text-center h-24"
        >
          <div className="flex items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-50 text-primary flex items-center justify-center">
              <Plus size={18} />
            </div>
            <span className="text-sm text-gray-500">Click to upload (pdf, png, jpeg)</span>
          </div>
        </button>
      </div>
    );
  };

  return (
    <div className={`flex flex-col h-full max-w-2xl ${authMobileScrollPadClass}`}>
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900">Business & KYC Details</h1>
      </div>

      <input 
        type="file" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*,.pdf" 
      />

      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="rera" className="text-gray-700">RERA Number (optional)</Label>
            <Input id="rera" placeholder="Placeholder" className="bg-white" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gst" className="text-gray-700">GST Number (optional)</Label>
            <Input id="gst" placeholder="Placeholder" className="bg-white" />
          </div>
        </div>

        <UploadCard title="Pan Card" uploadKey="pan" required />

        <div className="space-y-2">
          <Label className="text-gray-700">Aadhaar Card*</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <UploadCard title="Front" uploadKey="aadhaarFront" />
            <UploadCard title="Back" uploadKey="aadhaarBack" />
          </div>
        </div>

        <UploadCard title="Cancelled Cheque (optional)" uploadKey="cheque" />
      </div>

      <AuthSignupScreenFooter
        cta={
          <Button
            size="lg"
            onClick={onComplete}
            disabled={!isComplete}
            className={authPrimaryButtonClass}
          >
            Continue
          </Button>
        }
        showTerms={false}
        linkType="login"
        persistRole={sessionStorage.getItem("tk_pending_role") || undefined}
      />
    </div>
  );
}
