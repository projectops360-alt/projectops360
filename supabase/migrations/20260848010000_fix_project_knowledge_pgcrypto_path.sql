alter function public.create_project_knowledge_object(jsonb)
  set search_path = public, extensions, pg_temp;

alter function public.revise_project_knowledge_object(uuid, integer, jsonb)
  set search_path = public, extensions, pg_temp;
