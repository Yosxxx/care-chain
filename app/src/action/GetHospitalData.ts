"use server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { VerifyAdmin } from "./VerifyAdmin";
import { GetCurrentUser } from "./GetUser";

export async function GetHospitalData() {
  // 1. Get current user
  const user = await GetCurrentUser();

  // 2. Verify that user is an admin and get their hospital_id
  const admin = await VerifyAdmin(user.id);

  // 3. Fetch hospital info
  const supabaseServer = await createServerClient();
  const { data: hospitalInfo, error } = await supabaseServer
    .from("hospital_info")
    .select("*")
    .eq("hospital_id", admin.hospital_id)
    .maybeSingle();

  if (error) throw error;
  if (!hospitalInfo) throw new Error("Hospital not found");

  console.log(hospitalInfo);
  return await hospitalInfo;
}
