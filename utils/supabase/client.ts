import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client. Uses ONLY the public URL + anon/publishable key,
 * both safe to ship to the browser. The service_role/secret key is never
 * imported here.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
