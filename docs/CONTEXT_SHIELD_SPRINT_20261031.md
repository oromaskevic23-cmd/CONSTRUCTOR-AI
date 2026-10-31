# CONSTRUCTOR AI — Verified Context & Cost Shield, engineering pilot

**Founder and Final Architectural Decision Authority:** Alexander Nikolaevich Romaskevich (RomaskevicH)  
**Status:** executable, local, deterministic context selector — **not** production model routing or a general-purpose data-loss prevention system.

## Engineering objective

Large agentic codebases need scoped, reproducible context rather than uncontrolled copying of an entire repository into an LLM prompt. Hermes Agent already exposes context files, persistent memory, skills, toolsets, checkpoints and subagent delegation. Cursor publishes cloud agents with remote code changes, tests and review artifacts. CONSTRUCTOR AI should pursue superior **verified engineering outcomes**, not unsupported superiority claims or copied proprietary implementations.

Public references:
- [Hermes Agent features](https://hermes-agent.nousresearch.com/docs/user-guide/features/overview)
- [Cursor Cloud Agents](https://prod.cursor.com/help/ai-features/background-agents)
- [OpenHands Software Agent SDK](https://github.com/OpenHands/software-agent-sdk)

## Implementation

[engineering/context-shield.mjs](../engineering/context-shield.mjs) implements an offline source selection API:
- Input: trusted local workspace root, explicit objective, source-byte budget (512–32,768 bytes).
- Only allowlisted text extensions; hidden paths, common secret files, dependency/vendor output, binary data and symlink entries excluded. Encoded source is validated as UTF-8. File count, recursion and aggregate read limits are bounded.
- Deterministic keyword match over file paths/source text, then fixed source-byte budgeting and full-file SHA-256 receipts.
- Output: **untrusted source snapshots** (not model commands), file-level hashes, context-pack digest, selected-source-byte count, ignored/rejected counts, and explicit `NOT_MEASURED` fields for token counts and model cost.
- `verifyContextSnapshot` independently re-opens selected files and denies modified bytes, altered context metadata and changed/linked paths.
- Security flags never promote a draft to production, grant model/agent/owner permissions, or activate remote tools.

[14 adversarial local cases](../test/context-shield.test.mjs) cover stable selection, byte budgeting, secret file/content exclusion, symlink avoidance, invalid inputs, injected instructions as untrusted data, scan-limit fail closure, and post-selection tampering. A GitHub Actions workflow re-runs these tests on the proposed exact commit.

## Example: no model API and no secret upload

```js
import {buildVerifiedContext,verifyContextSnapshot} from './engineering/context-shield.mjs';

const pack=await buildVerifiedContext({
  workspaceRoot:'.',
  objective:'Fix invoice rounding in Task Manager',
  maxSourceBytes:8192
});
const localVerification=await verifyContextSnapshot({workspaceRoot:'.',pack});
console.log({paths:pack.entries.map(x=>x.path),
  sourceBytes:pack.selectedSourceBytes,
  digest:pack.packSha256,status:localVerification.status});
```

This does **not** call Groq, VELION, Supabase, GitHub, HANTER, network APIs or external agents. No secret needs to be configured.

## Explicit limitations

1. The matching is deterministic lexical heuristics, **not semantic understanding**, expert relevance, accurate token counting or measured financial savings.
2. Regex-based secret checks are **not comprehensive secret scanning or DLP**. An unknown secret can still be included; use trusted repositories and additional production-grade policy enforcement before any LLM transfer.
3. The `UNTRUSTED_REPOSITORY_DATA` marker is only metadata. It does **not** technically prevent a downstream model from following prompt injections in source. Separate prompt-boundary enforcement, policy tests and sandboxing are needed.
4. Local filesystems subject to concurrent hostile modification are not isolated by this tool. It reduces common symlink exposure, but does not establish race-free operation or OS/container confinement.
5. SHA-256 confirms integrity only when compared with trusted sources; it is **not** a digital signature, independent audit, quality grade or verified source authorship.
6. No deployment, autonomous generation, paid services, long-term memory, NCA delegation, professionally verified release or superiority benchmark is completed here.

## Next gated roadmap

- Integrate an independently reviewable source-context contract into the **existing** plan-only VELION model-proposal flow without expanding its authorization or export rights.
- Compare baseline full-context vs selected-context token counts, real model correctness, cost and latency on identical holdout tasks. Publish failures and confidence intervals; avoid unsupported percentage claims.
- Add signed skills and verified memory promotion, with independent exams and reversible checkpoints.
- Then link HANTER → federated orchestrators → professional LEGION/NCA teams under AI Passport, Enterprise Skills, Guardian Core, Approval Gateway, Audit Ledger, Zero Trust, Public/Private Boundary and CRYPTO IMPERIAL Ecosystem Boundary.
- Maintain reproducible ProofGraph / Proof-Carrying Release and explicit human final control. VELION is the model platform; MAX is only one mode.

**No evidence → no verified capability claim.**