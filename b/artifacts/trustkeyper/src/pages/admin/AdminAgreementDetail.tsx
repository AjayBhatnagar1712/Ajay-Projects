/**
 * Admin agreement detail — unsigned PDF download, signed PDF upload, email resend.
 */
import React, { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { AlertCircle, ArrowLeft, CheckCircle2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminAgreementDetailSections } from "@/components/admin/AdminAgreementDetailSections";
import { agreementStatusLabel } from "@/components/admin/AdminAgreementsTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminLeaseAgreement } from "@/hooks/useAdminData";
import {
  downloadAdminSignedPdf,
  downloadAdminUnsignedPdf,
  resendAdminSigningNotification,
  uploadAdminSignedPdf,
} from "@/lib/adminApi";

function formatDate(value: string | null): string {
  if (!value) return "—";
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return "—";
  return new Date(timestamp).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Per-agreement signing actions for Aman. No public Blob URLs are shown.
 */
export default function AdminAgreementDetail() {
  const [, params] = useRoute("/admin/agreements/:id");
  const id = params?.id;
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useAdminLeaseAgreement(id);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin", "lease-agreements"] });
    if (id) {
      await queryClient.invalidateQueries({ queryKey: ["admin", "lease-agreements", id] });
    }
  };

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      if (!id) throw new Error("Missing agreement id");
      return uploadAdminSignedPdf(id, file);
    },
    onSuccess: async () => {
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await invalidate();
    },
  });

  const resendMutation = useMutation({
    mutationFn: () => {
      if (!id) throw new Error("Missing agreement id");
      return resendAdminSigningNotification(id);
    },
    onSuccess: async () => {
      await invalidate();
    },
  });

  const canUpload = data?.status === "esign_sent" || data?.status === "signed";
  const canNotify = data?.status === "esign_sent" || data?.status === "signed";

  const handleDownloadUnsigned = async () => {
    if (!id) return;
    setDownloadError(null);
    setDownloadSuccess(null);
    try {
      await downloadAdminUnsignedPdf(id);
      setDownloadSuccess("Unsigned PDF downloaded.");
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Could not download the unsigned PDF.");
    }
  };

  const handleDownloadSigned = async () => {
    if (!id) return;
    setDownloadError(null);
    setDownloadSuccess(null);
    try {
      await downloadAdminSignedPdf(id);
      setDownloadSuccess("Signed PDF downloaded.");
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Could not download the signed PDF.");
    }
  };

  return (
    <AdminLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          href="/admin/agreements"
          className="inline-flex items-center gap-2 text-sm text-sky-800 hover:underline"
        >
          <ArrowLeft size={16} />
          Back to agreements
        </Link>

        {isLoading ? (
          <Card>
            <CardContent className="space-y-3 p-6">
              <Skeleton className="h-7 w-64" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ) : null}

        {isError ? (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">Could not load this agreement.</p>
              {error?.message ? <p className="mt-1 text-sm text-red-700/80">{error.message}</p> : null}
            </div>
          </div>
        ) : null}

        {data ? (
          <>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-semibold text-gray-900">
                  {data.propertyAddress?.trim() || "Untitled property"}
                </h2>
                <Badge variant="outline">{agreementStatusLabel(data.status)}</Badge>
              </div>
              <p className="mt-1 text-sm text-gray-500">Updated {formatDate(data.updatedAt)}</p>
            </div>

            <AdminAgreementDetailSections agreement={data} />

            <Card>
              <CardContent className="space-y-4 p-6">
                <h3 className="text-sm font-semibold text-gray-900">Signing</h3>
                <p className="text-sm text-gray-600">
                  {data.signingNotifiedAt
                    ? `Notification last sent ${formatDate(data.signingNotifiedAt)}.`
                    : "Signing notification has not been recorded yet."}
                </p>
                {data.signedAt ? (
                  <p className="text-sm text-gray-600">
                    Signed copy uploaded {formatDate(data.signedAt)}
                    {data.signedUploadedByPhone ? ` by +91 ${data.signedUploadedByPhone}` : ""}.
                  </p>
                ) : null}

                {downloadError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    {downloadError}
                  </div>
                ) : null}
                {downloadSuccess ? (
                  <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    {downloadSuccess}
                  </div>
                ) : null}
                {uploadMutation.isError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    {uploadMutation.error instanceof Error
                      ? uploadMutation.error.message
                      : "Could not upload the signed PDF."}
                  </div>
                ) : null}
                {uploadMutation.isSuccess ? (
                  <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    Signed PDF saved. The agreement is marked signed.
                  </div>
                ) : null}
                {resendMutation.isError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    {resendMutation.error instanceof Error
                      ? resendMutation.error.message
                      : "Could not resend the notification."}
                  </div>
                ) : null}
                {resendMutation.isSuccess ? (
                  <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    Signing notification sent.
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => void handleDownloadUnsigned()}>
                    Download unsigned PDF
                  </Button>
                  {data.hasSignedPdf ? (
                    <Button type="button" variant="outline" onClick={() => void handleDownloadSigned()}>
                      Download signed PDF
                    </Button>
                  ) : null}
                  {canNotify ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={resendMutation.isPending}
                      onClick={() => resendMutation.mutate()}
                    >
                      {resendMutation.isPending ? "Sending…" : "Resend signing email"}
                    </Button>
                  ) : null}
                </div>

                {canUpload ? (
                  <div className="space-y-3 border-t border-gray-100 pt-4">
                    <p className="text-sm text-gray-600">
                      {data.status === "signed"
                        ? "Replace the stored signed PDF. Status stays signed."
                        : "Upload the signed PDF from Leegality to mark this agreement signed."}
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf"
                      className="block w-full text-sm text-gray-700"
                      onChange={(event) => {
                        setSelectedFile(event.target.files?.[0] ?? null);
                        uploadMutation.reset();
                      }}
                    />
                    <Button
                      type="button"
                      disabled={!selectedFile || uploadMutation.isPending}
                      onClick={() => {
                        if (selectedFile) uploadMutation.mutate(selectedFile);
                      }}
                    >
                      {uploadMutation.isPending
                        ? "Uploading…"
                        : data.status === "signed"
                          ? "Replace signed PDF"
                          : "Upload signed PDF"}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    Upload is available after the broker sends this agreement for signing.
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </AdminLayout>
  );
}
