# VELION-to-CONSTRUCTOR real local model observation

Date: 2026-11-11. This is a single bounded engineering observation with synthetic input, not a production deployment or independent certification.

## What ran

A genuine Qwen/Qwen2.5-Coder-0.5B-Instruct-GGUF model (Q4_K_M, upstream revision `ebb2015119c907b064c512bf053e945850b5875f`) ran on CPU using node-llama-cpp 3.22.3. The model file SHA-256 was `1d9614638d18024d0fbb36575a15f1302a3adf044df10345688ec4f6e1c4ff32`. Model and runtime are third-party dependencies, not newly trained VELION weights.

Two local-only HTTP services were started on loopback with independent randomly generated session credentials. CONSTRUCTOR AI requested a Task Manager domain draft from the VELION GGUF adapter with the pinned `constructor_draft_v1` output schema. No paid provider, remote fallback or external tool call was used. No generated source was executed.

## Observed results

1. An earlier request on the previous code returned HTTP 502 `LOCAL_MODEL_RESPONSE_REJECTED` after approximately 19 seconds. That historical error grouped multiple causes, so its exact cause is unknown.
2. A subsequent single request using the new bounded error diagnostics returned HTTP 201 after 9,870 ms. VELION's receipt recorded 9,835 ms of model inference, the model-file hash and the structured format. CONSTRUCTOR AI quarantined two generated files.
3. **The candidate failed the syntax/module-shape preflight.** It did not export the required three functions and the test did not provide required imports or register a test. No independent functional QA ran, no Owner approval was granted and release remained denied. The candidate is not a working Task Manager.

The two requests used the same small model and a fixed temperature, but model output can vary. The second response does not explain or repair the earlier failure and does not establish coding quality or product readiness. The runtime emitted a warning about a control-looking token in the model; it remains unresolved.

## Evidence retained

- [Observation](../evidence/real-velion-0p5b-20261111/observation.json), SHA-256 `f6ee1edb39675edd3144626f0d7641079256e41a0d00283470aabf7bed9900e1`.
- [Quarantined domain source](../evidence/real-velion-0p5b-20261111/candidate-app.mjs.txt), SHA-256 `39f4b4bb4955d69d251ab6e2b946f376092069e4445ec24539752c0496f9f0ec`.
- [Quarantined test source](../evidence/real-velion-0p5b-20261111/candidate-test.mjs.txt), SHA-256 `9dda0ceff15e41a0a72e7859ab3c0c8ab741f764ea679e645f89e9e54b223621`.
- [Stage manifest](../evidence/real-velion-0p5b-20261111/stage-manifest.json), SHA-256 `b6b7e5bc7a5a3e73c313893c7cb54e46a7625147587405c90fab7f17fc9b9db8`.

The source files use inert `.txt` suffixes for inspection; their bytes are unchanged from quarantine. Hashes are unsigned integrity observations, not proof of identity, independently witnessed execution or authorship.

## Diagnostic improvement

The proposed code distinguishes an incomplete token-limited response from a structured-schema rejection and from generic upstream failures. The local Studio also displays whether source preflight failed or passed and explicitly says independent QA has not run. Arbitrary provider messages remain filtered. The diagnostics do not improve model capability and do not authorize generated source.

Focused local tests: VELION 16/16 and CONSTRUCTOR AI 42/42 with synthetic model responses and local HTTP. The CONSTRUCTOR run used Node.js 24.22.1's bundled Acorn 8.18.0 for the preflight dependency; these are not the full project suite, production browser acceptance or cloud CI.
