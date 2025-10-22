"use client";

import { useMemo, useState } from "react";
import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";

// IDL: adjust path if yours differs
import idl from "../../../anchor.json";

const SEED_CONFIG = Buffer.from("config");

export default function InitConfigPage() {
    const { connection } = useConnection();
    const wallet = useAnchorWallet();
    const { publicKey } = useWallet();

    const [kmsNs, setKmsNs] = useState("transit");
    const [sig, setSig] = useState("");
    const [err, setErr] = useState("");
    const [cfg, setCfg] = useState<any | null>(null);

    // envs
    const programId = useMemo(
        () => new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID!),
        []
    );
    const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "localnet";
    const rpc = process.env.NEXT_PUBLIC_RPC_URL ?? "(unset)";

    // provider & program
    const provider = useMemo(() => {
        if (!wallet) return null;
        return new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
    }, [connection, wallet]);

    const program = useMemo(() => {
        if (!provider) return null;
        return new anchor.Program(idl as anchor.Idl, provider);
    }, [provider, programId]);

    // PDAs
    const configPda = useMemo(
        () => PublicKey.findProgramAddressSync([SEED_CONFIG], programId)[0],
        [programId]
    );

    // helpers
    const fetchConfig = async () => {
        setErr("");
        try {
            if (!program) throw new Error("Program not ready");
            const acc = await program.account.config.fetch(configPda);
            setCfg({
                authority: acc.authority.toBase58(),
                paused: acc.paused,
                kmsNamespace: acc.kmsNamespace,
                bump: acc.bump,
            });
        } catch (e: any) {
            setCfg(null);
            setErr(e?.message ?? String(e));
        }
    };

    const initConfig = async () => {
        setSig(""); setErr("");
        try {
            if (!program || !wallet) throw new Error("Program/wallet not ready");

            const ns = kmsNs.trim();
            if (!ns) throw new Error("kms_namespace required");
            if (ns.length > 64) throw new Error("kms_namespace max length 64");

            const tx = await program.methods
                .initConfig(ns) // from your on-chain `config_init`
                .accounts({
                    config: configPda,                 // IMPORTANT
                    authority: wallet.publicKey!,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            setSig(tx);
            await fetchConfig();
        } catch (e: any) {
            // Try to surface simulation logs if available
            try {
                const logs = await (e as anchor.web3.SendTransactionError).getLogs?.();
                if (logs && logs.length) {
                    setErr(`${e.message}\nLogs:\n${logs.join("\n")}`);
                    return;
                }
            } catch { }
            setErr(e?.message ?? String(e));
        }
    };

    const airdrop = async () => {
        setErr("");
        try {
            if (!publicKey) throw new Error("Connect wallet first");
            const sig = await connection.requestAirdrop(publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
            await connection.confirmTransaction(sig, "confirmed");
        } catch (e: any) {
            setErr(e?.message ?? String(e));
        }
    };

    return (
        <main className="mx-auto max-w-2xl p-6 space-y-6">
            <header className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">init_config (admin)</h1>
                <WalletMultiButton />
            </header>

            <div className="rounded border p-3 text-xs font-mono space-y-1">
                <div>Cluster: {cluster}</div>
                <div>RPC: {rpc}</div>
                <div>Program: {programId.toBase58()}</div>
                <div>Config PDA: {configPda.toBase58()}</div>
                <div>Wallet: {publicKey ? publicKey.toBase58() : "(not connected)"}</div>
                {cluster === "localnet" && (
                    <button onClick={airdrop} className="mt-2 rounded border px-2 py-1">
                        Airdrop 2 SOL (localnet)
                    </button>
                )}
            </div>

            <div className="grid gap-3">
                <input
                    className="rounded border px-3 py-2 text-sm"
                    placeholder="kms_namespace (e.g. transit)"
                    value={kmsNs}
                    onChange={(e) => setKmsNs(e.target.value)}
                />
                <div className="flex gap-2">
                    <button
                        onClick={initConfig}
                        className="rounded bg-black text-white px-4 py-2 disabled:opacity-50"
                        disabled={!program || !publicKey}
                    >
                        Initialize
                    </button>
                    <button
                        onClick={fetchConfig}
                        className="rounded border px-4 py-2"
                        disabled={!program}
                    >
                        Read Config
                    </button>
                </div>
            </div>

            {sig && (
                <p className="text-sm">
                    Tx: <span className="font-mono">{sig}</span>
                </p>
            )}
            {err && (
                <pre className="whitespace-pre-wrap text-sm text-red-500">{err}</pre>
            )}

            {cfg && (
                <div className="rounded border p-3 text-sm">
                    <div><b>authority:</b> <span className="font-mono">{cfg.authority}</span></div>
                    <div><b>paused:</b> {String(cfg.paused)}</div>
                    <div><b>kms_namespace:</b> {cfg.kmsNamespace}</div>
                    <div><b>bump:</b> {cfg.bump}</div>
                </div>
            )}
        </main>
    );
}
