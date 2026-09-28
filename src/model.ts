// Orca CLI の JSON を、Raycast の一覧に出す形へ変換する純粋関数。
// Raycast API に依存させないことで、vitest で直接テストできるようにしている。

export type OrcaRepo = {
  id: string;
  displayName: string;
  path: string;
};

export type OrcaWorktree = {
  id: string;
  repoId: string;
  projectId: string | null;
  path: string;
  branch: string | null;
  displayName: string;
  comment: string | null;
  workspaceStatus: string | null;
  isArchived: boolean;
  isMainWorktree: boolean;
  lastActivityAt: number | null;
  linkedIssue: number | null;
  linkedPR: number | null;
  linkedLinearIssue: string | null;
  linkedLinearIssueOrganizationUrlKey: string | null;
};

export type OrcaTerminal = {
  handle: string;
  worktreeId: string;
  orphaned: boolean;
  agentIdentity: string | null;
};

export type WorktreeLink = { label: string; url: string };

export type WorktreeItem = {
  id: string;
  path: string;
  title: string;
  repoName: string;
  branch: string;
  comment: string;
  status: string;
  isMainWorktree: boolean;
  lastActivityAt: number | null;
  // エージェント（Claude など）のタブを先頭に並べる
  terminalHandles: string[];
  agentCount: number;
  links: WorktreeLink[];
  keywords: string[];
};

export function toWorktreeItems(
  worktrees: OrcaWorktree[],
  repos: OrcaRepo[],
  terminals: OrcaTerminal[],
): WorktreeItem[] {
  const repoNames = new Map(repos.map((r) => [r.id, r.displayName]));

  return worktrees
    .filter((wt) => !wt.isArchived)
    .sort((a, b) => (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0))
    .map((wt) => {
      const repoName = repoNames.get(wt.repoId) ?? basename(wt.path);
      const branch = (wt.branch ?? "").replace(/^refs\/heads\//, "");
      const comment = wt.comment ?? "";
      const links = buildLinks(wt);
      const own = terminals.filter((t) => t.worktreeId === wt.id);
      // 同じ worktree に前回の orphaned なエージェントが残っていても、今動いている方を先に開く
      const agents = own.filter((t) => t.agentIdentity).sort((a, b) => Number(a.orphaned) - Number(b.orphaned));
      const others = own.filter((t) => !t.agentIdentity);
      return {
        id: wt.id,
        path: wt.path,
        title: wt.displayName || basename(wt.path),
        repoName,
        branch,
        comment,
        status: wt.workspaceStatus ?? "",
        isMainWorktree: wt.isMainWorktree,
        lastActivityAt: wt.lastActivityAt,
        terminalHandles: [...agents, ...others].map((t) => t.handle),
        agentCount: agents.length,
        links,
        keywords: buildKeywords({ repoName, branch, comment, path: wt.path, wt }),
      };
    });
}

function buildLinks(wt: OrcaWorktree): WorktreeLink[] {
  const links: WorktreeLink[] = [];
  const github = wt.projectId?.match(/^github:(.+\/.+)$/)?.[1];
  if (github && wt.linkedPR != null) {
    links.push({ label: `PR #${wt.linkedPR}`, url: `https://github.com/${github}/pull/${wt.linkedPR}` });
  }
  if (github && wt.linkedIssue != null) {
    links.push({ label: `Issue #${wt.linkedIssue}`, url: `https://github.com/${github}/issues/${wt.linkedIssue}` });
  }
  if (wt.linkedLinearIssue && wt.linkedLinearIssueOrganizationUrlKey) {
    links.push({
      label: wt.linkedLinearIssue,
      url: `https://linear.app/${wt.linkedLinearIssueOrganizationUrlKey}/issue/${wt.linkedLinearIssue}`,
    });
  }
  return links;
}

// Raycast の絞り込みは title と keywords を単語単位で見るため、
// ブランチやコメントは丸ごとと分割後の両方を入れておく。
function buildKeywords(args: {
  repoName: string;
  branch: string;
  comment: string;
  path: string;
  wt: OrcaWorktree;
}): string[] {
  const { repoName, branch, comment, path, wt } = args;
  const words = [
    repoName,
    branch,
    ...branch.split("/"),
    ...comment.split(/\s+/),
    basename(path),
    wt.linkedLinearIssue ?? "",
    wt.linkedPR != null ? `#${wt.linkedPR}` : "",
    wt.linkedIssue != null ? `#${wt.linkedIssue}` : "",
  ];
  return [...new Set(words.filter((w) => w !== ""))];
}

function basename(path: string): string {
  return path.split("/").filter(Boolean).pop() ?? path;
}
