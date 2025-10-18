"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "./ui/textarea";
import { X } from "lucide-react";
import { GetDoctorAndHospitals } from "@/app/(protected)/doctor/patient/action";

export default function AppendRecord() {
    const [diagnosis, setDiagnosis] = useState("");
    const [keywords, setKeywords] = useState("");
    const [description, setDescription] = useState("");

    const [doctor, setDoctor] = useState<{
        doctor_id: string;
        name: string;
    } | null>(null);
    const [hospitalId, setHospitalId] = useState("");
    const [hospitals, setHospitals] = useState<any[]>([]);

    const [previews, setPreviews] = useState<string[]>([]);
    const [files, setFiles] = useState<File[]>([]);
    const [loading, setLoading] = useState(true);

    // Fetch doctor info and accepted hospitals
    useEffect(() => {
        const fetchData = async () => {
            try {
                const { doctor, hospitals } = await GetDoctorAndHospitals();
                setDoctor(doctor);
                setHospitals(hospitals);
                if (hospitals.length === 1) setHospitalId(hospitals[0].id);
            } catch (err) {
                console.error("Error loading doctor/hospitals:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // handle file selection
    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = e.target.files ? Array.from(e.target.files) : [];
        const limited = selectedFiles.slice(0, 5 - files.length);
        const newPreviews = limited.map((file) => URL.createObjectURL(file));
        setFiles((prev) => [...prev, ...limited]);
        setPreviews((prev) => [...prev, ...newPreviews]);
    };

    // remove file
    const handleRemoveImage = (index: number) => {
        URL.revokeObjectURL(previews[index]);
        setPreviews((prev) => prev.filter((_, i) => i !== index));
        setFiles((prev) => prev.filter((_, i) => i !== index));
    };

    useEffect(() => {
        return () => previews.forEach((url) => URL.revokeObjectURL(url));
    }, [previews]);

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    // handle submit uses live doctor info
    const handleSubmit = async () => {
        try {
            if (!doctor) {
                alert("Doctor not found or not authenticated.");
                return;
            }
            if (!hospitalId) {
                alert("Please select a hospital.");
                return;
            }

            const base64Images = await Promise.all(files.map(fileToBase64));
            const selectedHospital = hospitals.find((h) => h.id === hospitalId);

            const record = {
                diagnosis,
                keywords,
                description,
                doctor_id: doctor.doctor_id,
                doctor_name: doctor.name,
                hospital_id: hospitalId,
                hospital_name: selectedHospital?.name || "",
                patient_pubkey: null, // ✅ placeholder until patient is identified
                hospital_pubkey: null, // ✅ filled later by admin / custody signer
                images: base64Images,
                timestamp: new Date().toISOString(),
            };

            console.log("Medical Record JSON:", record);

            // Optional: download locally for now
            const blob = new Blob([JSON.stringify(record, null, 2)], {
                type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "medical_record.json";
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Error creating JSON:", error);
        }
    };

    return (
        <main className="p-5 border flex flex-col gap-y-5">
            <div className="font-bold text-2xl">Append Medical Record</div>

            {/* Doctor Info */}
            {doctor && (
                <div className="text-sm text-muted-foreground">
                    Logged in as{" "}
                    <span className="font-semibold">{doctor.name}</span>
                </div>
            )}

            {/* Hospital Select */}
            <div>
                <Label className="mb-2">Select Hospital</Label>
                <select
                    className="border rounded-md p-2 w-full"
                    value={hospitalId}
                    onChange={(e) => setHospitalId(e.target.value)}
                >
                    <option value="">-- Choose hospital --</option>
                    {hospitals.map((h) => (
                        <option key={h.id} value={h.id}>
                            {h.name}
                        </option>
                    ))}
                </select>
                {hospitals.length === 0 && (
                    <div className="text-xs text-red-500 mt-1">
                        No accepted hospital connections.
                    </div>
                )}
            </div>

            {/* Diagnosis */}
            <div>
                <Label className="mb-2">Diagnosis</Label>
                <Input
                    placeholder="e.g., Hypertension, Type 2 Diabetes"
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                />
            </div>

            {/* Keywords */}
            <div>
                <Label className="mb-2">Keywords</Label>
                <Input
                    placeholder="e.g., Cardiology, Routine"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                />
            </div>

            {/* Description */}
            <div>
                <Label className="mb-2">Description</Label>
                <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />
            </div>

            {/* Image Upload */}
            <div>
                <Label className="mb-2">Medical Images (optional, max 5)</Label>
                <Input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageChange}
                    disabled={files.length >= 5}
                />
                {previews.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                        {previews.map((src, i) => (
                            <div
                                key={i}
                                className="relative w-32 h-32 border rounded-md overflow-hidden group"
                            >
                                <Image
                                    src={src}
                                    alt={`Preview ${i + 1}`}
                                    fill
                                    className="object-cover"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleRemoveImage(i)}
                                    className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Actions */}
            <div>
                <div className="flex gap-x-2">
                    <Button onClick={handleSubmit}>Submit for Signature</Button>
                    <Button variant="secondary">Cancel</Button>
                </div>
                <div className="text-xs mt-2 text-muted-foreground">
                    Record will be encrypted and signed by hospital custody key.
                </div>
            </div>
        </main>
    );
}
