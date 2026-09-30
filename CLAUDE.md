# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Orca の worktree を Raycast から検索して開く拡張。コメント、README、コミットメッセージは日本語で書く。

## コマンド

| 目的               | コマンド                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| Raycast で動かす   | `npm run dev`                                                                                  |
| テスト             | `npm test`（1 ファイル: `npx vitest run src/model.test.ts`、1 件: `-t "<テスト名>"` を付ける） |
| ビルドと型チェック | `npx ray build -e dist`                                                                        |
| 型チェックだけ     | `npm run typecheck`（`raycast-env.d.ts` が生成済みのときだけ通る）                             |
| ESLint             | `npx eslint src`                                                                               |
| 整形の確認         | `npx prettier --check .`                                                                       |

- `raycast-env.d.ts`（`Arguments` や `Preferences` の型）は `ray` が生成し、gitignore されている。クローンした直後は `tsc` が `Cannot find namespace 'Arguments'` で失敗するので、`ray build` か `npm run dev` を先に実行する。
- `npm run lint`（`ray lint`）は、author「charden」が Raycast Store に未登録のため必ず失敗する。代わりに ESLint と Prettier を直接実行する。
- CI（`.github/workflows/ci.yml`）では、`ray build`、vitest、ESLint、Prettier の順に実行する。

## 構成

3 層に分かれており、Raycast API に依存しない純粋関数だけをテストしている。

- `src/search-worktrees.tsx`: UI。`useCachedPromise(listAll)` で一覧を取得し、`toWorktreeItems` で表示用に変換する。絞り込みは Raycast 標準の `filtering` に任せ、`keywords` を対象にする。
- `src/orca.ts`: `orca` CLI を `execFile` で呼ぶ。`@raycast/api` に依存するので、テストは書いていない。
- `src/model.ts` と `src/envelope.ts`: 純粋関数。CLI の JSON を一覧の項目に変換する処理と、JSON のエンベロープを読む処理。

## orca CLI と Orca アプリの前提

どれも実機で確かめた挙動で、コードの判断の根拠になっている。

- CLI は必ず `--json` 付きで呼ぶ。出力は `{ ok, result, error: { code, message } }` の形。**失敗したときも exit 1 とともに stdout にこの形の JSON を出す**。そのため、`orca()` は execFile が投げた例外の `stdout` も `parseEnvelope` に通している。
- Orca が起動していないと、`worktree list` などの呼び出しは失敗する。
  - 一覧を取る前（`launchInBackground`）: `orca status` で確認し、起動していなければ `open -g -a Orca` で裏で起動して、応答があるまで待つ。`orca open` は Orca を前面に出してしまい、Raycast が閉じるので、ここでは使わない。
  - 開くとき（`openInOrca`）: Orca を前面に出してよいので `orca open` を使う。
- `orca` の場所: Raycast はログインシェルの `PATH` を引き継がない。そのため、設定の `orcaPath` を見てから、`~/.local/bin`、`/opt/homebrew/bin`、`/usr/local/bin` の順に探す。
- ターミナル: `orphaned: true` は「画面がまだ描画していない」だけで、`terminal switch` で開ける。そのため一覧から除外はしない。並び順は、エージェントのタブのうち orphaned でないもの、orphaned のもの、それ以外のタブの順。Enter では先頭のタブを開く。handle が古くなっていて switch に失敗したら、`terminal create` で作り直す。

## 公開リポジトリとしての注意

- Orca のロゴは同梱しない。拡張のアイコンは自作（元の SVG は `assets/extension-icon.svg`）。Orca のアイコンは、実行時に `{ fileIcon: "/Applications/Orca.app" }` で表示する。
- テストデータには、実環境のリポジトリ名や Linear のキーを使わず、`app`、`api`、`acme` のようなダミーを使う。
