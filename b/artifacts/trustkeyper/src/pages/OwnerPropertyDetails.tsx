import React, { useRef, useState, useEffect, useCallback } from "react";
import { useLocation, useRoute } from "wouter";
import {
  Eye,
  FileText,
  Trash2,
  Wrench,
  X,
  ExternalLink,
} from "lucide-react";
import OwnerLayout from "@/components/OwnerLayout";
import { FlowSegmentTabs } from "@/components/FlowSegmentTabs";
import { SharePropertyModal } from "@/components/owner/SharePropertyModal";
import { RaiseComplaintModal } from "@/components/owner/RaiseComplaintModal";
import { PropertyDetailImageGallery } from "@/components/property/PropertyDetailImageGallery";
import { PropertyDetailPageLayout } from "@/components/property/PropertyDetailPageLayout";
import { PropertyDetailSummaryCard } from "@/components/property/PropertyDetailSummaryCard";
import { OwnerPropertyOverviewPanel } from "@/components/property/OwnerPropertyOverviewPanel";
import { getProperties, getPropertyTitle, type Property } from "@/lib/properties";
import { getPropertyDetailTitle } from "@/lib/propertyDetailFormatters";
import { PROPERTIES_UPDATED_EVENT } from "@/lib/propertyEditValidation";
import {
  formatDocumentSize,
  getPropertyDocuments,
  addPropertyDocumentUpload,
  removePropertyDocumentUpload,
  type PropertyDocument,
} from "@/lib/ownerPropertyDocuments";
import {
  getMaintenanceTicketById,
  getPropertyMaintenanceTickets,
  MAINTENANCE_TICKETS_CHANGED,
  updateMaintenanceTicketStatus,
  type PropertyMaintenanceTicket,
} from "@/lib/ownerPropertyMaintenance";
import { MaintenanceTicketCard } from "@/components/owner/MaintenanceTicketCard";
import { MaintenanceTicketDetailsModal } from "@/components/owner/MaintenanceTicketDetailsModal";
import { OwnerFlowButton } from "@/components/owner/OwnerFlowButton";
import { toast } from "@/hooks/use-toast";

type TabId = "overview" | "documents" | "maintenance";

const TABS: { value: TabId; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "documents", label: "Documents" },
  { value: "maintenance", label: "Maintenance History" },
];

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function DocumentViewerModal({
  doc,
  onClose,
}: {
  doc: PropertyDocument | null;
  onClose: () => void;
}) {
  if (!doc) return null;
  const isPdf =
    doc.fileName.toLowerCase().endsWith(".pdf") ||
    doc.mimeType === "application/pdf" ||
    doc.dataUrl.startsWith("data:application/pdf");

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/90">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white shrink-0">
        <p className="text-sm font-medium truncate pr-4">{doc.fileName}</p>
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-auto p-4 flex items-center justify-center">
        {!doc.dataUrl ? (
          <p className="text-white/80 text-sm text-center">No preview available for this document.</p>
        ) : isPdf ? (
          <iframe
            title={doc.fileName}
            src={doc.dataUrl}
            className="w-full max-w-4xl h-[min(85vh,900px)] bg-white rounded-lg"
          />
        ) : (
          <img
            src={doc.dataUrl}
            alt={doc.fileName}
            className="max-w-full max-h-[85vh] object-contain rounded-lg"
          />
        )}
      </div>
    </div>
  );
}

