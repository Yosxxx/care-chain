"use client";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

type Props = {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    doctorName?: string;
    loading?: boolean;
    onConfirm: () => Promise<void> | void;
};

export default function DeleteDoctorDialog({
    open,
    onOpenChange,
    doctorName,
    loading,
    onConfirm,
}: Props) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="rounded-sm">
                <DialogHeader>
                    <DialogTitle>Remove doctor?</DialogTitle>
                    <DialogDescription>
                        {`This will revoke access for ${doctorName ?? "this doctor"} to your hospital.`}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={!!loading}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={onConfirm} // <-- trigger from parent
                        disabled={!!loading}
                    >
                        {loading ? "Removing..." : "Remove"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
