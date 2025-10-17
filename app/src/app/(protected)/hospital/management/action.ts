"use server";
import { createClient as createClientSSR } from "@/utils/supabase/server";
import { createClient as createClientService } from "@/utils/supabase/service";

async function VerifyAdmin(supabaseSSR) {
    const {
        data: { user },
    } = await supabaseSSR.auth.getUser();
    if (!user) return false;

    const { data: admin } = await supabaseSSR
        .from("admin")
        .select("admin_id, hospital_id")
        .eq("admin_id", user.id)
        .maybeSingle();

    return admin ?? false;
}

async function CheckEmail(email: string) {
    const supabaseService = await createClientService();
    const { data, error } = await supabaseService.auth.admin.listUsers();
    if (error) throw error;
    return (
        data.users.find(
            (u: any) => u.email?.toLowerCase() === email.toLowerCase(),
        ) ?? null
    );
}

async function InsertDoctor(supabaseService: any, userId: string) {
    const { data, error } = await supabaseService
        .from("doctor")
        .upsert(
            { doctor_id: userId },
            { onConflict: "doctor_id", ignoreDuplicates: true },
        )
        .select()
        .maybeSingle(); // may be null if it was a no-op

    if (error) throw new Error(`Doctor insert failed: ${error.message}`);
    return data ?? null;
}

async function LinkHospital(
    supabaseService: any,
    doctorId: string,
    hospitalId: string,
) {
    const { data, error } = await supabaseService
        .from("doctor_hospital")
        .upsert(
            { doctor_id: doctorId, hospital_id: hospitalId, status: "PENDING" },
            { onConflict: "doctor_id,hospital_id", ignoreDuplicates: true },
        )
        .select()
        .maybeSingle();

    if (error)
        throw new Error(`doctor_hospital insert failed: ${error.message}`);
    return data ?? null;
}

// LINK
export async function InviteDoctor(formData: FormData) {
    const supabaseSSR = await createClientSSR();
    const supabaseService = await createClientService();

    const admin = await VerifyAdmin(supabaseSSR);
    if (!admin) throw new Error("Not logged in or not an admin");

    const email = (formData.get("email") as string)?.trim().toLowerCase();
    if (!email) throw new Error("Email is required");

    // 1) Check if user exists in Auth
    const existingUser = await CheckEmail(email);

    let userId: string;
    if (existingUser) {
        userId = existingUser.id;
    } else {
        // 2) Invite (Auth) via service client
        const { data: invite, error: inviteErr } =
            await supabaseService.auth.admin.inviteUserByEmail(email);
        if (inviteErr)
            throw new Error(`Auth invite failed: ${inviteErr.message}`);
        userId = invite.user.id;
    }

    // 3) Insert/ensure doctor (SSR, RLS)
    const doctorRow = await InsertDoctor(supabaseService, userId);

    // 4) Link to hospital (SSR, RLS)
    const linkRow = await LinkHospital(
        supabaseService,
        userId,
        admin.hospital_id,
    );

    return { doctor: doctorRow, link: linkRow };
}

// READ
export async function ReadDoctors() {
    const supabaseSSR = await createClientSSR();
    const admin = await VerifyAdmin(supabaseSSR);
    if (!admin) throw new Error("Not logged in or not an admin");

    const { data, error } = await supabaseSSR
        .from("read_doctors")
        .select("*")
        .eq("hospital_id", admin.hospital_id);

    if (error) throw new Error(error.message);
    return data || [];
}

// UNLINK
export async function DeleteDoctor(doctorId: string) {
    if (!doctorId) throw new Error("doctorId is required");

    const supabaseSSR = await createClientSSR();
    const supabaseService = await createClientService();

    const admin = await VerifyAdmin(supabaseSSR);
    if (!admin) throw new Error("Not logged in or not an admin");

    // Remove the relationship for THIS hospital only
    const { error: delErr } = await supabaseService
        .from("doctor_hospital")
        .delete()
        .eq("doctor_id", doctorId)
        .eq("hospital_id", admin.hospital_id);

    if (delErr) throw new Error(`Unlink failed: ${delErr.message}`);

    return { success: true };
}
