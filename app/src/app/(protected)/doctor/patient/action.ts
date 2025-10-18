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

    return doctor ?? null;
}

export async function GetDoctorAndHospitals() {
    const supabase = await createClient();
    const doctor = await VerifyDoctor(supabase);
    if (!doctor) return { doctor: null, hospitals: [] };

    const { data, error } = await supabase
        .from("hospital_selection") // your view
        .select("hospital_id, hospital_name, status")
        .eq("doctor_id", doctor.doctor_id)
        .eq("status", "ACCEPTED");

    if (error) {
        console.error("Error fetching hospitals from view:", error);
        return { doctor, hospitals: [] };
    }

    console.log(data);

    const hospitals = data.map((row: any) => ({
        id: row.hospital_id,
        name: row.hospital_name,
    }));

    return { doctor, hospitals };
}
