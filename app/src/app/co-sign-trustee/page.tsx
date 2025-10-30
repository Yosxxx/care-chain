"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";

export default function CoSignTrusteePage() {
    const { connection } = useConnection();
    const { publicKey, signTransaction } = useWallet();

    const params = useSearchParams();
    const [b64, setB64] = useState("");
    const [status, setStatus] = useState("");

    // auto-fill from ?tx=...
    useEffect(() => {
        const q = params.get("tx");
        if (q) setB64(q);
    }, [params]);

    const canSign = useMemo(
        () => !!publicKey && !!signTransaction,
        [publicKey, signTransaction]
    );

    const coSignAndSend = async () => {
        try {
            if (!canSign) throw new Error("Connect trustee wallet first.");
            if (!b64.trim()) throw new Error("No transaction provided.");

            setStatus("Decoding transaction...");
            const tx = Transaction.from(Buffer.from(b64.trim(), "base64"));

            // Sign with trustee wallet (second required signer)
            setStatus("Co-signing...");
            const signed = await signTransaction!(tx);

            // Send
            setStatus("Submitting to cluster...");
            const sig = await connection.sendRawTransaction(
                signed.serialize()
            );
            await connection.confirmTransaction(sig, "confirmed");

            setStatus(`✅ Submitted: ${sig}`);
        } catch (e: any) {
            setStatus(`❌ ${e?.message || String(e)}`);
        }
    };

    return (
        <main className="max-w-xl mx-auto p-6 space-y-3">
            <h1 className="text-xl font-semibold">Trustee Co-Sign</h1>

            <textarea
                className="w-full border rounded p-2 text-xs font-mono h-40"
                placeholder="Paste base64 from the patient"
                value={b64}
                onChange={(e) => setB64(e.target.value)}
            />

            <button
                disabled={!canSign}
                onClick={coSignAndSend}
                className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
            >
                Co-Sign & Submit
            </button>

            {status && (
                <p className="text-sm whitespace-pre-wrap">{status}</p>
            )}
        </main>
    );
}
