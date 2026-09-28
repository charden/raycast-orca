// orca CLI の --json 出力（エンベロープ）を読む純粋関数。
// CLI は失敗時も exit 1 とともに stdout へエンベロープを出すので、成功・失敗の両方でここを通す。

type Envelope<T> = { ok: boolean; result: T; error?: { code?: string; message?: string } };

// JSON として読めなければ undefined を返し、元のエラーの扱いは呼び出し側に任せる。
export function parseEnvelope<T>(stdout: string, command: string): { result: T } | undefined {
  let envelope: Envelope<T>;
  try {
    envelope = JSON.parse(stdout) as Envelope<T>;
  } catch {
    return undefined;
  }
  if (typeof envelope !== "object" || envelope === null) return undefined;
  if (!envelope.ok) {
    // 空文字の message ではトーストに理由が出ないので、|| で code へ落とす
    throw new Error(envelope.error?.message || envelope.error?.code || `orca ${command} が失敗しました`);
  }
  return { result: envelope.result };
}
