-- ============================================================================
-- ProjectOps360° — Document Repository Enhancements (Task 1.5)
-- Migration: 20260615000000_document_repository_enhancements.sql
--
-- Changes:
--   1. Add document_type (text) — classification: evidence, contract, etc.
--   2. Add storage_type (text) — upload or external_url
--   3. Add external_url (text) — URL when storage_type = external_url
--   4. Add owner (text) — free text for document owner/responsible party
--   5. Add indexes for filtering
--   6. Create Supabase Storage bucket for document uploads
--   7. Create storage policies for org-scoped access
-- ============================================================================

-- 1. Add document_type
ALTER TABLE public.documents
  ADD COLUMN document_type text NOT NULL DEFAULT 'evidence'
  CHECK (document_type IN ('evidence', 'contract', 'specification', 'report', 'presentation', 'other'));

-- 2. Add storage_type
ALTER TABLE public.documents
  ADD COLUMN storage_type text NOT NULL DEFAULT 'external_url'
  CHECK (storage_type IN ('upload', 'external_url'));

-- 3. Add external_url
ALTER TABLE public.documents
  ADD COLUMN external_url text;

-- 4. Add owner
ALTER TABLE public.documents
  ADD COLUMN owner text;

-- 5. Add indexes for filtering
CREATE INDEX idx_documents_document_type
  ON public.documents (organization_id, document_type)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_documents_status
  ON public.documents (organization_id, status)
  WHERE deleted_at IS NULL;

-- 6. Create storage bucket for document uploads (private, requires auth)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- 7. Create storage policies for org-scoped access
-- Path pattern: documents/{org_id}/{project_id}/{uuid}-{filename}

CREATE POLICY "Org members can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = 'documents'
  AND public.is_org_member(((storage.foldername(name))[2])::uuid)
);

CREATE POLICY "Org members can read documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = 'documents'
  AND public.is_org_member(((storage.foldername(name))[2])::uuid)
);

CREATE POLICY "Org members can delete documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = 'documents'
  AND public.is_org_member(((storage.foldername(name))[2])::uuid)
);

-- Comments
COMMENT ON COLUMN public.documents.document_type IS
  'Document classification: evidence | contract | specification | report | presentation | other';
COMMENT ON COLUMN public.documents.storage_type IS
  'How the document is stored: upload (Supabase Storage) or external_url';
COMMENT ON COLUMN public.documents.external_url IS
  'External URL for the document when storage_type = external_url';
COMMENT ON COLUMN public.documents.owner IS
  'Free text field for the document owner or responsible party';