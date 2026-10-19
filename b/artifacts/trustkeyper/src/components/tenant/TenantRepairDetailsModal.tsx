import { useEffect, useState } from "react";
import { Calendar, House, Info, Tag, Wrench, X } from "lucide-react";
import type { PropertyMaintenanceTicket } from "@/lib/ownerPropertyMaintenance";
import { formatTenantRepairReportedAt } from "@/lib/tenantRepairs";

export interface TenantRepairDetailsModalProps {
  open: boolean;
  ticket: PropertyMaintenanceTicket | null;
  propertyLabel: string;
  onClose: () => void;
}

export function TenantRepairDetailsModal({
  open,
  ticket,
  propertyLabel,
  onClose,
}: TenantRepairDetailsModalProps) {
  const [activeImage, setActiveImage] = useState(0);

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
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  useEffect(() => {
    if (open) setActiveImage(0);
  }, [open, ticket?.id]);

  if (!open || !ticket) return null;

  const images = ticket.images;
  const mainImage = images[activeImage];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-3xl relative max-h-[90vh] overflow-y-auto animate-in zoom-in-95 fade-in duration-300"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tenant-repair-details-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 z-10"
          aria-label="Close"
        >
          <X size={18} className="text-gray-600" />
        </button>

        <div className="p-6 pt-10">
          <h3
            id="tenant-repair-details-title"
            className="text-xl font-semibold text-[#192839] text-center mb-6"
          >
            Repair Details
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#768ea7] mb-3">
                Photos
              </p>
              {mainImage ? (
                <>
                  <div className="rounded-xl overflow-hidden border border-gray-100 bg-[#f8fafc] aspect-[4/3]">
                    <img src={mainImage} alt="" className="w-full h-full object-cover" />
                  </div>
                  {images.length > 1 ? (
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      {images.map((img, idx) => (
                        <button
                          key={`${ticket.id}-thumb-${idx}`}
                          type="button"
                          onClick={() => setActiveImage(idx)}
                          className={`aspect-square rounded-lg overflow-hidden border-2 ${
                            activeImage === idx ? "border-primary" : "border-gray-100"
                          }`}
                        >
                          <img src={img} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-[rgba(108,132,157,0.18)] bg-[#f8fafc] aspect-[4/3] flex flex-col items-center justify-center text-sm text-[#768ea7] gap-2">
                  <Wrench size={24} className="text-primary/30" />
                  No photos attached
                </div>
              )}
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#768ea7] mb-3">
                Report
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <Tag size={18} className="text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-[#768ea7]">Category</p>
                    <p className="text-sm font-semibold text-[#192839]">{ticket.category}</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Calendar size={18} className="text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-[#768ea7]">Reported on</p>
                    <p className="text-sm font-semibold text-[#192839]">
                      {formatTenantRepairReportedAt(ticket.createdAt)}
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <House size={18} className="text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-[#768ea7]">Property details</p>
                    <p className="text-sm font-semibold text-[#192839]">{propertyLabel}</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Info size={18} className="text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-[#768ea7]">Description</p>
                    <p className="text-sm font-semibold text-[#192839]">{ticket.title}</p>
                    {ticket.description ? (
                      <p className="text-sm text-[#40566d] mt-1">{ticket.description}</p>
                    ) : null}
                  </div>
                </li>
              </ul>

              <div className="mt-5">
                <p className="text-xs text-[#768ea7] mb-2">Status</p>
                <span
                  className={`inline-flex text-xs font-semibold uppercase tracking-wide px-3 py-1.5 rounded ${
                    ticket.status === "Issue Solved"
                      ? "bg-[#00a251] text-white"
                      : "bg-primary text-white"
                  }`}
                >
                  {ticket.status === "Pending" ? "Pending" : "Issue Solved"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
