"use client";
import { useCallback, useEffect, useState } from "react";
import * as anchor from "@coral-xyz/anchor";

export type UiRecord = {
  pubkey: string;
  patient: string;
  hospital: string;
  uploader: string;
  seq: number;
  cidEnc: string;
  metaMime: string;
  metaCid: string;
  sizeBytes: number;
  createdAt: number;
  hospitalName: string;
  description: string;
};

export function useRecords(program: anchor.Program | null | undefined) {
  const [records, setRecords] = useState<UiRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const refresh = useCallback(async () => {
    if (!program) return;
    setLoading(true);
    setErr("");
    try {
      const list = await program.account.record.all();

      const mapped: UiRecord[] = list
        .map(({ publicKey, account }) => ({
          pubkey: publicKey.toBase58(),
          patient: account.patient.toBase58?.() ?? "",
          hospital: account.hospital.toBase58?.() ?? "",
          uploader: account.uploader.toBase58?.() ?? "",
          seq: Number(account.seq ?? 0),
          cidEnc: account.cidEnc ?? "",
          metaMime: account.metaMime ?? "",
          metaCid: account.metaCid ?? "",
          sizeBytes: Number(account.sizeBytes ?? 0),
          createdAt: Number(account.createdAt ?? 0),
          hospitalName: account.hospitalName ?? "",
          description: account.description ?? "",
        }))
        .sort((a, b) => b.createdAt - a.createdAt);

      setRecords(mapped);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [program]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { records, loading, err, refresh };
}
