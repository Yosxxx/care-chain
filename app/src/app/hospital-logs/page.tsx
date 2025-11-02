"use client";

import { useEffect, useState } from "react";
import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import sodium from "libsodium-wrappers";
import dynamic from "next/dynamic";
import { useProgram } from "@/hooks/useProgram";
import { useWallet } from "@solana/wallet-adapter-react";

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
    createdAtEpoch: number;
    hospital_name: string;
    doctor_name: string;
    diagnosis: string;
    keywords: string;
    description: string;
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

export default function HospitalRecordListPage() {
    const { publicKey: hospitalWallet } = useWallet();
    const { program, ready } = useProgram();

    const [records, setRecords] = useState<Rec[]>([]);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");
    const [filter, setFilter] = useState<"7" | "30" | "all">("all");
    const [simulateOld, setSimulateOld] = useState(false); // dev test
    const [status, setStatus] = useState("");
    const [viewerUrl, setViewerUrl] = useState<string | null>(null);
    const [viewerMime, setViewerMime] = useState<string | null>(null);
    const [textPreview, setTextPreview] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [openViewer, setOpenViewer] = useState(false);

    const disabled = !ready || !program || !hospitalWallet;

    async function fetchHospitalRecords() {
        if (disabled) return;
        setLoading(true);
        setErr("");
        setRecords([]);

        try {
            // 1) fetch all record accounts
            // @ts-expect-error
            const all = await program!.account.record.all();

            // 2) filter by hospital authority
            const mine = all.filter((r: any) => {
                const rec = r.account;
                const hp = rec.hospitalPubkey ?? rec.hospital_pubkey;
                return hp?.toBase58?.() === hospitalWallet!.toBase58();
            });

            // 3) load metadata
            const out: Rec[] = await Promise.all(
                mine.map(async (r: any) => {
                    const rec = r.account;
                    const createdAtEpoch = Number(rec.createdAt);

                    const base: Rec = {
                        seq: Number(rec.seq ?? 0),
                        pda: r.publicKey.toBase58(),
                        cidEnc: rec.cidEnc,
                        metaCid: rec.metaCid,
                        hospital: rec.hospital.toBase58(),
                        sizeBytes: Number(rec.sizeBytes),
                        createdAt: new Date(createdAtEpoch * 1000).toLocaleString(),
                        createdAtEpoch,
                        hospital_name: rec.hospitalName,
                        doctor_name: rec.doctorName,
                        diagnosis: "",
                        keywords: "",
                        description: "",
                    };

                    try {
                        const meta = await (await fetch(ipfsGateway(rec.metaCid), { cache: "no-store" })).json();
                        base.diagnosis = meta.diagnosis ?? "";
                        base.keywords = meta.keywords ?? "";
                        base.description = meta.description ?? "";
                    } catch (err) {
                        console.warn(`Failed to load metadata for record ${base.seq}`, err);
                    }

                    // simulate old records (for testing)
                    if (simulateOld && base.seq % 2 === 0) {
                        base.createdAtEpoch -= 40 * 24 * 3600;
                        base.createdAt = new Date(base.createdAtEpoch * 1000).toLocaleString();
                    }

                    return base;
                })
            );

            // sort newest first
            out.sort((a, b) => b.createdAtEpoch - a.createdAtEpoch);

            // filter by time
            const now = Math.floor(Date.now() / 1000);
            let filtered = out;
            if (filter === "7") {
                const cutoff = now - 7 * 24 * 3600;
                filtered = out.filter((r) => r.createdAtEpoch >= cutoff);
            } else if (filter === "30") {
                const cutoff = now - 30 * 24 * 3600;
                filtered = out.filter((r) => r.createdAtEpoch >= cutoff);
            }

            setRecords(filtered);
        } catch (e: any) {
            console.error(e);
            setErr(e?.message ?? String(e));
        } finally {
            setLoading(false);
        }
    }

    async function decryptAndView(rec: Rec) {
        try {
            setErr("");
            setStatus("Decrypting...");
            setOpenViewer(true);
            setViewerMime(null);
            setViewerUrl(null);
            setTextPreview(null);
            setZoom(1);

            await sodium.ready;
            const meta = await (await fetch(ipfsGateway(rec.metaCid), { cache: "no-store" })).json();

            const chunkSize = meta.chunk_size ?? 1024 * 1024;
            const nonceBase = Uint8Array.from(Buffer.from(meta.nonce_base, "base64"));
            const aad = new TextEncoder().encode(meta.aad || "");
            const contentType = meta.original_content_type || "application/octet-stream";

            setStatus("Requesting KMS unwrap...");
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

            setStatus("Downloading & decrypting...");
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
            setStatus("Decryption complete.");
        } catch (e: any) {
            setErr(e?.message ?? String(e));
            setStatus("");
        }
    }

    useEffect(() => {
        if (hospitalWallet && ready) fetchHospitalRecords();
    }, [hospitalWallet?.toBase58(), ready, filter, simulateOld]);

    return (
        <main className="max-w-3xl mx-auto p-6 space-y-6 text-sm">
            <header className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">Hospital Record List</h1>
                <WalletMultiButton />
            </header>

            {!hospitalWallet && (
                <div className="rounded border border-yellow-600/40 bg-yellow-600/10 p-2 text-yellow-600">
                    Connect a <b>hospital</b> wallet to view uploaded records.
                </div>
            )}

            {hospitalWallet && (
                <div className="flex flex-wrap gap-3 items-center">
                    <button
                        onClick={fetchHospitalRecords}
                        disabled={!ready || loading}
                        className="rounded-md border px-3 py-2 hover:bg-black/5 disabled:opacity-50"
                    >
                        {loading ? "Loading…" : "Reload Records"}
                    </button>

                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value as "7" | "30" | "all")}
                        className="border rounded-md px-2 py-1 bg-transparent text-sm"
                    >
                        <option value="7">Last 7 days</option>
                        <option value="30">Last 30 days</option>
                        <option value="all">All time</option>
                    </select>

                    <button
                        onClick={() => setSimulateOld((s) => !s)}
                        className={`rounded-md border px-2 py-1 text-xs ${simulateOld ? "bg-emerald-700 text-white" : "bg-black/10"
                            }`}
                    >
                        {simulateOld ? "🧪 Simulate OFF" : "🧪 Simulate Old Records"}
                    </button>
                </div>
            )}

            {status && <p className="text-xs opacity-70">{status}</p>}
            {err && <p className="text-red-600 text-sm">{err}</p>}

            {records.length === 0 && !loading && hospitalWallet && (
                <p className="text-gray-400">No records found for this filter.</p>
            )}

            {records.map((r, i) => (
                <div key={r.pda} className="border rounded-lg p-4 shadow-sm space-y-2">
                    <div className="flex justify-between items-center pb-2 border-b">
                        <div className="font-semibold">Record #{records.length - i}</div>
                        <div className="text-xs text-gray-500">{r.createdAt}</div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-xs">
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

                    <div className="pt-2 border-t">
                        <button
                            onClick={() => decryptAndView(r)}
                            className="text-blue-500 hover:text-blue-700 underline font-medium"
                        >
                            Decrypt & View / Download
                        </button>
                    </div>
                </div>
            ))}

            {openViewer && viewerUrl && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur flex flex-col z-[9999]">
                    <div className="flex items-center gap-3 bg-black/40 text-white p-3">
                        <button onClick={() => setOpenViewer(false)}>✕ Close</button>
                        <a href={viewerUrl} download className="underline">
                            Download
                        </a>
                        <button onClick={() => setZoom((z) => z + 0.1)}>Zoom +</button>
                        <button onClick={() => setZoom((z) => Math.max(0.2, z - 0.1))}>Zoom −</button>
                        <button onClick={() => setZoom(1)}>Fit</button>
                    </div>

                    <div className="flex-1 flex justify-center items-center overflow-auto p-4">
                        {viewerMime?.includes("pdf") && (
                            <iframe src={viewerUrl} style={{ zoom }} className="w-full h-full" />
                        )}
                        {viewerMime?.startsWith("image/") && (
                            <img src={viewerUrl} style={{ transform: `scale(${zoom})` }} />
                        )}
                        {textPreview && (
                            <pre
                                className="text-white p-4 bg-black/30 rounded max-w-4xl overflow-auto whitespace-pre-wrap"
                                style={{ transform: `scale(${zoom})` }}
                            >
                                {textPreview}
                            </pre>
                        )}
                        {viewerMime?.startsWith("video/") && (
                            <video src={viewerUrl} controls style={{ transform: `scale(${zoom})` }} />
                        )}
                        {viewerMime?.startsWith("audio/") && <audio src={viewerUrl} controls />}
                    </div>
                </div>
            )}
        </main>
    );
}
