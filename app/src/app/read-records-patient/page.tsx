"use client";

import { useEffect, useState } from "react";
import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import sodium from "libsodium-wrappers";
import { useProgram } from "@/hooks/useProgram";
import { useWallet } from "@solana/wallet-adapter-react";
import { findPatientPda, findPatientSeqPda } from "@/lib/pda";
import dynamic from "next/dynamic";
import { summarizeRecords } from "@/lib/summarizeRecords";

const WalletMultiButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

type Rec = {
  seq: number;
  pda: string;
  cidEnc: string;
  metaCid: string;
  hospital: string;
  sizeBytes: number;
  createdAt: string;
  hospital_name?: string;
  doctor_name?: string;
  diagnosis?: string;
  keywords?: string;
  description?: string;
  medication?: string;
};

function deriveNonce(b: Uint8Array, idx: number) {
  const out = new Uint8Array(b);
  out[out.length - 4] = idx & 0xff;
  out[out.length - 3] = (idx >> 8) & 0xff;
  out[out.length - 2] = (idx >> 16) & 0xff;
  out[out.length - 1] = (idx >> 24) & 0xff;
  return out;
}

const pinataGateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY?.trim();
const ipfsGateway = (cid: string) =>
  pinataGateway
    ? `${pinataGateway.startsWith("http") ? pinataGateway : `https://${pinataGateway}`}/ipfs/${cid}`
    : `https://ipfs.io/ipfs/${cid}`;

