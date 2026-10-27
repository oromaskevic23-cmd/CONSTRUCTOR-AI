// CONSTRUCTOR AI: authenticated Supabase Edge Function gateway.
// No Groq secret is ever stored or sent to a browser.
const DEFAULT_URL = "https://flqxwhibxnyujynmopmr.supabase.co/functions/v1/constructor-groq-gateway";
export class GatewayError extends Error { constructor(code) { super(code); this.code = code; } }
export async function generateViaSupabase({prompt, accessToken, publishableKey, endpoint = DEFAULT_URL, fetchImpl = fetch} = {}) {
  if (typeof prompt !== "string" || prompt.trim().length < 8 || prompt.length > 1200) throw new GatewayError("INVALID_PROMPT");
  if (typeof accessToken !== "string" || !accessToken.trim()) throw new GatewayError("AUTH_REQUIRED");
  if (typeof publishableKey !== "string" || !publishableKey.trim()) throw new GatewayError("PUBLISHABLE_KEY_REQUIRED");
  if (endpoint !== DEFAULT_URL) throw new GatewayError("ENDPOINT_NOT_ALLOWED");
  let response;
  try { response = await fetchImpl(endpoint, {
    method:"POST", redirect:"error",
    headers:{"content-type":"application/json","authorization":"Bearer "+accessToken,"apikey":publishableKey},
    body:JSON.stringify({prompt:prompt.trim()}), signal:AbortSignal.timeout(30000)
  }); } catch { throw new GatewayError("NETWORK_FAILED"); }
  if (!response.ok) throw new GatewayError("GATEWAY_HTTP_"+response.status);
  let data; try { data=await response.json(); } catch { throw new GatewayError("INVALID_GATEWAY_JSON"); }
  if (data?.ok !== true || typeof data.proposal !== "string") throw new GatewayError("GATEWAY_REJECTED");
  return {model:data.model, provider:"groq", proposal:data.proposal, executed:false, verified:false};
}
