"use client";

import { useMemo, useState } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import idl from "../../../anchor.json";
import { findPatientPda, findPatientSeqPda } from "@/lib/pda";
import { MAX_DID_LEN } from "@/lib/constants";
import { hexToBytes, bytesToHex } from "@/lib/bytes";
import { blake2b256 } from "@/lib/hash";
import { usePatients } from "@/hooks/usePatients";
import dynamic from "next/dynamic";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { Buffer } from "buffer";

const WalletMultiButton = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

const ID_NAMESPACE = "carechain:id";

export default function PatientsPage() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const [did, setDid] = useState("");
  const [idSource, setIdSource] = useState("");
  const [idHashHex, setIdHashHex] = useState("");
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
    [provider]
  );

  // Always derive PDAs from the connected wallet (patient)
  const patientPk = wallet?.publicKey ?? null;
  const patientPda = useMemo(
    () => (patientPk ? findPatientPda(programId, patientPk) : null),
    [programId, patientPk]
  );
  const seqPda = useMemo(
    () => (patientPda ? findPatientSeqPda(programId, patientPda) : null),
    [programId, patientPda]
  );

  const { patients, loading, err: loadErr, refresh } = usePatients(program);

  // ----- DID helpers -----
  function useWalletDid() {
    try {
      if (!wallet?.publicKey) throw new Error("Connect wallet first");
      const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet";
      const didStr = `did:pkh:solana:${network}:${wallet.publicKey.toBase58()}`;
      if (didStr.length > MAX_DID_LEN)
        throw new Error("Derived DID exceeds max length");
      setDid(didStr);
      setErr("");
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  // multicodec prefix for Ed25519 pubkey = 0xED 0x01
  function didKeyFromEd25519Pub(pub: Uint8Array) {
    const prefixed = new Uint8Array(2 + pub.length);
    prefixed[0] = 0xed;
    prefixed[1] = 0x01;
    prefixed.set(pub, 2);
    return "did:key:z" + bs58.encode(prefixed);
  }

  function createDidKey() {
    try {
      const kp = nacl.sign.keyPair(); // KEEP secretKey private
      const didStr = didKeyFromEd25519Pub(kp.publicKey);
      if (didStr.length > MAX_DID_LEN)
        throw new Error("DID exceeds max length");
      setDid(didStr);
      // optional local stash (encrypt for prod)
      try {
        const payload = {
          did: didStr,
          ed25519SecretKeyBase64: Buffer.from(kp.secretKey).toString("base64"),
          createdAt: Date.now(),
        };
        localStorage.setItem(
          "carechain_didkey_ed25519",
          JSON.stringify(payload)
        );
      } catch {}
      setErr("");
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  // ----- id_hash helpers -----
  function normalizeId(raw: string) {
    return raw.trim().replace(/\s+/g, "").toUpperCase();
  }

  function computeHash() {
    try {
      const normalized = normalizeId(idSource);
      if (!normalized) throw new Error("Provide a non-empty ID source");
      const salt = (process.env.NEXT_PUBLIC_ID_SALT ?? "").trim(); // optional pepper
      const material = `${ID_NAMESPACE}:${programId.toBase58()}:${salt}:${normalized}`;
      const digest = new Uint8Array(blake2b256(material));
      setIdHashHex(bytesToHex(digest));
      setErr("");
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  function parseHexOrThrow(hex: string) {
    const clean = hex.trim().replace(/^0x/i, "");
    if (!/^[0-9a-fA-F]{64}$/.test(clean))
      throw new Error("id_hash hex must be 64 hex chars (32 bytes)");
    const bytes = hexToBytes(clean);
    if (bytes.length !== 32) throw new Error("id_hash must be 32 bytes");
    return bytes;
  }

  // ----- submit -----
  const upsert = async () => {
    setSig("");
    setErr("");
    try {
      if (!program || !wallet) throw new Error("Program/wallet not ready");
      if (!patientPk) throw new Error("Connect wallet first");

      const d = did.trim();
      if (!d) throw new Error("DID required");
      if (d.length > MAX_DID_LEN)
        throw new Error(`DID max ${MAX_DID_LEN} chars`);

      let idHash: Uint8Array;
      if (idHashHex.trim()) {
        idHash = parseHexOrThrow(idHashHex);
      } else if (idSource.trim()) {
        const normalized = normalizeId(idSource);
        const salt = (process.env.NEXT_PUBLIC_ID_SALT ?? "").trim();
        const material = `${ID_NAMESPACE}:${programId.toBase58()}:${salt}:${normalized}`;
        idHash = new Uint8Array(blake2b256(material));
      } else {
        throw new Error("Provide id_source (to hash) or paste id_hash hex");
      }

      const tx = await program.methods
        .upsertPatient([...idHash], d)
        .accounts({
          patientSigner: wallet.publicKey,
          patient: patientPda!,
          patientSeq: seqPda!,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setSig(tx);
      setDid("");
      setIdSource("");
      setIdHashHex("");
      refresh();
    } catch (e: any) {
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

  const canSubmit =
    !!program &&
    !!patientPk &&
    !!did.trim() &&
    (!!idHashHex.trim() || !!idSource.trim());

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Patients (Upsert)</h1>
        <WalletMultiButton />
      </header>

      <div className="grid gap-3">
        {/* DID */}
        <div className="grid gap-2 rounded border p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">DID</div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={useWalletDid}
                className="rounded border px-2 py-1 text-xs"
                disabled={!wallet?.publicKey}
                title="Derive did:pkh from connected wallet"
              >
                Use Wallet DID (did:pkh)
              </button>
              <button
                type="button"
                onClick={createDidKey}
                className="rounded border px-2 py-1 text-xs"
                title="Generate a did:key (Ed25519) locally"
              >
                Create DID (did:key)
              </button>
            </div>
          </div>
          <input
            className="rounded border px-3 py-2 text-sm"
            placeholder={`DID (≤ ${MAX_DID_LEN}) e.g. did:key:z6Mk... or did:pkh:solana:devnet:<pubkey>`}
            value={did}
            onChange={(e) => setDid(e.target.value)}
          />
          <p className="text-xs opacity-70">
            DID is a public identifier. Private keys stay in
            wallet/device/Vault.
          </p>
        </div>

        {/* id_hash */}
        <div className="grid gap-2 rounded border p-3">
          <div className="text-sm font-medium">id_hash</div>
          <input
            className="rounded border px-3 py-2 text-sm"
            placeholder="id source (e.g., MRN/NIK) — will be namespaced & blake2b-256 hashed"
            value={idSource}
            onChange={(e) => setIdSource(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={computeHash}
              className="rounded border px-3 py-1 w-fit text-xs"
            >
              Hash to 32-byte
            </button>
            {idHashHex && (
              <span className="text-xs opacity-70">
                {idHashHex.slice(0, 10)}…{idHashHex.slice(-10)} (
                {idHashHex.replace(/^0x/i, "").length / 2} bytes)
              </span>
            )}
          </div>
          <input
            className="rounded border px-3 py-2 font-mono text-xs"
            placeholder="or paste id_hash hex (0x… 64 hex chars)"
            value={idHashHex}
            onChange={(e) => setIdHashHex(e.target.value)}
          />
          <p className="text-xs opacity-70">
            Privacy: raw ID never leaves your browser; only the 32-byte digest
            is sent.
          </p>
        </div>

        <button
          onClick={upsert}
          disabled={!canSubmit}
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
                {new Date(p.createdAt * 1000).toLocaleString(undefined, {
                  hour12: false,
                })}
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
