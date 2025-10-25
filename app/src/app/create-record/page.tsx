"use client";

import { useState, useMemo } from "react";
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

const WalletMultiButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

export default function CreateRecordPage() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const [patientStr, setPatientStr] = useState(""); // base58 for PDAs/on-chain
  const [patientPkB64, setPatientPkB64] = useState("");   // pasted ed25519 PK (b64)
  const [hospitalPkB64, setHospitalPkB64] = useState(""); // pasted ed25519 PK (b64)
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
    [provider, programId]
  );

  const patient = useMemo(() => {
    try {
      return new PublicKey(patientStr.trim());
    } catch {
      return null;
    }
  }, [patientStr]);

  const handleChange = (key: string, val: string) =>
    setMeta((m) => ({ ...m, [key]: val }));

  function hexToU8(hex: string): Uint8Array {
    return new Uint8Array(Buffer.from(hex, "hex"));
  }

  function b64ToU8(b64: string): Uint8Array {
    return new Uint8Array(Buffer.from(b64, "base64"));
  }


  async function encUpload(): Promise<{
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
    if (!patientPkB64.trim()) throw new Error("Paste patientPk_b64");
    if (!hospitalPkB64.trim()) throw new Error("Paste hospitalPk_b64");

    const fd = new FormData();
    fd.append("file", file);
    fd.append("contentType", file.type || "application/octet-stream");
    // We now send PKs you pasted, not derived from wallet/base58.
    fd.append("patientPk_b64", patientPkB64.trim());
    fd.append("rsCreatorPk_b64", hospitalPkB64.trim());

    const r = await fetch("/create-record/enc-upload", { method: "POST", body: fd });
    const text = await r.text(); // more robust error surfacing
    if (!r.ok) throw new Error(text);
    return JSON.parse(text);
  }

  const createRecord = async () => {
    try {
      setStatus("Encrypting & uploading...");
      if (!program || !wallet || !patient)
        throw new Error("Program, wallet or patient missing");

      const {
        cidEnc,
        metaCid,
        sizeBytes,
        cipherHashHex,
        edekRoot_b64,
        edekPatient_b64,
        edekHospital_b64,
        kmsRef,
      } = await encUpload();

      setStatus("Deriving PDAs...");
      const hospitalAuth = wallet.publicKey;
      const configPda = findConfigPda(programId);
      const patientPda = findPatientPda(programId, patient);
      const patientSeqPda = findPatientSeqPda(programId, patientPda);
      const hospitalPda = findHospitalPda(programId, hospitalAuth);
      const grantWritePda = findGrantPda(programId, patientPda, hospitalAuth, 2);

      // @ts-ignore
      const patientSeq = await (program.account as any).patientSeq.fetch(patientSeqPda);
      const seq = new anchor.BN(patientSeq.value);

      const metaMime = "application/json";
      const sizeBn = new anchor.BN(sizeBytes);
      const hash32 = Array.from(hexToU8(cipherHashHex));
      const edekRoot = Buffer.from(b64ToU8(edekRoot_b64));
      const edekForPatient = Buffer.from(b64ToU8(edekPatient_b64));
      const edekForHospital = Buffer.from(b64ToU8(edekHospital_b64));
      console.log({
        hash32: hash32.constructor.name,
        edekRoot: edekRoot.constructor.name,
        edekForPatient: edekForPatient.constructor.name,
        edekForHospital: edekForHospital.constructor.name,
      });

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
          { kms: {} },
          { kms: {} },
          { kms: {} },
          kmsRef,
          meta.description,
          1,
          { xChaCha20: {} }
        )
        .accounts({
          uploader: wallet.publicKey,
          config: configPda,
          patient: patientPda,
          patientSeq: patientSeqPda,
          hospital: hospitalPda,
          grantWrite: grantWritePda,
          record: PublicKey.findProgramAddressSync(
            [
              Buffer.from("record"),
              patientPda.toBuffer(),
              seq.toArrayLike(Buffer, "le", 8),
            ],
            programId
          )[0],
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setStatus(`✅ Tx: ${tx}`);
    } catch (e: any) {
      setStatus(`❌ ${e.message}`);
    }
  };

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-4">
      <header className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">Hospital: Create Record</h1>
        <WalletMultiButton />
      </header>

      {/* On-chain patient identity (for PDA derivations) */}
      <input
        className="w-full border rounded p-2 font-mono text-sm"
        placeholder="Patient Pubkey (base58, Solana address)"
        value={patientStr}
        onChange={(e) => setPatientStr(e.target.value)}
      />

      {/* Crypto recipients (used for sealed-box). Paste Ed25519 PKs (base64, 32 bytes). */}
      <input
        className="w-full border rounded p-2 font-mono text-sm"
        placeholder="patientPk_b64 (Ed25519 public key, base64)"
        value={patientPkB64}
        onChange={(e) => setPatientPkB64(e.target.value)}
      />
      <input
        className="w-full border rounded p-2 font-mono text-sm"
        placeholder="hospitalPk_b64 (Ed25519 public key, base64)"
        value={hospitalPkB64}
        onChange={(e) => setHospitalPkB64(e.target.value)}
      />

      <input
        type="file"
        className="w-full border rounded p-2"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />

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
        disabled={!program || !patient || !file}
        onClick={createRecord}
        className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
      >
        Submit Record
      </button>

      {status && <p className="text-sm mt-2 whitespace-pre-wrap">{status}</p>}
    </main>
  );
}
