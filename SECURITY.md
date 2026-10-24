# Security Policy — CONSTRUCTOR AI

**Reference application status:** Free local-only Task Manager; do not expose the included loopback Node server as a public service or run arbitrary generated code in it.

## Reporting security problems

Use a **private GitHub Security Advisory** where enabled on this repository, or contact the project owner via an authenticated private channel. Do not publish exploit payloads, secrets, user data, seed phrases or credentials in public issues.

## Security boundaries

- No passwords, LLM API keys, tokens or private wallet material in this repository.
- No uncontrolled agent self-replication, unapproved production deploys or unilateral financial operations.
- For future AI-run code: require sandbox isolation, privileged-resource denial, per-task budgets, least privilege, approval gateway, signed permits and independent QA.
- Generated model instructions, user data and dependencies are untrusted inputs.
- No external network requests are needed to operate the reference UI; localStorage is not an encrypted secret store.
- Do not claim this repository is penetration-tested or Enterprise-certified absent independent assessment.

**Incident response:** revoke exposed keys through their issuer, contain affected systems, record evidence without secrets, repair vulnerability, run independent regression checks, release only with owner authorization.

## Non-executing artifact quarantine v0.3

The proof-bundle stage writes generated text into fresh private directories and checks SHA-256 integrity. It **is not a sandbox or a signed attestation**. Static heuristics do not establish code safety, and anyone with write access can alter both files and their unsigned manifest. Never import, compile, run, serve, deploy or release an untrusted draft. Use only a trusted operator-owned local output directory, not a shared or attacker-writable filesystem.
