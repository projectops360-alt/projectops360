import { describe, it, expect } from "vitest";
import { normalizeEvent } from "../normalizers";

describe("normalizeEvent", () => {
  it("normalizes push into an activity event + branch snapshot", () => {
    const { event, snapshots } = normalizeEvent(
      "push",
      null,
      {
        ref: "refs/heads/feature/checkout",
        after: "deadbeef",
        sender: { login: "alice" },
        commits: [{ message: "a" }, { message: "b" }],
        head_commit: { message: "b\nbody", timestamp: "2026-01-01T00:00:00Z", url: "http://c" },
      },
      "main",
    );
    expect(event.github_event_type).toBe("push");
    expect(event.branch_name).toBe("feature/checkout");
    expect(event.sha).toBe("deadbeef");
    expect(event.title).toBe("b");
    expect(event.actor_login).toBe("alice");
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].table).toBe("github_branch_snapshots");
    expect(snapshots[0].row.branch_type).toBe("feature");
    expect(snapshots[0].row.commit_count_window).toBe(2);
  });

  it("normalizes pull_request into a PR snapshot", () => {
    const { event, snapshots } = normalizeEvent(
      "pull_request",
      "opened",
      {
        number: 42,
        pull_request: {
          number: 42, title: "Checkout v2", state: "open", draft: false, merged: false,
          head: { ref: "feature/checkout" }, base: { ref: "main" }, user: { login: "bob" },
          created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-02T00:00:00Z", html_url: "http://pr",
        },
      },
      "main",
    );
    expect(event.github_numeric_id).toBe(42);
    expect(snapshots[0].table).toBe("github_pull_request_snapshots");
    expect(snapshots[0].row.pr_number).toBe(42);
    expect(snapshots[0].row.state).toBe("open");
    expect(snapshots[0].row.source_branch).toBe("feature/checkout");
  });

  it("marks merged PRs", () => {
    const { snapshots } = normalizeEvent("pull_request", "closed", {
      number: 7, pull_request: { number: 7, state: "closed", merged: true, merged_at: "2026-01-03T00:00:00Z", head: { ref: "f" }, base: { ref: "main" } },
    }, "main");
    expect(snapshots[0].row.state).toBe("merged");
  });

  it("normalizes workflow_run conclusion", () => {
    const { snapshots } = normalizeEvent("workflow_run", "completed", {
      workflow_run: { id: 1001, name: "CI", head_branch: "main", head_sha: "abc", status: "completed", conclusion: "failure", updated_at: "2026-01-01T00:00:00Z", html_url: "http://run" },
    }, "main");
    expect(snapshots[0].table).toBe("github_workflow_run_snapshots");
    expect(snapshots[0].row.conclusion).toBe("failure");
  });

  it("normalizes release into a release snapshot", () => {
    const { snapshots } = normalizeEvent("release", "published", {
      release: { tag_name: "v1.4.0", name: "1.4.0", target_commitish: "main", published_at: "2026-01-01T00:00:00Z", prerelease: false, draft: false, html_url: "http://rel" },
    }, "main");
    expect(snapshots[0].table).toBe("github_release_snapshots");
    expect(snapshots[0].row.tag_name).toBe("v1.4.0");
  });

  it("normalizes deployment into a deployment snapshot", () => {
    const { snapshots } = normalizeEvent("deployment", "created", {
      deployment: { id: 555, environment: "production", ref: "main", sha: "abc", state: "success", created_at: "2026-01-01T00:00:00Z" },
    }, "main");
    expect(snapshots[0].table).toBe("github_deployment_snapshots");
    expect(snapshots[0].row.deployment_id).toBe(555);
    expect(snapshots[0].row.environment).toBe("production");
  });

  it("marks a deleted branch stale via delete event", () => {
    const { snapshots } = normalizeEvent("delete", null, { ref: "feature/old", ref_type: "branch" }, "main");
    expect(snapshots[0].table).toBe("github_branch_snapshots");
    expect(snapshots[0].row.status).toBe("stale");
  });

  it("never stores raw secrets — payload_summary is a bounded object", () => {
    const { event } = normalizeEvent("push", null, { ref: "refs/heads/main", after: "x", token: "SHOULD_NOT_APPEAR" }, "main");
    expect(JSON.stringify(event.payload_summary)).not.toContain("SHOULD_NOT_APPEAR");
  });
});
