"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ChangeDialogProps = {
    role: "doctor" | "admin" | "patient";
    field: "email" | "name" | "password";
    open: boolean;
    onOpenChange: (v: boolean) => void;
    onConfirm: (value: string) => Promise<void>;
};

export default function ChangeDialog({
    role,
    field,
    open,
    onOpenChange,
    onConfirm,
}: ChangeDialogProps) {
    const [value, setValue] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const labelMap = {
        doctor: {
            email: "Doctor Email",
            name: "Doctor Name",
            password: "Doctor Password",
        },
        admin: {
            email: "Admin Email",
            name: "Admin Name",
            password: "Admin Password",
        },
        patient: {
            email: "Patient Email",
            name: "Patient Name",
            password: "Patient Password",
        },
    };

    const label = labelMap[role][field];

    const handleSubmit = async () => {
        setLoading(true);
        setError("");
        try {
            await onConfirm(value);
            setValue("");
            onOpenChange(false);
        } catch (err: any) {
            setError(`Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Change {label}</DialogTitle>
                    <DialogDescription>
                        Update your {field}. This will affect your login
                        credentials.
                    </DialogDescription>
                </DialogHeader>

                <Input
                    placeholder={`Enter new ${field}`}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                />

                {error && <p className="text-sm text-red-500">{error}</p>}

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={loading || !value}>
                        {loading ? "Saving..." : "Save"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
