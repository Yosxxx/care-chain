"use client";

import { useState } from "react";
import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { useProgram } from "@/hooks/useProgram";
import { findPatientPda, findPatientSeqPda } from "@/lib/pda";
import sodium from "libsodium-wrappers";

type Rec = {
  seq: number;
  pda: string;
  cidEnc: string;
  metaCid: string;
  note: string;
  hospital: string;
  sizeBytes: number;
  createdAt: string;
};

function deriveNonce(b: Uint8Array, idx: number) {
  const out = new Uint8Array(b);
  out[out.length - 4] = idx & 0xff;
  out[out.length - 3] = (idx >> 8) & 0xff;
  out[out.length - 2] = (idx >> 16) & 0xff;
  out[out.length - 1] = (idx >> 24) & 0xff;
  return out;
}

export default function ReadRecordsPage() {
  const { program, programId, ready } = useProgram();

  const [patientBase58, setPatientBase58] = useState("");
  const [records, setRecords] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Viewer State (Drive-like)
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerMime, setViewerMime] = useState<string | null>(null);
  const [textPreview, setTextPreview] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [openViewer, setOpenViewer] = useState(false);

  const gateway = (cid: string) => `https://ipfs.io/ipfs/${cid}`;

  async function fetchRecords() {
    try {
      setErr("");
      setLoading(true);
      setRecords([]);

      if (!ready || !program || !patientBase58) {
        throw new Error("Program or patient missing");
      }

      const patientPk = new PublicKey(patientBase58.trim());
      const patientPda = findPatientPda(programId, patientPk);
      const seqPda = findPatientSeqPda(programId, patientPda);

      const seqAcc = await (program.account as any).patientSeq.fetch(seqPda);
      const total = Number(seqAcc.value);

      const fetched: Rec[] = [];
      for (let i = 0; i < total; i++) {
        const recordPda = PublicKey.findProgramAddressSync(
          [
            Buffer.from("record"),
            patientPda.toBuffer(),
            new anchor.BN(i).toArrayLike(Buffer, "le", 8),
          ],
          programId
        )[0];

        const rec = await (program.account as any).record.fetch(recordPda);

        fetched.push({
          seq: i,
          pda: recordPda.toBase58(),
          cidEnc: rec.cidEnc,
          metaCid: rec.metaCid,
          note: rec.note,
          hospital: rec.hospital.toBase58(),
          sizeBytes: Number(rec.sizeBytes),
          createdAt: new Date(Number(rec.createdAt) * 1000).toLocaleString(),
        });
      }

      setRecords(fetched.reverse());
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function decryptAndView(rec: Rec) {
    try {
      setErr("");
      setOpenViewer(true);
      setViewerMime(null);
      setViewerUrl(null);
      setTextPreview(null);
      setZoom(1);

      await sodium.ready;

      // 1) Load meta
      const meta = await (await fetch(gateway(rec.metaCid))).json();

      const chunkSize = meta.chunk_size;
      const nonceBase = Uint8Array.from(Buffer.from(meta.nonce_base, "base64"));
      const aad = new TextEncoder().encode(meta.aad || "");
      const contentType = meta.original_content_type || "application/octet-stream";

      // 2) unwrap symmetric key
      const unwrap = await (await fetch("/api/unwrap-dek", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wrapped_dek_b64: meta.wrapped_dek })
      })).json();
      const DEK = Uint8Array.from(Buffer.from(unwrap.dek_b64, "base64"));

      // 3) Decrypt ciphertext stream
      const encRes = await fetch(gateway(rec.cidEnc));
      const reader = encRes.body!.getReader();
      const chunks: Uint8Array[] = [];

      let idx = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;

        for (let off = 0; off < value.length; off += chunkSize + sodium.crypto_aead_xchacha20poly1305_ietf_ABYTES) {
          const end = Math.min(off + chunkSize + sodium.crypto_aead_xchacha20poly1305_ietf_ABYTES, value.length);
          const cipher = value.subarray(off, end);
          const nonce = deriveNonce(nonceBase, idx++);
          chunks.push(
            sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(null, cipher, aad, nonce, DEK)
          );
        }
      }

      const total = chunks.reduce((n, c) => n + c.length, 0);
      const merged = new Uint8Array(total);
      let p = 0;
      for (const c of chunks) { merged.set(c, p); p += c.length; }

      const blob = new Blob([merged], { type: contentType });
      const url = URL.createObjectURL(blob);

      setViewerUrl(url);
      setViewerMime(contentType);

      // ✅ Text preview for .txt / JSON / logs
      if (contentType.startsWith("text/") || contentType.includes("json")) {
        setTextPreview(await blob.text());
      }

    } catch (e: any) {
      setErr(e.message || String(e));
    }
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-xl font-semibold">Read & Decrypt Records</h1>

      <div className="flex gap-2">
        <input
          className="border rounded p-2 flex-1 font-mono text-sm"
          placeholder="Patient Public Key"
          value={patientBase58}
          onChange={(e) => setPatientBase58(e.target.value)}
        />
        <button onClick={fetchRecords} disabled={!ready} className="bg-black text-white px-4 py-2 rounded">
          Fetch
        </button>
      </div>

      {err && <p className="text-red-600 text-sm">{err}</p>}
      {loading && <p>Loading records…</p>}

      {records.map(r => (
        <div key={r.pda} className="border rounded p-3 text-sm">
          <div className="font-semibold">Record #{r.seq}</div>
          <div>{r.cidEnc}</div>
          <button className="text-blue-600 underline mt-2" onClick={() => decryptAndView(r)}>
            View
          </button>
        </div>
      ))}

      {/* ================= GOOGLE DRIVE STYLE MODAL ================= */}
      {openViewer && viewerUrl && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur flex flex-col z-[9999]">
          {/* Toolbar */}
          <div className="flex items-center gap-3 bg-black/40 text-white p-3">
            <button onClick={() => setOpenViewer(false)}>✕ Close</button>
            <a href={viewerUrl} download className="underline">Download</a>
            <button onClick={() => setZoom(z => z + 0.1)}>Zoom +</button>
            <button onClick={() => setZoom(z => Math.max(0.2, z - 0.1))}>Zoom −</button>
            <button onClick={() => setZoom(1)}>Fit</button>
          </div>

          {/* Content */}
          <div className="flex-1 flex justify-center items-center overflow-auto p-4">
            {/* PDF */}
            {viewerMime?.includes("pdf") && (
              <iframe src={viewerUrl} style={{ zoom }} className="w-full h-full" />
            )}

            {/* Image */}
            {viewerMime?.startsWith("image/") && (
              <img src={viewerUrl} style={{ transform: `scale(${zoom})` }} />
            )}

            {/* Text */}
            {textPreview && (
              <pre className="text-white p-4 bg-black/30 rounded max-w-4xl overflow-auto whitespace-pre-wrap" style={{ transform: `scale(${zoom})` }}>
                {textPreview}
              </pre>
            )}

            {/* Video */}
            {viewerMime?.startsWith("video/") && (
              <video src={viewerUrl} controls style={{ transform: `scale(${zoom})` }} />
            )}

            {/* Audio */}
            {viewerMime?.startsWith("audio/") && (
              <audio src={viewerUrl} controls />
            )}
          </div>
        </div>
      )}
    </main>
  );
}
