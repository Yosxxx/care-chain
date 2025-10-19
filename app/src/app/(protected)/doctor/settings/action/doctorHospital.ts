"use server";

import { createClient } from "@/utils/supabase/server";

async function VerifyDoctor(supabase) {
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { data: doctor } = await supabase
        .from("doctor")
        .select("doctor_id, name")
        .eq("doctor_id", user.id)
        .maybeSingle();

    if (!doctor) throw new Error("Doctor not found");
    return doctor;
}

// === Get Pending Invitations ===
export async function GetPendingInvitations() {
    const supabase = await createClient();
    const doctor = await VerifyDoctor(supabase);

    const { data, error } = await supabase
        .from("hospital_invitations")
        .select("*")
        .eq("status", "PENDING")
        .eq("doctor_id", doctor.doctor_id);

    if (error) throw error;
    return data;
}

// === Get Accepted Hospitals ===
export async function GetAcceptedHospitals() {
    const supabase = await createClient();
    const doctor = await VerifyDoctor(supabase);

    const { data, error } = await supabase
        .from("hospital_invitations")
        .select("*")
        .eq("status", "ACCEPTED")
        .eq("doctor_id", doctor.doctor_id);

    if (error) throw error;
    return data;
}

// === Accept or Reject Invitation ===
export async function UpdateInvitationStatus(
    hospital_id: string,
    newStatus: "ACCEPTED" | "REJECTED",
) {
    const supabase = await createClient();
    const doctor = await VerifyDoctor(supabase);

    // 1️ Update doctor_hospital
    const { error: updateError } = await supabase
        .from("doctor_hospital")
        .update({ status: newStatus })
        .eq("hospital_id", hospital_id)
        .eq("doctor_id", doctor.doctor_id);

    if (updateError) throw updateError;

    // 2️ Log this action
    const { error: logError } = await supabase
        .from("doctor_hospital_log")
        .insert({
            hospital_id,
            doctor_id: doctor.doctor_id,
            actor: "DOCTOR",
            action: newStatus,
        });

    if (logError) throw logError;
}

// === Resign from Hospital ===
export async function ResignHospital(hospital_id: string) {
    const supabase = await createClient();
    const doctor = await VerifyDoctor(supabase);

    const { error: updateError } = await supabase
        .from("doctor_hospital")
        .update({ status: "RESIGNED" })
        .eq("hospital_id", hospital_id)
        .eq("doctor_id", doctor.doctor_id);

    if (updateError) throw updateError;

    const { error: logError } = await supabase
        .from("doctor_hospital_log")
        .insert({
            hospital_id,
            doctor_id: doctor.doctor_id,
            actor: "DOCTOR",
            action: "RESIGNED",
        });

    if (logError) throw logError;
}
