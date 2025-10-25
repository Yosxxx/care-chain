import { NextResponse } from "next/server";

export const runtime = "nodejs";

const TARGET = process.env.LOCAL_RPC || "http://127.0.0.1:8899";

export async function GET() {
  return NextResponse.json({ ok: true, target: TARGET });
}

export async function OPTIONS() {
  const res = new NextResponse(null, { status: 204 });
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return res;
}

export async function POST(req: Request) {
  try {
    const body = await req.text(); 
    const upstream = await fetch(TARGET, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    const text = await upstream.text();
    const res = new NextResponse(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
    res.headers.set("Access-Control-Allow-Origin", "*");
    return res;
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? String(e) },
      { status: 502 }
    );
  }
}
