"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import InviteDoctorModal from "@/components/invite-doctor-modal";

export default function Page() {
    const [modal, setModal] = useState(false);

    return (
        <main>
            {modal && (
                <div
                    className="fixed inset-0 z-50 grid place-items-center bg-black/40"
                    onClick={() => setModal(false)} // close when clicking outside modal
                >
                    <div onClick={(e) => e.stopPropagation()}>
                        <InviteDoctorModal setModal={setModal} />
                    </div>
                </div>
            )}

            <div className="flex justify-between">
                <div className="text-4xl font-bold">Medical Staff</div>
                <div className="flex gap-2">
                    <Input />
                    <Button onClick={() => setModal(true)}>Invite Doctor</Button>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Doctor ID</th>
                        <th>Name</th>
                        <th>Specialization</th>
                        <th>Email</th>
                        <th>Actions</th>
                    </tr>
                </thead>
            </table>
        </main>
    );
}
