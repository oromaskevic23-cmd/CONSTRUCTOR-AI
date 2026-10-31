# Third-Party Intellectual Property Policy — BioNeMo / CONSTRUCTOR AI

**Policy status:** DENY BY DEFAULT · FREE_ONLY · 31 October 2026  
**Founder / Final Architectural Decision Authority:** Alexander Nikolaevich Romaskevich (RomaskevicH)  
**Repository:** CONSTRUCTOR-AI — owner-controlled original source under its separate root proprietary license.

This is an operational intellectual-property control, not a legal opinion or certification. It cannot validate ownership or grant vendor rights by itself. The correct status for the BioNeMo integration is **documented references only; no NVIDIA-derived code, skills, model weights, NIM containers, data, or logos have been bundled by this integration**.

## 1. Distinguish upstream products and licenses

| Material | Upstream rights position | Current CONSTRUCTOR AI decision |
|---|---|---|
| BioNeMo Agent Toolkit source scripts and build tools | Apache License 2.0, subject to individual component notices and third-party content | **Reference only**. A permitted future source copy must retain LICENSE, applicable NOTICE, copyright/contributor notices and change notices. |
| BioNeMo Agent Toolkit skills, SKILL.md and documentation | CC BY 4.0 in the upstream toolkit, with attribution and modified-content identification; separately licensed bundles must retain their own terms | **Reference only**. Do not paste or rebrand skills as original IMPERIAL Core inventions. |
| NVIDIA BioNeMo Framework code | Separate open-source components (upstream indicates Apache 2.0 for Framework code) | **Do not infer license for its containers, weights, data or bundled third-party models from Framework code license**. |
| NVIDIA NIM API, downloaded runtime containers and deployment | NVIDIA runtime / service / access terms depend on product and access method | **BLOCKED** pending per-SKU terms, access entitlement, quotas, privacy assessment and license review. |
| Specific NVIDIA or third-party models and model weights | **Model-specific license**; inspect exact model card and revision | **BLOCKED** pending documented model terms, permitted outputs, derivative model rules and commercial rights. |
| Datasets / protein structures / scholarly and customer data | Dataset-specific provenance and privacy restrictions | **BLOCKED** until source, consent, sharing, privacy, attribution and permitted-use checks. |
| NVIDIA logo, trade dress, and co-branding | Separately protected trademarks; formal brand rules | **No logo assets or partnership claims**, absent genuine written permission. Names may appear in accurate descriptive third-party reference text subject to legal review. |

