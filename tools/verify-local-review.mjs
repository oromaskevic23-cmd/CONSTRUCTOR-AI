#!/usr/bin/env node
// Offline verification only. Never runs model output or grants release authority.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {verifyLocalReviewCopy} from '../engineering/local-review-evidence.mjs';
const [,,directory,ownerKeyPath,qaKeyPath,qaSuitePath]=process.argv;
if(process.argv.length!==6){
 process.stderr.write('USAGE: node tools/verify-local-review.mjs REVIEW_DIR OWNER_PUBLIC_PEM QA_PUBLIC_PEM REVIEWED_QA_SUITE\n');
 process.exitCode=2;
}else{
 try{
  const [ownerPublicKeyPem,qaPublicKeyPem,suiteBytes]=await Promise.all([
    readFile(ownerKeyPath,'utf8'),readFile(qaKeyPath,'utf8'),readFile(qaSuitePath)]);
  const result=await verifyLocalReviewCopy({directory,ownerPublicKeyPem,qaPublicKeyPem,
    expectedQaSuiteSha256:createHash('sha256').update(suiteBytes).digest('hex')});
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
 }catch(error){
  process.stderr.write('REVIEW_VERIFICATION_DENIED: '+(
    typeof error?.message==='string'&&/^[A-Z][A-Z0-9_]+$/.test(error.message)?
      error.message:'INVALID_INPUT_OR_EVIDENCE')+'\n');
  process.exitCode=1;
 }
}
