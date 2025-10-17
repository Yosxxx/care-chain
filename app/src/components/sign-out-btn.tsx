"use client";

import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function SignOutButton() {
    const router = useRouter();

    async function handleSignOut() {
        const supabase = createClient();

        // Get user role before signing out
        const { data } = await supabase.auth.getUser();
        const user = data.user;

        // Detect role using table name
        const { data: doctor } = await supabase
            .from("doctor")
            .select("doctor_id")
            .eq("doctor_id", user?.id)
            .maybeSingle();

        const { data: admin } = await supabase.from("admin").select("admin_id").eq("admin_id", user?.id).maybeSingle();

        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error("Sign-out failed:", error.message);
            return;
        }

        if (doctor) router.push("/auth/doctor");
        else if (admin) router.push("/auth/admin");
        else router.push("/");
    }

    return <Button onClick={handleSignOut}>Sign Out</Button>;
}
