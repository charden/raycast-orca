import {
  Action,
  ActionPanel,
  Color,
  Icon,
  Image,
  Keyboard,
  LaunchProps,
  List,
  Toast,
  closeMainWindow,
  showToast,
} from "@raycast/api";
import { showFailureToast, useCachedPromise } from "@raycast/utils";
import { existsSync } from "node:fs";
import { useMemo, useState } from "react";
import { toWorktreeItems, type WorktreeItem } from "./model";
import { listAll, openInOrca } from "./orca";

// Orca のアイコンは同梱せず、インストール済みのアプリから表示する。見つからなければ標準のアイコンにする。
const ORCA_APP = "/Applications/Orca.app";
const orcaIcon: Image.ImageLike = existsSync(ORCA_APP) ? { fileIcon: ORCA_APP } : Icon.AppWindow;

const STATUS: Record<string, { label: string; color: Color }> = {
  todo: { label: "Todo", color: Color.SecondaryText },
  "in-progress": { label: "In Progress", color: Color.Blue },
  "in-review": { label: "In Review", color: Color.Orange },
  completed: { label: "Done", color: Color.Green },
};

export default function Command(props: LaunchProps<{ arguments: Arguments.SearchWorktrees }>) {
  const [searchText, setSearchText] = useState(props.arguments.query ?? "");
  const [statusFilter, setStatusFilter] = useState("all");
  const { data, isLoading, revalidate } = useCachedPromise(listAll, [], {
    onError: (error) => {
      showFailureToast(error, { title: "Orca から一覧を取得できませんでした" });
    },
  });

  const items = useMemo(() => {
    if (!data) return [];
    const all = toWorktreeItems(data.worktrees, data.repos, data.terminals);
    return statusFilter === "all" ? all : all.filter((i) => i.status === statusFilter);
  }, [data, statusFilter]);

  return (
    <List
      isLoading={isLoading}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      filtering
      searchBarPlaceholder="名前・リポジトリ・ブランチ・コメント・Issue で検索"
      searchBarAccessory={
        <List.Dropdown tooltip="ステータス" value={statusFilter} onChange={setStatusFilter}>
          <List.Dropdown.Item title="すべて" value="all" />
          {Object.entries(STATUS).map(([id, s]) => (
            <List.Dropdown.Item key={id} title={s.label} value={id} />
          ))}
        </List.Dropdown>
      }
    >
      {items.map((item) => (
        <WorktreeRow key={item.id} item={item} onRefresh={revalidate} />
      ))}
    </List>
  );
}

function WorktreeRow({ item, onRefresh }: { item: WorktreeItem; onRefresh: () => void }) {
  const status = STATUS[item.status];
  const accessories: List.Item.Accessory[] = [];
  if (item.comment) accessories.push({ text: truncate(item.comment, 40), tooltip: item.comment });
  for (const link of item.links) accessories.push({ tag: link.label });
  if (item.agentCount > 0) {
    accessories.push({ icon: Icon.Stars, text: String(item.agentCount), tooltip: "エージェントのタブ（↵ で開く）" });
  } else if (item.terminalHandles.length > 0) {
    accessories.push({ icon: Icon.Terminal, text: String(item.terminalHandles.length), tooltip: "ターミナルのタブ" });
  }
  if (status) accessories.push({ tag: { value: status.label, color: status.color } });
  if (item.lastActivityAt) accessories.push({ date: new Date(item.lastActivityAt), tooltip: "最終アクティビティ" });

  return (
    <List.Item
      icon={item.isMainWorktree ? Icon.House : Icon.Tree}
      title={item.title}
      subtitle={item.branch && item.branch !== item.title ? `${item.repoName} · ${item.branch}` : item.repoName}
      keywords={item.keywords}
      accessories={accessories}
      actions={
        <ActionPanel>
          <Action title="Open in Orca" icon={orcaIcon} onAction={() => open(item)} />
          {item.links.map((link) => (
            <Action.OpenInBrowser key={link.url} title={`Open ${link.label}`} url={link.url} />
          ))}
          <Action.ShowInFinder path={item.path} shortcut={{ modifiers: ["cmd"], key: "f" }} />
          <Action.CopyToClipboard title="Copy Path" content={item.path} shortcut={Keyboard.Shortcut.Common.Copy} />
          {item.branch && (
            <Action.CopyToClipboard
              title="Copy Branch"
              content={item.branch}
              shortcut={{ modifiers: ["cmd"], key: "b" }}
            />
          )}
          <Action
            title="Refresh"
            icon={Icon.ArrowClockwise}
            shortcut={Keyboard.Shortcut.Common.Refresh}
            onAction={onRefresh}
          />
        </ActionPanel>
      }
    />
  );
}

async function open(item: WorktreeItem) {
  const toast = await showToast({ style: Toast.Style.Animated, title: `${item.title} を開いています` });
  try {
    const result = await openInOrca(item.id, item.terminalHandles);
    toast.hide();
    await closeMainWindow();
    if (result === "created") {
      await showToast({ style: Toast.Style.Success, title: "ターミナルを新しく作って開きました" });
    }
  } catch (error) {
    await showFailureToast(error, { title: "Orca で開けませんでした" });
  }
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
