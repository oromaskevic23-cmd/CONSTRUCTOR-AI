// Third isolated CI job: verify downloaded signature chain and receipts.
import {readFile,writeFile} from "node:fs/promises";
import {verifyQAChain} from "../engineering/qa-chain.mjs";
try {
 const bytes=await readFile("ci-qa-chain.json");
 if(bytes.length<200||bytes.length>220000)throw Error("INVALID_QA_CHAIN_SIZE");
 const chain=JSON.parse(bytes.toString("utf8"));
 const result=verifyQAChain(chain);
 if(result.release!=="DENIED"||result.owner_approval!=="NOT_VERIFIED")
   throw Error("RELEASE_OR_OWNER_GATE_UNSAFE");
 const verdict={...result,source:"SEPARATE_GITHUB_ACTIONS_AUDIT_JOB",
   artifact_trust:"SELF_ISSUED_CI_KEYS_NO_EXTERNAL_ATTESTATION"};
 await writeFile("ci-qa-verdict.json",JSON.stringify(verdict,null,2)+"\n",{flag:"wx",mode:0o600});
 console.log(JSON.stringify(verdict,null,2));
}catch(err){console.error("CHAIN AUDIT BLOCKED:",err.code??err.message);process.exit(1);}
