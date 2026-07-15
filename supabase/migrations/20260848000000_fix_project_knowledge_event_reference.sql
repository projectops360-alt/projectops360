create or replace function public.project_knowledge_insert_evidence(
  p_object_id uuid, p_organization_id uuid, p_project_id uuid, p_version_no integer, p_actor_id uuid, p_evidence jsonb
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare item jsonb;
begin
  for item in select value from jsonb_array_elements(p_evidence) loop
    if coalesce(item->>'evidence_type','') not in ('project_event','project_object','document','metric','engine_finding','external_reference')
      or coalesce(item->>'role','') not in ('supports','contradicts','context')
      or coalesce(item->>'confidence','') not in ('high','medium','low','unknown')
      or nullif(btrim(item->>'evidence_ref'),'') is null then
      raise exception 'knowledge_input_invalid_evidence';
    end if;
    if item->>'evidence_type' = 'project_event' and not exists (
      select 1 from public.project_event_log e
      where e.event_id = (item->>'evidence_ref')::uuid
        and e.organization_id = p_organization_id
        and e.project_id = p_project_id
    ) then
      raise exception 'knowledge_project_event_out_of_scope';
    end if;
    insert into public.project_knowledge_object_evidence(
      knowledge_object_id, organization_id, project_id, version_no, evidence_type, evidence_ref, role, confidence, note, metadata, created_by
    ) values (
      p_object_id, p_organization_id, p_project_id, p_version_no, item->>'evidence_type', item->>'evidence_ref', item->>'role',
      item->>'confidence', item->>'note', coalesce(item->'metadata','{}'::jsonb), p_actor_id
    );
  end loop;
end
$$;

revoke all on function public.project_knowledge_insert_evidence(uuid,uuid,uuid,integer,uuid,jsonb) from public, anon, authenticated;
