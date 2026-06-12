"use client";

import { useState, useRef } from "react";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { X, Loader2, Upload } from "lucide-react";
import { updateDocumentAction } from "@/app/[locale]/(app)/projects/[projectId]/documents/actions";
import { createClient } from "@/lib/supabase/client";
import type { Document, DocumentStatus, DocumentType, StorageType, Locale } from "@/types/database";
import { getI18nValue } from "@/types/database";

type EditState =
  | { error: string; success?: undefined }
  | { error?: undefined; success: true }
  | null;

const statusOptions: DocumentStatus[] = ["draft", "review", "approved", "archived"];
const documentTypeOptions: DocumentType[] = ["evidence", "contract", "specification", "report", "presentation", "other"];
const storageTypeOptions: StorageType[] = ["external_url", "upload"];

interface EditDocumentDialogProps {
  document: Document;
  locale: Locale;
  projectId: string;
  organizationId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function EditDocumentDialog({
  document,
  locale,
  projectId,
  organizationId,
  onClose,
  onSaved,
}: EditDocumentDialogProps) {
  const t = useTranslations("documents.form");
  const tStatus = useTranslations("documents.status");
  const tDocType = useTranslations("documents.documentType");
  const tStorageType = useTranslations("documents.storageType");

  const [storageType, setStorageType] = useState<StorageType>(document.storage_type);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentTitle = getI18nValue(document.title_i18n, locale) ?? getI18nValue(document.title_i18n, "en") ?? "";
  const currentDescription = getI18nValue(document.description_i18n, locale) ?? getI18nValue(document.description_i18n, "en") ?? "";

  async function handleUpdate(
    _prevState: EditState,
    formData: FormData,
  ): Promise<EditState> {
    const title = (formData.get("title") as string)?.trim();
    const description = (formData.get("description") as string)?.trim();
    const documentType = (formData.get("documentType") as string) || undefined;
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

    // Handle file upload if a new file was selected and storage type is "upload"
    if (currentStorageType === "upload" && selectedFile) {
      setUploading(true);
      try {
        const supabase = createClient();
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

    // If storage type is upload and no new file, keep existing file_url
    if (currentStorageType === "upload" && !selectedFile) {
      fileUrl = document.file_url ?? undefined;
      fileType = document.file_type ?? undefined;
    }

    const result = await updateDocumentAction({
      documentId: document.id,
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

    onSaved();
    onClose();
    return { success: true };
  }

  const [state, formAction, isPending] = useActionState(handleUpdate, null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 backdrop-blur-sm">
      <div className="my-8 w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{t("editTitle")}</h2>
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
            <label htmlFor="edit-doc-title" className="block text-sm font-medium text-foreground">
              {t("titleField")} <span className="text-red-500">*</span>
            </label>
            <input
              id="edit-doc-title"
              name="title"
              type="text"
              required
              maxLength={200}
              defaultValue={currentTitle}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              placeholder={t("titlePlaceholder")}
              disabled={isPending || uploading}
            />
          </div>

          {/* Document Type + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="edit-doc-type" className="block text-sm font-medium text-foreground">
                {t("documentType")}
              </label>
              <select
                id="edit-doc-type"
                name="documentType"
                defaultValue={document.document_type}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                disabled={isPending || uploading}
              >
                {documentTypeOptions.map((dt) => (
                  <option key={dt} value={dt}>{tDocType(dt)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="edit-doc-status" className="block text-sm font-medium text-foreground">
                {t("status")}
              </label>
              <select
                id="edit-doc-status"
                name="status"
                defaultValue={document.status}
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
            <label htmlFor="edit-doc-storage" className="block text-sm font-medium text-foreground">
              {t("storageType")}
            </label>
            <select
              id="edit-doc-storage"
              name="storageType"
              value={storageType}
              onChange={(e) => setStorageType(e.target.value as StorageType)}
              defaultValue={document.storage_type}
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
              <label htmlFor="edit-doc-url" className="block text-sm font-medium text-foreground">
                {t("externalUrl")} <span className="text-red-500">*</span>
              </label>
              <input
                id="edit-doc-url"
                name="externalUrl"
                type="url"
                maxLength={500}
                defaultValue={document.external_url ?? ""}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                placeholder={t("externalUrlPlaceholder")}
                disabled={isPending || uploading}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                {t("fileUpload")}
              </label>
              {document.file_url && !selectedFile && (
                <p className="text-xs text-muted-foreground mb-1">
                  Current file on record. Upload a new file to replace it.
                </p>
              )}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isPending || uploading}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />
                  {selectedFile ? t("fileSelected") : t("fileChoose")}
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
            </div>
          )}

          {/* Owner */}
          <div className="space-y-2">
            <label htmlFor="edit-doc-owner" className="block text-sm font-medium text-foreground">
              {t("owner")}
            </label>
            <input
              id="edit-doc-owner"
              name="owner"
              type="text"
              maxLength={200}
              defaultValue={document.owner ?? ""}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              placeholder={t("ownerPlaceholder")}
              disabled={isPending || uploading}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label htmlFor="edit-doc-notes" className="block text-sm font-medium text-foreground">
              {t("description")}
            </label>
            <textarea
              id="edit-doc-notes"
              name="description"
              rows={3}
              maxLength={2000}
              defaultValue={currentDescription}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
              placeholder={t("descriptionPlaceholder")}
              disabled={isPending || uploading}
            />
          </div>

          {/* Language preference */}
          <div className="space-y-2">
            <label htmlFor="edit-doc-language" className="block text-sm font-medium text-foreground">
              {t("language")}
            </label>
            <select
              id="edit-doc-language"
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
              {isPending ? "…" : t("save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}