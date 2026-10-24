#!/usr/bin/env node
// Read-only verification of a local untrusted draft quarantine.
import {verifyProofBundle} from "../engineering/proof-bundle.mjs";
const index=process.argv.indexOf("--bundle");
const bundle=index>=0?process.argv[index+1]:undefined;
if(process.argv.includes("--help")) {
  process.stdout.write("Usage: npm run proof:verify -- --bundle PATH\nRead-only verification. No source execution or approval is performed.\n");
} else if(!bundle) {
  process.stderr.write("BLOCKED: --bundle PATH is required.\n");
  process.exitCode=2;
} else {
  try{
    const result=await verifyProofBundle(bundle);
    process.stdout.write(JSON.stringify(result,null,2)+"\n");
  } catch (error) {
    process.stderr.write("BLOCKED: "+(error.code==="ENOENT"?"BUNDLE_MISSING":
      error.name==="ProofError"?error.code:"INTEGRITY_CHECK_FAILED")+"\n");
    process.exitCode=1;
  }
}
