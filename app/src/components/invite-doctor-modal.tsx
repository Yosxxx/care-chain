"use client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { InviteDoctor } from "@/app/(protected)/hospital/management/action";
import { AiOutlineUserAdd } from "react-icons/ai";

export default function InviteDoctorModal({ setModal }: { setModal: (v: boolean) => void }) {
    return (
        <div className="w-full min-w-lg rounded-sm bg-white p-6 shadow-xl">
            <div className="mb-4">
                <div className="text-xl font-semibold flex items-center">
                    <AiOutlineUserAdd size={30} />
                    Add Doctor To Hospital
                </div>
                <div className="text-muted-foreground">Invite a doctor to join your hospital</div>
            </div>

            <form
                action={async (formData: FormData) => {
                    await InviteDoctor(formData);
                    setModal(false);
                }}
                className="space-y-4"
            >
                <div className="space-y-2">
                    <Label htmlFor="email">Doctor&apos;s Email</Label>
                    <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="doctor@example.com"
                        required
                        className="rounded-sm"
                    />
                    <div className="text-xs text-muted-foreground">
                        An invitation email will be sent to join your hospital organization.
                    </div>
                </div>
                <div className="mt-2 flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setModal(false)}>
                        Cancel
                    </Button>
                    <Button type="submit" className="flex-1">
                        Send Invite
                    </Button>
                </div>
            </form>
        </div>
    );
}
