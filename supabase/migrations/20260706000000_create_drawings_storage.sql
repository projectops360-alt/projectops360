-- ═══════════════════════════════════════════════════════════════════════════════
-- Drawing Intelligence — Drawings Storage Bucket (Prompt 2 of 5)
-- Private bucket for drawing files, org-scoped via path convention:
--   drawings/{organization_id}/{project_id}/{uuid}-{filename}
-- Same policy pattern as the existing 'documents' bucket.
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public)
VALUES ('drawings', 'drawings', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Org members can upload drawings" ON storage.objects;
DROP POLICY IF EXISTS "Org members can read drawings" ON storage.objects;
DROP POLICY IF EXISTS "Org members can delete drawings" ON storage.objects;

CREATE POLICY "Org members can upload drawings"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'drawings'
  AND (storage.foldername(name))[1] = 'drawings'
  AND public.is_org_member(((storage.foldername(name))[2])::uuid)
);

CREATE POLICY "Org members can read drawings"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'drawings'
  AND (storage.foldername(name))[1] = 'drawings'
  AND public.is_org_member(((storage.foldername(name))[2])::uuid)
);

CREATE POLICY "Org members can delete drawings"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'drawings'
  AND (storage.foldername(name))[1] = 'drawings'
  AND public.is_org_member(((storage.foldername(name))[2])::uuid)
);
