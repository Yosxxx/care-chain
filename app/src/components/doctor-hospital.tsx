"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
    GetPendingInvitations,
    GetAcceptedHospitals,
    UpdateInvitationStatus,
    ResignHospital,
} from "@/app/(protected)/doctor/settings/action/doctorHospital";

export default function DoctorHospital() {
    const [tab, setTab] = useState<"INVITATION" | "STATUS">("INVITATION");
    const [pending, setPending] = useState<any[]>([]);
    const [accepted, setAccepted] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                if (tab === "INVITATION") {
                    const data = await GetPendingInvitations();
                    setPending(data || []);
                } else if (tab === "STATUS") {
                    const data = await GetAcceptedHospitals();
                    setAccepted(data || []);
                }
            } finally {
                setLoading(false);
            }
        })();
    }, [tab]);

    return (
        <div className="p-5 mt-10 border rounded-lg">
            {/* Tabs */}
            <div className="flex gap-3 mb-6">
                <Button
                    onClick={() => setTab("INVITATION")}
                    variant={tab === "INVITATION" ? "default" : "outline"}
                >
                    Invitations
                </Button>
                <Button
                    onClick={() => setTab("STATUS")}
                    variant={tab === "STATUS" ? "default" : "outline"}
                >
                    Active
                </Button>
            </div>

            {/* Pending Invitations */}
            {tab === "INVITATION" && (
                <section>
                    {loading && <p>Loading invitations...</p>}
                    {!loading && pending.length === 0 && (
                        <p>No pending invitations.</p>
                    )}

                    {pending.map((inv) => (
                        <div
                            key={inv.hospital_id}
                            className="border rounded-md p-4 mb-4 "
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="text-lg font-semibold">
                                        {inv.name}
                                    </div>
                                    <div className="text-sm opacity-70">
                                        {inv.hospital_id}
                                    </div>
                                    <div className="text-sm mt-2">
                                        {inv.address}
                                    </div>
                                    <div className="text-xs mt-1 opacity-60">
                                        Invited on{" "}
                                        {new Date(
                                            inv.created_at,
                                        ).toLocaleDateString()}
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <Button
                                        onClick={async () => {
                                            await UpdateInvitationStatus(
                                                inv.hospital_id,
                                                "ACCEPTED",
                                            );
                                            setPending((p) =>
                                                p.filter(
                                                    (x) =>
                                                        x.hospital_id !==
                                                        inv.hospital_id,
                                                ),
                                            );
                                        }}
                                    >
                                        Accept
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        onClick={async () => {
                                            await UpdateInvitationStatus(
                                                inv.hospital_id,
                                                "REJECTED",
                                            );
                                            setPending((p) =>
                                                p.filter(
                                                    (x) =>
                                                        x.hospital_id !==
                                                        inv.hospital_id,
                                                ),
                                            );
                                        }}
                                    >
                                        Reject
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </section>
            )}

            {/* Accepted Hospitals */}
            {tab === "STATUS" && (
                <section>
                    {loading && <p>Loading hospitals...</p>}
                    {!loading && accepted.length === 0 && (
                        <p>No active hospitals.</p>
                    )}

                    {accepted.map((h) => (
                        <div
                            key={h.hospital_id}
                            className="border rounded-md p-4 mb-4 "
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <div className="text-lg font-semibold">
                                            {h.name}
                                        </div>
                                    </div>
                                    <div className="text-sm opacity-70">
                                        {h.hospital_id}
                                    </div>
                                    <div className="text-sm mt-2">
                                        {h.address}
                                    </div>
                                    <div className="text-xs mt-1 opacity-60">
                                        Joined on{" "}
                                        {new Date(
                                            h.created_at,
                                        ).toLocaleDateString()}
                                    </div>
                                </div>

                                <Button
                                    variant="destructive"
                                    onClick={async () => {
                                        await ResignHospital(h.hospital_id);
                                        setAccepted((a) =>
                                            a.filter(
                                                (x) =>
                                                    x.hospital_id !==
                                                    h.hospital_id,
                                            ),
                                        );
                                    }}
                                >
                                    Revoke Access
                                </Button>
                            </div>
                        </div>
                    ))}
                </section>
            )}
        </div>
    );
}
