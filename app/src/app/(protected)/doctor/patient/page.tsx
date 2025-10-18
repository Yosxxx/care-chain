import { QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import PatientRecord from "@/components/patient-record";

export default function Page() {
    return (
        <main className="flex gap-y-5 flex-col">
            <div className="border p-5 flex flex-col gap-y-5">
                <div>Access Patient Records</div>
                <div className="flex justify-center items-center h-60 flex-col border p-5 gap-y-5">
                    <QrCode className="h-12 w-12" />
                    <div>
                        Scan patient&apos;s QR code to auto-fill wallet address
                    </div>
                    <Button>Scan QR Code</Button>
                </div>
                <div className="flex w-full items-center gap-x-5">
                    <Separator className="flex-1 h-[100px]" />

                    <span>OR ENTER MANUALLY</span>
                    <Separator className="flex-1" />
                </div>
                <div className="flex gap-x-5">
                    <Input
                        placeholder="Enter patient wallet address"
                        className="flex-1 font-mono"
                    />
                    <Button>Search</Button>
                </div>
                <div className="text-sm">
                    Access requires hospital custody signature
                </div>
            </div>

            <section>
                <PatientRecord />
            </section>
        </main>
    );
}
