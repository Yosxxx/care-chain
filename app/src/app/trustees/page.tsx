"use client";

import { useEffect, useMemo, useState } from "react";
import * as anchor from "@coral-xyz/anchor";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import idl from "../../../anchor.json";
import dynamic from "next/dynamic";
import { findPatientPda, findTrusteePda } from "@/lib/pda";

const WalletMultiButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

type TrusteeUi = {
  pubkey: string;
  patient: string;
  trustee: string;
  addedBy: string;
  createdAt: number;
  revoked: boolean;
  revokedAt?: number | null;
};

export default function TrusteesPage() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const [trusteeStr, setTrusteeStr] = useState("");
  const [trusteeValid, setTrusteeValid] = useState<boolean | null>(null);
  const [trustees, setTrustees] = useState<TrusteeUi[]>([]);
  const [patientExists, setPatientExists] = useState<boolean | null>(null);
  const [err, setErr] = useState("");
  const [status, setStatus] = useState("");
  const [sig, setSig] = useState("");
  const [pendingB64, setPendingB64] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [loading, setLoading] = useState(false);

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

  const patientPk = wallet?.publicKey ?? null;
  const patientPda = useMemo(
    () => (patientPk ? findPatientPda(programId, patientPk) : null),
    [programId, patientPk]
  );

  const ensureReady = () => {
    if (!program || !wallet) throw new Error("Program/wallet not ready");
    if (!patientPk) throw new Error("Connect wallet first");
    if (!patientExists) throw new Error("You have not registered as a patient yet");
  };

  async function checkTrusteeRegistered(pk: PublicKey) {
    if (!program) return;
    try {
      const tPda = findPatientPda(program.programId, pk);
      // @ts-expect-error anchor typing
      const acc = await program.account.patient.fetchNullable(tPda);
      setTrusteeValid(!!acc);
    } catch {
      setTrusteeValid(false);
    }
  }

  // === load patient registration ===
  useEffect(() => {
    (async () => {
      if (!program || !patientPda) return;
      try {
        // @ts-expect-error
        const acc = await program.account.patient.fetchNullable(patientPda);
        setPatientExists(!!acc);
      } catch {
        setPatientExists(false);
      }
    })();
  }, [program, patientPda]);

  // === load trustees list ===
  const loadTrustees = async () => {
    if (!program || !patientPk) return;
    setLoading(true);
    try {
      const filters: anchor.web3.GetProgramAccountsFilter[] = [
        { memcmp: { offset: 8, bytes: patientPk.toBase58() } },
      ];
      const raw = await program.account.trustee.all(filters as any);
      const rows: TrusteeUi[] = raw.map((r: any) => ({
        pubkey: r.publicKey.toBase58(),
        patient: r.account.patient.toBase58(),
        trustee: r.account.trustee.toBase58(),
        addedBy: r.account.addedBy.toBase58?.() ?? r.account.addedBy,
        createdAt: Number(r.account.createdAt),
        revoked: !!r.account.revoked,
        revokedAt: r.account.revokedAt ? Number(r.account.revokedAt) : null,
      }));
      rows.sort((a, b) => b.createdAt - a.createdAt);
      setTrustees(rows);
    } catch (e: any) {
      setErr(e.message ?? String(e));
      setTrustees([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTrustees();
  }, [program, patientPk?.toBase58()]);

  useEffect(() => {
    (async () => {
      setTrusteeValid(null);
      const t = trusteeStr.trim();
      if (!t || !program) return;
      try {
        const pk = new PublicKey(t);
        await checkTrusteeRegistered(pk);
      } catch {
        setTrusteeValid(false);
      }
    })();
  }, [trusteeStr, program]);

  // === prepare multi-sig tx (Add Trustee) ===
  const prepareAddTrustee = async () => {
    try {
      setErr(""); setStatus(""); setSig("");
      setPendingB64(""); setShareUrl("");

      ensureReady();

      const trusteePk = new PublicKey(trusteeStr.trim());
      if (!trusteeValid) throw new Error("This trustee wallet is not registered as a user.");

      const trusteePda = findTrusteePda(programId, patientPk!, trusteePk);

      setStatus("Building instruction...");
      const method = program!.methods
        .addTrustee()
        .accounts({
          patient: patientPk!,
          trustee: trusteePk,
          trusteeAccount: trusteePda,
          systemProgram: SystemProgram.programId,
        });

      const ix = await method.instruction();
      const { blockhash } = await connection.getLatestBlockhash("finalized");
      const tx = new Transaction({ feePayer: patientPk!, recentBlockhash: blockhash }).add(ix);

      const signedByPatient = await wallet!.signTransaction(tx);
      const b64 = Buffer.from(signedByPatient.serialize({ requireAllSignatures: false })).toString("base64");
      setPendingB64(b64);

      if (typeof window !== "undefined") {
        const url = `${window.location.origin}/co-sign-trustee?tx=${encodeURIComponent(b64)}`;
        setShareUrl(url);
      }

      setStatus("Share this with the trustee. They will co-sign & submit.");
    } catch (e: any) {
      setErr(e.message ?? String(e));
    }
  };

  // === Revoke Trustee ===
  const revokeTrustee = async (trusteePk: string) => {
    try {
      setErr(""); setStatus(""); setSig("");
      ensureReady();

      const trusteePda = findTrusteePda(programId, patientPk!, new PublicKey(trusteePk));

      const txSig = await program!.methods
        .revokeTrustee()
        .accounts({
          authority: wallet!.publicKey,
          patient: patientPda,
          trusteeAccount: trusteePda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setSig(txSig);
      setStatus("✅ Trustee revoked successfully.");
      await loadTrustees();
    } catch (e: any) {
      setErr(e.message ?? String(e));
    }
  };

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <header className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">Trustee Manager</h1>
        <WalletMultiButton />
      </header>

      {patientExists === false && (
        <div className="rounded border border-red-600/40 bg-red-600/10 p-3 text-sm text-red-600">
          You haven’t registered as a patient yet.
        </div>
      )}

      {/* ADD TRUSTEE FORM */}
      <section className="space-y-3">
        <input
          className="rounded border px-3 py-2 font-mono text-sm w-full"
          placeholder="trustee wallet pubkey"
          value={trusteeStr}
          onChange={(e) => setTrusteeStr(e.target.value)}
        />

        {trusteeValid === true && <div className="text-sm text-green-600">✅ Trustee is a registered user.</div>}
        {trusteeValid === false && <div className="text-sm text-red-600">❌ This wallet has no Patient account yet.</div>}

        <button
          onClick={prepareAddTrustee}
          disabled={!patientExists || !trusteeStr.trim() || trusteeValid !== true}
          className="rounded bg-black text-white px-4 py-2 disabled:opacity-50"
        >
          Prepare Add Trustee (patient signs)
        </button>

        {status && <p className="text-sm whitespace-pre-wrap">{status}</p>}

        {pendingB64 && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Base64 transaction (patient-signed). Send to the trustee:</label>
            <textarea
              readOnly
              className="w-full border rounded p-2 text-xs font-mono h-32"
              value={pendingB64}
            />
            {shareUrl && (
              <p className="text-xs break-all">
                Or share this link:{" "}
                <a className="underline" href={shareUrl} target="_blank" rel="noreferrer">
                  {shareUrl}
                </a>
              </p>
            )}
          </div>
        )}
      </section>

      {/* REVOKE + LIST */}
      {sig && (
        <p className="text-sm">
          Tx: <span className="font-mono">{sig}</span>
        </p>
      )}
      {err && <p className="text-sm text-red-600 whitespace-pre-wrap">{err}</p>}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Trustees</h2>
        {loading && <p className="text-sm">Loading…</p>}
        <div className="space-y-3">
          {trustees.map((t) => (
            <div key={t.pubkey} className="rounded border p-3 text-sm">
              <p><b>PDA:</b> <span className="font-mono">{t.pubkey}</span></p>
              <p><b>Trustee:</b> <span className="font-mono">{t.trustee}</span></p>
              <p><b>Added By:</b> <span className="font-mono">{t.addedBy}</span></p>
              <p><b>Created At:</b> {new Date(t.createdAt * 1000).toLocaleString()}</p>
              <p><b>Status:</b> {t.revoked ? "Revoked" : "Active"}</p>

              {!t.revoked && (
                <button
                  className="mt-2 rounded border px-3 py-1 text-xs"
                  onClick={() => revokeTrustee(t.trustee)}
                >
                  Revoke Trustee
                </button>
              )}
            </div>
          ))}
          {!loading && trustees.length === 0 && <p className="text-sm">No trustees found.</p>}
        </div>
      </section>
    </main>
  );
}
