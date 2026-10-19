import React, { useEffect, useMemo, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OwnerFlowButton } from "@/components/owner/OwnerFlowButton";
import { addPropertyMaintenanceTicket } from "@/lib/ownerPropertyMaintenance";
import { toast } from "@/hooks/use-toast";
import { getProperties, getPropertyTitle } from "@/lib/properties";
import { getOwnerName } from "@/components/OwnerLayout";

const CATEGORIES = [
  "Plumbing",
  "Electrical",
  "Painting",
  "Cleaning",
  "Appliance",
  "Structural",
  "Other",
];

export function RaiseComplaintModal({
  propertyId,
  propertyLabel,
  open,
  onClose,
  onSubmitted,
}: {
  propertyId?: string;
  propertyLabel?: string;
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState(propertyId ?? "");
  const [images, setImages] = useState<string[]>([]);

  useEffect(() => {
    if (propertyId) setSelectedPropertyId(propertyId);
  }, [propertyId]);

  const ownerName = getOwnerName().replace("!", "").trim().toLowerCase();
  const ownerProperties = useMemo(
    () =>
      getProperties().filter(
        (p) => p.uploadedBy === "owner" || (p.ownerName ?? "").trim().toLowerCase() === ownerName,
      ),
    [ownerName],
  );
  const hasFixedProperty = Boolean(propertyId);
const resolvedPropertyId = hasFixedProperty ? propertyId! : selectedPropertyId;

const resolvedProperty =
  ownerProperties.find((p) => p.id === resolvedPropertyId);

const resolvedPropertyLabel =
  propertyLabel ||
  (resolvedProperty
    ? getPropertyTitle(resolvedProperty)
    : "Select property");
  if (!open) return null;

  const reset = () => {
    setTitle("");
    setDescription("");
    setCategory(CATEGORIES[0]);
    setImages([]);
    if (!hasFixedProperty) setSelectedPropertyId("");
  };

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

  const submit = () => {
    if (!resolvedPropertyId) {
      toast({
        title: "Select property",
        description: "Please choose a property before logging maintenance.",
        variant: "destructive",
      });
      return;
    }
    if (!title.trim() || !description.trim()) {
      toast({
        title: "Missing details",
        description: "Add a short title and description for this maintenance issue.",
        variant: "destructive",
      });
      return;
    }
    addPropertyMaintenanceTicket({
      propertyId: resolvedPropertyId,
      category,
      title: title.trim(),
      description: description.trim(),
      images,
    });
    reset();
    toast({ title: "Maintenance logged", description: "Your maintenance issue has been recorded." });
    onSubmitted();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
          aria-label="Close"
        >
          <X size={16} className="text-gray-600" />
        </button>
        <div className="p-6 pt-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Log maintenance</h3>
          <p className="text-sm text-gray-500 mb-5 line-clamp-2">{resolvedPropertyLabel}</p>
          <div className="space-y-4">
            {!hasFixedProperty && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Property</label>
                <select
                  value={selectedPropertyId}
                  onChange={(e) => setSelectedPropertyId(e.target.value)}
                  className={`w-full h-10 px-3 rounded-lg border border-gray-300 text-sm text-gray-900 bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 ${
                    !selectedPropertyId ? "text-gray-400" : ""
                  }`}
                >
                  <option value="">Select property</option>
                  {ownerProperties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {getPropertyTitle(p)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {hasFixedProperty && (
              <p className="text-sm text-gray-500 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                {resolvedPropertyLabel}
              </p>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm text-gray-900 bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Kitchen tap leakage"
                className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Describe the issue in detail…"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm resize-none focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Upload Images</label>
              <label className="h-10 px-3 rounded-lg border border-dashed border-gray-300 text-sm text-primary font-medium flex items-center gap-2 cursor-pointer hover:bg-blue-50/40">
                <ImagePlus size={16} />
                Upload or click image
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    void onPickImages(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              {images.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {images.map((img, idx) => (
                    <div key={`${img.slice(0, 16)}-${idx}`} className="relative aspect-square rounded-md overflow-hidden border border-gray-200">
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
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 mt-6">
            <OwnerFlowButton type="button" className="flex-1 sm:order-2" onClick={submit}>
              Log Maintenance
            </OwnerFlowButton>
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-10 rounded-[4px] text-sm font-semibold sm:order-1"
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
