"use client";
import { useCallback, useEffect, useState } from "react";
import * as anchor from "@coral-xyz/anchor";

export type UiGrant = {
  pubkey: string;
  patient: string;
  grantee: string;
  scope: number;
  expiresAt: number | null;
  createdBy: string;
  createdAt: number;
  revoked: boolean;
  revokedAt: number | null;
};

export function useGrants(program: anchor.Program | null | undefined, filter?: { patient?: string; grantee?: string }) {
  const [grants, setGrants] = useState<UiGrant[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const refresh = useCallback(async () => {
    if (!program) return;
    setLoading(true); setErr("");
    try {
      const list = await program.account.grant.all();
      let mapped: UiGrant[] = list.map(({ publicKey, account }) => ({
        pubkey: publicKey.toBase58(),
        patient: account.patient.toBase58(),
        grantee: account.grantee.toBase58(),
        scope: account.scope,
        expiresAt: account.expiresAt ? Number(account.expiresAt) : null,
        createdBy: account.createdBy.toBase58(),
        createdAt: Number(account.createdAt),
        revoked: account.revoked,
        revokedAt: account.revokedAt ? Number(account.revokedAt) : null,
      }));
      if (filter?.patient) mapped = mapped.filter(g => g.patient === filter.patient);
      if (filter?.grantee) mapped = mapped.filter(g => g.grantee === filter.grantee);
      mapped.sort((a,b)=> b.createdAt - a.createdAt);
      setGrants(mapped);
    } catch (e:any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [program, filter?.patient, filter?.grantee]);

  useEffect(()=>{ refresh(); }, [refresh]);

  return { grants, loading, err, refresh };
}
    