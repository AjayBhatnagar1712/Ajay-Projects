import { useEffect, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { authPrimaryButtonClass } from "@/components/auth/authStyles";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addPropertyMaintenanceTicket } from "@/lib/ownerPropertyMaintenance";
import {
  TENANT_REPAIR_CATEGORIES,
  type TenantRepairCategory,
} from "@/lib/tenantRepairs";
import { cn } from "@/lib/utils";

export interface TenantRaiseComplaintModalProps {
  open: boolean;
  propertyId: string | null;
  propertyLabel: string;
  onClose: () => void;
  onSubmitted: () => void;
}

export function TenantRaiseComplaintModal({
  open,
  propertyId,
  propertyLabel,
  onClose,
  onSubmitted,
}: TenantRaiseComplaintModalProps) {
  const [category, setCategory] = useState<TenantRepairCategory>(TENANT_REPAIR_CATEGORIES[0]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onClose, submitting]);

  useEffect(() => {
    if (open) return;
    setCategory(TENANT_REPAIR_CATEGORIES[0]);
    setTitle("");
    setDescription("");
    setImages([]);
    setError(null);
    setSubmitting(false);
  }, [open]);

  if (!open) return null;

  const onPickImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const maxSelectable = 5 - images.length;
    const picked = Array.from(files).slice(0, maxSelectable);
    const dataUrls = await Promise.all(
      picked.map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result ?? ""));
            reader.onerror = () => reject(new Error("Failed to read image"));
            reader.readAsDataURL(file);
          }),
      ),
    );
    setImages((prev) => [...prev, ...dataUrls.filter(Boolean)]);
  };

  const handleSubmit = async () => {
    if (!propertyId) {
      setError("Your rental property is not linked yet. Complete onboarding to raise a complaint.");
      return;
    }
    if (!title.trim() || !description.trim()) {
      setError("Add a short title and description for this maintenance issue.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      addPropertyMaintenanceTicket({
        propertyId,
        category,
        title: title.trim(),
        description: description.trim(),
        images,
      });
      onSubmitted();
      onClose();
    } catch {
      setError("Could not log your maintenance request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300"
      role="presentation"
      onClick={() => {
        if (!submitting) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md relative animate-in zoom-in-95 fade-in duration-300"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tenant-raise-complaint-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 disabled:opacity-50"
          aria-label="Close"
        >
          <X size={16} className="text-gray-600" />
        </button>

        <div className="p-6 pt-8">
          <h3
            id="tenant-raise-complaint-title"
            className="text-lg font-semibold text-[#192839] mb-1 text-center"
          >
            Raise Complaint
          </h3>
          <p className="text-sm text-[#40566d] mb-5 text-center line-clamp-2">{propertyLabel}</p>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="tenant-repair-category"
                className="block text-sm text-[#161b3d] tracking-wide mb-1.5"
              >
                Category*
              </label>
              <select
                id="tenant-repair-category"
                value={category}
                onChange={(event) => setCategory(event.target.value as TenantRepairCategory)}
                className="w-full h-10 px-3 rounded border border-primary/20 bg-[#f8fafc] text-sm text-[#192839] focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {TENANT_REPAIR_CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="tenant-repair-title"
                className="block text-sm text-[#161b3d] tracking-wide mb-1.5"
              >
                Title*
              </label>
              <input
                id="tenant-repair-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Kitchen tap leakage"
                className="w-full h-10 px-3 rounded border border-primary/20 bg-[#f8fafc] text-sm text-[#192839] focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label
                htmlFor="tenant-repair-description"
                className="block text-sm text-[#161b3d] tracking-wide mb-1.5"
              >
                Description*
              </label>
              <Textarea
                id="tenant-repair-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                placeholder="Describe the issue in detail…"
                className="min-h-[96px] rounded border-primary/20 bg-[#f1f5fa] text-sm text-[#192839] shadow-none resize-none focus-visible:ring-primary/20"
              />
            </div>

            <div>
              <p className="block text-sm text-[#161b3d] tracking-wide mb-1.5">Upload Images</p>
              <label className="h-10 px-3 rounded border border-dashed border-primary/30 text-sm text-primary font-medium flex items-center gap-2 cursor-pointer hover:bg-primary/5">
                <ImagePlus size={16} />
                Upload or click image
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    void onPickImages(event.target.files);
                    event.target.value = "";
                  }}
                />
              </label>
              {images.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {images.map((img, idx) => (
                    <div
                      key={`${img.slice(0, 16)}-${idx}`}
                      className="relative aspect-square rounded-md overflow-hidden border border-gray-200"
                    >
                      <img src={img} alt={`Maintenance ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/55 text-white flex items-center justify-center"
                        aria-label="Remove image"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {error ? (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 mt-6">
            <Button
              type="button"
              className={cn(authPrimaryButtonClass, "flex-1 h-12 text-base font-normal sm:order-2")}
              disabled={submitting}
              onClick={() => void handleSubmit()}
            >
              {submitting ? "Submitting…" : "Log Maintenance"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-12 rounded border-primary text-primary text-base font-normal hover:bg-primary/5 sm:order-1"
              disabled={submitting}
              onClick={onClose}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
