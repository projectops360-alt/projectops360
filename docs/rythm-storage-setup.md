# Rythm (Meeting Intelligence) — Storage & Setup Notes

This document covers the manual/operational setup for the **Rythm** module. The
schema, RLS and bucket are all created by the migration
`supabase/migrations/20260725000000_rythm_meeting_intelligence.sql`.

## Private storage bucket: `meeting-audio`

- **Bucket id / name:** `meeting-audio`
- **Public:** `false` (private — objects are only reachable via signed URLs)
- **Path convention:** `projects/{projectId}/rythm/{meetingId}/{timestamp}.{extension}`

The bucket is created idempotently by the migration:

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('meeting-audio', 'meeting-audio', false)
ON CONFLICT (id) DO NOTHING;
```

### Access model (RLS on `storage.objects`)

Uploads/reads/deletes run with the **end-user's** session (the browser Supabase
client), so the service-role key never reaches the frontend. Access is granted
when the caller can access the project encoded at path segment `[2]`:

```
foldername(name) = ['projects', '{projectId}', 'rythm', '{meetingId}']
                       [1]          [2]
```

The check uses the SECURITY DEFINER helper `public.can_access_project(uuid)`,
which resolves the project → organization and calls the existing
`public.is_org_member()` cornerstone. Three policies are created: upload
(INSERT), read (SELECT) and delete (DELETE).

### Playback

Objects are private. The server action `getRythmAudioUrlAction` issues a
**1-hour signed URL** (`createSignedUrl`) on demand for the `<audio>` element.

## Tables

| Table | Purpose |
|-------|---------|
| `project_rythm_meetings` | One meeting record + lifecycle status. |
| `project_rythm_audio_files` | One stored recording/upload per meeting. |
| `project_rythm_transcripts` | Transcript scaffolding (filled by AssemblyAI later). |
| `project_rythm_processing_jobs` | Async pipeline queue (`transcription` / `summary` / `embedding`). |

All four tables carry `organization_id` + `project_id` and use the standard
org-membership RLS (`is_org_member(organization_id)`) plus a `service_role`
full-access policy, matching every other table in the codebase.

> **Note on tenancy:** the original spec listed only `project_id`. We additionally
> store `organization_id` (derived from the project at insert time) so the RLS
> reuses `is_org_member()` directly — consistent with the rest of ProjectOps360°.

## Status lifecycle

```
Meeting created            → meetings.status = draft
Recording starts           → meetings.status = recording
Audio saved (rec/upload)   → meetings.status = ready_for_transcription
                             audio.status    = ready_for_transcription
                             + processing_jobs row (job_type=transcription, status=queued)
```

The remaining statuses (`transcribing`, `transcribed`, `summary_ready`,
`failed`) are advanced by the transcription/summary pipeline added later.

## NOT wired in this phase (intentional)

- **AssemblyAI** transcription — `project_rythm_transcripts` rows and queued
  `transcription` jobs are scaffolding only. A background worker that drains
  `project_rythm_processing_jobs` and calls AssemblyAI is a later task.
- **OpenAI** summaries / embeddings — the `summary` and `embedding` job types
  exist but are not produced or consumed yet.

### Provider keys (server-side only — DO NOT expose to the browser)

When the transcription phase is implemented, add these to `.env.local`
(server-only) and to the Vercel project env. They must **never** be referenced
from client components or `NEXT_PUBLIC_*` vars:

```
ASSEMBLYAI_API_KEY=<server-only>
OPENAI_API_KEY=<server-only>   # already present for existing AI features
```

## Smoke test

1. Open a project → **Rythm** tab.
2. **New Meeting** → fill the form → Create. Meeting lands in `draft`.
3. On the meeting's **Audio** tab:
   - **Record:** Start → Stop → Save. Status moves to `ready_for_transcription`,
     an `audio_files` row + a queued `transcription` job appear.
   - **Upload:** choose an MP3/WAV/M4A/MP4/WEBM file. Same result.
4. Press **Play** on an audio record — a signed URL streams the private object.
5. Confirm a second org's user cannot read the object (RLS denies the signed URL).
