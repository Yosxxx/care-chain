"use client";

import { useState, useEffect, ChangeEvent, useMemo } from "react";
import JSZip from "jszip";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Undo2 } from "lucide-react";
import { GetHospitalData } from "@/action/GetHospitalData";

// --- SOLANA IMPORTS ---
import * as anchor from "@coral-xyz/anchor";
import {
  useConnection,
  useAnchorWallet,
  useWallet, // <-- ADDED
} from "@solana/wallet-adapter-react";
import {
  PublicKey,
  SystemProgram,
  Transaction, // <-- ADDED
  type TransactionInstruction, // <-- ADDED
} from "@solana/web3.js";
import idl from "../../../../anchor.json";
import {
  findPatientPda,
  findConfigPda,
  findPatientSeqPda,
  findHospitalPda,
  findGrantPda,
} from "@/lib/pda";
import bs58 from "bs58";
import { Textarea } from "@/components/ui/textarea";

interface MedicalRecord {
  patient_pubkey: string;
  hospital_id: string | null;
  hospital_pubkey: string | null;
  hospital_name: string | null;
  doctor_id: string;
  doctor_name: string;
  diagnosis: string;
  keywords: string;
  description: string;
}

interface HospitalData {
  hospital_id: string;
  name: string;
  authority_pubkey: string;
}

