import React, { useState } from "react";
import { useLocation } from "wouter";
import { FileText } from "lucide-react";
import BrokerLayout from "@/components/BrokerLayout";
import {
  AgreementDocumentRow,
  AgreementEditManuallyModal,
  AgreementViewModal,
  buildAgreementEditDraft,
} from "@/components/agreements/AgreementDocumentList";
import { getAgreements, updateAgreement, type Agreement } from "@/lib/agreements";
import { setSessionItem } from "@/lib/storageKeys";

export default function BrokerDocuments() {
  const [, setLocation] = useLocation();
  const [agreements, setAgreements] = useState(getAgreements);
  const [viewing, setViewing] = useState<Agreement | null>(null);
  const [editingManually, setEditingManually] = useState<Agreement | null>(null);

  const refresh = () => setAgreements(getAgreements());

  const handleSaveText = (id: string, text: string) => {
    updateAgreement(id, { customText: text });
    refresh();
  };

  return (
    <BrokerLayout>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Documents</h1>

      {agreements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-40 text-center">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center text-gray-300 mb-3">
            <FileText size={28} />
          </div>
          <p className="text-gray-500 font-medium">No Documents Found</p>
          <p className="text-xs text-gray-400 mt-1">Agreements sent for e-signing will appear here</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 min-w-0 w-full overflow-visible">
          {agreements.map((agr) => (
            <AgreementDocumentRow
              key={agr.id}
              agreement={agr}
              requesterRole="broker"
              onView={() => setViewing(agr)}
              onEditManually={() => setEditingManually(agr)}
              onEditDetails={() => {
                try {
                  window.sessionStorage.setItem("agreement_needs_resend", agr.id);
                } catch {
                  /* ignore */
                }
                setSessionItem("agreement_edit_draft", JSON.stringify(buildAgreementEditDraft(agr)));
                setLocation("/broker/agreements/generate");
              }}
            />
          ))}
        </div>
      )}

      {viewing ? <AgreementViewModal agreement={viewing} onClose={() => setViewing(null)} /> : null}
      {editingManually ? (
        <AgreementEditManuallyModal
          agreement={editingManually}
          onClose={() => setEditingManually(null)}
          onSave={(text) => handleSaveText(editingManually.id, text)}
        />
      ) : null}
    </BrokerLayout>
  );
}
