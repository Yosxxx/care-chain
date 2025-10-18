"use client";

import { useState, useEffect } from "react";
import { GetDoctorInfo, UpdateEmailDoctor, UpdateNameDoctor } from "./action";
import { Button } from "@/components/ui/button";
import ChangeDialog from "@/components/change-dialog";

export default function DoctorProfilePage() {
    const [doctor, setDoctor] = useState<any>(null);
    const [open, setOpen] = useState(false);
    const [field, setField] = useState<"email" | "name">("email");

    useEffect(() => {
        (async () => {
            const data = await GetDoctorInfo();
            setDoctor(data);
        })();
    }, []);

    const handleOpen = (f: "email" | "name") => {
        setField(f);
        setOpen(true);
    };

    return (
        <main className="w-full">
            <div className="p-5 border flex flex-col gap-y-5">
                <div className="text-2xl font-bold">Doctor Information</div>

                <div>
                    <div>Doctor ID</div>
                    <div className="p-2 border">
                        {doctor?.doctor_id ?? "---"}
                    </div>
                </div>

                <div>
                    <div>Email</div>
                    <div className="flex items-center gap-x-5">
                        <div className="p-2 border flex-1">
                            {doctor?.email ?? "---"}
                        </div>
                        <Button onClick={() => handleOpen("email")}>
                            Change
                        </Button>
                    </div>
                </div>

                <div>
                    <div>Name</div>
                    <div className="flex items-center gap-x-5">
                        <div className="p-2 border flex-1">
                            {doctor?.name ?? "---"}
                        </div>
                        <Button onClick={() => handleOpen("name")}>
                            Change
                        </Button>
                    </div>
                </div>

                <div>
                    <Button>Reset Password</Button>
                </div>
            </div>

            <ChangeDialog
                role="doctor"
                field={field}
                open={open}
                onOpenChange={setOpen}
                onConfirm={async (val) => {
                    if (field === "email") await UpdateEmailDoctor(val);
                    else await UpdateNameDoctor(val);

                    const updated = await GetDoctorInfo();
                    setDoctor(updated);
                }}
            />
        </main>
    );
}
