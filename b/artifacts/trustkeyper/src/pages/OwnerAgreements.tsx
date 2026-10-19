import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, FileText } from "lucide-react";
import { useLocation } from "wouter";
import OwnerLayout from "@/components/OwnerLayout";
import { OwnerPageEmpty } from "@/components/owner/OwnerPageEmpty";
import { OwnerFlowButton } from "@/components/owner/OwnerFlowButton";
import {
  AgreementDocumentRow,
  AgreementEditManuallyModal,
  AgreementViewModal,
  buildAgreementEditDraft,
} from "@/components/agreements/AgreementDocumentList";
import { getAgreements, updateAgreement, type Agreement } from "@/lib/agreements";
import { setSessionItem } from "@/lib/storageKeys";

export default function OwnerAgreements() {
  const [, setLocation] = useLocation();
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [viewing, setViewing] = useState<Agreement | null>(null);
  const [editingManually, setEditingManually] = useState<Agreement | null>(null);

  const refresh = () => {
    setAgreements(getAgreements());
  };

  useEffect(() => {
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const recentAgreements = useMemo(
    () => [...agreements].sort((a, b) => b.createdAt - a.createdAt),
    [agreements],
  );

  const handleSaveText = (id: string, text: string) => {
    updateAgreement(id, { customText: text });
    refresh();
  };

  return (
    <OwnerLayout>
      <div className="p-4 sm:p-8 max-w-6xl mx-auto">
        <button
          type="button"
          onClick={() => setLocation("/owner/dashboard")}
          className="flex items-center gap-2 text-primary font-medium text-lg mb-6 hover:underline w-fit"
        >
          <ChevronLeft size={20} /> Back to Dashboard
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Agreement</h1>
          <OwnerFlowButton onClick={() => setLocation("/owner/agreements/generate")}>
            Generate Agreement
          </OwnerFlowButton>
        </div>

        {recentAgreements.length === 0 ? (
          <OwnerPageEmpty
            icon={FileText}
            title="No agreements yet"
            description="Create a rental agreement for your property to collect documents and e-signatures."
          />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 min-w-0 w-full overflow-visible">
            {recentAgreements.map((agreement) => (
              <AgreementDocumentRow
                key={agreement.id}
                agreement={agreement}
                requesterRole="owner"
                onView={() => setViewing(agreement)}
                onEditManually={() => setEditingManually(agreement)}
                onEditDetails={() => {
                  try {
                    window.sessionStorage.setItem("agreement_needs_resend", agreement.id);
                  } catch {
                    /* ignore */
                  }
                  setSessionItem("agreement_edit_draft", JSON.stringify(buildAgreementEditDraft(agreement)));
                  setLocation("/owner/agreements/generate");
                }}
              />
            ))}
          </div>
        )}
      </div>

      {viewing ? <AgreementViewModal agreement={viewing} onClose={() => setViewing(null)} /> : null}
      {editingManually ? (
        <AgreementEditManuallyModal
          agreement={editingManually}
          onClose={() => setEditingManually(null)}
          onSave={(text) => handleSaveText(editingManually.id, text)}
        />
      ) : null}
    </OwnerLayout>
  );
}
