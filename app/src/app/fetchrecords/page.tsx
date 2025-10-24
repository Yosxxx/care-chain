"use client";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import * as anchor from "@coral-xyz/anchor";
import { useMemo } from "react";
import idl from "../../../anchor.json";
import { useRecords } from "@/hooks/useReocrds";

export default function RecordsPage() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

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

  const { records, loading, err, refresh } = useRecords(program);

  return (
    <main className="max-w-3xl mx-auto p-6">
      <header className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-semibold">All Medical Records</h1>
        <button
          onClick={refresh}
          className="bg-black text-white px-4 py-2 rounded"
        >
          Refresh
        </button>
      </header>

      {loading && <p>Loading...</p>}
      {err && <p className="text-red-600">{err}</p>}

      <ul className="space-y-3">
        {records.map((r) => (
          <li
            key={r.pubkey}
            className="border p-3 rounded font-mono text-sm space-y-1"
          >
            <p>
              <strong>Patient:</strong> {r.patient}
            </p>
            <p>
              <strong>Hospital:</strong> {r.hospitalName || r.hospital}
            </p>
            <p>
              <strong>Seq:</strong> {r.seq}
            </p>
            <p>
              <strong>Description:</strong> {r.description}
            </p>
            <p>
              <strong>Meta CID:</strong> {r.metaCid}
            </p>
            <p>
              <strong>Created:</strong>{" "}
              {new Date(r.createdAt * 1000).toLocaleString()}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
