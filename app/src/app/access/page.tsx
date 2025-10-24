"use client";

import { useMemo, useState } from "react";
import * as anchor from "@coral-xyz/anchor";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import idl from "../../../anchor.json"; // adjust path if needed
import { findGrantPda } from "@/lib/pda";
import { SCOPE_OPTIONS } from "@/lib/constants";
import { useGrants } from "@/hooks/useGrants";
import { findPatientPda, findConfigPda } from "@/lib/pda";

export default function AccessManagerPage() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const [patientStr, setPatientStr] = useState("");
  const [granteeStr, setGranteeStr] = useState("");
  const [expiresStr, setExpiresStr] = useState(""); // epoch seconds, optional
  const [err, setErr] = useState("");
  const [sig, setSig] = useState("");

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

  const patient = useMemo(() => {
    try {
      return new PublicKey(patientStr.trim());
    } catch {
      return null;
    }
  }, [patientStr]);
  const grantee = useMemo(() => {
    try {
      return new PublicKey(granteeStr.trim());
    } catch {
      return null;
    }
  }, [granteeStr]);

  const {
    grants,
    loading,
    err: loadErr,
    refresh,
  } = useGrants(program, {
    patient: patient?.toBase58(),
    grantee: grantee?.toBase58(),
  });

  // current active scopes (from chain)
  const current: Record<number, boolean> = useMemo(() => {
    const m: Record<number, boolean> = {};
    for (const g of grants) if (!g.revoked) m[g.scope] = true;
    return m;
  }, [grants]);

  // desired toggles (UI state)
  const [desired, setDesired] = useState<Record<number, boolean>>({});
  const flip = (bit: number) => setDesired((d) => ({ ...d, [bit]: !d[bit] }));

  const bnOpt = (s: string) => {
    const trimmed = s.trim();
    if (!trimmed) return null; // <-- this is the key change
    return new anchor.BN(trimmed);
  };

  const validate = () => {
    if (!program || !wallet) throw new Error("Program/wallet not ready");
    if (!patient) throw new Error("Invalid patient pubkey");
    if (!grantee)
      throw new Error("Invalid grantee (hospital authority) pubkey");
    if (expiresStr && !/^\d+$/.test(expiresStr.trim()))
      throw new Error("expires_at must be epoch seconds");
  };

  const upsertOne = async (scopeByte: number) => {
    setErr("");
    setSig("");
    validate();

    const patientPda = findPatientPda(programId, patient!);
    const grantPda = findGrantPda(programId, patientPda, grantee!, scopeByte);

    const configPda = findConfigPda(programId);

    const tx = await program!.methods
      .grantAccess(scopeByte, bnOpt(expiresStr))
      .accounts({
        authority: wallet!.publicKey,
        config: configPda,
        patient: patientPda,
        grant: grantPda,
        grantee: grantee!,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    setSig(tx);
  };

  const revokeOne = async (scopeByte: number) => {
    setErr("");
    setSig("");
    validate();

    const grantPda = findGrantPda(programId, patient!, grantee!, scopeByte);
    const patientPda = findPatientPda(programId, patient!);

    const tx = await program!.methods
      .revokeGrant()
      .accounts({
        patient: patientPda,
        grant: grantPda,
        grantee: grantee!,
        authority: wallet!.publicKey, // patient signs
      })
      .rpc();

    setSig(tx);
  };

  const save = async () => {
    try {
      for (const { bit } of SCOPE_OPTIONS) {
        const want = !!desired[bit];
        const have = !!current[bit];
        if (want && !have) {
          await upsertOne(bit);
          await refresh();
        } else if (!want && have) {
          await revokeOne(bit);
          await refresh();
        }
      }
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  };

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <header className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">Access Manager</h1>
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
          className="rounded border px-3 py-2 font-mono text-sm"
          placeholder="grantee (hospital authority pubkey)"
          value={granteeStr}
          onChange={(e) => setGranteeStr(e.target.value)}
        />
        <input
          className="rounded border px-3 py-2 text-sm"
          placeholder="expires_at epoch secs (optional)"
          value={expiresStr}
          onChange={(e) => setExpiresStr(e.target.value)}
        />

        <div className="flex flex-wrap gap-4 items-center text-sm">
          {SCOPE_OPTIONS.map(({ label, bit }) => (
            <label key={bit} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!desired[bit]}
                onChange={() => flip(bit)}
              />
              {label}
              <span className="text-xs text-gray-500">
                {current[bit] ? "(current: ON)" : "(current: off)"}
              </span>
            </label>
          ))}
        </div>

        <button
          onClick={save}
          disabled={!program || !patient || !grantee}
          className="rounded bg-black text-white px-4 py-2 disabled:opacity-50"
        >
          Save Access
        </button>
      </div>

      {sig && (
        <p className="text-sm">
          Tx: <span className="font-mono">{sig}</span>
        </p>
      )}
      {err && <p className="text-sm text-red-600 whitespace-pre-wrap">{err}</p>}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Grants (for this pair)</h2>
        {loadErr && <p className="text-sm text-red-600">{loadErr}</p>}
        {loading && <p className="text-sm">Loading…</p>}
        <div className="space-y-3">
          {grants.map((g) => (
            <div key={g.pubkey} className="rounded border p-3 text-sm">
              <p className="font-medium">
                Scope:{" "}
                {g.scope === 1
                  ? "Read"
                  : g.scope === 2
                  ? "Write"
                  : g.scope === 4
                  ? "Admin"
                  : g.scope}
              </p>
              <p>
                <b>Grant PDA:</b> <span className="font-mono">{g.pubkey}</span>
              </p>
              <p>
                <b>Patient:</b> <span className="font-mono">{g.patient}</span>
              </p>
              <p>
                <b>Grantee:</b> <span className="font-mono">{g.grantee}</span>
              </p>
              <p>
                <b>Created By:</b>{" "}
                <span className="font-mono">{g.createdBy}</span>
              </p>
              <p>
                <b>Created At:</b>{" "}
                {new Date(g.createdAt * 1000).toLocaleString()}
              </p>
              <p>
                <b>Expires At:</b>{" "}
                {g.expiresAt
                  ? new Date(g.expiresAt * 1000).toLocaleString()
                  : "—"}
              </p>
              <p>
                <b>Status:</b>{" "}
                {g.revoked
                  ? `Revoked${
                      g.revokedAt
                        ? ` @ ${new Date(g.revokedAt * 1000).toLocaleString()}`
                        : ""
                    }`
                  : "Active"}
              </p>
            </div>
          ))}
          {!loading && grants.length === 0 && (
            <p className="text-sm">No grants found.</p>
          )}
        </div>
      </section>
    </main>
  );
}
