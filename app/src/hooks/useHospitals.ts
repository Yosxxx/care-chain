"use client";
import { useCallback, useEffect, useState } from "react";
import * as anchor from "@coral-xyz/anchor";

export function useHospitals(program: anchor.Program | null | undefined) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const refresh = useCallback(async () => {
    if (!program) return;
    setLoading(true); setErr("");
    try {
      const list = await program.account.hospital.all();
      const mapped = list.map(({ publicKey, account }) => ({
        pubkey: publicKey.toBase58(),
        authority: account.authority.toBase58(),
        name: account.name,
        kmsRef: account.kmsRef,
        registeredBy: account.registeredBy.toBase58(),
        createdAt: Number(account.createdAt),
      })).sort((a,b)=>b.createdAt-a.createdAt);
      setRows(mapped);
    } catch (e:any) { setErr(e?.message ?? String(e)); }
    finally { setLoading(false); }
  }, [program]);

  useEffect(()=>{ refresh(); }, [refresh]);
  return { hospitals: rows, loading, err, refresh };
}
