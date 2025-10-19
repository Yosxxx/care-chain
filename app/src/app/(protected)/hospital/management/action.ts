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
    // 1️ Check if existing link already exists
    const { data: existing, error: fetchErr } = await supabaseService
        .from("doctor_hospital")
        .select("id, status")
        .eq("doctor_id", doctorId)
        .eq("hospital_id", hospitalId)
        .maybeSingle();

    if (fetchErr) throw new Error(`Fetch failed: ${fetchErr.message}`);

    let linkRow;

    if (existing) {
        // 2️. If doctor previously RESIGNED or REVOKED, reset to PENDING
        if (["RESIGNED", "REVOKED"].includes(existing.status)) {
            const { data, error } = await supabaseService
                .from("doctor_hospital")
                .update({ status: "PENDING" })
                .eq("doctor_id", doctorId)
                .eq("hospital_id", hospitalId)
                .select()
                .maybeSingle();

            if (error)
                throw new Error(
                    `doctor_hospital update failed: ${error.message}`,
                );

            linkRow = data;
        } else {
            // Already exists and not resigned/revoked — do nothing
            linkRow = existing;
        }
    } else {
        // 3️ Fresh invite if no record exists (use UPSERT here)
        const { data, error } = await supabaseService
            .from("doctor_hospital")
            .upsert(
                {
                    doctor_id: doctorId,
                    hospital_id: hospitalId,
                    status: "PENDING",
                },
                { onConflict: "doctor_id,hospital_id" },
            )
            .select()
            .maybeSingle();

        if (error)
            throw new Error(`doctor_hospital insert failed: ${error.message}`);

        linkRow = data;
    }

    // 4️ Always log the invite in doctor_hospital_log
    const { error: logErr } = await supabaseService
        .from("doctor_hospital_log")
        .insert({
            doctor_id: doctorId,
            hospital_id: hospitalId,
            actor: "HOSPITAL",
            action: "INVITED",
        });

    if (logErr)
        throw new Error(`doctor_hospital_log insert failed: ${logErr.message}`);

    return linkRow;
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
        // user already exists
        userId = existingUser.id;
    } else {
        // 2 Create user manually without triggering Supabase’s invite email
        const { data: createdUser, error: createErr } =
            await supabaseService.auth.admin.createUser({
                email,
                email_confirm: true, // marks email as verified
            });
        if (createErr)
            throw new Error(`User creation failed: ${createErr.message}`);
        userId = createdUser.user.id;

        // 3 Send password setup/reset email (tokenized link)
        const { error: resetErr } =
            await supabaseService.auth.resetPasswordForEmail(email, {
                redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/reset-password`,
            });
        if (resetErr)
            throw new Error(`Password setup email failed: ${resetErr.message}`);
    }

    // 4 Insert/ensure doctor
    const doctorRow = await InsertDoctor(supabaseService, userId);

    // 5 Link doctor to hospital
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
