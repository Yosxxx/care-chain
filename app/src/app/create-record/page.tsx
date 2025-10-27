"use client";

import { useEffect, useMemo, useState } from "react";
import * as anchor from "@coral-xyz/anchor";
import { useConnection, useAnchorWallet, useWallet } from "@solana/wallet-adapter-react";
import dynamic from "next/dynamic";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  type TransactionInstruction,
} from "@solana/web3.js";
import idl from "../../../anchor.json";
import {
  findConfigPda,
  findPatientPda,
  findPatientSeqPda,
  findHospitalPda,
  findGrantPda,
} from "@/lib/pda";
import bs58 from "bs58";

const WalletMultiButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

export default function CreateRecordPage() {
  const { connection } = useConnection();

  // Anchor wallet for provider; useWallet for signTransaction access.
  const anchorWallet = useAnchorWallet();
  const { signTransaction: waSignTx } = useWallet();

  const [patientStr, setPatientStr] = useState(""); // base58 Solana address of patient
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState({
    hospital_id: "",
    hospital_name: "",
    doctor_name: "",
    doctor_id: "",
    diagnosis: "",
    keywords: "",
    description: "",
  });
  const [status, setStatus] = useState("");
  const [coSignBase64, setCoSignBase64] = useState("");
  const [shareUrl, setShareUrl] = useState("");

  // Keep the built instruction so we can refresh with a new blockhash
  const [lastIx, setLastIx] = useState<TransactionInstruction | null>(null);

  // Live checks
  const [hospitalOk, setHospitalOk] = useState<boolean | null>(null);
  const [patientOk, setPatientOk] = useState<boolean | null>(null);
  const [grantOk, setGrantOk] = useState<boolean | null>(null);
  const [grantErr, setGrantErr] = useState("");

  const programId = useMemo(
    () => new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID!),
    []
  );

  const provider = useMemo(
    () =>
      anchorWallet
        ? new anchor.AnchorProvider(connection, anchorWallet, { commitment: "confirmed" })
        : null,
    [connection, anchorWallet]
  );

  const program = useMemo(
    () => (provider ? new anchor.Program(idl as anchor.Idl, provider) : null),
    [provider]
  );

  const patientPk = useMemo(() => {
    try {
      return new PublicKey(patientStr.trim());
    } catch {
      return null;
    }
  }, [patientStr]);

  const handleChange = (k: string, v: string) =>
    setMeta((m) => ({ ...m, [k]: v }));

  // ---------- helpers ----------
  const u8ToB64 = (u8: Uint8Array) => Buffer.from(u8).toString("base64");
  const hexToU8 = (hex: string) => new Uint8Array(Buffer.from(hex, "hex"));
  const b64ToU8 = (b64: string) => new Uint8Array(Buffer.from(b64, "base64"));

  async function encUpload(
    patientPk_b64: string,
    hospitalPk_b64: string
  ): Promise<{
    cidEnc: string;
    metaCid: string;
    sizeBytes: number;
    cipherHashHex: string;
    edekRoot_b64: string;
    edekPatient_b64: string;
    edekHospital_b64: string;
    kmsRef: string;
  }> {
    if (!file) throw new Error("Choose a file first");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("contentType", file.type || "application/octet-stream");
    fd.append("patientPk_b64", patientPk_b64);
    fd.append("rsCreatorPk_b64", hospitalPk_b64);

    const r = await fetch("/create-record/enc-upload", { method: "POST", body: fd });
    const text = await r.text();
    if (!r.ok) throw new Error(text);
    return JSON.parse(text);
  }

  // ---------- live checkers ----------
  useEffect(() => {
    (async () => {
      if (!program || !anchorWallet?.publicKey) {
        setHospitalOk(null);
        return;
      }
      try {
        const hospitalPda = findHospitalPda(program.programId, anchorWallet.publicKey);
        // @ts-expect-error anchor typing
        const hAcc = await program.account.hospital.fetchNullable(hospitalPda);
        setHospitalOk(!!hAcc);
      } catch {
        setHospitalOk(false);
      }
    })();
  }, [program, anchorWallet?.publicKey]);

  useEffect(() => {
    (async () => {
      if (!program || !patientPk) {
        setPatientOk(null);
        return;
      }
      try {
        const patientPda = findPatientPda(program.programId, patientPk);
        // @ts-expect-error anchor typing
        const pAcc = await program.account.patient.fetchNullable(patientPda);
        setPatientOk(!!pAcc);
      } catch {
        setPatientOk(false);
      }
    })();
  }, [program, patientPk?.toBase58()]);

  useEffect(() => {
    (async () => {
      setGrantErr("");
      if (!program || !anchorWallet?.publicKey || !patientPk) {
        setGrantOk(null);
        return;
      }
      try {
        const patientPda = findPatientPda(program.programId, patientPk);
        const grantWritePda = findGrantPda(program.programId, patientPda, anchorWallet.publicKey, 2);
        // @ts-expect-error anchor typing
        const gAcc = await program.account.grant.fetchNullable(grantWritePda);
        if (!gAcc) {
          setGrantOk(false);
          setGrantErr("Grant not found");
          return;
        }
        if (gAcc.revoked) {
          setGrantOk(false);
          setGrantErr("Grant revoked");
          return;
        }
        setGrantOk(true);
      } catch (e: any) {
        setGrantOk(false);
        setGrantErr(e?.message ?? "Grant check failed");
      }
    })();
  }, [program, anchorWallet?.publicKey, patientPk?.toBase58()]);

  // Build shareable URL when base64 changes
  useEffect(() => {
    if (coSignBase64 && typeof window !== "undefined") {
      setShareUrl(`${window.location.origin}/co-sign?tx=${encodeURIComponent(coSignBase64)}`);
    } else {
      setShareUrl("");
    }
  }, [coSignBase64]);

  // ---------- main create ----------
  const createRecord = async () => {
    setCoSignBase64("");
    try {
      setStatus("Checking preconditions...");
      if (!program || !anchorWallet || !patientPk) throw new Error("Program, wallet or patient missing");
      if (!hospitalOk) throw new Error("Hospital not registered for this wallet.");
      if (!patientOk) throw new Error("Patient not registered. Ask the patient to upsert first.");
      if (!grantOk) throw new Error(grantErr || "Write access not granted by this patient.");

      const configPda = findConfigPda(programId);
      const patientPda = findPatientPda(programId, patientPk);
      const patientSeqPda = findPatientSeqPda(programId, patientPda);
      const hospitalPda = findHospitalPda(programId, anchorWallet.publicKey);
      const grantWritePda = findGrantPda(programId, patientPda, anchorWallet.publicKey, 2);

      // Base64 public keys for the upload service
      const patientPk_b64 = u8ToB64(bs58.decode(patientStr.trim()));
      const hospitalPk_b64 = u8ToB64(anchorWallet.publicKey.toBytes());

      setStatus("Encrypting & uploading...");
      const {
        cidEnc,
        metaCid,
        sizeBytes,
        cipherHashHex,
        edekRoot_b64,
        edekPatient_b64,
        edekHospital_b64,
        kmsRef,
      } = await encUpload(patientPk_b64, hospitalPk_b64);

      setStatus("Deriving sequence...");
      // @ts-expect-error anchor typing
      const patientSeq = await program.account.patientSeq.fetch(patientSeqPda);
      const seq = new anchor.BN(patientSeq.value);

      const metaMime = "application/json";
      const sizeBn = new anchor.BN(sizeBytes);
      const hash32 = Array.from(hexToU8(cipherHashHex));
      const edekRoot = Buffer.from(b64ToU8(edekRoot_b64));
      const edekForPatient = Buffer.from(b64ToU8(edekPatient_b64));
      const edekForHospital = Buffer.from(b64ToU8(edekHospital_b64));

      // Build Anchor method and obtain the raw instruction
      const method = program.methods
        .createRecord(
          seq,
          cidEnc,
          metaMime,
          metaCid,
          sizeBn,
          hash32,
          edekRoot,
          edekForPatient,
          edekForHospital,
          { kms: {} }, // edek_root_algo
          { kms: {} }, // edek_patient_algo
          { kms: {} }, // edek_hospital_algo
          kmsRef,
          1, // enc_version
          { xChaCha20: {} }, // enc_algo
          // extra metadata
          meta.hospital_id,
          meta.hospital_name,
          meta.doctor_name,
          meta.doctor_id,
          meta.diagnosis,
          meta.keywords,
          meta.description
        )
        .accounts({
          uploader: anchorWallet.publicKey, // hospital signer
          payer: patientPk,                 // patient co-signer (rent payer)
          config: configPda,
          patient: patientPda,
          patientSeq: patientSeqPda,
          hospital: hospitalPda,
          grantWrite: grantWritePda,
          record: PublicKey.findProgramAddressSync(
            [Buffer.from("record"), patientPda.toBuffer(), seq.toArrayLike(Buffer, "le", 8)],
            programId
          )[0],
          systemProgram: SystemProgram.programId,
        });

      // If both are the same wallet (dev), just send normally
      if (anchorWallet.publicKey.equals(patientPk)) {
        setStatus("Submitting (single-signer test path)...");
        const sig = await method.rpc();
        setStatus(`✅ Tx: ${sig}`);
        return;
      }

      // ---------- Multi-sign path (Hospital pays network fee) ----------
      setStatus("Building instruction...");
      const ix = await method.instruction();
      setLastIx(ix); // save for refresh

      setStatus("Compiling legacy message (feePayer = hospital)...");
      const { blockhash } = await connection.getLatestBlockhash("finalized");

      const ltx = new Transaction({
        feePayer: anchorWallet.publicKey,   // hospital pays fee
        recentBlockhash: blockhash,
      }).add(ix);

      if (!waSignTx) {
        throw new Error(
          "This wallet cannot sign transactions. Use Phantom/Backpack/Solflare or enable UnsafeBurnerWalletAdapter (dev only)."
        );
      }

      setStatus("Signing as hospital (legacy tx)...");
      const signedByHospital = await waSignTx(ltx);

      // Serialize WITHOUT requiring all signatures (patient still missing)
      const b64 = Buffer.from(
        signedByHospital.serialize({ requireAllSignatures: false })
      ).toString("base64");

      setCoSignBase64(b64);
      setStatus("Waiting for patient co-sign. Share the base64 or the link below with the patient.");
      // -----------------------------------------------------------------
    } catch (e: any) {
      const msg = e?.message || e?.toString?.() || "Unknown error";
      setStatus(`❌ ${msg}`);
    }
  };

  // Rebuild & re-sign wit a fresh blockhash (when patient reports "Blockhash not found")
  const refreshCosignTx = async () => {
    try {
      if (!anchorWallet || !lastIx) return;
      setStatus("Refreshihng co-sign transaction...");
      const { blockhash } = await connection.getLatestBlockhash("finalized");
      const ltx = new Transaction({
        feePayer: anchorWallet.publicKey,
        recentBlockhash: blockhash,
      }).add(lastIx);

      if (!waSignTx) throw new Error("Wallet cannot sign transactions.");
      const signedByHospital = await waSignTx(ltx);

      const b64 = Buffer.from(
        signedByHospital.serialize({ requireAllSignatures: false })
      ).toString("base64");

      setCoSignBase64(b64);
      setStatus("Share the new link/base64 with the patient.");
    } catch (e: any) {
      setStatus(`❌ ${e?.message || String(e)}`);
    }
  };

  // Keep the gate light; createRecord() performs full checks anyway
  const readyToSubmit =
    !!program &&
    !!anchorWallet?.publicKey &&
    !!patientPk &&
    !!file;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("✅ Copied to clipboard.");
    } catch {
      setStatus("⚠️ Copy failed. Select & copy manually.");
    }
  };

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-4">
      <header className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">Hospital: Create Record</h1>
        <WalletMultiButton />
      </header>

      {/* Status banners */}
      <div className="space-y-2 text-sm">
        {hospitalOk === false && (
          <div className="rounded border border-red-600/40 bg-red-600/10 p-2 text-red-600">
            This wallet is <b>not</b> a registered hospital authority.
          </div>
        )}
        {patientOk === false && (
          <div className="rounded border border-red-600/40 bg-red-600/10 p-2 text-red-600">
            Patient not registered.
          </div>
        )}
        {grantOk === false && (
          <div className="rounded border border-yellow-600/40 bg-yellow-600/10 p-2 text-yellow-600">
            Write grant missing: {grantErr || "patient must grant Write access to this hospital."}
          </div>
        )}
        {hospitalOk && patientOk && grantOk && (
          <div className="rounded border border-emerald-600/40 bg-emerald-600/10 p-2 text-emerald-600">
            All checks passed. You can submit the record.
          </div>
        )}
      </div>

      {/* On-chain patient identity (for PDAs) */}
      <input
        className="w-full border rounded p-2 font-mono text-sm"
        placeholder="Patient Pubkey (base58)"
        value={patientStr}
        onChange={(e) => setPatientStr(e.target.value)}
      />

      {/* File to encrypt & upload */}
      <input
        type="file"
        className="w-full border rounded p-2"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />

      {/* Optional metadata */}
      {Object.entries(meta).map(([k, v]) => (
        <input
          key={k}
          className="w-full border rounded p-2"
          placeholder={k.replace(/_/g, " ")}
          value={v}
          onChange={(e) => handleChange(k, e.target.value)}
        />
      ))}

      <button
        disabled={!readyToSubmit}
        onClick={createRecord}
        className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
      >
        Submit Record
      </button>

      {status && <p className="text-sm mt-2 whitespace-pre-wrap">{status}</p>}

      {/* Multi-sign output for patient */}
      {coSignBase64 && (
        <div className="mt-4 space-y-2">
          <label className="text-sm font-medium">
            Base64 transaction (hospital-signed). Send to the patient to co-sign &amp; submit:
          </label>
          <textarea
            readOnly
            className="w-full border rounded p-2 text-xs font-mono h-40"
            value={coSignBase64}
          />
          <div className="flex gap-2 items-center flex-wrap">
            <button
              onClick={() => copyToClipboard(coSignBase64)}
              className="bg-gray-800 text-white px-3 py-2 rounded"
            >
              Copy
            </button>
            <button
              onClick={refreshCosignTx}
              className="bg-gray-700 text-white px-3 py-2 rounded"
            >
              Refresh co-sign TX
            </button>
            {shareUrl && (
              <span className="text-xs break-all">
                or share this link:&nbsp;
                <a className="underline" href={shareUrl} target="_blank" rel="noreferrer">
                  {shareUrl}
                </a>
              </span>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
