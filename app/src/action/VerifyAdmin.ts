"use server";

import { createClient as createServerClient } from "@/lib/supabase/server";

export async function VerifyAdmin(userId: string) {
  const supabaseServer = await createServerClient();

  const { data: adminRow, error: adminErr } = await supabaseServer
    .from("admin")
    .select("*")
    .eq("admin_id", userId)
    .single();

  if (adminErr) {
    throw adminErr;
  }

  if (!adminRow) {
    throw new Error("You dont belong to any hospital");
  }

  return adminRow;
}
