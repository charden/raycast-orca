import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { getPreferenceValues } from "@raycast/api";
import type { OrcaRepo, OrcaTerminal, OrcaWorktree } from "./model";

const execFileAsync = promisify(execFile);

// Raycast はログインシェルの PATH を引き継がないので、orca の場所を自分で探す。
function orcaPath(): string {
  const { orcaPath } = getPreferenceValues<{ orcaPath?: string }>();
  if (orcaPath) return orcaPath;
  const candidates = [join(homedir(), ".local/bin/orca"), "/opt/homebrew/bin/orca", "/usr/local/bin/orca"];
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error("orca CLI が見つかりません。拡張の設定でパスを指定してください");
  return found;
}

async function orca<T>(args: string[]): Promise<T> {
  const { stdout } = await execFileAsync(orcaPath(), [...args, "--json"], { maxBuffer: 32 * 1024 * 1024 });
  const envelope = JSON.parse(stdout) as { ok: boolean; result: T; error?: { message?: string } };
  if (!envelope.ok) throw new Error(envelope.error?.message ?? `orca ${args.join(" ")} が失敗しました`);
  return envelope.result;
}

export async function listAll(): Promise<{
  worktrees: OrcaWorktree[];
  repos: OrcaRepo[];
  terminals: OrcaTerminal[];
}> {
  const [wt, repo, term] = await Promise.all([
    orca<{ worktrees: OrcaWorktree[] }>(["worktree", "list"]),
    orca<{ repos: OrcaRepo[] }>(["repo", "list"]),
    orca<{ terminals: OrcaTerminal[] }>(["terminal", "list"]),
  ]);
  return { worktrees: wt.worktrees, repos: repo.repos, terminals: term.terminals };
}

// 既存のターミナルがあればそこへ切り替え、なければ新しく作って表示する。
// ハンドルが古くなっている（Orca 再起動後など）場合も、作り直しで開ける。
export async function openInOrca(worktreeId: string, terminalHandles: string[]): Promise<"switched" | "created"> {
  // キャッシュされた一覧からは Orca 未起動でも選べるので、先に起動して runtime に届くまで待つ。
  // 起動済みなら数十 ms で返る。
  await orca(["open"]);
  let result: "switched" | "created" = "created";
  const handle = terminalHandles[0];
  if (handle) {
    try {
      await orca(["terminal", "switch", "--terminal", handle]);
      result = "switched";
    } catch {
      // 下で作り直す
    }
  }
  if (result === "created") {
    await orca(["terminal", "create", "--worktree", `id:${worktreeId}`, "--focus"]);
  }
  await execFileAsync("/usr/bin/open", ["-a", "Orca"]);
  return result;
}
