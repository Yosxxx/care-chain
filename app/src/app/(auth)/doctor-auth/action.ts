"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export default async function DoctorLogin(formData: FormData) {
    const supabase = await createClient();

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    // 1. Sign in
    const { data: sessionData, error: signInError } =
        await supabase.auth.signInWithPassword({ email, password });

    if (signInError) throw new Error(signInError.message);

    const user = sessionData.user;
    if (!user) throw new Error("User not found");

    // 2. Check if user exists in the doctor table
    const { data: doctorRecord } = await supabase
        .from("doctor")
        .select("id")
        .eq("doctor_id", user.id)
        .single();

    if (!doctorRecord) {
        await supabase.auth.signOut();
        throw new Error("Access denied: You are not a doctor");
    }

    // 3. Redirect to doctor dashboard
    redirect("/doctor/dashboard");
}
