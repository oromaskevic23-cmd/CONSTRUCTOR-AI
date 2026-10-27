import test from "node:test";
import assert from "node:assert/strict";
import {generateFromSignedInSession} from "../engineering/authenticated-generate.mjs";
const fake=(token)=>({auth:{getSession:async()=>({data:{session:token?{access_token:token}:null},error:null})}});
test("login required before gateway call",async()=>{await assert.rejects(generateFromSignedInSession({supabase:fake(null),prompt:"Build a CRM",publishableKey:"public"}),/LOGIN_REQUIRED/)});
test("authenticated session is forwarded to gateway",async()=>{
 const out=await generateFromSignedInSession({supabase:fake("jwt-session"),prompt:"Build a CRM",publishableKey:"public",fetchImpl:async(_,init)=>{
 assert.equal(init.headers.authorization,"Bearer jwt-session");
 return {ok:true,json:async()=>({ok:true,model:"mock",proposal:"proposal"})};
 }});
 assert.equal(out.proposal,"proposal");
});
