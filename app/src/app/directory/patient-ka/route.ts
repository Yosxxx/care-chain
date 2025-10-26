// src/app/directory/patient-ka/route.ts
import { NextResponse } from "next/server";
import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import idl from "../../../../anchor.json"; 
import bs58 from "bs58";
import * as ed2curve from "ed2curve";

export const runtime = "nodejs";

const PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID!);
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const KV_MOUNT = process.env.VAULT_KV_MOUNT || "secret";

function x25519B64(u8: Uint8Array) {
  return Buffer.from(u8).toString("base64");
}

function ed25519FromDidKey(did: string): Uint8Array | null {
  const m = /^did:key:z([1-9A-HJ-NP-Za-km-z]+)$/.exec(did);
  if (!m) return null;
  const decoded = bs58.decode(m[1]);
  if (decoded.length !== 34 || decoded[0] !== 0xed || decoded[1] !== 0x01) return null;
  return decoded.slice(2); // 32 bytes Ed25519
}

async function fromVaultDirectory(patientPda: string) {
  const addr = (process.env.VAULT_ADDR || "").replace(/\/+$/, "");
  const token = process.env.VAULT_TOKEN || "";
  if (!addr || !token) return null;
  const ns = process.env.VAULT_NAMESPACE;

  // KV v2: /v1/secret/data/patient-ka/<patientPda>
  const url = `${addr}/v1/${KV_MOUNT}/data/patient-ka/${patientPda}`;
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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const pdaStr = searchParams.get("patientPda");
    if (!pdaStr) {
      return NextResponse.json({ error: "patientPda required" }, { status: 400 });
    }
    const patientPda = new PublicKey(pdaStr);

    // (1) Try on-chain Patient.did (did:key)
    const connection = new anchor.web3.Connection(RPC_URL, "confirmed");
    const provider = new anchor.AnchorProvider(connection, {} as any, {});
    const program = new anchor.Program(idl as anchor.Idl, provider);

    // @ts-expect-error anchor typing; account name must match your IDL
    const pAcc = await program.account.patient.fetchNullable(patientPda);
    if (pAcc?.did && typeof pAcc.did === "string" && pAcc.did.startsWith("did:key:")) {
      const ed = ed25519FromDidKey(pAcc.did);
      if (ed) {
        const x = ed2curve.convertPublicKey(ed); // Uint8Array(32)
        return NextResponse.json({ key_b64: x25519B64(x) });
      }
    }

    // (2) Fallback to Directory (Vault KV)
    const keyB64 = await fromVaultDirectory(patientPda.toBase58());
    if (keyB64) return NextResponse.json({ key_b64: keyB64 });

    return NextResponse.json({ error: "not found" }, { status: 404 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
