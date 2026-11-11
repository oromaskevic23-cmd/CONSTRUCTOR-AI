# Task UI: isolated review prototype

This is a small UI shell for the restricted task-domain contract. The shell
does not contain `app.mjs`: `start.mjs` expects a candidate to be supplied
inside an isolated test environment. Do not serve it with untrusted generated
code on a developer host or use it to bypass the existing signed QA and Owner
Approval Gateway. This is not an export, deployment, or production product.

The shell supports creation, completion, reopening, deletion, filtering and
browser-local storage. It validates domain results and uses text-only DOM
rendering. Storage failures and detected cross-tab changes leave data in session
memory without overwriting the previously stored version. Cross-tab detection
is best effort: localStorage does not provide an atomic compare-and-set. The
optional browser smoke uses a separately authored synthetic fixture, not the
real model draft.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm install --no-save --package-lock=false --ignore-scripts --no-audit --no-fund playwright@1.62.1
TASK_UI_CHROMIUM=/absolute/path/to/chromium TASK_UI_BROWSER_NO_SANDBOX=YES \
  node tools/task-ui-browser-smoke.mjs
```

The smoke needs a locally installed Playwright package and Chromium. Disabling
the Chromium sandbox is permitted only for the synthetic fixture in a trusted
test environment; it is not security-isolation evidence. A desktop or mobile
Chromium viewport is not a physical iPhone, Safari, app-store release, or proof
of interaction with a model-generated module.

The [test record](../../docs/TASK_UI_EVIDENCE_20261111.md) distinguishes the
synthetic real-browser run from the isolated DOM integration run.
