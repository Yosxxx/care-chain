"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import InviteDoctorDialog from "@/components/invite-doctor-dialog";
import DeleteDoctorDialog from "@/components/delete-doctor-dialog";
import { ReadDoctors, DeleteDoctor } from "./action";
import { MdDelete } from "react-icons/md";

type Doctor = {
    doctor_id: string;
    name?: string | null;
    specialization?: string | null;
    status?: string | null;
    email?: string | null;
};

export default function Page() {
    const [inviteOpen, setInviteOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [targetDoctor, setTargetDoctor] = useState<Doctor | null>(null);

    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [removing, setRemoving] = useState(false);

    async function fetchDoctors() {
        try {
            setLoading(true);
            const data = await ReadDoctors();
            setDoctors((data || []) as Doctor[]);
        } catch (err) {
            console.error("Error fetching doctors:", err);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchDoctors();
    }, []);

    const filtered = useMemo(() => {
        if (!searchTerm.trim()) return doctors;
        const term = searchTerm.toLowerCase();
        return doctors.filter(
            (d) =>
                d.name?.toLowerCase().includes(term) ||
                d.specialization?.toLowerCase().includes(term) ||
                d.status?.toLowerCase().includes(term) ||
                d.email?.toLowerCase().includes(term) ||
                d.doctor_id?.toLowerCase().includes(term),
        );
    }, [searchTerm, doctors]);

    async function handleConfirmDelete() {
        if (!targetDoctor) return;
        try {
            setRemoving(true);
            await DeleteDoctor(targetDoctor.doctor_id);
            setDeleteOpen(false);
            setTargetDoctor(null);
            await fetchDoctors();
        } finally {
            setRemoving(false);
        }
    }

    return (
        <main className="space-y-6">
            {/* INVITE DIALOG (controlled) */}
            <InviteDoctorDialog
                open={inviteOpen}
                onOpenChange={setInviteOpen}
                onSubmitted={fetchDoctors}
            />

            {/* DELETE CONFIRM DIALOG */}
            <DeleteDoctorDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                doctorName={
                    targetDoctor?.name ??
                    targetDoctor?.email ??
                    targetDoctor?.doctor_id
                }
                loading={removing}
                onConfirm={handleConfirmDelete}
            />

            {/* HEADER */}
            <div className="flex items-center justify-between">
                <h1 className="text-4xl font-bold">Medical Staff</h1>
                <div className="flex gap-2">
                    <Input
                        placeholder="Search doctors..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-64"
                    />
                    <Button onClick={() => setInviteOpen(true)}>
                        Invite Doctor
                    </Button>
                </div>
            </div>

            {/* TABLE */}
            <table className="w-full border-collapse border border-gray-300 rounded-sm">
                <thead className="bg-gray-100">
                    <tr>
                        <th className="border p-2 text-start">Doctor ID</th>
                        <th className="border p-2 text-start">Name</th>
                        <th className="border p-2 text-start">
                            Specialization
                        </th>
                        <th className="border p-2 text-start">Status</th>
                        <th className="border p-2 text-start">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {loading ? (
                        <tr>
                            <td colSpan={5} className="text-center p-4">
                                Loading...
                            </td>
                        </tr>
                    ) : filtered.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="p-4">
                                No doctors found.
                            </td>
                        </tr>
                    ) : (
                        filtered.map((doc) => (
                            <tr key={doc.doctor_id}>
                                <td className="border p-2">{doc.doctor_id}</td>
                                <td className="border p-2">
                                    {doc.name || "—"}
                                </td>
                                <td className="border p-2">
                                    {doc.specialization || "—"}
                                </td>
                                <td className="border p-2">
                                    {doc.status || "—"}
                                </td>
                                <td className="border p-2">
                                    <button
                                        aria-label="Delete doctor"
                                        onClick={() => {
                                            setTargetDoctor(doc);
                                            setDeleteOpen(true);
                                        }}
                                    >
                                        <MdDelete />
                                    </button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </main>
    );
}
