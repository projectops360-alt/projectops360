# Safe Milestone Delete

## Product rule

A milestone may be deleted from ProjectOps360 only when it has zero active tasks associated with it.

The server is authoritative. The UI may show a delete action only for milestones, but the server must re-check immediately before deletion.

If one or more active roadmap tasks reference the milestone, deletion must be blocked and the user must be told how many tasks are associated. No cascading task deletion is permitted from the safe milestone-delete action.

Soft-deleted tasks do not block deletion. Cross-project or cross-organization identifiers must never be accepted as proof of emptiness.

Deletion is a soft delete and must preserve audit/process-mining evidence. After deletion the project roadmap and Living Graph must be revalidated/refreshed.
