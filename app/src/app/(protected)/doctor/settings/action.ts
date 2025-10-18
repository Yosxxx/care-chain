"use server";
import { createClient } from "@/utils/supabase/server";

async function VerifyDoctor(supabaseSSR) {
    const {
        data: { user },
        error: userError,
    } = await supabaseSSR.auth.getUser();

    if (userError || !user) return null;

    const { data: doctor, error: doctorError } = await supabaseSSR
        .from("doctor")
        .select("doctor_id, name")
        .eq("doctor_id", user.id)
        .maybeSingle();

    if (doctorError || !doctor) return null;

    return {
        email: user.email,
        doctor_id: doctor.doctor_id,
        name: doctor.name,
    };
}

export async function GetDoctorInfo() {
    const supabaseSSR = await createClient();
    return await VerifyDoctor(supabaseSSR);
}
