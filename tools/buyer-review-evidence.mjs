// CONSTRUCTOR AI — offline buyer technical-review bundle, never a sales permit.
// Architect: Alexander Nikolaevich Romaskevich (RomaskevicH).
import {prepareBuyerReviewEvidence} from '../engineering/commercial-evidence-gate.mjs';

const args=process.argv.slice(2);
if(args.length!==4)throw Error(
  'USAGE: node tools/buyer-review-evidence.mjs PRODUCT_DIR BUILD_PROOF_JSON QA_JSON NEW_REPORT_PATH'
);
const result=await prepareBuyerReviewEvidence({
  productDirectory:args[0],buildProofPath:args[1],
  qaProofPath:args[2],outputPath:args[3],
  sourceCommit:process.env.GITHUB_SHA||'',
  ciRunId:process.env.GITHUB_RUN_ID||null,
});
console.log(JSON.stringify(result));
