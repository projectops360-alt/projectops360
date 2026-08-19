"use client";

import { InlineProjectRoleEditor } from "./inline-project-role-editor";

export function MemberRoleCell({
  projectId,
  memberId,
  projectRole,
  deliveryRole,
  governanceRole,
  isEs,
  onSaved,
}: {
  projectId: string;
  memberId: string;
  projectRole: string | null;
  deliveryRole: string | null;
  governanceRole: string | null;
  isEs: boolean;
  onSaved: () => void;
}) {
  return (
    <div>
      <InlineProjectRoleEditor
        projectId={projectId}
        memberId={memberId}
        value={projectRole}
        isEs={isEs}
        onSaved={onSaved}
      />
      <div className="mt-0.5 text-[11px] text-muted-foreground">
        {[deliveryRole, governanceRole].filter(Boolean).join(" · ") || "—"}
      </div>
    </div>
  );
}
