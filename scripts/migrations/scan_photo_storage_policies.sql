-- Scan label photos: explicit storage policies for the `user-uploads` bucket.
--
-- Aug 7 2026. Bailey asked that the scanner retain both sides of a product, not
-- just read them. Photos now land in `user-uploads` (private, 10MB,
-- jpeg/png/webp) at `${user_id}/${scan_id}/view-N.ext`.
--
-- WHY THIS MIGRATION EXISTS: `user-uploads` was created Oct 2025, never wired
-- up, and has NO RLS policies on storage.objects. Private-with-no-policy is
-- already safe — nothing but the service role can reach it, and the app signs
-- URLs server-side. But safety-by-absence is indistinguishable from
-- safety-nobody-checked, and the next person to add a public policy to this
-- bucket for an unrelated feature would silently expose every scan photo. These
-- policies make the intent explicit and mirror `glass-skin-photos` exactly.
--
-- The folder convention is load-bearing: storage.foldername(name)[1] is the
-- owning user's id, so a user can only ever read beneath their own prefix.
--
-- Idempotent — safe to re-run.

-- Service role does all writes (upload on scan, delete on scan/account removal).
DROP POLICY IF EXISTS "Service role manages scan photos" ON storage.objects;
CREATE POLICY "Service role manages scan photos"
  ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'user-uploads'
    AND (SELECT auth.role()) = 'service_role'
  );

-- A user may read only objects under their own user-id prefix. The app serves
-- these via signed URLs rather than direct client reads, so this is defence in
-- depth, not the primary path.
DROP POLICY IF EXISTS "Users can read own scan photos" ON storage.objects;
CREATE POLICY "Users can read own scan photos"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'user-uploads'
    AND (SELECT auth.uid())::text = (storage.foldername(name))[1]
  );

-- Confirm the bucket is still private. This SELECT is the check, not a change —
-- if it ever returns true, scan photos are world-readable by URL.
DO $$
DECLARE is_public boolean;
BEGIN
  SELECT public INTO is_public FROM storage.buckets WHERE id = 'user-uploads';
  IF is_public THEN
    RAISE EXCEPTION 'user-uploads is PUBLIC — scan photos would be exposed. Set it private before use.';
  END IF;
END $$;
