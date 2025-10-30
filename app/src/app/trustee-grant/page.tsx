"use client";

import { useEffect, useMemo, useState } from "react";
import * as anchor from "@coral-xyz/anchor";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import idl from "../../../anchor.json";
import dynamic from "next/dynamic";
import {
    findConfigPda,
    findGrantPda,
    findHospitalPda,
    findPatientPda,
    findTrusteePda,
} from "@/lib/pda";

const WalletMultiButton = dynamic(
    async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
    { ssr: false }
);

const SCOPE_READ = 1;

export default function TrusteeGrantPage() {
    const { connection } = useConnection();
    const wallet = useAnchorWallet();

    const [patientStr, setPatientStr] = useState("");
    const [granteeStr, setGranteeStr] = useState("");
    const [expiresStr, setExpiresStr] = useState("");

    const [err, setErr] = useState("");
    const [status, setStatus] = useState("");
    const [sig, setSig] = useState("");

    const [hospital, setHospital] = useState<any>(null);
    const [trusteeOfPatient, setTrusteeOfPatient] = useState<boolean | null>(null);

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

    const trusteePk = wallet?.publicKey ?? null;

    // ---- Verify trustee relationship to patient ----
    useEffect(() => {
        (async () => {
            setTrusteeOfPatient(null);
            if (!program || !patientStr.trim() || !trusteePk) return;

            try {
                const patientPk = new PublicKey(patientStr.trim());
                const trusteePda = findTrusteePda(programId, patientPk, trusteePk);
                // @ts-expect-error
                const acc = await program.account.trustee.fetchNullable(trusteePda);
                if (!acc || acc.revoked) setTrusteeOfPatient(false);
                else setTrusteeOfPatient(true);
            } catch {
                setTrusteeOfPatient(false);
            }
        })();
    }, [program, patientStr, trusteePk]);

    // ---- Verify hospital authority ----
    useEffect(() => {
        (async () => {
            setHospital(null);
            if (!program || !granteeStr.trim()) return;
            try {
                const granteePk = new PublicKey(granteeStr.trim());
                const hospitalPda = findHospitalPda(program.programId, granteePk);
                // @ts-expect-error
                const acc = await program.account.hospital.fetchNullable(hospitalPda);
                if (!acc) return;
                setHospital({
                    authority: granteePk.toBase58(),
                    name: acc.name,
                    createdAt: Number(acc.createdAt),
                });
            } catch {
                setHospital(null);
            }
        })();
    }, [program, granteeStr]);

    const ensureReady = () => {
        if (!program || !wallet) throw new Error("Wallet/program not ready");
        if (!trusteePk) throw new Error("Connect trustee wallet first");
        if (!patientStr.trim()) throw new Error("Enter patient wallet address");
        if (!granteeStr.trim()) throw new Error("Enter hospital authority pubkey");
    };

    const bnOpt = (s: string) => {
        const t = s.trim();
        if (!t) return null;
        if (!/^\d+$/.test(t)) throw new Error("expires_at must be epoch seconds");
        return new anchor.BN(t);
    };

    // === Trustee directly creates READ grant ===
    const submitGrantDirect = async () => {
        try {
            setErr(""); setSig(""); setStatus("");
            ensureReady();
            if (!trusteeOfPatient) throw new Error("You are not a valid trustee of this patient.");

            const patientPk = new PublicKey(patientStr.trim());
            const granteePk = new PublicKey(granteeStr.trim());
            const patientPda = findPatientPda(programId, patientPk);
            const grantPda = findGrantPda(programId, patientPda, granteePk, SCOPE_READ);
            const configPda = findConfigPda(programId);
            const trusteePda = findTrusteePda(programId, patientPk, wallet!.publicKey);

            setStatus("Submitting transaction...");

            const txSig = await program!.methods
                .grantAccess(SCOPE_READ)
                .accounts({
                    authority: wallet!.publicKey,
                    config: configPda,
                    patient: patientPda,
                    grant: grantPda,
                    grantee: granteePk,
                    trusteeAccount: trusteePda,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            setSig(txSig);
            setStatus("✅ Grant successfully created and submitted.");
        } catch (e: any) {
            setErr(e?.message ?? String(e));
        }
    };

    return (
        <main className="max-w-2xl mx-auto p-6 space-y-6">
            <header className="flex justify-between items-center">
                <h1 className="text-xl font-semibold">Trustee Grant Access (READ only)</h1>
                <WalletMultiButton />
            </header>

            <input
                className="rounded border px-3 py-2 font-mono text-sm w-full"
                placeholder="Patient wallet address"
                value={patientStr}
                onChange={(e) => setPatientStr(e.target.value)}
            />

            {trusteeOfPatient === false && (
                <p className="text-sm text-red-600">
                    ❌ You are not a registered trustee for this patient.
                </p>
            )}
            {trusteeOfPatient === true && (
                <p className="text-sm text-green-600">
                    ✅ You are an active trustee for this patient.
                </p>
            )}

            <input
                className="rounded border px-3 py-2 font-mono text-sm w-full"
                placeholder="Hospital authority pubkey"
                value={granteeStr}
                onChange={(e) => setGranteeStr(e.target.value)}
            />

            {hospital && (
                <div className="rounded border p-3 text-sm">
                    <div className="font-medium">Hospital verified ✅</div>
                    <div>Name: {hospital.name}</div>
                    <div>
                        Authority: <span className="font-mono">{hospital.authority}</span>
                    </div>
                    <div>Created: {new Date(hospital.createdAt * 1000).toLocaleString()}</div>
                </div>
            )}

            <input
                className="rounded border px-3 py-2 text-sm w-full"
                placeholder="expires_at epoch secs (optional)"
                value={expiresStr}
                onChange={(e) => setExpiresStr(e.target.value)}
            />

            <button
                onClick={submitGrantDirect}
                disabled={!patientStr || !granteeStr || trusteeOfPatient !== true}
                className="rounded bg-black text-white px-4 py-2 disabled:opacity-50"
            >
                Create Grant (Trustee direct)
            </button>

            {status && <p className="text-sm whitespace-pre-wrap">{status}</p>}
            {sig && (
                <p className="text-sm">
                    Tx Signature: <span className="font-mono">{sig}</span>
                </p>
            )}
            {err && <p className="text-sm text-red-600 whitespace-pre-wrap">{err}</p>}
        </main>
    );
}
