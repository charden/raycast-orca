# Orca Worktrees

[Orca](https://github.com/stablyai/orca) で管理している worktree を Raycast から検索して、Orca で開くための拡張です。Orca 公式の拡張ではありません。

[![CI](https://github.com/charden/raycast-orca/actions/workflows/ci.yml/badge.svg)](https://github.com/charden/raycast-orca/actions/workflows/ci.yml)

## できること

- worktree を最近触った順に一覧します。アーカイブ済みのものは表示しません。
- 名前、リポジトリ、ブランチ、コメント、Issue・PR・Linear の ID で絞り込めます。ステータス（Todo / In Progress / In Review / Done）でも絞り込めます。
- Enter でその worktree を Orca で開きます。
  - エージェント（Claude など）のタブがあれば、そのタブへ切り替えます。今動いているエージェントのタブを、前回から残っているタブ（orphaned）より先に選びます。
  - タブが無い、または古くなっている場合は、新しくターミナルを作って開きます。
- Orca が起動していなければ裏で起動します。一覧を出す段階では Orca を前面に出さないので、Raycast は閉じません。

## アクション

| アクション               | ショートカット       |
| ------------------------ | -------------------- |
| Open in Orca             | `↵`                  |
| Open PR / Issue / Linear | アクションパネルから |
| Show in Finder           | `⌘F`                 |
| Copy Path                | `⌘⇧C`                |
| Copy Branch              | `⌘B`                 |
| Refresh                  | `⌘R`                 |

## 必要なもの

- macOS と [Raycast](https://www.raycast.com/)
- Orca と `orca` CLI

`orca` CLI は `~/.local/bin`、`/opt/homebrew/bin`、`/usr/local/bin` の順に探します。Raycast はログインシェルの `PATH` を引き継がないためです。別の場所に置いている場合は、拡張の設定「orca CLI のパス」に指定してください。

## インストール

Raycast Store には公開していないので、手元でビルドして読み込みます。

```sh
git clone git@github.com:charden/raycast-orca.git
cd raycast-orca
npm install
npm run dev
```

`npm run dev` を一度実行すると、Raycast に「Search Orca Worktrees」が登録されます。以降は開発サーバーを止めても使えます。

## 仕組み

`orca` CLI を `--json` 付きで呼び、その結果を Raycast の一覧に変換しています。

| 目的       | 使うコマンド                                         |
| ---------- | ---------------------------------------------------- |
| 一覧の取得 | `worktree list`、`repo list`、`terminal list`        |
| 起動確認   | `status`（未起動なら `open -g -a Orca` で裏で起動）  |
| 開く       | `open`、`terminal switch`、`terminal create --focus` |

CLI が失敗したときは、stdout に出る JSON のエラー理由をトーストに表示します。

## 開発

| コマンド                 | 内容                                                                              |
| ------------------------ | --------------------------------------------------------------------------------- |
| `npm run dev`            | Raycast で開発モードとして動かす                                                  |
| `npm test`               | テスト（vitest）                                                                  |
| `npm run typecheck`      | 型チェック。`raycast-env.d.ts` は `npm run dev` か `npm run build` で生成されます |
| `npx eslint src`         | ESLint                                                                            |
| `npx prettier --check .` | 整形の確認                                                                        |

`npm run lint`（`ray lint`）は、author が Raycast Store に登録されていないため失敗します。Store に公開しない限り、ESLint と Prettier を直接使ってください。

テストは Raycast API に依存しない純粋関数を対象にしています。

- `src/model.ts`: CLI の JSON を一覧の項目に変換する
- `src/envelope.ts`: CLI の JSON 出力（エンベロープ）を読む

CI（GitHub Actions）では、ビルドと型チェック、テスト、ESLint、Prettier を実行します。

## アイコン

- 拡張のアイコン（`assets/extension-icon.png`）は、この拡張のために作ったものです。元の SVG は `assets/extension-icon.svg` にあります。
- 「Open in Orca」アクションには、インストール済みの Orca（`/Applications/Orca.app`）のアイコンを表示します。Orca のロゴはリポジトリに同梱していません。Orca が見つからないときは Raycast の標準アイコンを使います。

## ライセンス

[MIT](LICENSE)
