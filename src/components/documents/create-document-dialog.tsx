"use client";

import { useState, useRef } from "react";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { X, Loader2, Upload } from "lucide-react";
import { createDocumentAction } from "@/app/[locale]/(app)/projects/[projectId]/documents/actions";
import { createClient } from "@/lib/supabase/client";
import { getOrgContext } from "@/lib/auth";
import type { DocumentStatus, DocumentType, StorageType, Locale } from "@/types/database";

type CreateState =
  | { error: string; success?: undefined; documentId?: undefined }
  | { error?: undefined; success: true; documentId: string }
  | null;

const statusOptions: DocumentStatus[] = ["draft", "review", "approved", "archived"];
const documentTypeOptions: DocumentType[] = ["evidence", "contract", "specification", "report", "presentation", "other"];
const storageTypeOptions: StorageType[] = ["external_url", "upload"];

interface CreateDocumentDialogProps {
  locale: Locale;
  projectId: string;
  organizationId: string;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateDocumentDialog({
  locale,
  projectId,
  organizationId,
  onClose,
  onCreated,
}: CreateDocumentDialogProps) {
  const t = useTranslations("documents.form");
  const tStatus = useTranslations("documents.status");
  const tDocType = useTranslations("documents.documentType");
  const tStorageType = useTranslations("documents.storageType");

  const [storageType, setStorageType] = useState<StorageType>("external_url");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleCreate(
    _prevState: CreateState,
    formData: FormData,
  ): Promise<CreateState> {
    const title = (formData.get("title") as string)?.trim();
    const description = (formData.get("description") as string)?.trim();
    const documentType = (formData.get("documentType") as string) || "evidence";
    const owner = (formData.get("owner") as string)?.trim();
    const status = (formData.get("status") as string) || "draft";
    const languagePreference = formData.get("languagePreference") as string;
    const currentStorageType = (formData.get("storageType") as string) || "external_url";
    const externalUrl = (formData.get("externalUrl") as string)?.trim();

    if (!title) {
      return { error: t("errors.titleRequired") };
    }

    let fileUrl: string | undefined;
    let fileType: string | undefined;

    // Handle file upload if storage type is "upload"
    if (currentStorageType === "upload" && selectedFile) {
      setUploading(true);
      try {
        const supabase = createClient();
        const ext = selectedFile.name.split(".").pop() || "";
        const path = `documents/${organizationId}/${projectId}/${crypto.randomUUID()}-${selectedFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(path, selectedFile, {
            contentType: selectedFile.type,
            upsert: false,
          });

        if (uploadError) {
          setUploading(false);
          console.error("Upload error:", uploadError);
          return { error: t("errors.uploadFailed") };
        }

        fileUrl = path;
        fileType = selectedFile.type;
        setUploading(false);
      } catch {
        setUploading(false);
        return { error: t("errors.uploadFailed") };
      }
    }

    const result = await createDocumentAction({
      title,
      description,
      documentType,
      storageType: currentStorageType,
      externalUrl: currentStorageType === "external_url" ? externalUrl : undefined,
      fileUrl,
      fileType,
      owner,
      status,
      projectId,
      locale: languagePreference,
    });

    if (result.error) {
      const errorMap: Record<string, string> = {
        titleRequired: t("errors.titleRequired"),
        titleTooLong: t("errors.titleTooLong"),
        descriptionTooLong: t("errors.descriptionTooLong"),
        ownerTooLong: t("errors.ownerTooLong"),
        externalUrlTooLong: t("errors.externalUrlTooLong"),
        externalUrlInvalid: t("errors.externalUrlInvalid"),
        fileRequired: t("errors.fileRequired"),
        uploadFailed: t("errors.uploadFailed"),
      };
      return { error: errorMap[result.error] || t("errors.unexpected") };
    }

    onCreated();
    onClose();
    return { success: true as const, documentId: result.documentId ?? "" };
  }

  const [state, formAction, isPending] = useActionState(handleCreate, null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 backdrop-blur-sm">
      <div className="my-8 w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{t("title")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {state?.error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
            {state.error}
          </div>
        )}

        <form action={formAction} className="mt-4 space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <label htmlFor="doc-title" className="block text-sm font-medium text-foreground">
              {t("titleField")} <span className="text-red-500">*</span>
            </label>
            <input
              id="doc-title"
              name="title"
              type="text"
              required
              maxLength={200}
              autoFocus
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              placeholder={t("titlePlaceholder")}
              disabled={isPending || uploading}
            />
          </div>

          {/* Document Type + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="doc-type" className="block text-sm font-medium text-foreground">
                {t("documentType")}
              </label>
              <select
                id="doc-type"
                name="documentType"
                defaultValue="evidence"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                disabled={isPending || uploading}
              >
                {documentTypeOptions.map((dt) => (
                  <option key={dt} value={dt}>{tDocType(dt)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="doc-status" className="block text-sm font-medium text-foreground">
                {t("status")}
              </label>
              <select
                id="doc-status"
                name="status"
                defaultValue="draft"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                disabled={isPending || uploading}
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>{tStatus(s)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Storage Type */}
          <div className="space-y-2">
            <label htmlFor="doc-storage" className="block text-sm font-medium text-foreground">
              {t("storageType")}
            </label>
            <select
              id="doc-storage"
              name="storageType"
              value={storageType}
              onChange={(e) => setStorageType(e.target.value as StorageType)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              disabled={isPending || uploading}
            >
              {storageTypeOptions.map((st) => (
                <option key={st} value={st}>{tStorageType(st)}</option>
              ))}
            </select>
          </div>

          {/* Conditional: External URL or File Upload */}
          {storageType === "external_url" ? (
            <div className="space-y-2">
              <label htmlFor="doc-external-url" className="block text-sm font-medium text-foreground">
                {t("externalUrl")} <span className="text-red-500">*</span>
              </label>
              <input
                id="doc-external-url"
                name="externalUrl"
                type="url"
                maxLength={500}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                placeholder={t("externalUrlPlaceholder")}
                disabled={isPending || uploading}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                {t("fileUpload")} <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isPending || uploading}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />
                  {t("fileChoose")}
                </button>
                {selectedFile && (
                  <span className="text-sm text-muted-foreground">{selectedFile.name}</span>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setSelectedFile(file);
                }}
                disabled={isPending || uploading}
              />
              {selectedFile && (
                <p className="text-xs text-muted-foreground">
                  {t("fileSelected")}: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>
          )}

          {/* Owner */}
          <div className="space-y-2">
            <label htmlFor="doc-owner" className="block text-sm font-medium text-foreground">
              {t("owner")}
            </label>
            <input
              id="doc-owner"
              name="owner"
              type="text"
              maxLength={200}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              placeholder={t("ownerPlaceholder")}
              disabled={isPending || uploading}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label htmlFor="doc-description" className="block text-sm font-medium text-foreground">
              {t("description")}
            </label>
            <textarea
              id="doc-description"
              name="description"
              rows={3}
              maxLength={2000}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
              placeholder={t("descriptionPlaceholder")}
              disabled={isPending || uploading}
            />
          </div>

          {/* Language preference */}
          <div className="space-y-2">
            <label htmlFor="doc-language" className="block text-sm font-medium text-foreground">
              {t("language")}
            </label>
            <select
              id="doc-language"
              name="languagePreference"
              defaultValue={locale}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              disabled={isPending || uploading}
            >
              <option value="en">English</option>
              <option value="es">Español</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending || uploading}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={isPending || uploading}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {(isPending || uploading) && <Loader2 className="h-4 w-4 animate-spin" />}
              {uploading ? "…" : isPending ? "…" : t("submit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}