"use client";

import { useState } from "react";
import JSZip from "jszip";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Undo2 } from "lucide-react";

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

export default function Page() {
  const [record, setRecord] = useState<MedicalRecord | null>(null);
  const [original, setOriginal] = useState<MedicalRecord | null>(null);
  const [zipName, setZipName] = useState<string | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [images, setImages] = useState<{ name: string; blob: Blob }[]>([]);

  // ==================== LOAD ZIP ====================
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const zip = await JSZip.loadAsync(file);
      const jsonFile = zip.file("medical_record.json");
      if (!jsonFile) return alert("medical_record.json not found");

      const data = JSON.parse(await jsonFile.async("string"));
      setRecord(data);
      setOriginal(data);
      setZipName(file.name);

      const imgs = await Promise.all(
        Object.values(zip.files)
          .filter((f) => f.name.match(/\.(jpg|jpeg|png|webp|bmp)$/i) && !f.dir)
          .map(async (f) => ({ name: f.name, blob: await f.async("blob") }))
      );

      setImages(imgs);
      setPreviews(imgs.map((i) => URL.createObjectURL(i.blob)));
    } catch (err) {
      console.error("Error reading zip:", err);
      alert("Failed to parse zip");
    }
  };

  // ==================== HELPERS ====================
  const handleChange = (key: keyof MedicalRecord, value: string) =>
    record && setRecord({ ...record, [key]: value });

  const handleReset = (key: keyof MedicalRecord) =>
    record && original && setRecord({ ...record, [key]: original[key] });

  const handleFill = (key: keyof MedicalRecord) => {
    if (!record) return;
    const data: Partial<MedicalRecord> = {
      hospital_id: "HOSP123456",
      hospital_pubkey: "SOLANA_PUBKEY_ABC123XYZ",
      hospital_name: "St. Care Medical Center",
    };
    setRecord({ ...record, [key]: data[key] ?? record[key] });
  };

  const handleDownloadZip = async () => {
    if (!record) return;
    const zip = new JSZip();

    zip.file("medical_record.json", JSON.stringify(record, null, 2));
    images.forEach((img) => zip.file(img.name, img.blob));

    const blob = await zip.generateAsync({ type: "blob" });
    const filename = `medical_record_${
      new Date()
        .toISOString()
        .replace(/[-:]/g, "")
        .replace("T", "_")
        .split(".")[0]
    }.zip`;

    const link = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: filename,
    });
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

  // ==================== RENDER ====================
  return (
    <main className="p-5">
      <Input type="file" accept=".zip" onChange={handleFileUpload} />

      {record && zipName && (
        <div className="flex flex-col gap-y-3 border p-3 mt-5">
          <div className="text-2xl font-bold">{zipName}</div>

          {fields.map(({ key, label, textarea, fillable }) => (
            <div key={key}>
              <div>{label}</div>
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
                {fillable && (
                  <Button onClick={() => handleFill(key)}>Fill</Button>
                )}
              </div>
            </div>
          ))}

          {/* Image previews */}
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

          {/* Action buttons */}
          <div className="flex gap-x-5 mt-4">
            <Button className="flex-1" onClick={handleDownloadZip}>
              Download Updated ZIP
            </Button>
            <Button className="flex-1" variant="secondary">
              Reject
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
