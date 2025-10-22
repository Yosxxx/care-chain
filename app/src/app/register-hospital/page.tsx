"use client";
import { useState, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { useProgram } from "@/hooks/useProgram";
import { findConfigPda, findHospitalPda } from "@/lib/pda";
import { MAX_KMS_REF_LEN, MAX_NAME_LEN } from "@/lib/constants";
import { useHospitalEvents } from "@/hooks/useHospitalEvents";
import { useHospitals } from "@/hooks/useHospitals";
import dynamic from "next/dynamic";

const WalletMultiButtonDynamic = dynamic(
    async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
    { ssr: false }
);

export default function Page() {
    const { publicKey } = useWallet();
    const { program, ready, programId } = useProgram();

    const [authority, setAuthority] = useState("");
    const [name, setName] = useState("");
    const [kmsRef, setKmsRef] = useState("");
    const [sig, setSig] = useState("");
    const [err, setErr] = useState("");
    const [last, setLast] = useState<any | null>(null);

    const { hospitals, loading, refresh } = useHospitals(program);

    useHospitalEvents(program, (e) => {
        setLast({
            name: e.name,
            authority: e.hospitalAuthority.toBase58(),
            pda: e.hospital.toBase58(),
            kmsRef: e.kmsRef,
            createdAt: Number(e.createdAt),
        });
        refresh();
    });

    const authPk = useMemo(() => {
        try { return new PublicKey(authority.trim()); } catch { return null; }
    }, [authority]);

    const submit = async () => {
        setSig(""); setErr("");
        try {
            if (!ready || !program || !publicKey || !programId) throw new Error("Program/wallet not ready");
            if (!authPk) throw new Error("Invalid hospital authority");
            const n = name.trim(), k = kmsRef.trim();
            if (!n) throw new Error("Name required");
            if (n.length > MAX_NAME_LEN) throw new Error(`Name ≤ ${MAX_NAME_LEN}`);
            if (!k) throw new Error("kms_ref required");
            if (k.length > MAX_KMS_REF_LEN) throw new Error(`kms_ref ≤ ${MAX_KMS_REF_LEN}`);

            const config = findConfigPda(programId);
            const hospital = findHospitalPda(programId, authPk);

            const tx = await program.methods
                .registerHospitals(n, k)
                .accounts({ registrar: publicKey, config, hospitalAuthority: authPk, hospital, systemProgram: SystemProgram.programId })
                .rpc();

            setSig(tx);
            setName(""); setKmsRef("");
            refresh();
        } catch (e: any) { setErr(e?.message ?? String(e)); }
    };

    return (
        <main className="mx-auto max-w-2xl p-6 space-y-6">
            <header className="flex justify-between items-center">
                <h1 className="text-xl font-semibold">register_hospitals</h1>
                <WalletMultiButtonDynamic />
            </header>

            <div className="grid gap-3">
                <input className="rounded border px-3 py-2 font-mono text-sm" placeholder="hospital_authority (base58)" value={authority} onChange={e => setAuthority(e.target.value)} />
                <input className="rounded border px-3 py-2 text-sm" placeholder={`name (≤ ${MAX_NAME_LEN})`} value={name} onChange={e => setName(e.target.value)} />
                <input className="rounded border px-3 py-2 text-sm" placeholder={`kms_ref (≤ ${MAX_KMS_REF_LEN}) e.g. hosp-rs-harapan`} value={kmsRef} onChange={e => setKmsRef(e.target.value)} />
                <button onClick={submit} disabled={!ready} className="rounded bg-black text-white px-4 py-2 disabled:opacity-50">Send</button>
            </div>

            {sig && <p className="text-sm">Tx: <span className="font-mono">{sig}</span></p>}
            {err && <p className="text-sm text-red-600">{err}</p>}

            {last && (
                <div className="rounded border p-3 text-sm">
                    <p className="font-semibold mb-1">Last event</p>
                    <div>Name: {last.name}</div>
                    <div>Authority: <span className="font-mono">{last.authority}</span></div>
                    <div>Hospital PDA: <span className="font-mono">{last.pda}</span></div>
                    <div>KMS Ref: {last.kmsRef}</div>
                    <div>Created: {new Date(last.createdAt * 1000).toLocaleString()}</div>
                </div>
            )}

            <section>
                <h2 className="text-lg font-semibold mb-2">Hospitals</h2>
                {loading ? <p>Loading…</p> : (
                    <div className="space-y-2">
                        {hospitals.map(h => (
                            <div key={h.pubkey} className="rounded border p-3 text-sm">
                                <div className="font-medium">{h.name}</div>
                                <div>PDA: <span className="font-mono">{h.pubkey}</span></div>
                                <div>Authority: <span className="font-mono">{h.authority}</span></div>
                                <div>KMS Ref: {h.kmsRef}</div>
                                <div>Registered By: <span className="font-mono">{h.registeredBy}</span></div>
                                <div>Created: {new Date(h.createdAt * 1000).toLocaleString()}</div>
                            </div>
                        ))}
                        {hospitals.length === 0 && <p className="text-sm">No hospitals yet.</p>}
                    </div>
                )}
            </section>
        </main>
    );
}
