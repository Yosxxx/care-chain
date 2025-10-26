// src/app/kms/[ref]/x25519.pub/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const KV_MOUNT = process.env.VAULT_KV_MOUNT || "secret";

async function fetchFromVault(ref: string) {
  const addr = (process.env.VAULT_ADDR || "").replace(/\/+$/, "");
  const token = process.env.VAULT_TOKEN || "";
  if (!addr || !token) return null;
  const ns = process.env.VAULT_NAMESPACE;

  // KV v2 path example: /v1/secret/data/x25519/<ref>
  const url = `${addr}/v1/${KV_MOUNT}/data/x25519/${encodeURIComponent(ref)}`;
  const res = await fetch(url, {
    headers: {
      "X-Vault-Token": token,
      ...(ns ? { "X-Vault-Namespace": ns } : {}),
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const j = await res.json();
  return j?.data?.data?.key_b64 as string | undefined;
}

function fetchFromEnv(ref: string) {
  // Optional quick fallback: set HOSPITAL_PUBKEYS_JSON='{"carechain-hosp-001":"BASE64..."}'
  try {
    const raw = process.env.HOSPITAL_PUBKEYS_JSON;
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, string>;
    return map[ref] || null;
  } catch { return null; }
}

export async function GET(
  _req: Request,
  ctx: { params: { ref: string } }
) {
  const ref = ctx.params.ref;
  const keyB64 = (await fetchFromVault(ref)) || fetchFromEnv(ref);

  if (!keyB64) {
    return new NextResponse("not found", { status: 404 });
  }
  // Plain text response, as promised
  return new NextResponse(keyB64 + "\n", {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
