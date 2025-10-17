"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import InviteDoctorModal from "@/components/invite-doctor-modal";
import { ReadDoctors } from "./action"; // server action
import { FaEdit } from "react-icons/fa";
import { MdDelete } from "react-icons/md";

export default function Page() {
    const [modal, setModal] = useState(false);
    const [doctors, setDoctors] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filtered, setFiltered] = useState<any[]>([]);

    // --- Fetch doctors once on load ---
    useEffect(() => {
        async function fetchDoctors() {
            try {
                const data = await ReadDoctors();
                setDoctors(data || []);
                setFiltered(data || []); // initialize filtered list
            } catch (err) {
                console.error("Error fetching doctors:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchDoctors();
    }, []);

    // --- Search effect with debounce ---
    useEffect(() => {
        const delay = setTimeout(() => {
            if (!searchTerm.trim()) {
                setFiltered(doctors);
            } else {
                const term = searchTerm.toLowerCase();
                setFiltered(
                    doctors.filter(
                        (doc) =>
                            doc.name?.toLowerCase().includes(term) ||
                            doc.specialization?.toLowerCase().includes(term) ||
                            doc.status?.toLowerCase().includes(term),
                    ),
                );
            }
        }, 300);

        return () => clearTimeout(delay);
    }, [searchTerm, doctors]);

    return (
        <main>
            {/* INVITE MODAL */}
            {modal && (
                <div
                    className="fixed inset-0 z-50 grid place-items-center bg-black/40"
                    onClick={() => setModal(false)}
                >
                    <div onClick={(e) => e.stopPropagation()}>
                        <InviteDoctorModal setModal={setModal} />
                    </div>
                </div>
            )}

            {/* HEADER */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-4xl font-bold">Medical Staff</h1>
                <div className="flex gap-2">
                    <Input
                        placeholder="Search doctors..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-64"
                    />
                    <Button onClick={() => setModal(true)}>
                        Invite Doctor
                    </Button>
                </div>
            </div>

            {/* TABLE */}
            <table className="w-full border-collapse border border-gray-300">
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
                                    <MdDelete />
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </main>
    );
}
