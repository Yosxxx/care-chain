import { createClient as createServiceClient } from "@supabase/supabase-js";

export function createClient() {
    return createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!, // service key (never expose to client)
        { auth: { autoRefreshToken: false, persistSession: false } },
    );
}
