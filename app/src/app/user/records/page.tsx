"use client";

import { useEffect, useMemo, useState } from "react";
import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import sodium from "libsodium-wrappers";
import { useProgram } from "@/hooks/useProgram";
import { useWallet } from "@solana/wallet-adapter-react";
import { findPatientPda, findPatientSeqPda } from "@/lib/pda";
import dynamic from "next/dynamic";
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
import { ExternalLink } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const WalletMultiButton = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
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
  hospital_id: string;
  hospital_name: string;
  doctor_name: string;
  doctor_id: string;
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
  const totalPages = Math.ceil(records.length / perPage);

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
        const seqAcc = await (program.account as any).patientSeq.fetch(seqPda);
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

          // @ts-expect-error Anchor typing
          const rec = await (program.account as any).record.fetch(recordPda);

          out.push({
            seq: i,
            pda: recordPda.toBase58(),
            cidEnc: rec.cidEnc,
            metaCid: rec.metaCid,
            hospital: rec.hospital.toBase58(),
            sizeBytes: Number(rec.sizeBytes),
            createdAt: new Date(Number(rec.createdAt) * 1000).toLocaleString(),
            hospital_id: rec.hospitalId,
            hospital_name: rec.hospitalName,
            doctor_name: rec.doctorName,
            doctor_id: rec.doctorId,
            diagnosis: rec.diagnosis,
            keywords: rec.keywords,
            description: rec.description,
            txSignature: rec.txSignature ?? "",
          });
        }

        setRecords(out.reverse());
      } catch (e: any) {
        setErr(e?.message ?? String(e));
      }
    })();
  }, [ready, program, programId.toBase58(), publicKey?.toBase58()]);

  // ================== FILTERING + SORTING ==================
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

  const startIndex = (page - 1) * perPage;
  const paginated = filteredRecords.slice(startIndex, startIndex + perPage);

  // ================== DECRYPT + DOWNLOAD ==================
  async function handleDecryptAndDownload(rec: Rec) {
    try {
      await sodium.ready;
      const meta = await (await fetch(ipfsGateway(rec.metaCid))).json();

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

      const nonceBase = Uint8Array.from(Buffer.from(meta.nonce_base, "base64"));
      const aad = new TextEncoder().encode(meta.aad || "");
      const chunkSize: number = meta.chunk_size ?? 1024 * 1024;

      const res = await fetch(ipfsGateway(rec.cidEnc));
      const encBuf = new Uint8Array(await res.arrayBuffer());
      const TAG = sodium.crypto_aead_xchacha20poly1305_ietf_ABYTES;

      let off = 0;
      let idx = 0;
      const chunks: Uint8Array[] = [];

      while (off < encBuf.length) {
        const clen = Math.min(chunkSize + TAG, encBuf.length - off);
        const cipher = encBuf.subarray(off, off + clen);
        off += clen;
        const nonce = new Uint8Array(nonceBase);
        nonce[nonce.length - 4] = idx & 0xff;
        nonce[nonce.length - 3] = (idx >> 8) & 0xff;
        nonce[nonce.length - 2] = (idx >> 16) & 0xff;
        nonce[nonce.length - 1] = (idx >> 24) & 0xff;
        idx++;

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

      const contentType =
        meta.original_content_type || "application/octet-stream";
      const blob = new Blob([merged], { type: contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = meta.original_name || `record-${rec.seq}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.message ?? String(e));
    }
  }

  // ================== UI ==================
  return (
    <main className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">My Records</h1>
          <p className="text-gray-500">
            View and download your medical records
          </p>
        </div>
      </div>

      {!publicKey && (
        <div className="text-yellow-600 border border-yellow-600/40 bg-yellow-600/10 p-2 rounded">
          Connect wallet to load your records.
        </div>
      )}
      {publicKey && patientOk === false && (
        <div className="text-red-600 border border-red-600/40 bg-red-600/10 p-2 rounded">
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

      {/* Record Cards */}
      <div className="flex flex-col gap-y-4">
        {paginated.map((rec) => (
          <Collapsible key={rec.pda} className="border p-4 rounded">
            <CollapsibleTrigger className="w-full flex justify-between text-left">
              <div>
                <div className="font-semibold text-lg">
                  {rec.diagnosis || "Untitled Diagnosis"}
                </div>
                {rec.keywords && (
                  <div className="text-sm text-gray-500">{rec.keywords}</div>
                )}
              </div>
              <div className="text-sm text-gray-500">{rec.createdAt}</div>
            </CollapsibleTrigger>

            <CollapsibleContent className="mt-4 space-y-4 text-sm">
              {/* Two-row metadata layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-500 font-medium">
                    Hospital ID
                  </div>
                  <div className="font-mono border p-1 rounded">
                    {rec.hospital_id || "N/A"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-medium">
                    Doctor ID
                  </div>
                  <div className="font-mono border p-1 rounded">
                    {rec.doctor_id || "N/A"}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 font-medium">
                    Hospital Name
                  </div>
                  <div className="font-mono border p-1 rounded">
                    {rec.hospital_name || "N/A"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-medium">
                    Doctor Name
                  </div>
                  <div className="font-mono border p-1 rounded">
                    {rec.doctor_name || "N/A"}
                  </div>
                </div>
              </div>

              {/* Pubkey Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-500 font-medium">
                    Hospital Pubkey
                  </div>
                  <div className="font-mono border p-1 rounded break-all">
                    {rec.hospital}
                  </div>
                </div>
                <div />
              </div>

              <Separator className="my-2" />

              {/* Description */}
              {rec.description && (
                <div>
                  <div className="text-xs text-gray-500 font-medium">
                    Description
                  </div>
                  <p className="whitespace-pre-wrap border p-2 rounded">
                    {rec.description}
                  </p>
                </div>
              )}

              {/* Solscan Link */}
              {rec.txSignature && (
                <div>
                  <div className="text-xs text-gray-500 font-medium">
                    Transaction Signature
                  </div>
                  <a
                    href={`https://solscan.io/tx/${rec.txSignature}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-blue-600 hover:text-blue-800 underline"
                  >
                    View on Solscan <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}

              {/* Action */}
              <div className="pt-3 border-t mt-3">
                <Button onClick={() => handleDecryptAndDownload(rec)}>
                  Download Decrypted File
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>

      {records.length > perPage && (
        <Pagination>
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
    </main>
  );
}
