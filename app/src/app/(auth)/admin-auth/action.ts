"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export default async function AdminLogin(formData: FormData) {
    const supabase = await createClient();

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    // 1. Sign in
    const { data: sessionData, error: signInError } =
        await supabase.auth.signInWithPassword({ email, password });

    if (signInError) throw new Error(signInError.message);

    const user = sessionData.user;
    if (!user) throw new Error("User not found");

    // 2. Check if user exists in the admin table
    const { data: adminRecord } = await supabase
        .from("admin")
        .select("id")
        .eq("admin_id", user.id)
        .single();

    if (!adminRecord) {
        // Sign them out immediately
        await supabase.auth.signOut();
        throw new Error("Access denied: You are not an administrator");
    }

    // 3. Redirect to admin dashboard
    redirect("/admin/dashboard");
}
