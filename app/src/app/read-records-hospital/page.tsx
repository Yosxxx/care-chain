"use client";

import { useEffect, useState } from "react";
import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import sodium from "libsodium-wrappers";
import { useProgram } from "@/hooks/useProgram";
import { useWallet } from "@solana/wallet-adapter-react";
import {
    findPatientPda,
    findPatientSeqPda,
} from "@/lib/pda";
import dynamic from "next/dynamic";

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
    hospital_name: string;
    doctor_name: string;
    diagnosis: string;
    keywords: string;
    description: string;
    medication: string; // ✅ added field
};

const SCOPE_READ = 1;

// ---- local PDA helpers ----
const SEED_CONFIG = Buffer.from("config");
const SEED_RECORD = Buffer.from("record");
const SEED_HOSPITAL = Buffer.from("hospital");
const SEED_GRANT = Buffer.from("grant");

const findHospitalPda = (pid: PublicKey, hospitalAuthority: PublicKey) =>
    PublicKey.findProgramAddressSync([SEED_HOSPITAL, hospitalAuthority.toBuffer()], pid)[0];

const findGrantReadPda = (pid: PublicKey, patientPda: PublicKey, reader: PublicKey) =>
    PublicKey.findProgramAddressSync(
        [SEED_GRANT, patientPda.toBuffer(), reader.toBuffer(), Buffer.from([SCOPE_READ])],
        pid
    )[0];

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

