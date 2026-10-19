import React, { useState } from "react";
import {
  Calendar,
  Check,
  House,
  Info,
  Tag,
  X,
} from "lucide-react";
import type { PropertyMaintenanceTicket, MaintenanceStatus } from "@/lib/ownerPropertyMaintenance";
import { updateMaintenanceTicketStatus } from "@/lib/ownerPropertyMaintenance";

function formatReportDate(ts: number): string {
  const d = new Date(ts);
  const day = d.getDate();
  const suffix =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
        ? "nd"
        : day % 10 === 3 && day !== 13
          ? "rd"
          : "th";
  return `${d.toLocaleDateString("en-IN", { month: "long" })} ${day}${suffix}, ${d.getFullYear()}`;
}

export function MaintenanceTicketDetailsModal({
  ticket,
  propertyLabel,
  open,
  onClose,
  onUpdated,
}: {
  ticket: PropertyMaintenanceTicket | null;
  propertyLabel: string;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [activeImage, setActiveImage] = useState(0);

  if (!open || !ticket) return null;

  const images = ticket.images.length > 0 ? ticket.images : [];
  const mainImage = images[activeImage];

  const applyStatus = (status: MaintenanceStatus, closeAfter = false) => {
    updateMaintenanceTicketStatus(ticket.id, status);
    onUpdated();
    if (closeAfter) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl relative max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 z-10"
          aria-label="Close"
        >
          <X size={18} className="text-gray-600" />
        </button>

        <div className="p-6 pt-10">
          <h3 className="text-xl font-semibold text-gray-900 text-center mb-6">Repair Details</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Photos</p>
              {mainImage ? (
                <>
                  <div className="rounded-xl overflow-hidden border border-gray-100 bg-gray-50 aspect-[4/3]">
                    <img src={mainImage} alt="" className="w-full h-full object-cover" />
                  </div>
                  {images.length > 1 && (
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
                  )}
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 aspect-[4/3] flex items-center justify-center text-sm text-gray-400">
                  No photos attached
                </div>
              )}
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">
                Report
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <Tag size={18} className="text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-400">Category</p>
                    <p className="text-sm font-semibold text-gray-900">{ticket.category}</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Calendar size={18} className="text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-400">Reported on</p>
                    <p className="text-sm font-semibold text-gray-900">{formatReportDate(ticket.createdAt)}</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <House size={18} className="text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-400">Property details</p>
                    <p className="text-sm font-semibold text-gray-900">{propertyLabel}</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Info size={18} className="text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-400">Description</p>
                    <p className="text-sm font-semibold text-gray-900">{ticket.title}</p>
                    {ticket.description ? (
                      <p className="text-sm text-gray-600 mt-1">{ticket.description}</p>
                    ) : null}
                  </div>
                </li>
              </ul>

              <div className="mt-5">
                <p className="text-xs text-gray-400 mb-2">Status</p>
                <div className="inline-flex rounded-lg border border-gray-200 p-1 bg-gray-50">
                  <button
                    type="button"
                    onClick={() => applyStatus("Pending")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      ticket.status === "Pending"
                        ? "bg-primary text-white"
                        : "text-gray-600 hover:bg-white"
                    }`}
                  >
                    Pending
                  </button>
                  <button
                    type="button"
                    onClick={() => applyStatus("Issue Solved")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      ticket.status === "Issue Solved"
                        ? "bg-green-600 text-white"
                        : "text-gray-600 hover:bg-white"
                    }`}
                  >
                    Issue Solved
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              type="button"
              onClick={() => applyStatus("Pending", true)}
              className="w-14 h-14 rounded-xl bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm"
              aria-label="Mark as pending"
            >
              <X size={24} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={() => applyStatus("Issue Solved", true)}
              className="w-14 h-14 rounded-xl bg-primary text-white flex items-center justify-center hover:opacity-90 transition-colors shadow-sm"
              aria-label="Mark as solved"
            >
              <Check size={24} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