export default function Page() {
  const [record, setRecord] = useState<MedicalRecord | null>(null);
  const [original, setOriginal] = useState<MedicalRecord | null>(null);
  const [zipName, setZipName] = useState<string | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [images, setImages] = useState<{ name: string; blob: Blob }[]>([]);
  const [hospitalData, setHospitalData] = useState<HospitalData | null>(null);

  // --- SOLANA STATE & HOOKS ---
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const { signTransaction: waSignTx } = useWallet(); // <-- ADDED
  const [patientCheckStatus, setPatientCheckStatus] = useState<string | null>(
    null
  );
  const [status, setStatus] = useState("");

  // --- LIVE CHECKS STATE ---
  const [hospitalOk, setHospitalOk] = useState<boolean | null>(null);
  const [patientAccountOk, setPatientAccountOk] = useState<boolean | null>(
    null
  );
  const [grantOk, setGrantOk] = useState<boolean | null>(null);
  const [grantErr, setGrantErr] = useState<string>("");

  // --- CO-SIGN STATE (COPIED) ---
  const [lastIx, setLastIx] = useState<TransactionInstruction | null>(null);
  const [coSignBase64, setCoSignBase64] = useState("");
  const [shareUrl, setShareUrl] = useState("");

  const programId = useMemo(
    () => new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID!),
    []
  );

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

  const patientPk = useMemo(() => {
    if (!record?.patient_pubkey) return null;
    try {
      return new PublicKey(record.patient_pubkey.trim());
    } catch {
      return null;
    }
  }, [record?.patient_pubkey]);

  // ==================== HELPERS (COPIED) ====================
  const u8ToB64 = (u8: Uint8Array) => Buffer.from(u8).toString("base64");
  const hexToU8 = (hex: string) => new Uint8Array(Buffer.from(hex, "hex"));
  const b64ToU8 = (b64: string) => new Uint8Array(Buffer.from(b64, "base64"));

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("✅ Copied to clipboard.");
    } catch {
      setStatus("⚠️ Copy failed. Select & copy manually.");
    }
  };

  // ==================== ENC UPLOAD (MODIFIED) ====================
  async function encUpload(
    file: File,
    patientPk_b64: string,
    hospitalPk_b64: string
  ): Promise<{
    cidEnc: string;
    metaCid: string;
    sizeBytes: number;
    cipherHashHex: string;
    edekRoot_b64: string;
    edekPatient_b64: string;
    edekHospital_b64: string;
    kmsRef: string;
  }> {
    if (!file) throw new Error("No file provided for upload");

    const fd = new FormData();
    fd.append("file", file);
    fd.append("contentType", file.type || "application/octet-stream");
    fd.append("patientPk_b64", patientPk_b64);
    fd.append("rsCreatorPk_b64", hospitalPk_b64);

    // Make sure this API route matches your file structure
    const r = await fetch("/api/enc-upload", { method: "POST", body: fd });

    const text = await r.text();
    if (!r.ok) throw new Error(text);
    return JSON.parse(text);
  }

  // ==================== LIVE CHECKERS (COPIED & ADAPTED) ====================
  // Check 1: Is connected wallet a registered hospital?
  useEffect(() => {
    (async () => {
      if (!program || !wallet?.publicKey) {
        setHospitalOk(null);
        return;
      }
      try {
        const hospitalPda = findHospitalPda(
          program.programId,
          wallet.publicKey
        );
        // @ts-expect-error anchor typing
        const hAcc = await program.account.hospital.fetchNullable(hospitalPda);
        setHospitalOk(!!hAcc);
      } catch {
        setHospitalOk(false);
      }
    })();
  }, [program, wallet?.publicKey]);

  // Check 2: Does the patient pubkey exist?
  useEffect(() => {
    const checkPatient = async () => {
      if (!program || !patientPk) {
        setPatientAccountOk(null);
        if (record?.patient_pubkey) {
          setPatientCheckStatus("❌ Invalid Pubkey format");
        } else {
          setPatientCheckStatus(null);
        }
        return;
      }

      try {
        setPatientCheckStatus("Checking patient account...");
        const patientPda = findPatientPda(program.programId, patientPk);
        // @ts-expect-error anchor typing
        const pAcc = await program.account.patient.fetchNullable(patientPda);

        if (pAcc) {
          setPatientAccountOk(true);
          setPatientCheckStatus("✅ Patient account exists on-chain.");
        } else {
          setPatientAccountOk(false);
          setPatientCheckStatus(
            "❌ Patient account not found (not registered)."
          );
        }
      } catch (e: any) {
        setPatientAccountOk(false);
        setPatientCheckStatus(`Error: ${e.message}`);
      }
    };

    checkPatient();
  }, [program, patientPk?.toBase58()]);

  // Check 3: Does this hospital have a Write Grant from this patient?
  useEffect(() => {
    (async () => {
      setGrantErr("");
      if (!program || !wallet?.publicKey || !patientPk) {
        setGrantOk(null);
        return;
      }
      try {
        const patientPda = findPatientPda(program.programId, patientPk);
        const grantWritePda = findGrantPda(
          program.programId,
          patientPda,
          wallet.publicKey,
          2 // GrantLevel.Write
        );
        // @ts-expect-error anchor typing
        const gAcc = await program.account.grant.fetchNullable(grantWritePda);
        if (!gAcc) {
          setGrantOk(false);
          setGrantErr("Grant not found");
          return;
        }
        if (gAcc.revoked) {
          setGrantOk(false);
          setGrantErr("Grant revoked");
          return;
        }
        setGrantOk(true);
      } catch (e: any) {
        setGrantOk(false);
        setGrantErr(e?.message ?? "Grant check failed");
      }
    })();
  }, [program, wallet?.publicKey, patientPk?.toBase58()]);

  // Build shareable URL when base64 changes
  useEffect(() => {
    if (coSignBase64 && typeof window !== "undefined") {
      setShareUrl(
        `${window.location.origin}/co-sign?tx=${encodeURIComponent(
          coSignBase64
        )}`
      );
    } else {
      setShareUrl("");
    }
  }, [coSignBase64]);

  // ==================== FETCH HOSPITAL INFO ====================
  useEffect(() => {
    const fetchHospital = async () => {
      try {
        const data = await GetHospitalData();
        setHospitalData(data);
      } catch (err: unknown) {
        if (err instanceof Error)
          console.error("Failed to fetch hospital data:", err.message);
      }
    };
    fetchHospital();
  }, []);

  // ==================== LOAD ZIP ====================
  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    // ... (This function remains unchanged) ...
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const zip = await JSZip.loadAsync(file);
      const jsonFile = zip.file("medical_record.json");
      if (!jsonFile) {
        alert("medical_record.json not found");
        return;
      }

      const jsonText = await jsonFile.async("string");
      const data: MedicalRecord = JSON.parse(jsonText);
      setRecord(data);
      setOriginal(data);
      setZipName(file.name);

      // Extract images
      const imgs = await Promise.all(
        Object.values(zip.files)
          .filter((f) => /\.(jpe?g|png|webp|bmp)$/i.test(f.name) && !f.dir)
          .map(async (f) => ({ name: f.name, blob: await f.async("blob") }))
      );
      setImages(imgs);
      setPreviews(imgs.map((i) => URL.createObjectURL(i.blob)));

      // Auto-fill hospital info if available
      if (hospitalData) {
        setRecord((prev) =>
          prev
            ? {
                ...prev,
                hospital_id: hospitalData.hospital_id,
                hospital_pubkey: hospitalData.authority_pubkey,
                hospital_name: hospitalData.name,
              }
            : prev
        );
      }
    } catch (err: unknown) {
      console.error("Error reading zip:", err);
      alert("Failed to parse zip");
    }
  };

  // ==================== HELPERS ====================
  const handleChange = (key: keyof MedicalRecord, value: string) =>
    record && setRecord({ ...record, [key]: value });

  const handleReset = (key: keyof MedicalRecord) =>
    record && original && setRecord({ ...record, [key]: original[key] });

  const handleFill = () => {
    // ... (This function remains unchanged) ...
    if (!record || !hospitalData) return;
    setRecord({
      ...record,
      hospital_id: hospitalData.hospital_id,
      hospital_pubkey: hospitalData.authority_pubkey,
      hospital_name: hospitalData.name,
    });
  };

  const handleDownloadZip = async () => {
    // ... (This function remains unchanged) ...
    if (!record) return;

    const zip = new JSZip();
    zip.file("medical_record.json", JSON.stringify(record, null, 2));
    images.forEach((img) => zip.file(img.name, img.blob));

    const blob = await zip.generateAsync({ type: "blob" });

    // --- Filename structure: patient_pubkey + hospital_pubkey + date ---
    const patientKey =
      record.patient_pubkey?.replace(/[^a-zA-Z0-9_-]/g, "") ||
      "unknown_patient";
    const hospitalKey =
      record.hospital_pubkey?.replace(/[^a-zA-Z0-9_-]/g, "") ||
      "unknown_hospital";

    const timestamp = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace("T", "_")
      .split(".")[0];

    const filename = `${patientKey}_${hospitalKey}_${timestamp}.zip`;

    // --- Download trigger ---
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // ==================== REFRESH TX (COPIED) ====================
  const refreshCosignTx = async () => {
    try {
      if (!wallet || !lastIx) return;
      setStatus("Refreshihng co-sign transaction...");
      const { blockhash } = await connection.getLatestBlockhash("finalized");
      const ltx = new Transaction({
        feePayer: wallet.publicKey,
        recentBlockhash: blockhash,
      }).add(lastIx);

      if (!waSignTx) throw new Error("Wallet cannot sign transactions.");
      const signedByHospital = await waSignTx(ltx);

      const b64 = Buffer.from(
        signedByHospital.serialize({ requireAllSignatures: false })
      ).toString("base64");

      setCoSignBase64(b64);
      setStatus("Share the new link/base64 with the patient.");
    } catch (e: any) {
      setStatus(`❌ ${e?.message || String(e)}`);
    }
  };

  // ==================== MAIN SUBMIT (IMPLEMENTED) ====================
  const handleSubmitOnChain = async () => {
    setCoSignBase64(""); // Clear previous tx
    try {
      setStatus("Checking preconditions...");
      if (!program || !wallet || !patientPk || !record)
        throw new Error("Program, wallet, patient, or record missing");
      if (!hospitalOk)
        throw new Error("Hospital not registered for this wallet.");
      if (!patientAccountOk)
        throw new Error(
          "Patient not registered. Ask the patient to upsert first."
        );
      if (!grantOk)
        throw new Error(
          grantErr || "Write access not granted by this patient."
        );

      const configPda = findConfigPda(programId);
      const patientPda = findPatientPda(programId, patientPk);
      const patientSeqPda = findPatientSeqPda(programId, patientPda);
      const hospitalPda = findHospitalPda(programId, wallet.publicKey);
      const grantWritePda = findGrantPda(
        programId,
        patientPda,
        wallet.publicKey,
        2
      );

      // Base64 public keys for the upload service
      const patientPk_b64 = u8ToB64(bs58.decode(record.patient_pubkey.trim()));
      const hospitalPk_b64 = u8ToB64(wallet.publicKey.toBytes());

      // --- GENERATE ZIP IN MEMORY ---
      setStatus("Zipping record...");
      const zip = new JSZip();
      zip.file("medical_record.json", JSON.stringify(record, null, 2));
      images.forEach((img) => zip.file(img.name, img.blob));
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const finalZipFile = new File([zipBlob], zipName || "record.zip", {
        type: "application/zip",
      });
      // --- END ZIP ---

      setStatus("Encrypting & uploading zip...");
      const {
        cidEnc,
        metaCid,
        sizeBytes,
        cipherHashHex,
        edekRoot_b64,
        edekPatient_b64,
        edekHospital_b64,
        kmsRef,
      } = await encUpload(finalZipFile, patientPk_b64, hospitalPk_b64);

      setStatus("Deriving PDAs & sequence...");
      // @ts-expect-error anchor typing
      const patientSeq = await program.account.patientSeq.fetch(patientSeqPda);
      const seq = new anchor.BN(patientSeq.value);

      const metaMime = "application/zip";
      const sizeBn = new anchor.BN(sizeBytes);
      const hash32 = Array.from(hexToU8(cipherHashHex));
      const edekRoot = Buffer.from(b64ToU8(edekRoot_b64));
      const edekForPatient = Buffer.from(b64ToU8(edekPatient_b64));
      const edekForHospital = Buffer.from(b64ToU8(edekHospital_b64));

      setStatus("Building method...");
      const method = program.methods
        .createRecord(
          seq,
          cidEnc,
          metaMime,
          metaCid,
          sizeBn,
          hash32,
          edekRoot,
          edekForPatient,
          edekForHospital,
          { kms: {} }, // edek_root_algo
          { kms: {} }, // edek_patient_algo
          { kms: {} }, // edek_hospital_algo
          kmsRef,
          1, // enc_version
          { xChaCha20: {} }, // enc_algo
          // --- Use 'record' state for on-chain attributes ---
          record.hospital_id || "",
          record.hospital_name || "",
          record.doctor_name || "",
          record.doctor_id || "",
          record.diagnosis || "",
          record.keywords || "",
          record.description || ""
        )
        .accounts({
          uploader: wallet.publicKey, // hospital signer
          payer: patientPk, // <-- CRITICAL FIX: Patient co-signer (rent payer)
          config: configPda,
          patient: patientPda,
          patientSeq: patientSeqPda,
          hospital: hospitalPda,
          grantWrite: grantWritePda,
          record: PublicKey.findProgramAddressSync(
            [
              Buffer.from("record"),
              patientPda.toBuffer(),
              seq.toArrayLike(Buffer, "le", 8),
            ],
            programId
          )[0],
          systemProgram: SystemProgram.programId,
        });

      // If both are the same wallet (dev), just send normally
      if (wallet.publicKey.equals(patientPk)) {
        setStatus("Submitting (single-signer test path)...");
        const sig = await method.rpc();
        setStatus(`✅ Tx: ${sig}`);
        return;
      }

      // ---------- Multi-sign path (Hospital pays network fee) ----------
      setStatus("Building instruction...");
      const ix = await method.instruction();
      setLastIx(ix); // save for refresh

      setStatus("Compiling legacy message (feePayer = hospital)...");
      const { blockhash } = await connection.getLatestBlockhash("finalized");

      const ltx = new Transaction({
        feePayer: wallet.publicKey, // hospital pays fee
        recentBlockhash: blockhash,
      }).add(ix);

      if (!waSignTx) {
        throw new Error(
          "This wallet cannot sign transactions. Use Phantom/Backpack/Solflare."
        );
      }

      setStatus("Signing as hospital (legacy tx)...");
      const signedByHospital = await waSignTx(ltx);

      // Serialize WITHOUT requiring all signatures (patient still missing)
      const b64 = Buffer.from(
        signedByHospital.serialize({ requireAllSignatures: false })
      ).toString("base64");

      setCoSignBase64(b64);
      setStatus(
        "Waiting for patient co-sign. Share the base64 or the link below with the patient."
      );
      // -----------------------------------------------------------------
    } catch (e: any) {
      const msg = e?.message || e?.toString?.() || "Unknown error";
      setStatus(`❌ ${msg}`);
    }
  };

  // ==================== FIELD CONFIG ====================
  const fields: {
    key: keyof MedicalRecord;
    label: string;
    textarea?: boolean;
    fillable?: boolean;
  }[] = [
    // ... (This array remains unchanged) ...
    { key: "patient_pubkey", label: "Patient Pubkey" },
    { key: "hospital_id", label: "Hospital ID", fillable: true },
    { key: "hospital_pubkey", label: "Hospital Pubkey", fillable: true },
    { key: "hospital_name", label: "Hospital Name", fillable: true },
    { key: "doctor_name", label: "Doctor Name" },
    { key: "doctor_id", label: "Doctor ID" },
    { key: "diagnosis", label: "Diagnosis" },
    { key: "keywords", label: "Keywords" },
    { key: "description", label: "Description", textarea: true },
  ];

  // --- READY STATE ---
  const readyToSubmit =
    !!program &&
    !!wallet?.publicKey &&
    !!patientPk &&
    !!record &&
    hospitalOk === true &&
    patientAccountOk === true &&
    grantOk === true;

  // ==================== RENDER ====================
  return (
    <main className="my-6">
      <header className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-architekt font-bold dark:text-white">
          Edit & Submit Record
        </h1>
      </header>

      <Input
        type="file"
        accept=".zip"
        onChange={handleFileUpload}
        className="mb-4"
      />

      {/* --- STATUS BANNERS --- */}
      <div className="space-y-2 mb-4">
        {/* --- Failure States --- */}
        {hospitalOk === false && (
          <div className="rounded border border-red-600/40 bg-red-600/10 p-2 text-red-600">
            ❌ This wallet is <b>not</b> a registered hospital authority.
          </div>
        )}

        {patientAccountOk === false && record?.patient_pubkey && (
          <div className="rounded border border-red-600/40 bg-red-600/10 p-2 text-red-600">
            ⚠️ Patient not registered. Ask them to upsert on the Patients page.
          </div>
        )}

        {grantOk === false && (
          <div className="rounded border border-yellow-600/40 bg-yellow-600/10 p-2 text-yellow-600">
            ⚠️ Write grant missing:
            {grantErr || "Patient must grant Write access to this hospital."}
          </div>
        )}

        {/* --- Success State --- */}
        {hospitalOk && patientAccountOk && grantOk && (
          <div className="rounded border border-emerald-600/40 bg-emerald-600/10 p-3 text-emerald-600">
            ✅ <b>All checks passed successfully.</b>
            <ul className="mt-2 list-disc list-inside space-y-1 text-emerald-700/90 dark:text-emerald-400/90">
              <li>
                <b>Hospital verified:</b> This connected wallet is a registered
                hospital authority on-chain.
              </li>
              <li>
                <b>Patient verified:</b> The provided patient account exists and
                matches the on-chain registry.
              </li>
              <li>
                <b>Grant confirmed:</b> Patient has granted <b>Write access</b>{" "}
                to this hospital.
              </li>
            </ul>
          </div>
        )}
      </div>

      {record && zipName && (
        <section className="flex flex-col gap-y-3 border p-3 mt-5 rounded">
          <h1 className="text-2xl font-bold font-architekt">{zipName}</h1>

          <div className="flex flex-col gap-8 mt-6">
            {/* ──────────────── 🧩 PATIENT SECTION ──────────────── */}
            <section>
              <h2 className=" font-bold mb-3 text-lg">Patient Information</h2>

              <div>
                <label className="font-medium">Patient Pubkey</label>
                <div className="flex gap-2">
                  <Input
                    value={record.patient_pubkey ?? ""}
                    onChange={(e) =>
                      handleChange("patient_pubkey", e.target.value)
                    }
                  />
                  <Button
                    variant="secondary"
                    onClick={() => handleReset("patient_pubkey")}
                  >
                    Revert
                  </Button>
                </div>

                {patientCheckStatus && (
                  <p
                    className={`mt-1 text-sm ${
                      patientCheckStatus.startsWith("✅")
                        ? "text-emerald-600"
                        : patientCheckStatus.startsWith("❌")
                        ? "text-red-600"
                        : "text-gray-500"
                    }`}
                  >
                    {patientCheckStatus}
                  </p>
                )}
              </div>
            </section>

            {/* ──────────────── 🏥 DOCTOR & HOSPITAL SECTION ──────────────── */}
            <section>
              <h2 className=" font-bold mb-3 text-lg">
                Doctor & Hospital Details
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Hospital ID */}
                <div>
                  <label className="font-medium">Hospital ID</label>
                  <div className="flex gap-2">
                    <Input
                      value={record.hospital_id ?? ""}
                      onChange={(e) =>
                        handleChange("hospital_id", e.target.value)
                      }
                    />
                    <Button
                      variant="secondary"
                      onClick={() => handleReset("hospital_id")}
                    >
                      Revert
                    </Button>
                    <Button onClick={handleFill}>Fill</Button>
                  </div>
                </div>

                {/* Doctor Name */}
                <div>
                  <label className="font-medium">Doctor Name</label>
                  <div className="flex gap-2">
                    <Input
                      value={record.doctor_name ?? ""}
                      onChange={(e) =>
                        handleChange("doctor_name", e.target.value)
                      }
                    />
                    <Button
                      variant="secondary"
                      onClick={() => handleReset("doctor_name")}
                    >
                      Revert
                    </Button>
                  </div>
                </div>

                {/* Hospital Pubkey */}
                <div>
                  <label className="font-medium">Hospital Pubkey</label>
                  <div className="flex gap-2">
                    <Input
                      value={record.hospital_pubkey ?? ""}
                      onChange={(e) =>
                        handleChange("hospital_pubkey", e.target.value)
                      }
                    />
                    <Button
                      variant="secondary"
                      onClick={() => handleReset("hospital_pubkey")}
                    >
                      Revert
                    </Button>
                    <Button onClick={handleFill}>Fill</Button>
                  </div>
                </div>

                {/* Doctor ID */}
                <div>
                  <label className="font-medium">Doctor ID</label>
                  <div className="flex gap-2">
                    <Input
                      value={record.doctor_id ?? ""}
                      onChange={(e) =>
                        handleChange("doctor_id", e.target.value)
                      }
                    />
                    <Button
                      variant="secondary"
                      onClick={() => handleReset("doctor_id")}
                    >
                      Revert
                    </Button>
                  </div>
                </div>

                {/* Hospital Name */}
                <div>
                  <label className="font-medium">Hospital Name</label>
                  <div className="flex gap-2">
                    <Input
                      value={record.hospital_name ?? ""}
                      onChange={(e) =>
                        handleChange("hospital_name", e.target.value)
                      }
                    />
                    <Button
                      variant="secondary"
                      onClick={() => handleReset("hospital_name")}
                    >
                      Revert
                    </Button>
                    <Button onClick={handleFill}>Fill</Button>
                  </div>
                </div>

                {/* Empty placeholder (for symmetry) */}
                <div></div>
              </div>
            </section>

            {/* ──────────────── 📋 RECORD SECTION ──────────────── */}
            <section>
              <h2 className="font-bold mb-3 text-lg">Record Details</h2>

              <div className="flex flex-col gap-4">
                {/* Diagnosis */}
                <div>
                  <label className="font-medium">Diagnosis</label>
                  <div className="flex gap-2">
                    <Textarea
                      value={record.diagnosis ?? ""}
                      onChange={(e) =>
                        handleChange("diagnosis", e.target.value)
                      }
                      className="min-h-[80px] w-full"
                    />
                    <Button
                      variant="secondary"
                      onClick={() => handleReset("diagnosis")}
                    >
                      Revert
                    </Button>
                  </div>
                </div>

                {/* Keywords */}
                <div>
                  <label className="font-medium">Keywords</label>
                  <div className="flex gap-2">
                    <Textarea
                      value={record.keywords ?? ""}
                      onChange={(e) => handleChange("keywords", e.target.value)}
                      className="min-h-[80px] w-full"
                    />
                    <Button
                      variant="secondary"
                      onClick={() => handleReset("keywords")}
                    >
                      Revert
                    </Button>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="font-medium">Description</label>
                  <div className="flex gap-2">
                    <Textarea
                      value={record.description ?? ""}
                      onChange={(e) =>
                        handleChange("description", e.target.value)
                      }
                      className="min-h-[120px] w-full"
                    />
                    <Button
                      variant="secondary"
                      onClick={() => handleReset("description")}
                    >
                      Revert
                    </Button>
                  </div>
                </div>
              </div>
            </section>

            {/* ──────────────── 🖼️ PREVIEW SECTION ──────────────── */}
            {previews.length > 0 && (
              <section>
                <h2 className="font-bold mb-3 ">Attached Preview</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {previews.map((src, i) => (
                    <div
                      key={i}
                      className="relative w-full aspect-square border rounded overflow-hidden"
                    >
                      <Image
                        src={src}
                        alt={`Preview ${i}`}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ──────────────── ⚙️ ACTION BUTTONS ──────────────── */}
            <section className="mt-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={handleDownloadZip} className="flex-1">
                  Download Updated ZIP
                </Button>
                <Button
                  onClick={handleSubmitOnChain}
                  disabled={!readyToSubmit}
                  className="flex-1"
                >
                  Submit On-Chain
                </Button>
              </div>
            </section>
          </div>

          {/* --- RENDER SUBMIT STATUS --- */}
          {status && <p className=" mt-4 whitespace-pre-wrap">{status}</p>}

          {/* --- MULTI-SIGN OUTPUT (COPIED) --- */}
          {coSignBase64 && (
            <div className="mt-4 space-y-2">
              <label className=" font-medium">
                Base64 transaction (hospital-signed). Send to the patient to
                co-sign &amp; submit:
              </label>
              <textarea
                readOnly
                className="w-full border rounded p-2 text-xs font-mono h-40"
                value={coSignBase64}
              />
              <div className="flex gap-2 items-center flex-wrap">
                <Button size="sm" onClick={() => copyToClipboard(coSignBase64)}>
                  Copy
                </Button>
                <Button size="sm" variant="secondary" onClick={refreshCosignTx}>
                  Refresh co-sign TX
                </Button>
                {shareUrl && (
                  <span className="text-xs break-all">
                    or share this link:&nbsp;
                    <a
                      className="underline"
                      href={shareUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {shareUrl}
                    </a>
                  </span>
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
