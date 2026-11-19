// Project author and founding architect: Alexander Nikolaevich Romaskevich (RomaskevicH).
// Fail-closed revalidation of QUARANTINED source before any QA evidence or local review export.
// Structural preflight is NOT a runtime sandbox, test success, signed QA or production approval.
import {inspectTaskSource} from './task-source-preflight.mjs';

const EXPECTED_PATHS='app.mjs|test/app.test.mjs';
const APPROVED_SCOPE='SYNTAX_AND_MODULE_SHAPE_ONLY_NOT_QA';

export function assertTaskStagePreflight(manifest,files){
  if(!manifest||typeof manifest!=='object'||Array.isArray(manifest)||
     manifest.schema!=='constructor_task_stage_v1'||
     manifest.artifactState!=='QUARANTINED_DENIED'||
     manifest.release_allowed!==false||
     manifest.staticReview!=='NO_HEURISTIC_FLAGS_NOT_A_SANDBOX'||
     manifest.execution!=='NOT_RUN'||manifest.independentQa!=='NOT_RUN'||
     manifest.approval!=='DENIED'||manifest.release!=='DENIED'||
     !manifest.preflight||manifest.preflight.status!=='PASS'||
     manifest.preflight.scope!==APPROVED_SCOPE||
     !Array.isArray(manifest.preflight.issues)||manifest.preflight.issues.length!==0)
    throw Error('STAGE_PREFLIGHT_DENIED');

  if(!Array.isArray(files)||files.length!==2||
     files.some(f=>!f||typeof f.path!=='string'||typeof f.content!=='string')||
     files.map(f=>f.path).sort().join('|')!==EXPECTED_PATHS)
    throw Error('STAGE_PREFLIGHT_FILE_SET_DENIED');

  // Recheck actual SHA-bound source. Do not trust status strings from a manifest.
  const checked=inspectTaskSource(files);
  if(checked.status!=='PASS'||checked.scope!==APPROVED_SCOPE||checked.issues.length!==0)
    throw Error('STAGE_PREFLIGHT_RECHECK_FAILED');

  return Object.freeze({status:'STAGE_PREFLIGHT_REVALIDATED',
    execution:'NOT_RUN',independentQa:'NOT_RUN',productionRelease:'DENIED'});
}
