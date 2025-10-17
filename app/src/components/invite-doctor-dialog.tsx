"use client";

import { AiOutlineUserAdd } from "react-icons/ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import * as React from "react";
import { InviteDoctor } from "@/app/(protected)/hospital/management/action";

type Props = {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    onSubmitted?: () => Promise<void> | void; // e.g. refresh list
};

export default function InviteDoctorDialog({
    open,
    onOpenChange,
    onSubmitted,
}: Props) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg rounded-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <AiOutlineUserAdd size={22} />
                        Add Doctor To Hospital
                    </DialogTitle>
                    <DialogDescription>
                        Invite a doctor to join your hospital organization.
                    </DialogDescription>
                </DialogHeader>

                <form
                    action={async (formData: FormData) => {
                        await InviteDoctor(formData);
                        onOpenChange(false);
                        await onSubmitted?.();
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
                        <p className="text-xs text-muted-foreground">
                            An invitation email will be sent to join your
                            hospital organization.
                        </p>
                    </div>

                    <DialogFooter className="gap-2 ">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button type="submit">Send Invite</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
