import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function AppendRecord() {
    return (
        <main className="p-5 border flex flex-col gap-y-5">
            <div className="font-bold text-2xl">Append Medical Record</div>

            <div>
                <Label className="mb-2">Diagnosis</Label>
                <Input
                    placeholder="e.g, Hypertension, Type 2 Diabetes"
                    className="p-2"
                />
            </div>

            <div>
                <Label className="mb-2">Keywords</Label>
                <Input placeholder="e.g, Cardiology, Routine" className="p-2" />
            </div>

            <div>
                <Label>Description (rich text editor)</Label>
            </div>

            <div>
                <div className="mb-2">Medical images</div>
                <div className="flex">
                    <Input type="upload" placeholder={"Upload Images"} />
                </div>
            </div>

            <div>
                <div className="flex gap-x-2">
                    <Button>Submit for Signature</Button>
                    <Button>Cancel</Button>
                </div>
                <div>
                    Record will be encrypted and signed by hospital custody key
                </div>
            </div>
        </main>
    );
}
