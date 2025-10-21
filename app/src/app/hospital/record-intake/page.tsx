"use client";

import { useState, useEffect, ChangeEvent } from "react";
import JSZip from "jszip";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Undo2 } from "lucide-react";
import { GetHospitalData } from "@/action/GetHospitalData";
import { useSolana } from "@/components/solana-provider";

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
    if (!record || !hospitalData) return;
    setRecord({
      ...record,
      hospital_id: hospitalData.hospital_id,
      hospital_pubkey: hospitalData.authority_pubkey,
      hospital_name: hospitalData.name,
    });
  };

  const handleDownloadZip = async () => {
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

  // ==================== FIELD CONFIG ====================
  const fields: {
    key: keyof MedicalRecord;
    label: string;
    textarea?: boolean;
    fillable?: boolean;
  }[] = [
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

  // ==================== WALLET CONNECTION ====================
  const { isConnected } = useSolana();

  // ==================== RENDER ====================
  return (
    <main className="p-5">
      <Input type="file" accept=".zip" onChange={handleFileUpload} />

      {record && zipName && (
        <section className="flex flex-col gap-y-3 border p-3 mt-5 rounded">
          <h1 className="text-2xl font-bold">{zipName}</h1>

          {fields.map(({ key, label, textarea, fillable }) => (
            <div key={key}>
              <label className="font-medium">{label}</label>
              <div className="flex gap-x-3">
                {textarea ? (
                  <textarea
                    value={record[key] ?? ""}
                    onChange={(e) => handleChange(key, e.target.value)}
                    className="w-full p-2 border rounded min-h-[100px]"
                  />
                ) : (
                  <Input
                    value={record[key] ?? ""}
                    onChange={(e) => handleChange(key, e.target.value)}
                  />
                )}
                <Button variant="secondary" onClick={() => handleReset(key)}>
                  <Undo2 />
                </Button>
                {fillable && <Button onClick={handleFill}>Fill</Button>}
              </div>
            </div>
          ))}

          {previews.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
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
          )}

          <div className="flex gap-x-5 mt-4">
            <Button
              className="flex-1"
              onClick={handleDownloadZip}
              disabled={!isConnected}
            >
              Download Updated ZIP
            </Button>
            <Button className="flex-1" variant="secondary">
              Reject
            </Button>
          </div>
        </section>
      )}
    </main>
  );
}
