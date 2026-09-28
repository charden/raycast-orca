import { describe, expect, it } from "vitest";
import { toWorktreeItems, type OrcaRepo, type OrcaTerminal, type OrcaWorktree } from "./model";

const repos: OrcaRepo[] = [
  { id: "r1", displayName: "app", path: "/home/me/ghq/app" },
  { id: "r2", displayName: "api", path: "/home/me/ghq/api" },
];

function worktree(overrides: Partial<OrcaWorktree>): OrcaWorktree {
  return {
    id: "r1::/home/me/orca/workspaces/app/feature-x",
    repoId: "r1",
    projectId: "github:me/app",
    path: "/home/me/orca/workspaces/app/feature-x",
    branch: "refs/heads/me/login-form",
    displayName: "Login form",
    comment: "",
    workspaceStatus: "in-progress",
    isArchived: false,
    isMainWorktree: false,
    lastActivityAt: 1000,
    linkedIssue: null,
    linkedPR: null,
    linkedLinearIssue: null,
    linkedLinearIssueOrganizationUrlKey: null,
    ...overrides,
  };
}

describe("toWorktreeItems", () => {
  it("アーカイブ済みを除き、最近触った順に並べる", () => {
    const items = toWorktreeItems(
      [
        worktree({ id: "old", lastActivityAt: 1 }),
        worktree({ id: "archived", lastActivityAt: 99, isArchived: true }),
        worktree({ id: "new", lastActivityAt: 50 }),
      ],
      repos,
      [],
    );
    expect(items.map((i) => i.id)).toEqual(["new", "old"]);
  });

  it("リポジトリ名は repo list の displayName から引き、ブランチは refs/heads/ を外す", () => {
    const [item] = toWorktreeItems([worktree({})], repos, []);
    expect(item.repoName).toBe("app");
    expect(item.branch).toBe("me/login-form");
  });

  it("repo list にない repoId はパスの末尾をリポジトリ名にする", () => {
    const [item] = toWorktreeItems([worktree({ repoId: "unknown", path: "/x/y/zeta" })], repos, []);
    expect(item.repoName).toBe("zeta");
  });

  // orphaned は「画面がまだその worktree を描画していない」だけで、switch すれば開ける
  it("その worktree のターミナルを orphaned も含めて拾い、エージェントのタブを先頭にする", () => {
    const featureX = "r1::/home/me/orca/workspaces/app/feature-x";
    const terminals: OrcaTerminal[] = [
      { handle: "shell", worktreeId: featureX, orphaned: false, agentIdentity: null },
      { handle: "claude", worktreeId: featureX, orphaned: true, agentIdentity: "claude" },
      { handle: "other", worktreeId: "r2::/home/me/ghq/api", orphaned: false, agentIdentity: "claude" },
    ];
    const [item] = toWorktreeItems([worktree({})], repos, terminals);
    expect(item.terminalHandles).toEqual(["claude", "shell"]);
    expect(item.agentCount).toBe(1);
  });

  // 前回の orphaned なエージェントより、今動いているエージェントを Enter で開きたい
  it("エージェント同士では orphaned でないタブを先にする", () => {
    const featureX = "r1::/home/me/orca/workspaces/app/feature-x";
    const terminals: OrcaTerminal[] = [
      { handle: "shell", worktreeId: featureX, orphaned: false, agentIdentity: null },
      { handle: "stale", worktreeId: featureX, orphaned: true, agentIdentity: "claude" },
      { handle: "live", worktreeId: featureX, orphaned: false, agentIdentity: "claude" },
    ];
    const [item] = toWorktreeItems([worktree({})], repos, terminals);
    expect(item.terminalHandles).toEqual(["live", "stale", "shell"]);
  });

  it("GitHub の issue・PR と Linear のリンクを作る", () => {
    const [item] = toWorktreeItems(
      [
        worktree({
          linkedIssue: 10,
          linkedPR: 12,
          linkedLinearIssue: "ENG-8",
          linkedLinearIssueOrganizationUrlKey: "acme",
        }),
      ],
      repos,
      [],
    );
    expect(item.links).toEqual([
      { label: "PR #12", url: "https://github.com/me/app/pull/12" },
      { label: "Issue #10", url: "https://github.com/me/app/issues/10" },
      { label: "ENG-8", url: "https://linear.app/acme/issue/ENG-8" },
    ]);
  });

  it("GitHub 以外のプロジェクトでは issue・PR のリンクを作らない", () => {
    const [item] = toWorktreeItems([worktree({ projectId: "repo:abc", linkedPR: 3 })], repos, []);
    expect(item.links).toEqual([]);
  });

  it("コメントやリンク先の ID でも検索できるよう keywords に入れる", () => {
    const [item] = toWorktreeItems(
      [worktree({ comment: "TASK-123 レビュー待ち", linkedLinearIssue: "ENG-8", linkedPR: 12 })],
      repos,
      [],
    );
    expect(item.keywords).toEqual(
      expect.arrayContaining(["app", "me/login-form", "login-form", "TASK-123", "ENG-8", "#12", "feature-x"]),
    );
  });
});
