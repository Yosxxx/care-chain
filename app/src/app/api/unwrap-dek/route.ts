import { NextResponse } from "next/server";
import { VaultKmsAdapter } from "@/lib/vaultKmsAdapter";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { wrapped_dek_b64 } = await req.json();
    if (!wrapped_dek_b64) {
      return NextResponse.json({ error: "wrapped_dek_b64 required" }, { status: 400 });
    }

    const wrapped = Buffer.from(wrapped_dek_b64, "base64"); 
    const kms = await VaultKmsAdapter.init();               
    const dek = await kms.decryptKey(wrapped);              

    return NextResponse.json({ dek_b64: Buffer.from(dek).toString("base64") });
  } catch (e: any) {
    console.error("[unwrap-dek] error:", e);
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