export default function OwnerPropertyDetails() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/owner/properties/:id");
  const [property, setProperty] = useState<Property | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [shareOpen, setShareOpen] = useState(false);
  const [complaintOpen, setComplaintOpen] = useState(false);
  const [viewerDoc, setViewerDoc] = useState<PropertyDocument | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [documents, setDocuments] = useState<PropertyDocument[]>([]);
  const [tickets, setTickets] = useState(() =>
    params?.id ? getPropertyMaintenanceTickets(params.id) : [],
  );
  const [detailsTicket, setDetailsTicket] = useState<PropertyMaintenanceTicket | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const refreshDocuments = useCallback(() => {
    if (params?.id) setDocuments(getPropertyDocuments(params.id));
  }, [params?.id]);

  const refreshTickets = useCallback(() => {
    if (params?.id) setTickets(getPropertyMaintenanceTickets(params.id));
  }, [params?.id]);

  useEffect(() => {
    if (params?.id) {
      const p = getProperties().find((x) => x.id === params.id);
      if (p) setProperty(p);
      refreshDocuments();
      refreshTickets();
    }
  }, [params?.id, refreshDocuments, refreshTickets]);

  useEffect(() => {
    const refreshProperty = () => {
      if (!params?.id) return;
      const p = getProperties().find((x) => x.id === params.id);
      if (p) setProperty(p);
    };
    window.addEventListener(PROPERTIES_UPDATED_EVENT, refreshProperty);
    return () => window.removeEventListener(PROPERTIES_UPDATED_EVENT, refreshProperty);
  }, [params?.id]);

  useEffect(() => {
    const onChange = () => refreshTickets();
    window.addEventListener(MAINTENANCE_TICKETS_CHANGED, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(MAINTENANCE_TICKETS_CHANGED, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [refreshTickets]);

  if (!property) {
    return (
      <OwnerLayout>
        <div className="p-8 text-center text-gray-500">Property not found.</div>
      </OwnerLayout>
    );
  }

  const rent = property.monthlyRent
    ? `₹${Number(property.monthlyRent).toLocaleString("en-IN")}`
    : "—";
  const areaLabel = property.builtUpArea
    ? `${property.builtUpArea} ${property.builtUpUnits || ""}`.trim()
    : "—";
  const isRented = property.status === "Rented";
  const title = getPropertyDetailTitle(property);

  const handleUpload = async (file: File) => {
    try {
      await addPropertyDocumentUpload(property.id, file);
      refreshDocuments();
      toast({ title: "Document uploaded" });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    }
  };

  const openDocument = (doc: PropertyDocument) => {
    if (!doc.dataUrl && doc.agreementId) {
      setLocation("/owner/agreements");
      toast({
        title: "View agreement",
        description: "Open the agreement from your Agreements list for full details.",
      });
      return;
    }
    if (!doc.dataUrl) {
      toast({ title: "No preview", description: "This document has no file attached yet.", variant: "destructive" });
      return;
    }
    setViewerDoc(doc);
  };

  const summaryCard = (
    <PropertyDetailSummaryCard
      property={property}
      title={title}
      onShare={() => setShareOpen(true)}
      onEdit={() => setLocation(`/owner/properties/add?edit=${property.id}`)}
      verifiedLabel={isRented ? "Occupied" : "Live"}
      verifiedTone={isRented ? "warning" : "success"}
    />
  );

  return (
    <OwnerLayout>
      <div className="p-4 sm:p-8">
        <PropertyDetailPageLayout
          backLabel="Back"
          onBack={() => window.history.back()}
          mobileEditLabel="Edit Details"
          onMobileEdit={() => setLocation(`/owner/properties/add?edit=${property.id}`)}
          summaryCard={summaryCard}
        >
          <PropertyDetailImageGallery
            images={property.images ?? []}
            selectedImage={selectedImage}
            onSelect={setSelectedImage}
          />

          <div className="md:hidden mt-4">{summaryCard}</div>

          <FlowSegmentTabs
            value={activeTab}
            onChange={(v) => setActiveTab(v as TabId)}
            options={TABS}
            className="mt-6"
          />

          <div className="mt-4">
            {activeTab === "overview" && (
              <OwnerPropertyOverviewPanel
                property={property}
                rentLabel={rent}
                areaLabel={areaLabel}
              />
            )}

            {activeTab === "documents" && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Documents</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Rental agreements and files linked to this property.
                </p>
              </div>
              <OwnerFlowButton
                type="button"
                className="sm:shrink-0"
                onClick={() => uploadRef.current?.click()}
              >
                Upload document
              </OwnerFlowButton>
              <input
                ref={uploadRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleUpload(f);
                  e.target.value = "";
                }}
              />
            </div>

            {documents.length === 0 ? (
              <div className="text-center py-14 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50">
                <FileText size={32} className="mx-auto text-gray-300 mb-3" />
                <p className="text-sm font-semibold text-gray-700">No documents yet</p>
                <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                  Agreements created for this property and your uploads will appear here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-4 p-4 border border-gray-100 rounded-xl hover:border-primary/30 hover:bg-[#F8FBFF] transition-colors group"
                  >
                    <button
                      type="button"
                      onClick={() => openDocument(doc)}
                      className="flex items-center gap-4 flex-1 min-w-0 text-left"
                    >
                      <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100">
                        <FileText size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 group-hover:text-primary truncate">
                          {doc.fileName}
                        </p>
                        <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                          {doc.source === "agreement" ? "Rental agreement" : "Uploaded"}
                          {" · "}
                          {formatDocumentSize(doc.fileSize)}
                          {" · "}
                          {formatDate(doc.uploadedAt)}
                        </p>
                      </div>
                      <Eye size={18} className="text-gray-400 group-hover:text-primary shrink-0" />
                    </button>
                    {doc.source === "upload" && (
                      <button
                        type="button"
                        onClick={() => {
                          removePropertyDocumentUpload(property.id, doc.id);
                          refreshDocuments();
                          toast({ title: "Document removed" });
                        }}
                        className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50"
                        aria-label="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                    {doc.source === "agreement" && !doc.dataUrl && (
                      <button
                        type="button"
                        onClick={() => setLocation("/owner/agreements")}
                        className="p-2 text-gray-400 hover:text-primary rounded-lg hover:bg-blue-50"
                        aria-label="Open agreements"
                      >
                        <ExternalLink size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
              </div>
            )}

            {activeTab === "maintenance" && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Maintenance History</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {tickets.length === 0
                    ? "No maintenance records for this property yet."
                    : `${tickets.length} record${tickets.length === 1 ? "" : "s"}`}
                </p>
              </div>
              <OwnerFlowButton
                type="button"
                className="sm:shrink-0"
                onClick={() => setComplaintOpen(true)}
              >
                <Wrench size={16} />
                Log Maintenance
              </OwnerFlowButton>
            </div>

            {tickets.length === 0 ? (
              <div className="text-center py-14 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50">
                <Wrench size={32} className="mx-auto text-gray-300 mb-3" />
                <p className="text-sm font-semibold text-gray-700">No maintenance history</p>
                <p className="text-xs text-gray-500 mt-1">
                  Log maintenance to record an issue for this property.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {tickets.map((t, idx) => (
                  <MaintenanceTicketCard
                    key={t.id}
                    ticket={t}
                    ticketLabel={`Ticket- ${String(idx + 1).padStart(2, "0")}`}
                    propertyLabel={getPropertyTitle(property)}
                    onViewDetails={() => setDetailsTicket(t)}
                    onStatusChange={(status) => {
                      updateMaintenanceTicketStatus(t.id, status);
                      refreshTickets();
                    }}
                  />
                ))}
              </div>
            )}
              </div>
            )}
          </div>
        </PropertyDetailPageLayout>
      </div>

      <SharePropertyModal property={property} open={shareOpen} onClose={() => setShareOpen(false)} />
      <RaiseComplaintModal
        propertyId={property.id}
        propertyLabel={getPropertyTitle(property)}
        open={complaintOpen}
        onClose={() => setComplaintOpen(false)}
        onSubmitted={refreshTickets}
      />
      <MaintenanceTicketDetailsModal
        ticket={detailsTicket}
        propertyLabel={getPropertyTitle(property)}
        open={Boolean(detailsTicket)}
        onClose={() => setDetailsTicket(null)}
        onUpdated={() => {
          refreshTickets();
          if (detailsTicket) {
            const updated = getMaintenanceTicketById(detailsTicket.id);
            if (updated) setDetailsTicket(updated);
          }
        }}
      />
      <DocumentViewerModal doc={viewerDoc} onClose={() => setViewerDoc(null)} />
    </OwnerLayout>
  );
}
