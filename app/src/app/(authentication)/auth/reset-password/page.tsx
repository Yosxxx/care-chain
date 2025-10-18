"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
    const supabase = createClient();
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(true);

    // ✅ Handle tokens from reset email link
    useEffect(() => {
        const handleSession = async () => {
            const hash = window.location.hash;
            const params = new URLSearchParams(hash.replace("#", ""));
            const access_token = params.get("access_token");
            const refresh_token = params.get("refresh_token");

            if (access_token && refresh_token) {
                const { error } = await supabase.auth.setSession({
                    access_token,
                    refresh_token,
                });
                if (error) {
                    console.error("Session error:", error);
                    setMessage("Auth session error");
                }
            } else {
                setMessage("Auth session missing!");
            }
            setLoading(false);
        };

        handleSession();
    }, []);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (password !== confirm) {
            setMessage("Passwords do not match");
            return;
        }

        const { error } = await supabase.auth.updateUser({ password });
        if (error) setMessage(error.message);
        else {
            setMessage("Password updated! Redirecting...");
            setTimeout(() => router.push("/doctor/dashboard"), 2000);
        }
    }

    if (loading) {
        return (
            <main className="flex items-center justify-center min-h-screen">
                <div>Loading session...</div>
            </main>
        );
    }

    return (
        <main className="flex items-center justify-center min-h-screen">
            <div className="max-w-sm w-full border p-5 rounded-xl shadow">
                <h1 className="text-2xl font-bold mb-4">Set Your Password</h1>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                        type="password"
                        placeholder="New password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                    <Input
                        type="password"
                        placeholder="Confirm password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        required
                    />
                    <Button type="submit" className="w-full">
                        Update Password
                    </Button>
                    {message && (
                        <div className="text-sm mt-2 text-center">
                            {message}
                        </div>
                    )}
                </form>
            </div>
        </main>
    );
}
