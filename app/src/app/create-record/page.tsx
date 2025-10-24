"use client";

import { useState, useMemo } from "react";
import * as anchor from "@coral-xyz/anchor";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import idl from "../../../anchor.json";
import {
  findConfigPda,
  findPatientPda,
  findPatientSeqPda,
  findHospitalPda,
  findGrantPda,
} from "@/lib/pda";

export default function CreateRecordPage() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const [patientStr, setPatientStr] = useState("");
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
        ? new anchor.AnchorProvider(connection, wallet, {
            commitment: "confirmed",
          })
        : null,
    [connection, wallet]
  );
  const program = useMemo(
    () => (provider ? new anchor.Program(idl as anchor.Idl, provider) : null),
    [provider]
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

  const createRecord = async () => {
    try {
      setStatus("Sending...");
      if (!program || !wallet || !patient)
        throw new Error("Program, wallet or patient missing");

      const hospitalAuth = wallet.publicKey;
      const configPda = findConfigPda(programId);
      const patientPda = findPatientPda(programId, patient);
      const patientSeqPda = findPatientSeqPda(programId, patientPda);
      const hospitalPda = findHospitalPda(programId, hospitalAuth);
      const grantWritePda = findGrantPda(
        programId,
        patientPda,
        hospitalAuth,
        2
      );

      const cidEnc = "cid_enc_demo";
      const metaMime = "application/json";
      const metaCid = "meta_cid_demo";
      const sizeBytes = new anchor.BN(1234);
      const hash = new Uint8Array(32); // blank hash for now
      const bytes = Buffer.from("demo");
      // Fetch current patient sequence
      // @ts-ignore
      const patientSeq = await (program.account as any).patientSeq.fetch(
        patientSeqPda
      );
      const seq = new anchor.BN(patientSeq.value); // try value instead of +1

      const tx = await program.methods
        .createRecord(
          seq,
          cidEnc,
          metaMime,
          metaCid,
          sizeBytes,
          Array.from(hash),
          bytes,
          bytes,
          bytes,
          { kms: {} },
          { kms: {} },
          { kms: {} },
          meta.hospital_name,
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

      <input
        className="w-full border rounded p-2 font-mono text-sm"
        placeholder="Patient Pubkey"
        value={patientStr}
        onChange={(e) => setPatientStr(e.target.value)}
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
        disabled={!program || !patient}
        onClick={createRecord}
        className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
      >
        Submit Record
      </button>

      {status && <p className="text-sm mt-2">{status}</p>}
    </main>
  );
}
