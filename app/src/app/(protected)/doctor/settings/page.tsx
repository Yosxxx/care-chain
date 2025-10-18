"use client";

import { useEffect, useState } from "react";
import { GetDoctorInfo } from "./action";
import { Button } from "@/components/ui/button";

export default function Page() {
    const [doctor, setDoctor] = useState<any>(null);

    useEffect(() => {
        (async () => {
            const data = await GetDoctorInfo();
            setDoctor(data);
        })();
    }, []);

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
                    <div className="flex w-full items-center gap-x-5">
                        <div className="p-2 border flex-1">
                            {doctor?.email ?? "---"}
                        </div>
                        <Button>Change</Button>
                    </div>
                </div>

                <div>
                    <div>Name</div>
                    <div className="flex w-full items-center gap-x-5">
                        <div className="p-2 border flex-1">
                            {doctor?.name ?? "---"}
                        </div>
                        <Button>Change</Button>
                    </div>
                </div>

                <div>
                    <Button>Reset Password</Button>
                </div>
            </div>
        </main>
    );
}
