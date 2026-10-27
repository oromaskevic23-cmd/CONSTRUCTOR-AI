const BASE="https://flqxwhibxnyujynmopmr.supabase.co";
const KEY="sb_publishable_jlbND1F8kxn-ptIMisA6rA_i_AuqyY5"; // public publishable key, NOT a secret
const form=document.querySelector("#ai-login");
const email=document.querySelector("#ai-email");
const password=document.querySelector("#ai-password");
const prompt=document.querySelector("#ai-prompt");
const output=document.querySelector("#ai-output");
const status=document.querySelector("#ai-status");
const logout=document.querySelector("#ai-logout");
const generate=document.querySelector("#ai-generate");
let token=null; // memory-only: no localStorage/sessionStorage
const notice=(s)=>{status.textContent=s};
async function authRequest(path,body){
 const r=await fetch(BASE+"/auth/v1/"+path,{method:"POST",headers:{"apikey":KEY,"content-type":"application/json"},body:JSON.stringify(body),cache:"no-store"});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw Error("AUTH_HTTP_"+r.status);
 return data;
}
form.addEventListener("submit",async e=>{
 e.preventDefault();token=null;generate.disabled=true;output.textContent="";
 try{
 const data=await authRequest("token?grant_type=password",{email:email.value.trim(),password:password.value});
 password.value="";
 if(typeof data.access_token!=="string")throw Error("NO_ACCESS_TOKEN");
 token=data.access_token;generate.disabled=false;logout.disabled=false;
 notice("Вход выполнен. Сессия действует до закрытия страницы или истечения токена.");
 }catch(err){password.value="";notice("Ошибка входа: "+err.message)}
});
logout.addEventListener("click",async()=>{const old=token;token=null;generate.disabled=true;logout.disabled=true;output.textContent="";notice("Выход выполнен в этом окне.");if(old)await fetch(BASE+"/auth/v1/logout",{method:"POST",headers:{"apikey":KEY,"authorization":"Bearer "+old}}).catch(()=>{});});
generate.addEventListener("click",async()=>{
 if(!token){notice("Сначала войдите.");return}
 const text=prompt.value.trim();
 if(text.length<8||text.length>1200){notice("Задание: от 8 до 1200 символов.");return}
 generate.disabled=true;output.textContent="";notice("Отправка задания в Groq…");
 try{
 const r=await fetch(BASE+"/functions/v1/constructor-groq-gateway",{method:"POST",headers:{"apikey":KEY,"authorization":"Bearer "+token,"content-type":"application/json"},body:JSON.stringify({prompt:text}),cache:"no-store"});
 const data=await r.json().catch(()=>({}));
 if(!r.ok||data.ok!==true||typeof data.proposal!=="string")throw Error(data.error||"HTTP_"+r.status);
 output.textContent=data.proposal;notice("Groq ответил: "+data.model+". Это предложение кода, не исполненный проект.");
 }catch(err){notice("Генерация не подтверждена: "+err.message)}
 finally{generate.disabled=!token}
});
