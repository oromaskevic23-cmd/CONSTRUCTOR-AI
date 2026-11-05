# CONSTRUCTOR AI — QA Attestation and Local Review Trust

**Project author and founding architect:** Alexander Nikolaevich Romaskevich (RomaskevicH)  
**Date:** 2026-11-05 · **Status:** local verification code and synthetic tests; no production signer or trusted key enrollment.

## Finding and correction

The earlier standalone QA collector searched a text log for a few success
phrases and wrote a receipt asserting isolated Docker execution and independent
QA success. In a local regression, a three-line synthetic log was sufficient
to obtain that receipt without running Docker. A SHA-256 match binds bytes but
does not establish where the bytes came from. The old receipt was therefore not
a trustworthy standalone attestation, even if an independent CI workflow
separately ran Docker.

The collector now labels its result **UNATTESTED_QA_LOG_SHAPE_ONLY** and
**NOT_ATTESTED_BY_COLLECTOR**. That observation alone cannot authorize a
review export. The previous QA receipt and Owner-approval version are rejected
by the updated export gateway.

## Verifiable review boundary

To permit a local review copy, the operator must supply:

1. The staged source and a QA log, both re-hashed at export time.
2. A QA attestation signed by an externally trusted Ed25519 QA key. Its
   canonical payload binds the mission, stage manifest hash, QA log hash, the
   hash of the separately maintained independent QA suite, the claimed
   isolation/result and a bounded validity interval.
3. An Owner approval signed by a different externally trusted Ed25519 key. The
   version-2 approval binds the mission, stage and log hashes and the complete
   signed QA attestation hash, together with a short expiry and one-time nonce.
4. An operator-controlled persistent replay directory and a separate output
   directory. Reusing the Owner approval is denied.

The canonical QA payload has the order produced by the exported
taskQaPayload function. The signed attestation digest is SHA-256 over the UTF-8
JSON serialization of that canonical payload followed by the signature field.
The Owner payload uses the fixed field order implemented in the local gateway.
Reviewers should pin the exact source revision and reproduce signature
verification before adopting any external signing implementation.

## Trust limitations

- This repository contains no QA or Owner private key, no key enrollment,
  revocation service, authenticated QA signer, signed Audit Ledger, real AI
  Passport or verified production deployment.
- Passing a public key through a file path is not independent key enrollment.
  A malicious caller who controls the supplied trusted keys can sign false
  claims. Both trust anchors and their separation must be established outside
  this reference implementation.
- A valid QA signature proves only that the supplied key signed the claimed
  bytes and scope. It does not itself prove an honest signer, real sandbox
  isolation, test quality or absence of malicious code.
- The exporter only writes a **local review copy**. It does not authorize
  production, cloud deployment, financial actions or execution of the copy.
- The automated tests use generated synthetic keys and fixtures. They are not
  an independent human audit or evidence that a real owner enrolled keys.
- Existing version-1 approvals and unsigned observations are intentionally
  unusable for the updated review-export path.

## Required work before operational use

Independently enroll and protect distinct QA and Owner keys; bind them to a
reviewed policy; ensure only the isolated QA controller can access the QA
signer; verify sandbox configuration and test-suite identity from the
controller; persist revocation and audit records; independently test replay,
key compromise, clock handling and failure recovery. Only then may the
architect decide whether this local reference is fit for a higher-risk stage.
