"use server";
import { createClient } from "@/utils/supabase/server";

async function VerifyDoctor(supabaseSSR) {
    const {
        data: { user },
    } = await supabaseSSR.auth.getUser();

    if (!user) return null;

    const { data: doctor } = await supabaseSSR
        .from("doctor")
        .select("doctor_id, name")
        .eq("doctor_id", user.id)
        .maybeSingle();

    if (!doctor) return null;

    return {
        email: user.email,
        doctor_id: doctor.doctor_id,
        name: doctor.name,
    };
}

export async function GetDoctorInfo() {
    const supabase = await createClient();
    return await VerifyDoctor(supabase);
}

export async function UpdateEmailDoctor(newEmail: string) {
    const supabase = await createClient();
    const doctor = await VerifyDoctor(supabase);
    if (!doctor) throw new Error("Doctor not found");

    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) throw error;
}

export async function UpdateNameDoctor(newName: string) {
    const supabase = await createClient();
    const doctor = await VerifyDoctor(supabase);
    if (!doctor) throw new Error("Doctor not found");

    const { error } = await supabase
        .from("doctor")
        .update({ name: newName })
        .eq("doctor_id", doctor.doctor_id);

    if (error) throw error;
}
