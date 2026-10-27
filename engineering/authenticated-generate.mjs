import {generateViaSupabase} from "./supabase-groq-client.mjs";
// Pass an authenticated Supabase JS client; never paste or persist JWT manually.
// Caller is responsible for presenting a login UI and handling token refresh.
export async function generateFromSignedInSession({supabase, prompt, publishableKey, fetchImpl}={}) {
 if (!supabase?.auth?.getSession) throw new Error("SUPABASE_CLIENT_REQUIRED");
 const {data,error}=await supabase.auth.getSession();
 if(error) throw new Error("SESSION_LOOKUP_FAILED");
 const accessToken=data?.session?.access_token;
 if(!accessToken) throw new Error("LOGIN_REQUIRED");
 return generateViaSupabase({prompt,accessToken,publishableKey,fetchImpl});
}
