// CONSTRUCTOR AI technical buyer package — local files only, no external actions.
// Author: Alexander Nikolaevich Romaskevich (RomaskevicH).
import {assembleBuyerEvaluation,verifyBuyerEvaluation} from '../engineering/buyer-demo-package.mjs';

const [,,command,...args]=process.argv;
if(command==='assemble'&&args.length===5){
 const result=await assembleBuyerEvaluation({
   productDirectory:args[0],buildProofPath:args[1],
   qaProofPath:args[2],buyerEvidencePath:args[3],
   outputDirectory:args[4],
   sourceCommit:process.env.GITHUB_SHA||'',
   ciRunId:process.env.GITHUB_RUN_ID||null
 });
 console.log(JSON.stringify(result));
}else if(command==='verify'&&args.length===1){
 const result=await verifyBuyerEvaluation({
   directory:args[0],expectedCommit:process.env.GITHUB_SHA||null
 });
 console.log(JSON.stringify(result));
}else{
 throw Error('USAGE: node tools/buyer-pilot-package.mjs assemble PRODUCT_DIR BUILD_JSON QA_JSON BUYER_JSON NEW_OUTPUT_DIR | verify PACKAGE_DIR');
}