export default function HospitalReadPage() {
    const { publicKey: hospitalWallet } = useWallet();
    const { program, programId, ready } = useProgram();

    const [patientInput, setPatientInput] = useState("");
    const [patientOk, setPatientOk] = useState<boolean | null>(null);
    const [hasGrant, setHasGrant] = useState<boolean | null>(null);
    const [grantExpiresAt, setGrantExpiresAt] = useState<number | null>(null);
    const [records, setRecords] = useState<Rec[]>([]);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");
    const [status, setStatus] = useState("");

    // viewer
    const [viewerUrl, setViewerUrl] = useState<string | null>(null);
    const [viewerMime, setViewerMime] = useState<string | null>(null);
    const [textPreview, setTextPreview] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [openViewer, setOpenViewer] = useState(false);

    const disabled = !ready || !program || !hospitalWallet;

    async function fetchPatientRecords() {
        setErr("");
        setStatus("");
        setRecords([]);
        setPatientOk(null);
        setHasGrant(null);
        setGrantExpiresAt(null);

        if (disabled) return;
        if (!patientInput.trim()) {
            setErr("Enter a patient wallet address.");
            return;
        }

        setLoading(true);
        try {
            const patientWalletPk = new PublicKey(patientInput.trim());
            const patientPda = findPatientPda(programId, patientWalletPk);

            // (1) patient exists?
            // @ts-expect-error
            const pAcc = await program!.account.patient.fetchNullable(patientPda);
            if (!pAcc) { setPatientOk(false); return; }
            setPatientOk(true);

            // (2) compute PDAs
            const hospitalPda = findHospitalPda(programId, hospitalWallet!);
            const grantReadPda = findGrantReadPda(programId, patientPda, hospitalWallet!);

            // (3) pre-check grant_read
            // @ts-expect-error
            const grantAcc = await program!.account.grant.fetchNullable(grantReadPda);
            const now = Math.floor(Date.now() / 1000);
            if (
                !grantAcc ||
                grantAcc.revoked ||
                (Number(grantAcc.expiresAt) !== 0 && Number(grantAcc.expiresAt) <= now) ||
                grantAcc.grantee.toBase58() !== hospitalWallet!.toBase58() ||
                grantAcc.patient.toBase58() !== patientPda.toBase58()
            ) {
                setHasGrant(false);
                setGrantExpiresAt(grantAcc ? Number(grantAcc.expiresAt) : null);
                return;
            }
            setHasGrant(true);
            setGrantExpiresAt(Number(grantAcc.expiresAt));

            // (4) list records and auto-fetch JSON metadata
            const patientSeqPda = findPatientSeqPda(programId, patientPda);
            // @ts-expect-error
            const seqAcc = await program!.account.patientSeq.fetch(patientSeqPda);
            const total = Number(seqAcc.value);

            const out: Rec[] = await Promise.all(
                Array.from({ length: total }).map(async (_, i) => {
                    const recordPda = PublicKey.findProgramAddressSync(
                        [SEED_RECORD, patientPda.toBuffer(), new anchor.BN(i).toArrayLike(Buffer, "le", 8)],
                        programId
                    )[0];
                    // @ts-expect-error
                    const rec = await program!.account.record.fetch(recordPda);
                    const base: Rec = {
                        seq: i,
                        pda: recordPda.toBase58(),
                        cidEnc: rec.cidEnc,
                        metaCid: rec.metaCid,
                        hospital: rec.hospital.toBase58(),
                        sizeBytes: Number(rec.sizeBytes),
                        createdAt: new Date(Number(rec.createdAt) * 1000).toLocaleString(),
                        hospital_name: rec.hospitalName,
                        doctor_name: rec.doctorName,
                        diagnosis: "",
                        keywords: "",
                        description: "",
                        medication: "", // ✅ initialize
                    };

                    // auto-load IPFS metadata JSON (no decryption required)
                    try {
                        const meta = await (await fetch(ipfsGateway(rec.metaCid), { cache: "no-store" })).json();
                        base.diagnosis = meta.diagnosis ?? "";
                        base.keywords = meta.keywords ?? "";
                        base.description = meta.description ?? "";
                        base.medication = meta.medication ?? ""; // ✅ parse medication
                    } catch (err) {
                        console.warn(`Failed to fetch metadata for record ${i}`, err);
                    }

                    return base;
                })
            );

            setRecords(out.reverse());
        } catch (e: any) {
            setErr(e?.message ?? String(e));
        } finally {
            setLoading(false);
        }
    }

    const deriveIxAccounts = (rec: Rec) => {
        if (!hospitalWallet) throw new Error("Connect hospital wallet.");
        if (!patientInput.trim()) throw new Error("Patient wallet is empty.");

        const patientWalletPk = new PublicKey(patientInput.trim());
        const patientPda = findPatientPda(programId, patientWalletPk);
        const patientSeqPda = findPatientSeqPda(programId, patientPda);
        const configPda = PublicKey.findProgramAddressSync([SEED_CONFIG], programId)[0];
        const hospitalPda = findHospitalPda(programId, hospitalWallet);
        const grantReadPda = findGrantReadPda(programId, patientPda, hospitalWallet);
        const recordPk = new PublicKey(rec.pda);

        return { configPda, patientPda, patientSeqPda, hospitalPda, grantReadPda, recordPk };
    };

    async function decryptAndView(rec: Rec) {
        try {
            if (!hasGrant) throw new Error("No active read grant.");
            setErr("");
            setOpenViewer(true);
            setViewerMime(null);
            setViewerUrl(null);
            setTextPreview(null);
            setZoom(1);
            setStatus("Authorizing on-chain…");

            if (!program || !hospitalWallet) throw new Error("Program or wallet not ready");

            const { configPda, patientPda, patientSeqPda, hospitalPda, grantReadPda, recordPk } =
                deriveIxAccounts(rec);

            await program.methods
                .readRecords(new anchor.BN(rec.seq))
                .accounts({
                    config: configPda,
                    reader: hospitalWallet,
                    patient: patientPda,
                    hospital: hospitalPda,
                    patientSeq: patientSeqPda,
                    grantRead: grantReadPda,
                    record: recordPk,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .rpc();

            setStatus("Authorized. Fetching encrypted metadata…");
            await sodium.ready;

            const meta = await (await fetch(ipfsGateway(rec.metaCid), { cache: "no-store" })).json();
            const chunkSize = meta.chunk_size ?? 1024 * 1024;
            const nonceBase = Uint8Array.from(Buffer.from(meta.nonce_base, "base64"));
            const aad = new TextEncoder().encode(meta.aad || "");
            const contentType = meta.original_content_type || "application/octet-stream";

            setStatus("Requesting KMS unwrap…");
            const unwrap = await (
                await fetch("/api/unwrap-dek", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ wrapped_dek_b64: meta.wrapped_dek, recordId: meta.aad }),
                })
            ).json();
            if (!unwrap?.dek_b64) throw new Error("Failed to unwrap DEK");
            const DEK = Uint8Array.from(Buffer.from(unwrap.dek_b64, "base64"));

            setStatus("Downloading & decrypting…");
            const res = await fetch(ipfsGateway(rec.cidEnc), { cache: "no-store" });
            if (!res.ok) throw new Error(`Failed to fetch ciphertext: ${res.status}`);
            const encBuf = new Uint8Array(await res.arrayBuffer());

            const chunks: Uint8Array[] = [];
            const TAG = sodium.crypto_aead_xchacha20poly1305_ietf_ABYTES;
            let off = 0, idx = 0;
            while (off < encBuf.length) {
                const clen = Math.min(chunkSize + TAG, encBuf.length - off);
                const cipher = encBuf.subarray(off, off + clen);
                off += clen;
                const nonce = deriveNonce(nonceBase, idx++);
                const plain = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(null, cipher, aad, nonce, DEK);
                chunks.push(plain);
            }

            const total = chunks.reduce((n, c) => n + c.length, 0);
            const merged = new Uint8Array(total);
            let p = 0; for (const c of chunks) { merged.set(c, p); p += c.length; }

            const blob = new Blob([merged], { type: contentType });
            const url = URL.createObjectURL(blob);
            setViewerUrl(url);
            setViewerMime(contentType);
            if (contentType.startsWith("text/") || contentType.includes("json")) {
                setTextPreview(await blob.text());
            }
            setStatus("Done.");
        } catch (e: any) {
            setErr(e?.message ?? String(e));
            setStatus("");
        }
    }

    return (
        <main className="max-w-3xl mx-auto p-6 space-y-6">
            <header className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">Hospital Read (Grant-Gated)</h1>
                <WalletMultiButton />
            </header>

            <div className="space-y-2">
                <label className="block text-sm font-medium">Patient Wallet (base58)</label>
                <input
                    value={patientInput}
                    onChange={(e) => setPatientInput(e.target.value)}
                    placeholder="Enter patient wallet address"
                    className="w-full rounded-md border px-3 py-2 bg-transparent"
                />
                <button
                    onClick={fetchPatientRecords}
                    disabled={!hospitalWallet || !ready}
                    className="rounded-md border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50"
                >
                    Load Patient Records
                </button>
            </div>

            <div className="text-sm space-y-2">
                {!hospitalWallet && (
                    <div className="rounded border border-yellow-600/40 bg-yellow-600/10 p-2 text-yellow-600">
                        Connect a <b>hospital</b> wallet to proceed.
                    </div>
                )}
                {hospitalWallet && patientOk === false && (
                    <div className="rounded border border-red-600/40 bg-red-600/10 p-2 text-red-600">
                        The entered wallet is not registered as a patient.
                    </div>
                )}
                {hospitalWallet && patientOk === true && hasGrant === false && (
                    <div className="rounded border border-red-600/40 bg-red-600/10 p-2 text-red-600">
                        No active read grant for this patient.
                        {grantExpiresAt ? ` Last expiry: ${new Date(grantExpiresAt * 1000).toLocaleString()}` : ""}
                    </div>
                )}
                {hospitalWallet && patientOk === true && hasGrant === true && (
                    <div className="rounded border border-emerald-600/40 bg-emerald-600/10 p-2 text-emerald-600">
                        Grant verified. Listing records…
                    </div>
                )}
            </div>

            {status && <p className="text-xs opacity-70">{status}</p>}
            {err && <p className="text-red-600 text-sm">{err}</p>}
            {loading && <p>Loading…</p>}

            {hasGrant === true && records.map((r) => (
                <div key={r.pda} className="border rounded-lg p-4 text-sm space-y-3 shadow-sm">
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
                            className="text-blue-600 hover:text-blue-800 underline font-medium"
                            onClick={() => decryptAndView(r)}
                        >
                            View Encrypted File
                        </button>
                    </div>

                    <details className="pt-2 text-xs text-gray-400">
                        <summary className="cursor-pointer hover:text-gray-600">Technical Details</summary>
                        <div className="font-mono break-all space-y-1 pt-2">
                            <div><span className="text-gray-500">Record PDA:</span> {r.pda}</div>
                            <div><span className="text-gray-500">CID Enc:</span> {r.cidEnc}</div>
                            <div><span className="text-gray-500">Hospital PDA:</span> {r.hospital}</div>
                        </div>
                    </details>
                </div>
            ))}

            {openViewer && viewerUrl && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur flex flex-col z-[9999]">
                    <div className="flex items-center gap-3 bg-black/40 text-white p-3">
                        <button onClick={() => setOpenViewer(false)}>✕ Close</button>
                        <a href={viewerUrl} download className="underline">Download</a>
                        <button onClick={() => setZoom(z => z + 0.1)}>Zoom +</button>
                        <button onClick={() => setZoom(z => Math.max(0.2, z - 0.1))}>Zoom −</button>
                        <button onClick={() => setZoom(1)}>Fit</button>
                    </div>
                    <div className="flex-1 flex justify-center items-center overflow-auto p-4">
                        {viewerMime?.includes("pdf") && <iframe src={viewerUrl} style={{ zoom }} className="w-full h-full" />}
                        {viewerMime?.startsWith("image/") && <img src={viewerUrl} style={{ transform: `scale(${zoom})` }} />}
                        {textPreview && (
                            <pre className="text-white p-4 bg-black/30 rounded max-w-4xl overflow-auto whitespace-pre-wrap" style={{ transform: `scale(${zoom})` }}>
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
