"use client";

import { useEffect, useMemo, useState } from "react";
import * as anchor from "@coral-xyz/anchor";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import idl from "../../../anchor.json";
import {
  findHospitalPda,
} from "@/lib/pda";
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

export default function Page() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const [hospital, setHospital] = useState<HospitalUi>(null);
  const [grants, setGrants] = useState<GrantUi[]>([]);
  const [loadingGrants, setLoadingGrants] = useState(false);
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

  // The connected wallet is now assumed to be the GRANTEE (Hospital Authority)
  const grantee = wallet?.publicKey ?? null;

  // ---- Load hospital preview based on connected wallet ----
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

  // ---- Load GRANTS given TO this hospital ----
  const loadGrants = async () => {
    setLoadingGrants(true);
    setLoadErr("");
    try {
      if (!program || !grantee) {
        setGrants([]);
        setLoadingGrants(false);
        return;
      }

      // Build memcmp filter to find grants BY GRANTEE (this hospital's authority)
      // Layout: discriminator(8) + patient(32) + grantee(32)
      const filters: anchor.web3.GetProgramAccountsFilter[] = [
        { memcmp: { offset: 8 + 32, bytes: grantee.toBase58() } },
      ];

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
      setLoadingGrants(false);
    }
  };

  // auto-load on program/grantee change
  useEffect(() => {
    void loadGrants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program, grantee?.toBase58()]);

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <header className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">My Hospital's Grants</h1>
        <WalletMultiButton />
      </header>

      {/* Hospital Details Section */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Hospital Details</h2>
        {!grantee ? (
          <p className="text-sm text-gray-500">
            Connect your wallet to view your hospital's registration details.
          </p>
        ) : hospital ? (
          <div className="rounded border p-3 text-sm">
            <div className="font-medium">✅ Hospital Registered</div>
            <div>PDA: <span className="font-mono">{hospital.pubkey}</span></div>
            <div>Authority: <span className="font-mono">{hospital.authority}</span></div>
            <div>Name: {hospital.name}</div>
            <div>KMS Ref: {hospital.kmsRef}</div>
            <div>Created: {new Date(hospital.createdAt * 1000).toLocaleString()}</div>
          </div>
        ) : (
          <div className="rounded border border-yellow-600/40 bg-yellow-600/10 p-3 text-sm text-yellow-600">
            No hospital account found for this wallet.
          </div>
        )}
      </section>

      {/* Error display */}
      {loadErr && <p className="text-sm text-red-600 whitespace-pre-wrap">{loadErr}</p>}

      {/* Grants Received Section */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Grants Received</h2>
        {loadingGrants && <p className="text-sm">Loading grants…</p>}

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
              {/* Button removed */}
            </div>
          ))}
          {!loadingGrants && grants.length === 0 && (
            <p className="text-sm">No grants have been issued to this hospital yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}