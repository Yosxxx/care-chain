"use client";

import { useMemo, useState } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import idl from "../../../anchor.json";
import { findPatientPda, findPatientSeqPda } from "@/lib/pda";
import { MAX_DID_LEN } from "@/lib/constants";
import { hexToBytes, bytesToHex } from "@/lib/bytes";
import { blake2b256 } from "@/lib/hash";
import { usePatients } from "@/hooks/usePatients";

export default function PatientsPage() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const [patientStr, setPatientStr] = useState("");
  const [did, setDid] = useState("");
  const [idSource, setIdSource] = useState(""); // raw identifier to hash (e.g., national id)
  const [idHashHex, setIdHashHex] = useState(""); // or paste hex directly
  const [sig, setSig] = useState("");
  const [err, setErr] = useState("");

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
    [provider, programId]
  );

  const patientPk = useMemo(() => {
    try {
      return new PublicKey(patientStr.trim());
    } catch {
      return null;
    }
  }, [patientStr]);

  const patientPda = useMemo(
    () => (patientPk ? findPatientPda(programId, patientPk) : null),
    [programId, patientPk]
  );
  const seqPda = useMemo(
    () => (patientPda ? findPatientSeqPda(programId, patientPda) : null),
    [programId, patientPda]
  );

  const { patients, loading, err: loadErr, refresh } = usePatients(program);

  const computeHash = () => {
    try {
      const h = blake2b256(idSource.trim());
      setIdHashHex(bytesToHex(new Uint8Array(h)));
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  };

  const upsert = async () => {
    setSig("");
    setErr("");
    try {
      if (!program || !wallet) throw new Error("Program/wallet not ready");
      if (!patientPk) throw new Error("Invalid patient pubkey");

      const d = did.trim();
      if (!d) throw new Error("DID required");
      if (d.length > MAX_DID_LEN)
        throw new Error(`DID max ${MAX_DID_LEN} chars`);

      let idHash: Uint8Array;
      if (idHashHex.trim()) {
        const bytes = hexToBytes(idHashHex);
        if (bytes.length !== 32) throw new Error("id_hash must be 32 bytes");
        idHash = bytes;
      } else if (idSource.trim()) {
        const h = blake2b256(idSource.trim());
        idHash = new Uint8Array(h); // 32 bytes
      } else {
        throw new Error("Provide id_source to hash, or paste id_hash hex");
      }

      // ⚠️ TODO: change the method name/args to your actual instruction:
      // Suggested signature: patientsUpsert(idHashVec: number[], did: string)
      const tx = await program.methods
        .upsertPatient([...idHash], d) // <-- RENAME if different
        .accounts({
          // Typical accounts; adjust to match your on-chain context
          patientSigner: wallet.publicKey, // if your ix requires signer = the patient; or use "authority" if admin registers
          patient: patientPda!,
          patientSeq: seqPda!, // if your ix initializes/uses PatientSeq
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setSig(tx);
      setDid("");
      setIdSource("");
      setIdHashHex("");
      refresh();
    } catch (e: any) {
      // try to surface simulation logs
      try {
        const logs = await (e as anchor.web3.SendTransactionError).getLogs?.();
        if (logs && logs.length) {
          setErr(`${e.message}\n${logs.join("\n")}`);
          return;
        }
      } catch {}
      setErr(e?.message ?? String(e));
    }
  };

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Patients (Upsert)</h1>
        <WalletMultiButton />
      </header>

      <div className="grid gap-3">
        <input
          className="rounded border px-3 py-2 font-mono text-sm"
          placeholder="patient pubkey (base58)"
          value={patientStr}
          onChange={(e) => setPatientStr(e.target.value)}
        />

        <input
          className="rounded border px-3 py-2 text-sm"
          placeholder={`DID (≤ ${MAX_DID_LEN}) e.g. did:key:z6Mk...`}
          value={did}
          onChange={(e) => setDid(e.target.value)}
        />

        <div className="grid gap-2 rounded border p-3">
          <div className="text-sm font-medium">id_hash</div>
          <input
            className="rounded border px-3 py-2 text-sm"
            placeholder="id source (will be blake2b-256 hashed)"
            value={idSource}
            onChange={(e) => setIdSource(e.target.value)}
          />
          <button
            onClick={computeHash}
            className="rounded border px-3 py-1 w-fit text-xs"
          >
            Hash to 32-byte
          </button>
          <input
            className="rounded border px-3 py-2 font-mono text-xs"
            placeholder="or paste id_hash hex (0x… 64 hex chars)"
            value={idHashHex}
            onChange={(e) => setIdHashHex(e.target.value)}
          />
        </div>

        <button
          onClick={upsert}
          disabled={!program || !patientPk}
          className="rounded bg-black text-white px-4 py-2 disabled:opacity-50"
        >
          Upsert Patient
        </button>
      </div>

      {sig && (
        <p className="text-sm">
          Tx: <span className="font-mono">{sig}</span>
        </p>
      )}
      {err && (
        <pre className="text-sm text-red-600 whitespace-pre-wrap">{err}</pre>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">All Patients</h2>
        {loadErr && <p className="text-sm text-red-600">{loadErr}</p>}
        {loading && <p className="text-sm">Loading…</p>}
        <div className="space-y-3">
          {patients.map((p) => (
            <div key={p.pubkey} className="rounded border p-3 text-sm">
              <div>
                <b>Patient PDA:</b>{" "}
                <span className="font-mono">{p.pubkey}</span>
              </div>
              <div>
                <b>id_hash:</b>{" "}
                <span className="font-mono break-all">{p.idHashHex}</span>
              </div>
              <div>
                <b>DID:</b> {p.did}
              </div>
              <div>
                <b>Created At:</b>{" "}
                {new Date(p.createdAt * 1000).toLocaleString()}
              </div>
            </div>
          ))}
          {!loading && patients.length === 0 && (
            <p className="text-sm">No patients yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}
