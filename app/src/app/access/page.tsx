"use client";

import { useEffect, useMemo, useState } from "react";
import * as anchor from "@coral-xyz/anchor";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import idl from "../../../anchor.json";
import {
  findGrantPda,
  findHospitalPda,
  findPatientPda,
  findConfigPda,
} from "@/lib/pda";
import { SCOPE_OPTIONS } from "@/lib/constants";
import dynamic from "next/dynamic";

const WalletMultiButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

type HospitalUi = {
  pubkey: string;
  authority: string;
  name: string;
  kmsRef: string;
  createdAt: number;
} | null;

type GrantUi = {
  pubkey: string;
  scope: number;
  patient: string; // PDA
  grantee: string; // hospital authority
  createdBy: string;
  createdAt: number;
  expiresAt?: number | null;
  revoked: boolean;
  revokedAt?: number | null;
};

export default function AccessManagerPage() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const [granteeStr, setGranteeStr] = useState(""); // hospital authority (optional filter)
  const [expiresStr, setExpiresStr] = useState(""); // epoch seconds (optional)
  const [err, setErr] = useState("");
  const [sig, setSig] = useState("");
  const [hospital, setHospital] = useState<HospitalUi>(null);

  const [patientExists, setPatientExists] = useState<boolean | null>(null);
  const [grants, setGrants] = useState<GrantUi[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState("");

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

  // Connected patient wallet & PDA
  const patientPk = wallet?.publicKey ?? null;
  const patientPda = useMemo(
    () => (patientPk ? findPatientPda(programId, patientPk) : null),
    [programId, patientPk]
  );

  // Parse optional grantee filter
  const grantee = useMemo(() => {
    try {
      const t = granteeStr.trim();
      return t ? new PublicKey(t) : null;
    } catch {
      return null;
    }
  }, [granteeStr]);

  // ---- Check if PATIENT is registered (Patient account exists) ----
  useEffect(() => {
    (async () => {
      setPatientExists(null);
      if (!program || !patientPda) return;
      try {
        // @ts-expect-error anchor account typing
        const acc = await program.account.patient.fetchNullable(patientPda);
        setPatientExists(!!acc);
      } catch {
        setPatientExists(false);
      }
    })();
  }, [program, patientPda]);

  // ---- Load hospital preview if a grantee is entered ----
  useEffect(() => {
    (async () => {
      setHospital(null);
      if (!program || !grantee) return;
      try {
        const hospitalPda = findHospitalPda(program.programId, grantee);
        // @ts-expect-error anchor account typing
        const acc = await program.account.hospital.fetchNullable(hospitalPda);
        if (!acc) { setHospital(null); return; }
        setHospital({
          pubkey: hospitalPda.toBase58(),
          authority: grantee.toBase58(),
          name: acc.name as string,
          kmsRef: acc.kmsRef as string,
          createdAt: Number(acc.createdAt),
        });
      } catch {
        setHospital(null);
      }
    })();
  }, [program, grantee]);

  // ---- Load GRANTS (always by Patient PDA; optionally by grantee) ----
  const loadGrants = async () => {
    setLoading(true);
    setLoadErr("");
    try {
      if (!program || !patientPda) {
        setGrants([]);
        setLoading(false);
        return;
      }

      // Build memcmp filters: patient (PDA) always; grantee if provided
      // Layout: adjust offsets to your actual Grant struct.
      // Commonly: discriminator(8) + patient(32) + grantee(32) + scope(u8) + ...
      const filters: anchor.web3.GetProgramAccountsFilter[] = [
        { memcmp: { offset: 8, bytes: patientPda.toBase58() } },
      ];
      if (grantee) {
        filters.push({ memcmp: { offset: 8 + 32, bytes: grantee.toBase58() } });
      }

      const raw = await program.account.grant.all(filters as any);
      const rows: GrantUi[] = raw.map((r: any) => ({
        pubkey: r.publicKey.toBase58(),
        scope: r.account.scope as number,
        patient: r.account.patient.toBase58(),
        grantee: r.account.grantee.toBase58(),
        createdBy: r.account.createdBy.toBase58?.() ?? r.account.createdBy,
        createdAt: Number(r.account.createdAt),
        expiresAt: r.account.expiresAt ? Number(r.account.expiresAt) : null,
        revoked: !!r.account.revoked,
        revokedAt: r.account.revokedAt ? Number(r.account.revokedAt) : null,
      }));

      // Sort newest first
      rows.sort((a, b) => b.createdAt - a.createdAt);
      setGrants(rows);
    } catch (e: any) {
      setLoadErr(e?.message ?? String(e));
      setGrants([]);
    } finally {
      setLoading(false);
    }
  };

  // auto-load on program/patient/grantee change
  useEffect(() => {
    void loadGrants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program, patientPda?.toBase58(), grantee?.toBase58()]);

  // ---- UI state for toggles ----
  const current: Record<number, boolean> = useMemo(() => {
    const m: Record<number, boolean> = {};
    for (const g of grants) if (!g.revoked) m[g.scope] = true;
    return m;
  }, [grants]);
  const [desired, setDesired] = useState<Record<number, boolean>>({});
  const flip = (bit: number) => setDesired(d => ({ ...d, [bit]: !d[bit] }));

  const bnOpt = (s: string) => {
    const t = s.trim();
    if (!t) return null;
    if (!/^\d+$/.test(t)) throw new Error("expires_at must be epoch seconds");
    return new anchor.BN(t);
  };

  const ensureReady = () => {
    if (!program || !wallet) throw new Error("Program/wallet not ready");
    if (!patientPk) throw new Error("Connect wallet first");
    if (!patientExists) throw new Error("You have not registered as a patient yet");
    if (!grantee) throw new Error("Invalid grantee (hospital authority) pubkey");
  };

  const assertHospitalRegistered = async () => {
    const hospitalPda = findHospitalPda(programId, grantee!);
    // @ts-expect-error anchor account typing
    const acc = await program!.account.hospital.fetchNullable(hospitalPda);
    if (!acc) throw new Error("Hospital not registered (no Hospital account for this authority)");
  };

  const upsertOne = async (scopeByte: number) => {
    setErr(""); setSig("");
    ensureReady();
    await assertHospitalRegistered();

    const grantPda = findGrantPda(programId, patientPda!, grantee!, scopeByte);
    const configPda = findConfigPda(programId);

    const tx = await program!.methods
      .grantAccess(scopeByte, bnOpt(expiresStr))
      .accounts({
        authority: wallet!.publicKey,   // patient signs
        config: configPda,
        patient: patientPda!,
        grant: grantPda,
        grantee: grantee!,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    setSig(tx);
  };

  const revokeOne = async (scopeByte: number) => {
    setErr(""); setSig("");
    ensureReady();
    await assertHospitalRegistered();

    const grantPda = findGrantPda(programId, patientPda!, grantee!, scopeByte);

    const tx = await program!.methods
      .revokeGrant()
      .accounts({
        patient: patientPda!,
        grant: grantPda,
        grantee: grantee!,
        authority: wallet!.publicKey,   // patient signs
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
          await loadGrants();
        } else if (!want && have) {
          await revokeOne(bit);
          await loadGrants();
        }
      }
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  };

  const revokeAll = async () => {
    try {
      for (const { bit } of SCOPE_OPTIONS) {
        if (current[bit]) {
          await revokeOne(bit);
        }
      }
      await loadGrants();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  };

  const canAct = !!program && !!patientPk && patientExists !== false;

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <header className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">Access Manager</h1>
        <WalletMultiButton />
      </header>

      {/* Patient registration status */}
      {patientExists === false && (
        <div className="rounded border border-red-600/40 bg-red-600/10 p-3 text-sm text-red-600">
          You haven’t registered as a patient yet. Go to <b>Patients (Upsert)</b> and create your patient record first.
        </div>
      )}

      <div className="grid gap-3">
        <input
          className="rounded border px-3 py-2 font-mono text-sm"
          placeholder="grantee (hospital authority pubkey) — leave empty to view all"
          value={granteeStr}
          onChange={(e) => setGranteeStr(e.target.value)}
        />
        <input
          className="rounded border px-3 py-2 text-sm"
          placeholder="expires_at epoch secs (optional)"
          value={expiresStr}
          onChange={(e) => setExpiresStr(e.target.value)}
        />

        {/* Hospital verification (only if a grantee is typed) */}
        {granteeStr.trim() && (
          <div className="rounded border p-3 text-sm">
            {hospital ? (
              <>
                <div className="font-medium">Hospital verified ✅</div>
                <div>PDA: <span className="font-mono">{hospital.pubkey}</span></div>
                <div>Authority: <span className="font-mono">{hospital.authority}</span></div>
                <div>Name: {hospital.name}</div>
                <div>KMS Ref: {hospital.kmsRef}</div>
                <div>Created: {new Date(hospital.createdAt * 1000).toLocaleString()}</div>
              </>
            ) : (
              <div className="text-yellow-600">Hospital not found for this authority (grants will be blocked).</div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-4 items-center text-sm">
          {SCOPE_OPTIONS.map(({ label, bit }) => (
            <label key={bit} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!desired[bit]}
                onChange={() => flip(bit)}
                disabled={!canAct || !grantee}
              />
              {label}
              <span className="text-xs text-gray-500">
                {current[bit] ? "(current: ON)" : "(current: off)"}
              </span>
            </label>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={save}
            disabled={!canAct || !grantee}
            className="rounded bg-black text-white px-4 py-2 disabled:opacity-50"
          >
            Save Access
          </button>
          <button
            onClick={revokeAll}
            disabled={!canAct || grants.every(g => g.revoked) || !grantee}
            className="rounded border px-4 py-2 disabled:opacity-50"
          >
            Revoke all for this hospital
          </button>
        </div>
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

        {/* If a grantee is set, show grants for that specific hospital; else show ALL hospital grants for this patient */}
        <div className="space-y-3">
          {grants.map((g) => (
            <div key={g.pubkey} className="rounded border p-3 text-sm">
              <p className="font-medium">
                Scope: {g.scope === 1 ? "Read" : g.scope === 2 ? "Write" : g.scope === 4 ? "Admin" : g.scope}
              </p>
              <p><b>Grant PDA:</b> <span className="font-mono">{g.pubkey}</span></p>
              <p><b>Patient (PDA):</b> <span className="font-mono">{g.patient}</span></p>
              <p><b>Grantee (Authority):</b> <span className="font-mono">{g.grantee}</span></p>
              <p><b>Created By:</b> <span className="font-mono">{g.createdBy}</span></p>
              <p><b>Created At:</b> {new Date(g.createdAt * 1000).toLocaleString()}</p>
              <p><b>Expires At:</b> {g.expiresAt ? new Date(g.expiresAt * 1000).toLocaleString() : "—"}</p>
              <p><b>Status:</b> {g.revoked ? `Revoked${g.revokedAt ? ` @ ${new Date(g.revokedAt * 1000).toLocaleString()}` : ""}` : "Active"}</p>

              {!g.revoked && grantee && (
                <button
                  className="mt-2 rounded border px-3 py-1 text-xs"
                  onClick={async () => {
                    try {
                      await revokeOne(g.scope);
                      await loadGrants();
                    } catch (e: any) {
                      setErr(e?.message ?? String(e));
                    }
                  }}
                >
                  Revoke this grant
                </button>
              )}
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
