"use client";

import { useEffect, useMemo, useState } from "react";
import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import sodium from "libsodium-wrappers";
import JSZip from "jszip";
import { useProgram } from "@/hooks/useProgram";
import { useWallet } from "@solana/wallet-adapter-react";
import { findPatientPda, findPatientSeqPda } from "@/lib/pda";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { FilterButton } from "@/components/filter-button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ChevronsUpDown, ExternalLink } from "lucide-react";
import { Separator } from "@/components/ui/separator";

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
  txSignature?: string;
};

const pinataGateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY?.trim();
const ipfsGateway = (cid: string) =>
  pinataGateway
    ? `${
        pinataGateway.startsWith("http")
          ? pinataGateway
          : `https://${pinataGateway}`
      }/ipfs/${cid}`
    : `https://ipfs.io/ipfs/${cid}`;

function deriveNonce(b: Uint8Array, idx: number) {
  const out = new Uint8Array(b);
  out[out.length - 4] = idx & 0xff;
  out[out.length - 3] = (idx >> 8) & 0xff;
  out[out.length - 2] = (idx >> 16) & 0xff;
  out[out.length - 1] = (idx >> 24) & 0xff;
  return out;
}

export default function Page() {
  const { publicKey } = useWallet();
  const { program, programId, ready } = useProgram();

  const [records, setRecords] = useState<Rec[]>([]);
  const [patientOk, setPatientOk] = useState<boolean | null>(null);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const perPage = 10;

  // State to track if a record has viewable/downloadable attachments
  const [attachmentStatus, setAttachmentStatus] = useState<
    Record<string, boolean>
  >({});

  // Viewer states
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerMime, setViewerMime] = useState<string | null>(null);
  const [textPreview, setTextPreview] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [openViewer, setOpenViewer] = useState(false);

  // ================== FETCH ON-CHAIN RECORDS ==================
  useEffect(() => {
    (async () => {
      setErr("");
      setRecords([]);
      setPatientOk(null);
      if (!ready || !program || !publicKey) return;

      try {
        const patientPda = findPatientPda(programId, publicKey);
        // @ts-expect-error anchor typing
        const pAcc = await program.account.patient.fetchNullable(patientPda);
        if (!pAcc) {
          setPatientOk(false);
          return;
        }
        setPatientOk(true);

        // get seq
        const seqPda = findPatientSeqPda(programId, patientPda);
        // @ts-expect-error
        const seqAcc = await program.account.patientSeq.fetch(seqPda);
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
          const rec = await program.account.record.fetch(recordPda);

          // Fetch meta.json from IPFS
          let meta: any = {};
          try {
            const metaRes = await fetch(ipfsGateway(rec.metaCid), {
              cache: "no-store",
            });
            meta = await metaRes.json();
          } catch {}

          out.push({
            seq: i,
            pda: recordPda.toBase58(),
            cidEnc: rec.cidEnc,
            metaCid: rec.metaCid,
            hospital: rec.hospital.toBase58(),
            sizeBytes: Number(rec.sizeBytes),
            createdAt: new Date(Number(rec.createdAt) * 1000).toLocaleString(),
            hospital_name: meta.hospital_name || rec.hospitalName || "",
            doctor_name: meta.doctor_name || rec.doctorName || "",
            diagnosis: meta.diagnosis || "",
            keywords: meta.keywords || "",
            description: meta.description || "",
            txSignature: rec.txSignature ?? "",
          });
        }

        setRecords(out.reverse());
      } catch (e: any) {
        setErr(e?.message ?? String(e));
      }
    })();
  }, [ready, program, programId.toBase58(), publicKey?.toBase58()]);

  // ================== CHECK FOR ATTACHMENTS (HEURISTIC) ==================
  useEffect(() => {
    if (records.length === 0) {
      setAttachmentStatus({});
      return;
    }

    const THRESHOLD_NO_ATTACHMENT = 5120; // 5 KB
    const newAttachmentStatus: Record<string, boolean> = {};

    for (const rec of records) {
      // If size is very small, assume NO attachments.
      // Otherwise, assume YES.
      newAttachmentStatus[rec.pda] = rec.sizeBytes > THRESHOLD_NO_ATTACHMENT;
    }
    setAttachmentStatus(newAttachmentStatus);
  }, [records]); // Dependency: run when records change

  // ================== DECRYPT & VIEW ==================
  async function decryptAndView(rec: Rec) {
    // Guard clause: Don't run if we know there are no attachments
    if (attachmentStatus[rec.pda] === false) {
      return;
    }
    try {
      setErr("");
      setOpenViewer(true);
      setViewerUrl(null);
      setViewerMime(null);
      setTextPreview(null);
      setZoom(1);

      await sodium.ready;
      const meta = await (
        await fetch(ipfsGateway(rec.metaCid), { cache: "no-store" })
      ).json();

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

      const chunkSize = meta.chunk_size ?? 1024 * 1024;
      const nonceBase = Uint8Array.from(Buffer.from(meta.nonce_base, "base64"));
      const aad = new TextEncoder().encode(meta.aad || "");
      const res = await fetch(ipfsGateway(rec.cidEnc));
      const encBuf = new Uint8Array(await res.arrayBuffer());

      const TAG = sodium.crypto_aead_xchacha20poly1305_ietf_ABYTES;
      const chunks: Uint8Array[] = [];
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

      // Since this function only runs if attachments are expected,
      // we can assume the decrypted content is a zip.
      // We will load it to extract the first non-JSON file for viewing.
      const zip = await JSZip.loadAsync(merged);
      const firstAttachment = Object.values(zip.files).find(
        (file) => !file.dir && file.name.toLowerCase() !== "medical_record.json"
      );

      if (!firstAttachment) {
        throw new Error(
          "Expected an attachment in the zip file, but none was found."
        );
      }

      const blob = await firstAttachment.async("blob");
      const url = URL.createObjectURL(blob);
      setViewerUrl(url);
      setViewerMime(blob.type); // Use the MIME type from the blob itself

      if (blob.type.startsWith("text/") || blob.type.includes("json")) {
        setTextPreview(await blob.text());
      }
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  // ================== FILTERING + PAGINATION ==================
  const filteredRecords = useMemo(() => {
    let filtered = records.filter((r) =>
      (r.diagnosis + r.keywords + r.description)
        .toLowerCase()
        .includes(search.toLowerCase())
    );

    if (filterMode === "doctor")
      filtered.sort((a, b) => a.doctor_name.localeCompare(b.doctor_name));
    else if (filterMode === "hospital")
      filtered.sort((a, b) => a.hospital_name.localeCompare(b.hospital_name));
    else if (filterMode === "dateAsc")
      filtered.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    else if (filterMode === "dateDesc")
      filtered.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    return filtered;
  }, [records, search, filterMode]);

  const totalPages = Math.ceil(filteredRecords.length / perPage);
  const startIndex = (page - 1) * perPage;
  const paginated = filteredRecords.slice(startIndex, startIndex + perPage);

  // ================== UI ==================
  return (
    <main className="space-y-6 my-5">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">My Records</h1>
          <p>View and decrypt your medical records securely</p>
        </div>
      </div>

      {!publicKey && (
        <div className="text-yellow-600 border border-yellow-600/40 bg-yellow-600/10 p-2 rounded-xs">
          Connect wallet to load your records.
        </div>
      )}
      {publicKey && patientOk === false && (
        <div className="text-red-600 border border-red-600/40 bg-red-600/10 p-2 rounded-xs">
          This wallet is not registered as a patient yet.
        </div>
      )}
      {err && <p className="text-red-600 text-sm">{err}</p>}

      <div className="flex gap-2">
        <Input
          placeholder="Search records..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />

        <FilterButton
          options={[
            { label: "Default", value: null },
            { label: "Doctor (A-Z)", value: "doctor" },
            { label: "Hospital (A-Z)", value: "hospital" },
            { label: "Date ↑", value: "dateAsc" },
            { label: "Date ↓", value: "dateDesc" },
          ]}
          selected={filterMode}
          onChange={(val) => {
            setFilterMode(val);
            setPage(1);
          }}
        />
      </div>

      <div className="flex flex-col gap-y-4">
        {paginated.map((rec) => (
          <Collapsible key={rec.pda} className="border p-4 rounded-xs">
            <CollapsibleTrigger className="w-full flex justify-between text-left items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate text-sm">
                  {rec.diagnosis || "Untitled Diagnosis"}
                </div>
                {rec.keywords && (
                  <div className="text-sm text-muted-foreground space-x-2">
                    <span>{rec.keywords}</span>
                  </div>
                )}
              </div>
              <div className="text-sm text-muted-foreground text-right whitespace-nowrap">
                {new Date(rec.createdAt).toLocaleDateString()}
              </div>
              <ChevronsUpDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </CollapsibleTrigger>

            <CollapsibleContent className="mt-4 space-y-4 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs font-medium">Hospital Name</div>
                  <div className="font-mono border p-2 rounded-xs">
                    {rec.hospital_name || "N/A"}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium">Doctor Name</div>
                  <div className="font-mono border p-2 rounded-xs">
                    {rec.doctor_name || "N/A"}
                  </div>
                </div>
              </div>

              <Separator className="my-2" />

              {rec.description && (
                <div>
                  <div className="text-xs font-medium">Description</div>
                  <p className="whitespace-pre-wrap border p-2 rounded-xs min-h-52 max-h-52">
                    {rec.description}
                  </p>
                </div>
              )}

              {rec.txSignature && (
                <div>
                  <div className="text-xs font-medium">
                    Transaction Signature
                  </div>
                  <a
                    href={`https://solscan.io/tx/${rec.txSignature}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-800 underline"
                  >
                    View on Solscan <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}

              <div className="pt-3 border-t mt-3">
                {/* --- MODIFIED BUTTON --- */}
                <Button
                  onClick={() => decryptAndView(rec)}
                  disabled={attachmentStatus[rec.pda] === false}
                >
                  {attachmentStatus[rec.pda] === false
                    ? "No Attachments"
                    : "View Encrypted File"}
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>

      {/* Pagination */}
      {filteredRecords.length > perPage && (
        <Pagination className="mb-5">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (page > 1) setPage(page - 1);
                }}
              />
            </PaginationItem>
            {Array.from({ length: totalPages }).map((_, i) => (
              <PaginationItem key={i}>
                <PaginationLink
                  href="#"
                  isActive={page === i + 1}
                  onClick={(e) => {
                    e.preventDefault();
                    setPage(i + 1);
                  }}
                >
                  {i + 1}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (page < totalPages) setPage(page + 1);
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {openViewer && viewerUrl && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur flex flex-col z-[9999]">
          <div className="flex items-center gap-3 bg-black/40 text-white p-3">
            <button onClick={() => setOpenViewer(false)}>✕ Close</button>
            <a href={viewerUrl} download className="underline">
              Download
            </a>
            <button onClick={() => setZoom((z) => z + 0.1)}>Zoom +</button>
            <button onClick={() => setZoom((z) => Math.max(0.2, z - 0.1))}>
              Zoom −
            </button>
            <button onClick={() => setZoom(1)}>Fit</button>
          </div>

          <div className="flex-1 flex justify-center items-center overflow-auto p-4">
            {viewerMime?.includes("pdf") && (
              <iframe
                src={viewerUrl}
                style={{ zoom }}
                className="w-full h-full"
              />
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
              <video
                src={viewerUrl}
                controls
                style={{ transform: `scale(${zoom})` }}
              />
            )}
            {viewerMime?.startsWith("audio/") && (
              <audio src={viewerUrl} controls />
            )}
          </div>
        </div>
      )}
    </main>
  );
}
