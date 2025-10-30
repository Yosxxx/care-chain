"use client";
import { useCallback, useEffect, useState } from "react";
import * as anchor from "@coral-xyz/anchor";

export type UiPatient = {
  pubkey: string;
  did: string;
  createdAt: number;
};

export function usePatients(program: anchor.Program | null | undefined) {
  const [patients, setPatients] = useState<UiPatient[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const refresh = useCallback(async () => {
    if (!program) return;
    setLoading(true); setErr("");
    try {
      const list = await program.account.patient.all();
      const mapped: UiPatient[] = list.map(({ publicKey, account }) => ({
        pubkey: publicKey.toBase58(),
        did: account.did,
        createdAt: Number(account.createdAt),
      })).sort((a,b)=> b.createdAt - a.createdAt);
      setPatients(mapped);
    } catch (e:any) { setErr(e?.message ?? String(e)); }
    finally { setLoading(false); }
  }, [program]);

  useEffect(()=>{ refresh(); }, [refresh]);

  return { patients, loading, err, refresh };
}
