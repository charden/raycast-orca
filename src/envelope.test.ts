import { describe, expect, it } from "vitest";
import { parseEnvelope } from "./envelope";

describe("parseEnvelope", () => {
  it("ok なら result を返す", () => {
    expect(parseEnvelope<{ n: number }>('{"ok":true,"result":{"n":1}}', "worktree list")).toEqual({ result: { n: 1 } });
  });

  it("ok でなければ error.message を投げる", () => {
    const stdout = JSON.stringify({ ok: false, error: { code: "invalid_argument", message: "Unknown flag --bogus" } });
    expect(() => parseEnvelope(stdout, "worktree list")).toThrow("Unknown flag --bogus");
  });

  it("message がなければ code を使う", () => {
    const stdout = JSON.stringify({ ok: false, error: { code: "terminal_handle_stale" } });
    expect(() => parseEnvelope(stdout, "terminal switch")).toThrow("terminal_handle_stale");
  });

  it("message が空文字なら code を使う", () => {
    const stdout = JSON.stringify({ ok: false, error: { code: "terminal_handle_stale", message: "" } });
    expect(() => parseEnvelope(stdout, "terminal switch")).toThrow("terminal_handle_stale");
  });

  // null や数値を読んで TypeError を出すと、呼び出し側の元のエラーが上書きされる
  it("エンベロープの形でない JSON なら undefined を返す", () => {
    expect(parseEnvelope("null", "worktree list")).toBeUndefined();
    expect(parseEnvelope("1", "worktree list")).toBeUndefined();
  });

  it("error がなければコマンド名入りの既定メッセージを投げる", () => {
    expect(() => parseEnvelope('{"ok":false}', "terminal switch")).toThrow("orca terminal switch が失敗しました");
  });

  it("JSON でなければ undefined を返し、呼び出し側に元のエラーを任せる", () => {
    expect(parseEnvelope("", "worktree list")).toBeUndefined();
  });
});
