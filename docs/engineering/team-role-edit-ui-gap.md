# Team & Roles — role editor follow-up

The canonical backend action `updateProjectMemberAction` already accepts `project_role`, `delivery_role`, and `governance_role` patches. The current List UI renders `project_role` as text while `permission_level` is editable.

Required UI follow-up: replace the read-only project-role text in the List member row with an inline role editor backed by `updateProjectMemberAction`, preserving free-text/custom roles and the existing `PROJECT_ROLES` datalist. This applies to all members, including `group_imported` rows created from task-person resources.

Do not solve this by changing imported users' roles automatically: task assignment proves project participation, not a specific organizational role.