**Name distinction:** The [NVIDIA BioNeMo Agent Toolkit](https://github.com/NVIDIA-BioNeMo/bionemo-agent-toolkit) is a life-sciences skills project. [NVIDIA NeMo Agent Toolkit](https://docs.nvidia.com/nemo/agent-toolkit/latest/) is a different agent product. NVIDIA's October 2026 deprecation notice applies to **NeMo Agent Toolkit**; do not misattribute it to BioNeMo.

## 2. Primary authority links and review scope

- [BioNeMo Agent Toolkit LICENSE](https://github.com/NVIDIA-BioNeMo/bionemo-agent-toolkit/blob/main/LICENSE) and [NOTICE](https://github.com/NVIDIA-BioNeMo/bionemo-agent-toolkit/blob/main/NOTICE).
- [Apache 2.0, Section 4 redistribution obligations](https://www.apache.org/licenses/LICENSE-2.0) — a copy of license, change notices, retained notices and applicable NOTICE content when distributing covered derivatives.
- [Creative Commons BY 4.0 legal code](https://creativecommons.org/licenses/by/4.0/legalcode) — attribution, source link/license, modification notices for shared adapted licensed material. CC BY does **not** authorize falsely implying endorsement.
- [NVIDIA Software Licensing FAQ: model and NIM terms are separate](https://www.nvidia.com/en-us/agreements/enterprise-software/nvidia-software-licensing-overview-and-faq/).
- [NVIDIA logo and brand guidelines](https://www.nvidia.com/en-gb/about-nvidia/legal-info/logo-brand-usage/).
- [NVIDIA Community Model License](https://www.nvidia.com/en-eu/agreements/enterprise-software/nvidia-community-models-license/) as **one example** of model-specific restrictions — it contains restrictions affecting use of NVIDIA model outputs to develop other models. Do not apply that agreement to every model without checking the model card.
- [NVIDIA AI Developer NIM access FAQs](https://docs.api.nvidia.com/nim/docs/product): free developer API prototyping access does not automatically confer commercial production, hosting, redistribution or sublicensing rights.

**Important licensing ambiguity:** the upstream BioNeMo repository describes licensing by *file type*. Its top-level LICENSE uses an SPDX AND expression while its NOTICE shows OR. Therefore this policy avoids a blanket conclusion that all assets are under one elective license. Review the specific file and notices when considering redistribution, and seek counsel if terms conflict.

## 3. Clean-room integration boundary

No copying source code, model weights, datasets or documentation content from NVIDIA repositories into CONSTRUCTOR AI without a per-artifact provenance record. Prefer original IMPERIAL Core adapter/interface code that describes only the public request/response contract, and keep runtime provider transport optional, scoped and disabled by default. Avoid sample copying unless license and attribution are tracked.

NCA may **read public product descriptions** for architecture research, but public availability alone is not redistribution permission. Open-source licenses do not grant exclusive authorship or automatic re-licensing of upstream works. Preserve all actual authors in Git history and notices; do not overwrite their copyright with the founder's name.

If copying approved Apache-licensed code, maintain source and modification notices, and carry required license/NOTICE obligations to redistributions. If adapting or redistributing CC-BY skill content, give the specified NVIDIA attribution, source and license URL, and indicate changes. Some components (including third-party bundles, datasets and model outputs) can have different terms — require review of each.

## 4. Training VELION and generated outputs

**Explicitly prohibit** using BioNeMo model outputs, weights, proprietary datasets, trained representations or derivative materials to train, distill, fine-tune, benchmark for commercial promotion, or improve VELION until the **exact model's current license**, output terms, dataset rights and privacy controls have been checked and the owner has authorized a reviewed use case. NVIDIA Community Model License has particular limitations; this is not a universal prohibition across all models. Keep **MAX as a mode** of VELION, not a model name.

Scientific predictions are computational estimates, not medical conclusions. A successful API call is not validation of binding affinity, drug efficacy, safety or clinical utility. All research outputs need independent scientific validation.

## 5. Commercial release and original ownership

CONSTRUCTOR AI's proprietary [root LICENSE](../LICENSE) applies only to material for which IMPERIAL Core actually has sufficient rights. It does **not** relicense open-source code, transferred model weights, partner branding or customer data, nor assert ownership of AI-generated output where law or contract does not provide it.

Required release evidence for each actual bundled third-party component:

1. Exact artifact name, version, source URL, SHA-256, original licensor, publication/distribution status and whether modified.
2. Exact applicable license, full notices and attributions, allowed deployment mode, commercial permissions, patent obligations and restrictions.
3. Model weights, training/output restrictions, data privacy and dataset licensing assessed *separately* from SDK/runtime licenses.
4. Trademark and media chain of title documented. The owner-submitted CONSTRUCTOR AI banner is separately user-provided: user instruction authorizes placement, but independent copyright ownership and third-party elements have **not** been legally verified by this repository.
5. An actual human legal/IP review, Owner authorization for specific commercial use, Guardian Core/Approval Gateway policy decisions and Audit Ledger record.
6. An evidence package anchored to exact source revision, build/test results, data provenance, and reproducible signed release. NO PASS without evidence.

**Not permitted:** imitate NVIDIA's logos, falsely claim NVIDIA partnership/endorsement, redistribute restricted model weights, suppress NOTICE/attribution, use unauthorized research datasets or customer IP, or infer that a visible GitHub repo is freely exploitable.

## 6. CI evidence and limitations

The [rights manifest](../governance/THIRD_PARTY_RIGHTS.json) records five NVIDIA rights categories as REFERENCE_ONLY / BLOCKED_PENDING_REVIEW. Run `node tools/ip-rights-gate.mjs` and `node --test test/ip-rights-gate.test.mjs`.

The automated gate detects missing/misclassified provenance metadata and known disallowed vendored paths, NVIDIA-branded image filenames and model-weight extensions. It is **not** a full software composition analysis, image copyright matcher, license classifier, Git history audit or lawyer. Renamed unlicensed content, dataset claims, package-level licensing conflicts and contract terms require further tools and human inspection. It must never output 'copyright safe' as a blanket legal guarantee.

Preserve HANTER federated dispatch, AI Passport, Enterprise Skills, Guardian Core, Approval Gateway, Audit Ledger, ProofGraph, Zero Trust, Owner Kill Switch, Public/Private Boundary and CRYPTO IMPERIAL Ecosystem Boundary.

**Legal sign-off and actual NVIDIA entitlement have not been obtained by this change.**
