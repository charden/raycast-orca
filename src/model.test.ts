import { describe, expect, it } from "vitest";
import { toWorktreeItems, type OrcaRepo, type OrcaTerminal, type OrcaWorktree } from "./model";

const repos: OrcaRepo[] = [
  { id: "r1", displayName: "dotfiles", path: "/home/me/ghq/dotfiles" },
  { id: "r2", displayName: "secretary", path: "/home/me/ghq/secretary" },
];

function worktree(overrides: Partial<OrcaWorktree>): OrcaWorktree {
  return {
    id: "r1::/home/me/orca/workspaces/dotfiles/barb",
    repoId: "r1",
    projectId: "github:me/dotfiles",
    path: "/home/me/orca/workspaces/dotfiles/barb",
    branch: "refs/heads/me/profile-split",
    displayName: "Profile split",
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
    expect(item.repoName).toBe("dotfiles");
    expect(item.branch).toBe("me/profile-split");
  });

  it("repo list にない repoId はパスの末尾をリポジトリ名にする", () => {
    const [item] = toWorktreeItems([worktree({ repoId: "unknown", path: "/x/y/zeta" })], repos, []);
    expect(item.repoName).toBe("zeta");
  });

  // orphaned は「画面がまだその worktree を描画していない」だけで、switch すれば開ける
  it("その worktree のターミナルを orphaned も含めて拾い、エージェントのタブを先頭にする", () => {
    const barb = "r1::/home/me/orca/workspaces/dotfiles/barb";
    const terminals: OrcaTerminal[] = [
      { handle: "shell", worktreeId: barb, orphaned: false, agentIdentity: null },
      { handle: "claude", worktreeId: barb, orphaned: true, agentIdentity: "claude" },
      { handle: "other", worktreeId: "r2::/home/me/ghq/secretary", orphaned: false, agentIdentity: "claude" },
    ];
    const [item] = toWorktreeItems([worktree({})], repos, terminals);
    expect(item.terminalHandles).toEqual(["claude", "shell"]);
    expect(item.agentCount).toBe(1);
  });

  // 前回の orphaned なエージェントより、今動いているエージェントを Enter で開きたい
  it("エージェント同士では orphaned でないタブを先にする", () => {
    const barb = "r1::/home/me/orca/workspaces/dotfiles/barb";
    const terminals: OrcaTerminal[] = [
      { handle: "shell", worktreeId: barb, orphaned: false, agentIdentity: null },
      { handle: "stale", worktreeId: barb, orphaned: true, agentIdentity: "claude" },
      { handle: "live", worktreeId: barb, orphaned: false, agentIdentity: "claude" },
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
          linkedLinearIssue: "CHA-8",
          linkedLinearIssueOrganizationUrlKey: "charden",
        }),
      ],
      repos,
      [],
    );
    expect(item.links).toEqual([
      { label: "PR #12", url: "https://github.com/me/dotfiles/pull/12" },
      { label: "Issue #10", url: "https://github.com/me/dotfiles/issues/10" },
      { label: "CHA-8", url: "https://linear.app/charden/issue/CHA-8" },
    ]);
  });

  it("GitHub 以外のプロジェクトでは issue・PR のリンクを作らない", () => {
    const [item] = toWorktreeItems([worktree({ projectId: "repo:abc", linkedPR: 3 })], repos, []);
    expect(item.links).toEqual([]);
  });

  it("コメントやリンク先の ID でも検索できるよう keywords に入れる", () => {
    const [item] = toWorktreeItems(
      [worktree({ comment: "TASK-123 レビュー待ち", linkedLinearIssue: "CHA-8", linkedPR: 12 })],
      repos,
      [],
    );
    expect(item.keywords).toEqual(
      expect.arrayContaining(["dotfiles", "me/profile-split", "profile-split", "TASK-123", "CHA-8", "#12", "barb"]),
    );
  });
});
