// The only local review export command. No signing, key enrollment or deployment.
import {exportOwnerApprovedReviewCopy} from '../engineering/task-review-export.mjs';
const [,,stagePath,qaProofPath,qaLogPath,approvalPath,ownerPublicKeyPath,replayDirectory,outputDirectory]=process.argv;
if(process.argv.length!==9)throw Error('USAGE: node tools/export-approved-task-review.mjs STAGE QA_PROOF QA_LOG OWNER_APPROVAL OWNER_PUBLIC_KEY TRUSTED_REPLAY_DIR EXISTING_OUTPUT_DIR');
const result=await exportOwnerApprovedReviewCopy({stagePath,qaProofPath,qaLogPath,
 approvalPath,ownerPublicKeyPath,replayDirectory,outputDirectory});
console.log(JSON.stringify(result));