export default function ReadRecordsPage() {
  const { publicKey } = useWallet();
  const { program, programId, ready } = useProgram();

  const [patientOk, setPatientOk] = useState<boolean | null>(null);
  const [records, setRecords] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Viewer state
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerMime, setViewerMime] = useState<string | null>(null);
  const [textPreview, setTextPreview] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [openViewer, setOpenViewer] = useState(false);

  // 🩺 Summarizer state
  const [summary, setSummary] = useState("");
  const [summarizing, setSummarizing] = useState(false);

  const patientPk = publicKey ?? null;
  const disabled = !ready || !program || !patientPk;

  // ========== Auto fetch ==========
  useEffect(() => {
    (async () => {
      setErr("");
      setRecords([]);
      setPatientOk(null);
      if (disabled) return;

      try {
        const patientPda = findPatientPda(programId, patientPk!);
        // @ts-expect-error
        const pAcc = await program!.account.patient.fetchNullable(patientPda);
        if (!pAcc) {
          setPatientOk(false);
          return;
        }
        setPatientOk(true);

        const seqPda = findPatientSeqPda(programId, patientPda);
        // @ts-expect-error
        const seqAcc = await program!.account.patientSeq.fetch(seqPda);
        const total = Number(seqAcc.value);
        const out: Rec[] = [];

        for (let i = 0; i < total; i++) {
          const recordPda = PublicKey.findProgramAddressSync(
            [
              Buffer.from("record"),
              patientPda.toBuffer(),
              new anchor.BN(i).toArrayLike(Buffer, "le", 8),
            ],
            programId
          )[0];

          // @ts-expect-error
          const rec = await program!.account.record.fetch(recordPda);

          // Fetch meta.json from IPFS
          let meta: any = {};
          try {
            const metaRes = await fetch(ipfsGateway(rec.metaCid), { cache: "no-store" });
            meta = await metaRes.json();
          } catch (e) {
            console.warn(`Failed to fetch meta.json for ${rec.metaCid}`);
          }

          out.push({
            seq: i,
            pda: recordPda.toBase58(),
            cidEnc: rec.cidEnc,
            metaCid: rec.metaCid,
            hospital: rec.hospital.toBase58(),
            sizeBytes: Number(rec.sizeBytes),
            createdAt: new Date(Number(rec.createdAt) * 1000).toLocaleString(),
            hospital_name: meta.hospital_name || "",
            doctor_name: meta.doctor_name || "",
            diagnosis: meta.diagnosis || "",
            keywords: meta.keywords || "",
            description: meta.description || "",
            medication: meta.medication || "",
          });
        }

        setRecords(out.reverse());
      } catch (e: any) {
        setErr(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [ready, program, programId.toBase58(), patientPk?.toBase58()]);

  async function handleSummarize() {
    try {
      setSummarizing(true);
      setSummary("Summarizing...");
      const result = await summarizeRecords(records);
      setSummary(result);
    } catch (e: any) {
      setSummary(`❌ ${e?.message ?? String(e)}`);
    } finally {
      setSummarizing(false);
    }
  }

  // ========== Decrypt and View ==========
  async function decryptAndView(rec: Rec) {
    try {
      setErr("");
      setOpenViewer(true);
      setViewerMime(null);
      setViewerUrl(null);
      setTextPreview(null);
      setZoom(1);

      await sodium.ready;
      const meta = await (await fetch(ipfsGateway(rec.metaCid), { cache: "no-store" })).json();

      const chunkSize: number = meta.chunk_size ?? 1024 * 1024;
      const nonceBase = Uint8Array.from(Buffer.from(meta.nonce_base, "base64"));
      const aad = new TextEncoder().encode(meta.aad || "");
      const contentType = meta.original_content_type || "application/octet-stream";

      const unwrap = await (
        await fetch("/api/unwrap-dek", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            wrapped_dek_b64: meta.wrapped_dek,
            recordId: meta.aad,
          }),
        })
      ).json();

      if (!unwrap?.dek_b64) throw new Error("Failed to unwrap DEK");
      const DEK = Uint8Array.from(Buffer.from(unwrap.dek_b64, "base64"));

      const res = await fetch(ipfsGateway(rec.cidEnc), { cache: "no-store" });
      const encBuf = new Uint8Array(await res.arrayBuffer());

      const chunks: Uint8Array[] = [];
      const TAG = sodium.crypto_aead_xchacha20poly1305_ietf_ABYTES;
      let off = 0,
        idx = 0;

      while (off < encBuf.length) {
        const clen = Math.min(chunkSize + TAG, encBuf.length - off);
        const cipher = encBuf.subarray(off, off + clen);
        off += clen;

        const nonce = deriveNonce(nonceBase, idx++);
        const plain = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
          null,
          cipher,
          aad,
          nonce,
          DEK
        );
        chunks.push(plain);
      }

      const total = chunks.reduce((n, c) => n + c.length, 0);
      const merged = new Uint8Array(total);
      let p = 0;
      for (const c of chunks) {
        merged.set(c, p);
        p += c.length;
      }

      const blob = new Blob([merged], { type: contentType });
      const url = URL.createObjectURL(blob);
      setViewerUrl(url);
      setViewerMime(contentType);

      if (contentType.startsWith("text/") || contentType.includes("json")) {
        setTextPreview(await blob.text());
      }
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">My Records</h1>
        <WalletMultiButton />
      </header>

      <div className="text-sm space-y-2">
        {!publicKey && (
          <div className="rounded border border-yellow-600/40 bg-yellow-600/10 p-2 text-yellow-600">
            Connect a wallet to view your records.
          </div>
        )}
        {publicKey && patientOk === false && (
          <div className="rounded border border-red-600/40 bg-red-600/10 p-2 text-red-600">
            This wallet is not registered as a patient yet.
          </div>
        )}
        {publicKey && patientOk === true && (
          <div className="rounded border border-emerald-600/40 bg-emerald-600/10 p-2 text-emerald-600">
            Patient found. Loading your records…
          </div>
        )}
      </div>

      <button
        onClick={handleSummarize}
        disabled={!records.length || summarizing}
        className="rounded-md border px-3 py-2 text-sm bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {summarizing ? "Summarizing…" : "Summarize Records"}
      </button>

      {summary && (
        <div className="border rounded-md p-4 bg-gray-900/40 text-gray-100 whitespace-pre-wrap">
          <h2 className="font-semibold mb-2">🩺 LLM Summary</h2>
          {summary}
        </div>
      )}

      {err && <p className="text-red-600 text-sm">{err}</p>}
      {loading && <p>Loading records…</p>}

      {/* rest of your record display remains unchanged */}
      {records.map((r) => (
        <div key={r.pda} className="border rounded-lg p-4 text-sm space-y-3 shadow-sm bg-white/5">
          {/* record details (same as before) */}
          <div className="flex justify-between items-center pb-2 border-b">
            <div className="font-semibold text-base">Record #{r.seq}</div>
            <div className="text-xs text-gray-500">{r.createdAt}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div>
              <div className="text-gray-500 font-medium">Hospital</div>
              <div>{r.hospital_name || <span className="opacity-50">(N/A)</span>}</div>
            </div>
            <div>
              <div className="text-gray-500 font-medium">Doctor</div>
              <div>{r.doctor_name || <span className="opacity-50">(N/A)</span>}</div>
            </div>
          </div>

          {r.diagnosis && (
            <div className="pt-1">
              <div className="font-medium text-xs text-gray-500">Diagnosis</div>
              <p className="text-gray-400">{r.diagnosis}</p>
            </div>
          )}
          {r.description && (
            <div className="pt-1">
              <div className="font-medium text-xs text-gray-500">Description</div>
              <p className="text-gray-400 whitespace-pre-wrap">{r.description}</p>
            </div>
          )}
          {r.keywords && (
            <div className="pt-1">
              <div className="font-medium text-xs text-gray-500">Keywords</div>
              <p className="text-gray-400">{r.keywords}</p>
            </div>
          )}
          {r.medication && (
            <div className="pt-1">
              <div className="font-medium text-xs text-gray-500">Medication</div>
              <p className="text-gray-400">{r.medication}</p>
            </div>
          )}

          <div className="pt-3 border-t">
            <button
              className="text-blue-600 hover:text-blue-800 underline disabled:opacity-50 font-medium"
              onClick={() => decryptAndView(r)}
              disabled={patientOk !== true}
            >
              View Encrypted File
            </button>
          </div>
        </div>
      ))}

      {/* existing viewer unchanged */}
      {openViewer && viewerUrl && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur flex flex-col z-[9999]">
          <div className="flex items-center gap-3 bg-black/40 text-white p-3">
            <button onClick={() => setOpenViewer(false)}>✕ Close</button>
            <a href={viewerUrl} download className="underline">Download</a>
            <button onClick={() => setZoom((z) => z + 0.1)}>Zoom +</button>
            <button onClick={() => setZoom((z) => Math.max(0.2, z - 0.1))}>Zoom −</button>
            <button onClick={() => setZoom(1)}>Fit</button>
          </div>

          <div className="flex-1 flex justify-center items-center overflow-auto p-4">
            {viewerMime?.includes("pdf") && <iframe src={viewerUrl} style={{ zoom }} className="w-full h-full" />}
            {viewerMime?.startsWith("image/") && <img src={viewerUrl} style={{ transform: `scale(${zoom})` }} />}
            {textPreview && (
              <pre
                className="text-white p-4 bg-black/30 rounded max-w-4xl overflow-auto whitespace-pre-wrap"
                style={{ transform: `scale(${zoom})` }}
              >
                {textPreview}
              </pre>
            )}
            {viewerMime?.startsWith("video/") && <video src={viewerUrl} controls style={{ transform: `scale(${zoom})` }} />}
            {viewerMime?.startsWith("audio/") && <audio src={viewerUrl} controls />}
          </div>
        </div>
      )}
    </main>
  );
}
