import test from "node:test";
import assert from "node:assert/strict";
import {generateViaSupabase,GatewayError} from "../engineering/supabase-groq-client.mjs";
const base={prompt:"Создай CRM для клиентов",accessToken:"test-jwt",publishableKey:"test-publishable"};
test("requires auth before network",async()=>{await assert.rejects(generateViaSupabase({...base,accessToken:"",fetchImpl:()=>{throw Error("called")}}),{code:"AUTH_REQUIRED"})});
test("posts prompt and bearer without Groq key",async()=>{const result=await generateViaSupabase({...base,fetchImpl:async(url,init)=>{assert.match(url,/constructor-groq-gateway$/);assert.equal(init.headers.authorization,"Bearer test-jwt");assert.deepEqual(JSON.parse(init.body),{prompt:base.prompt});return {ok:true,json:async()=>({ok:true,model:"test-model",proposal:"Generated proposal"})}}});assert.equal(result.proposal,"Generated proposal");assert.equal(result.verified,false)});
test("rejects non-success upstream",async()=>{await assert.rejects(generateViaSupabase({...base,fetchImpl:async()=>({ok:false,status:401})}),{code:"GATEWAY_HTTP_401"})});
