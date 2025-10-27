"use client";

import { useEffect, useMemo, useState } from "react";
import * as anchor from "@coral-xyz/anchor";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import dynamic from "next/dynamic";
import { PublicKey, SystemProgram } from "@solana/web3.js";
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
  const wallet = useAnchorWallet();

  const [patientStr, setPatientStr] = useState(""); // patient Solana address (base58)
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

  // live checks
  const [hospitalOk, setHospitalOk] = useState<boolean | null>(null);
  const [patientOk, setPatientOk] = useState<boolean | null>(null);
  const [grantOk, setGrantOk] = useState<boolean | null>(null);
  const [grantErr, setGrantErr] = useState<string>("");

  const programId = useMemo(
    () => new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID!),
    []
  );

  const provider = useMemo(
    () =>
      wallet
        ? new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" })
        : null,
    [connection, wallet]
  );

  const program = useMemo(
    () => (provider ? new anchor.Program(idl as anchor.Idl, provider) : null),
    [provider]
  );

  const patientPk = useMemo(() => {
    try { return new PublicKey(patientStr.trim()); } catch { return null; }
  }, [patientStr]);

  const handleChange = (key: string, val: string) =>
    setMeta((m) => ({ ...m, [key]: val }));

  // ---------- helpers ----------
  const u8ToB64 = (u8: Uint8Array) => Buffer.from(u8).toString("base64");
  const hexToU8 = (hex: string) => new Uint8Array(Buffer.from(hex, "hex"));
  const b64ToU8 = (b64: string) => new Uint8Array(Buffer.from(b64, "base64"));

  async function encUpload(patientPk_b64: string, hospitalPk_b64: string): Promise<{
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
    fd.append("patientPk_b64", patientPk_b64);    // Ed25519 pubkey, base64
    fd.append("rsCreatorPk_b64", hospitalPk_b64); // Ed25519 pubkey, base64

    const r = await fetch("/create-record/enc-upload", { method: "POST", body: fd });
    const text = await r.text();
    if (!r.ok) throw new Error(text);
    return JSON.parse(text);
  }

  // ---------- live checkers ----------
  useEffect(() => {
    (async () => {
      if (!program || !wallet?.publicKey) {
        setHospitalOk(null);
        return;
      }
      try {
        const hospitalPda = findHospitalPda(program.programId, wallet.publicKey);
        // @ts-expect-error anchor typing
        const hAcc = await program.account.hospital.fetchNullable(hospitalPda);
        setHospitalOk(!!hAcc);
      } catch {
        setHospitalOk(false);
      }
    })();
  }, [program, wallet?.publicKey]);

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
      if (!program || !wallet?.publicKey || !patientPk) {
        setGrantOk(null);
        return;
      }
      try {
        const patientPda = findPatientPda(program.programId, patientPk);
        const grantWritePda = findGrantPda(program.programId, patientPda, wallet.publicKey, 2);
        // @ts-expect-error anchor typing
        const gAcc = await program.account.grant.fetchNullable(grantWritePda);
        if (!gAcc) { setGrantOk(false); setGrantErr("Grant not found"); return; }
        if (gAcc.revoked) { setGrantOk(false); setGrantErr("Grant revoked"); return; }
        setGrantOk(true);
      } catch (e: any) {
        setGrantOk(false);
        setGrantErr(e?.message ?? "Grant check failed");
      }
    })();
  }, [program, wallet?.publicKey, patientPk?.toBase58()]);

  // ---------- main create ----------
  const createRecord = async () => {
    try {
      setStatus("Checking preconditions...");
      if (!program || !wallet || !patientPk) throw new Error("Program, wallet or patient missing");
      if (!hospitalOk) throw new Error("Hospital not registered for this wallet.");
      if (!patientOk) throw new Error("Patient not registered. Ask the patient to upsert first.");
      if (!grantOk) throw new Error(grantErr || "Write access not granted by this patient.");

      const configPda = findConfigPda(programId);
      const patientPda = findPatientPda(programId, patientPk);
      const patientSeqPda = findPatientSeqPda(programId, patientPda);
      const hospitalPda = findHospitalPda(programId, wallet.publicKey);
      const grantWritePda = findGrantPda(programId, patientPda, wallet.publicKey, 2);

      // Derive Ed25519 public keys (base64) from Solana addresses
      const patientPk_b64 = u8ToB64(bs58.decode(patientStr.trim()));      // 32 bytes
      const hospitalPk_b64 = u8ToB64(wallet.publicKey.toBytes());         // 32 bytes

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

      setStatus("Deriving PDAs & sequence...");
      // @ts-expect-error anchor typing
      const patientSeq = await program.account.patientSeq.fetch(patientSeqPda);
      const seq = new anchor.BN(patientSeq.value);

      const metaMime = "application/json";
      const sizeBn = new anchor.BN(sizeBytes);
      const hash32 = Array.from(hexToU8(cipherHashHex));
      const edekRoot = Buffer.from(b64ToU8(edekRoot_b64));
      const edekForPatient = Buffer.from(b64ToU8(edekPatient_b64));
      const edekForHospital = Buffer.from(b64ToU8(edekHospital_b64));

      setStatus("Submitting transaction...");
      const tx = await program.methods
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

          // --- START: NEW ON-CHAIN ATTRIBUTES ---
          meta.hospital_id,
          meta.hospital_name,
          meta.doctor_name,
          meta.doctor_id,
          meta.diagnosis,
          meta.keywords,
          meta.description // <-- This is the new description field
          // --- END: NEW ON-CHAIN ATTRIBUTES ---
        )
        .accounts({
          uploader: wallet.publicKey,
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
        })
        .rpc();

      setStatus(`✅ Tx: ${tx}`);
    } catch (e: any) {
      setStatus(`❌ ${e.message ?? String(e)}`);
    }
  };

  const readyToSubmit =
    !!program &&
    !!wallet?.publicKey &&
    !!patientPk &&
    !!file &&
    hospitalOk === true &&
    patientOk === true &&
    grantOk === true;

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
            Patient not registered. Ask them to upsert on the Patients page.
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

      {/* On-chain patient identity (for PDA derivations) */}
      <input
        className="w-full border rounded p-2 font-mono text-sm"
        placeholder="Patient Pubkey (base58, Solana address)"
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
    </main>
  );
}
