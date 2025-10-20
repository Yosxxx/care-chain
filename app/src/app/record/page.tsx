"use client";

import { useState } from "react";
import Image from "next/image";
import JSZip from "jszip";
import { QrCode, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export default function Page() {
  const [previews, setPreviews] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const [form, setForm] = useState({
    patient_pubkey: "",
    hospital_pubkey: "",
    hospital_name: "",
    doctor_id: "",
    doctor_name: "",
    diagnosis: "",
    keywords: "",
    description: "",
  });

  // --- Handle inputs ---
  const handleInput = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // --- Handle file uploads ---
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files ? Array.from(e.target.files) : [];
    const allowed = selected.slice(0, 5 - files.length);
    const newPreviews = allowed.map((file) => URL.createObjectURL(file));
    setFiles((prev) => [...prev, ...allowed]);
    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  // --- Delete selected image ---
  const handleDeleteImage = (index: number) => {
    const updatedFiles = [...files];
    const updatedPreviews = [...previews];
    updatedFiles.splice(index, 1);
    updatedPreviews.splice(index, 1);
    setFiles(updatedFiles);
    setPreviews(updatedPreviews);
  };

  // --- Download zip ---
  const handleDownloadZip = async () => {
    const zip = new JSZip();

    // JSON content (no image names)
    const record = {
      patient_pubkey: form.patient_pubkey,
      hospital_pubkey: null,
      hospital_name: null,
      doctor_id: form.doctor_id,
      doctor_name: form.doctor_name,
      diagnosis: form.diagnosis,
      keywords: form.keywords,
      description: form.description,
    };

    zip.file("medical_record.json", JSON.stringify(record, null, 2));

    // Images (if any)
    for (const file of files) {
      zip.file(`images/${file.name}`, file);
    }

    // Generate and trigger download
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "medical_record_bundle.zip";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="min-w-md max-w-md flex flex-col gap-y-5 relative">
        <h1 className="text-2xl font-bold">Append Medical Record</h1>

        {/* Patient Pubkey */}
        <div>
          <Label>Patient Pubkey</Label>
          <div className="flex gap-x-3 mt-1">
            <Input
              value={form.patient_pubkey}
              onChange={(e) => handleInput("patient_pubkey", e.target.value)}
            />
            <Button>
              <QrCode />
            </Button>
          </div>
        </div>

        {/* Doctor Info */}
        <div>
          <Label>Doctor ID</Label>
          <Input
            value={form.doctor_id}
            onChange={(e) => handleInput("doctor_id", e.target.value)}
          />
        </div>

        <div>
          <Label>Doctor Name</Label>
          <Input
            value={form.doctor_name}
            onChange={(e) => handleInput("doctor_name", e.target.value)}
          />
        </div>

        {/* Medical Info */}
        <div>
          <Label>Diagnosis</Label>
          <Input
            value={form.diagnosis}
            onChange={(e) => handleInput("diagnosis", e.target.value)}
          />
        </div>

        <div>
          <Label>Keywords</Label>
          <Input
            value={form.keywords}
            onChange={(e) => handleInput("keywords", e.target.value)}
          />
        </div>

        <div>
          <Label>Description</Label>
          <Textarea
            value={form.description}
            onChange={(e) => handleInput("description", e.target.value)}
          />
        </div>

        {/* Image Upload */}
        <div>
          <Label>Medical Images (Optional, max 5)</Label>
          <Input
            type="file"
            accept="image/*"
            multiple
            className="mt-2"
            onChange={handleImageChange}
          />

          {previews.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {previews.map((src, i) => (
                <div
                  key={i}
                  className="relative w-full aspect-square border rounded overflow-hidden group cursor-pointer"
                  onClick={() => setSelectedImage(src)}
                >
                  <Image
                    src={src}
                    alt={`Preview ${i + 1}`}
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteImage(i);
                    }}
                    className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded-full hover:bg-black"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Button onClick={handleDownloadZip} className="mt-2">
          Download Zip
        </Button>

        {/* --- Image Modal --- */}
        {selectedImage && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="relative w-[80vw] h-[80vh] flex items-center justify-center">
              <Image
                src={selectedImage}
                alt="Preview large"
                fill
                className="object-contain rounded-lg"
              />
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute top-4 right-4 bg-black/70 text-white p-2 rounded-full hover:bg-black"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
