"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { PROJECT_ROLES } from "@/lib/team-roles/config";
import { updateProjectMemberAction } from "./actions";

export function InlineProjectRoleEditor({
  projectId,
  memberId,
  value,
  isEs,
  onSaved,
}: {
  projectId: string;
  memberId: string;
  value: string | null;
  isEs: boolean;
  onSaved: () => void;
}) {
  const [role, setRole] = useState(value ?? "");
  const [pending, startTransition] = useTransition();
  const changed = role.trim() !== (value ?? "").trim();

  const save = () => {
    if (!changed) return;
    startTransition(async () => {
      const result = await updateProjectMemberAction({
        projectId,
        id: memberId,
        patch: { project_role: role.trim() || undefined },
      });
      if (!result.error) onSaved();
    });
  };

  return (
    <div className="flex min-w-[170px] items-center gap-1">
      <input
        value={role}
        onChange={(event) => setRole(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            save();
          }
        }}
        list={`project-role-${memberId}`}
        aria-label={isEs ? "Rol de proyecto" : "Project role"}
        placeholder={isEs ? "Asignar rol…" : "Assign role…"}
        disabled={pending}
        className="min-w-0 flex-1 rounded border border-border bg-background px-1.5 py-1 text-xs text-foreground"
      />
      <datalist id={`project-role-${memberId}`}>
        {PROJECT_ROLES.map((item) => <option key={item} value={item} />)}
      </datalist>
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : changed ? (
        <button type="button" onClick={save} aria-label={isEs ? "Guardar rol" : "Save role"} className="text-brand-600 hover:text-brand-700">
          <Check className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
