# Phase 1 — Security, Data Protection, and CI Stabilization

**Repository:** `accmohanadibrahim/ABOHASHEM-sales`  
**Audit branch:** `audit/phase-1-security-ci-2026-11`  
**Baseline:** `main @ 61ba60a7f5745c789958b313ca012c7d88802d41`  
**Status:** Initial inventory completed; detailed secret/content scan and CI remediation remain pending.

## 1. Scope and safety boundaries

This phase is intentionally isolated from production.

- All work in this phase is performed on the audit branch.
- Do not merge to `main`, deploy, or alter production hosting configuration without explicit approval.
- Do not delete, rewrite, rename, or move source/business data during the audit.
- Do not print, copy into reports, or expose any discovered credential or personal/customer information.
- If sensitive material is confirmed, record only the file path, category, exposure scope, and remediation recommendation. Coordinate access restriction and history remediation separately.
- Preserve original source files and create checksums/inventories before any later data migration.

## 2. Initial repository inventory

The Git tree at the baseline commit contains **554 tree entries**, including **515 file blobs**. The repository is currently **public**.

The inventory includes:
- 90 Python files
- 26 JavaScript files
- 25 HTML files
- 51 Excel workbooks
- 45 CSV files
- 32 JSON files
- 173 PDF files
- 13 TXT files
- Other assets and workflow/configuration files

There are **80 file blobs under `data/raw/`**, in addition to seven directories. The raw-data area includes customer receivable/balance documents, financial statements, cost data, and other business source files. This is a material confidentiality risk while the repository is public. File names and extensions alone do not prove the presence of personal data, but the business context warrants a content-level review.

## 3. Confirmed security observations

### S1 — Public repository contains raw business-source files
**Severity: Critical pending content verification**

The public repository includes 80 raw-source file blobs. The raw-data paths include receivable and customer balance documents, financial statements, and cost-related sources. Treat this as a potential exposure of confidential company and customer information until a controlled content scan establishes otherwise.

**Required actions**
1. Review repository visibility with the repository owner/company data owner.
2. Inspect content in a controlled environment; never paste sensitive values into issues, PR comments, or audit logs.
3. Classify each raw source by confidentiality and retention requirements.
4. Design a private storage location for original business documents and a sanitized test-data set for CI/demo use.
5. Review Git history for previously committed sensitive content. Removing a file from the current tree does not remove historical copies.

**Not performed:** repository visibility change, file deletion, file migration, history rewrite, or production change.

### S2 — Credential and secret scanning
**Severity: High / not yet assessed**

The initial path-name inventory did not identify obvious secret-named files. This is not a substitute for scanning file contents and Git history.

**Required actions**
- Run a secret scanner against the current tree and full Git history.
- Scan workflow files, environment/configuration files, notebooks, scripts, and documentation.
- Redact findings in all output.
- Validate any candidate finding with the owner before rotation or revocation.

**Status:** pending. No claim of a clean secret scan is made.

### S3 — Dependency and application security
**Severity: High / not yet assessed**

A dependency inventory and lockfile review are required before selecting compatible scanners and version-pinning strategy.

**Required actions**
- Inventory Python and JavaScript dependency manifests and lockfiles.
- Run dependency vulnerability checks (for example, pip-audit and npm audit where applicable).
- Run static security analysis appropriate to the Python/JavaScript codebase.
- Review file uploads, path handling, subprocess use, parsing of untrusted files, and any exposed administrative functions.

**Status:** pending.

## 4. CI state inherited from prior validation work

The previously observed workflow run `44209026414` used head SHA `bac4414941a3dd35a1706e726fb11f026a3162ba` on the separate KPI validation branch. Its `build` job failed with:

- `test_register_is_current`: generated KPI register differs from the committed register.
- `test_gross_margin_catalog_matches_statement`: the test could not locate the expected gross-margin KPI row/value.

The captured pytest summary was **124 passed, 15 skipped, 2 failed**. The `abohashem-main` job was still in progress in the last observation; therefore the workflow was not a successful end-to-end run.

This audit branch starts from the unchanged `main` baseline, not from that validation branch. The two KPI test failures are recorded as follow-up work and must be repaired and revalidated on an isolated branch before proposing any merge.

## 5. Phase 1 execution checklist

### Data protection
- [ ] Obtain a data-owner decision on public repository visibility.
- [ ] Produce a file-level classification inventory for `data/raw/`, `data/processed/`, exports, and reports.
- [ ] Perform content-level PII/confidential-data review with redacted findings.
- [ ] Scan current tree and full Git history for secrets.
- [ ] Identify public URLs, tokens, API keys, credentials, and hard-coded endpoints.
- [ ] Define private source-data storage and sanitized CI fixtures.
- [ ] Define backup, retention, access-control, and restore procedures.

### Application and dependency security
- [ ] Inventory dependency manifests, lockfiles, and runtime versions.
- [ ] Run dependency vulnerability scanning.
- [ ] Run Python and JavaScript static security analysis.
- [ ] Review authentication/authorization boundaries and any sensitive endpoints.
- [ ] Review upload, parsing, path traversal, CSV/Excel/PDF processing, and subprocess boundaries.
- [ ] Review logging to ensure financial/customer data and secrets are not emitted.

### CI and regression stabilization
- [ ] Reproduce the KPI-register generator mismatch.
- [ ] Repair the gross-margin catalog test using a real rendered row and independently calculated expected value.
- [ ] Explain each skipped test and decide whether it should run in CI.
- [ ] Run the complete Python test suite and browser tests on a supported, pinned runner.
- [ ] Verify export totals against the corresponding on-screen values.
- [ ] Preserve the current main SHA and production deployment throughout.

## 6. Exit criteria

Phase 1 is complete only when:
1. The data owner has decided the repository visibility and source-data handling policy.
2. Current-tree and Git-history secret scans have been run and findings triaged.
3. Sensitive-data exposure has a documented containment/remediation plan.
4. Dependency and static-security scan results are recorded.
5. CI has a reproducible green result, or every remaining failure/skip is explicitly accepted with rationale.
6. Main and production remain unchanged until separately approved.

## 7. Change log

- Created this branch from `main` at `61ba60a7f5745c789958b313ca012c7d88802d41`.
- Added this audit plan and initial inventory only.
- No source data was changed or deleted.
- No merge or deployment was performed.


## 8. Follow-up inspection — 2026-11-18

### Confirmed public data exposure scope
A second inspection of the current branch confirmed that the public repository includes not only raw source material but also processed customer/accounting outputs. Examples of exposed file categories include:
- Customer receivable balances in CSV format.
- Customer receivable history in JSON format.
- Customer-level sales and incentive summaries.
- Financial statement workbooks and detailed income-statement workbooks.
- Raw receivable, cost, income, operations, and recipe source folders.

This confirms that business-sensitive datasets are present in the public repository tree. The inspection did not reproduce or copy customer names, balances, or workbook cell contents into this report. The exact personal-data classification and legal exposure still require a controlled content review.

**Risk update:** S1 is confirmed as a public business-data exposure, not merely a filename-based possibility. Do not interpret this as confirmation that every file contains personal data.

### Dependency and workflow inventory
- Python dependency manifests were found at `analysis/requirements.txt` and `executive_dashboard/requirements.txt`.
- Dependencies are not fully locked: several packages use open-ended or bounded ranges, and no lockfile was found in the inspected paths.
- The current workflow `.github/workflows/python-app.yml` uses `ubuntu-latest`, `actions/checkout@v4`, and `actions/setup-python@v3`. The runner label is floating and the actions are version-tag references rather than immutable commit-SHA pins.
- The workflow runs pytest and flake8, but no dedicated secret scanner, dependency vulnerability scanner, or SAST step was found in the inspected workflow.
- The dashboard's dependency manifests and CI configuration require a separate reproducibility and supply-chain review before changing the workflow.

### Limited credential-pattern search
A repository code-search pass was run for common markers including private-key headers, AWS access-key prefix, and common variable names such as `api_key`, `access_token`, `SECRET_KEY`, and `Bearer `. No matching code-search results were returned.

**Important limitation:** GitHub code search is not a substitute for a dedicated secret scanner. This check does not cover the complete Git history, all binary files, every encoding, or all secret formats. Therefore S2 remains **not cleared**.

### Current phase status
- [x] Confirmed the repository remains public, as temporarily authorized by the owner for this scan.
- [x] Confirmed processed customer/accounting datasets are also present in the public tree.
- [x] Inspected the primary workflow and two Python dependency manifests.
- [x] Ran a limited repository code-search pass for common credential patterns (no hits returned).
- [ ] Run a dedicated current-tree and full-history secret scanner with redacted output.
- [ ] Inspect raw and processed data content under controlled handling and classify customer/company confidential information.
- [ ] Run dependency vulnerability and Python/JavaScript SAST scans.
- [ ] Decide containment and private source-data storage before any file movement or visibility change.

No repository visibility setting, source file, production deployment, or main-branch commit was changed during this follow-up.


## 9. Security workflow added — execution pending

Added `.github/workflows/security-audit.yml` on the isolated audit branch only.

The workflow is configured to:
- Check out full Git history.
- Run Gitleaks against the current tree and Git history, with redaction enabled and finding details suppressed from normal workflow output.
- Run `pip-audit` against both discovered Python requirements files.
- Run Bandit against the `analysis` and `executive_dashboard` Python trees.
- Use read-only repository permissions and an Ubuntu 24.04 runner.

The checkout action is pinned to a full commit SHA. The Gitleaks container currently uses a version tag rather than a digest; supply-chain hardening of the scanner image remains a follow-up.

**Execution status (updated 2026-11-18):** GitHub Actions did execute the workflow on the audit branch. The first run was cancelled during a branch update. The latest run (`44212039539`, head SHA `93087482c9a51e1f05959fb9b3e4ab923baa9cfc`) completed with a failure in the Bandit step. Gitleaks and pip-audit completed successfully. See Section 10 for the recorded results. The earlier statement that no runs existed is superseded.

### Additional processed-data inventory
The `data/processed/` directory includes customer balance/history extracts, customer dimension and sales/bonus summaries, detailed sales transaction exports, financial statement outputs, forecasts, cost/recipe data, and operations datasets. This strengthens the conclusion that the public tree contains operationally and commercially sensitive company data. No record-level values were copied into this report.

### Revised checklist
- [x] Add an isolated security-scanning workflow with read-only permissions.
- [ ] Obtain and review an actual successful or failed execution of the new security workflow.
- [ ] Triage findings without disclosing secret values or customer-level records.
- [ ] Confirm whether any credentials require rotation; do not rotate unless a credential is actually validated as exposed.


## 10. Security scan results — 2026-11-18

**Run:** [44212039539](https://github.com/accmohanadibrahim/ABOHASHEM-sales/actions/runs/44212039539)  
**Branch:** `audit/phase-1-security-ci-2026-11`  
**Scanned commit:** `93087482c9a51e1f05959fb9b3e4ab923baa9cfc`  
**Overall result:** failed at the Bandit static-analysis gate; this is a findings-driven failure, not evidence that the scanner failed to execute.

### 10.1 Gitleaks — completed
- Current working tree and full Git history were scanned.
- Reported finding count: **0**.
- The scanner step completed successfully.
- Scope limitation: this does not establish that confidential business/customer data is absent. It only reports no matches from the configured Gitleaks ruleset.

### 10.2 pip-audit — completed
- Both `analysis/requirements.txt` and `executive_dashboard/requirements.txt` were audited.
- Both manifests reported: **No known vulnerabilities found**.
- The dependency audit step completed successfully.
- Scope limitation: manifests are not fully locked; transitive/runtime environment reproducibility and JavaScript dependencies were not covered by this result.

### 10.3 Bandit — findings require triage
- Scope: `analysis/` and `executive_dashboard/`, excluding the configured test and virtual-environment paths.
- Total findings: **84**.
- Severity counts: **4 HIGH**, **1 MEDIUM**, **79 LOW**.
- The Bandit step exited non-zero because findings were present.
- These are automated static-analysis findings, not yet confirmed exploitable vulnerabilities. Each must be reviewed for reachability, input trust, context, and compensating controls.
- No source snippets, finding text, file paths, or line-level details are included in this public report.

### 10.4 Workflow follow-up
- The workflow's Bandit summary has been adjusted to print counts by severity and Bandit rule ID only. It intentionally suppresses paths, line numbers, source snippets, and finding text from public logs.
- A subsequent run is required to capture this sanitized rule-level breakdown.
- Do not suppress or waive HIGH findings without documented triage and owner approval.

### 10.5 Current conclusions
- Secret scanner: **no findings reported by configured Gitleaks scan**.
- Python dependency scan: **no known vulnerabilities reported for the two manifests**.
- Python SAST: **not cleared; 4 HIGH, 1 MEDIUM, 79 LOW findings require triage**.
- Confidential business-data exposure: **confirmed in the public repository tree**, independent of the scanner results.
- No change to repository visibility, `main`, production deployment, or business source data was performed.

### 10.6 Remaining work
- [ ] Run the updated workflow and capture the Bandit rule-ID counts.
- [ ] Triage all 4 HIGH and 1 MEDIUM findings in a controlled review.
- [ ] Review LOW findings and document false positives/accepted risks.
- [ ] Assess JavaScript dependencies and JavaScript static analysis separately.
- [ ] Complete content-level classification of customer/company data and agree containment with the data owner.
- [ ] Keep the audit isolated; no merge or production deployment without explicit approval.


### 10.7 Initial triage of HIGH findings — source review on 2026-11-18

The Bandit rule IDs were mapped to their documented checks and the corresponding Python source locations were reviewed at the scanned source baseline.

**B324 — one HIGH finding**
- Location: `executive_dashboard/build_all.py:70`.
- The flagged call is an MD5 digest of a file's bytes, returned by a helper named `digest`.
- The surrounding code uses this digest as a build/output comparison fingerprint; the reviewed context does not indicate password storage, authentication, signatures, or integrity verification across a trust boundary.
- Initial assessment: **likely non-security fingerprint use / likely false positive for security impact**, but MD5 remains collision-weak. Recommended cleanup: replace with SHA-256 to avoid ambiguity and collision concerns. Do not use `usedforsecurity=False` as a blanket suppression unless the project deliberately retains MD5 for a documented non-security compatibility reason.

**B613 — three HIGH findings**
- `executive_dashboard/src/ar_history.py:56`
- `executive_dashboard/src/ops_ingest.py:71`
- `executive_dashboard/src/recipes.py:60`
- All three locations define the same `BIDI` regular expression. The pattern intentionally contains Unicode bidirectional formatting/control characters as members/ranges of a character class so the parsers can identify or strip such controls from ingested text.
- Initial assessment: **intentional sanitizer pattern, not evidence by itself of a Trojan Source control-flow payload**. However, embedding invisible bidi controls directly in Python source creates a source-review hazard and is exactly the class of source ambiguity that B613 is designed to surface.
- Recommended no-behavior-change cleanup: express the same character class using explicit ASCII escape notation (for example, `r"[\\u200e\\u200f\\u202a-\\u202e\\u2066-\\u2069]"`) and add a unit test proving the sanitizer still detects/removes every intended code point. This recommendation is not yet applied.

**Triage status:** the four HIGH findings now have a source-level preliminary explanation. None is currently confirmed as an exploitable vulnerability from the reviewed context. The three B613 findings should still be remediated as source-hygiene issues and re-scanned. The B324 call should be changed to SHA-256 in a separate reviewed change. No application source file has been modified during this audit.

**Important scope note:** this review was limited to the exact flagged lines and their immediate context. It is not a full manual audit of the parser, data-ingestion, or build pipeline.


## 10.8 Updated scan and MEDIUM finding triage — 2026-11-18

**Run:** [44218887824](https://github.com/accmohanadibrahim/ABOHASHEM-sales/actions/runs/44218887824)  
**Scanned workflow commit:** `d5eea4178868ca0582a8fcd52dde7654a68866c9`  
**Source baseline reviewed:** `27233c9bf79057e906f06cbe8cc5fbec892d7025`  
**Overall result:** failed at the Bandit step because findings remain.

The updated workflow completed all scanner steps and emitted sanitized locations for HIGH/MEDIUM findings (path and line only):
- HIGH B324: 1
- HIGH B613: 3
- MEDIUM B307: 1
- LOW: 79
- Gitleaks: 0 findings in the current tree and full Git history.
- pip-audit: both Python requirements manifests reported no known vulnerabilities.

**B307 — one MEDIUM finding**
- Location: `analysis/07_forecasting.py:174`.
- The flagged operation is `eval(best_model.replace("ARIMA", ""))`.
- Source review shows `best_model` is selected from the keys of the locally computed cross-validation summary. Those keys are constructed by the forecasting script from a fixed internal model-name list; they are not read from a request, uploaded file, or external configuration. The evaluated expression is therefore constrained by this internal model-name set in the reviewed execution path.
- Preliminary assessment: **no direct attacker-controlled input path was identified in the reviewed context; likely low practical exploitability / constrained use**, but `eval` is unnecessary and should be removed.
- Recommended safe replacement: parse the tuple using `ast.literal_eval` after validating the expected `ARIMA(...)` prefix and tuple shape, or map each allowed model name to a fixed tuple. Add a test for valid model names and rejection of unexpected strings.
- This is a preliminary source-context review, not proof that every upstream data path is safe. No code change has been applied.

### Updated phase status
- [x] Run the updated workflow and capture sanitized HIGH/MEDIUM locations.
- [x] Perform preliminary source-context triage for the one MEDIUM B307 finding.
- [ ] Implement and test the proposed source cleanups (SHA-256, escaped bidi controls, and removal of `eval`) on a separately approved remediation branch.
- [ ] Review LOW findings and document false positives/accepted risks.
- [ ] Complete content-level classification and containment planning for exposed business/customer data.
- [ ] Review JavaScript dependencies and JavaScript static analysis.

The latest workflow run is findings-driven failure, not a clean security pass. The zero Gitleaks result and clean pip-audit results do not mitigate or disprove the confirmed public exposure of business-sensitive files in the repository.

No application source files, business datasets, repository visibility settings, `main`, or production deployment were changed. The report update is confined to the audit branch.


## 10.9 Metadata-only classification of exposed data paths — 2026-11-18

A metadata-only review was performed against the recursive Git tree at the unchanged main baseline `61ba60a7f5745c789958b313ca012c7d88802d41`. No file contents, customer names, account balances, invoice values, or workbook cells were copied or opened for this inventory.

### Confirmed path-level inventory
- `data/raw/`: **80 files** — 49 receivables/balance documents, 4 cost-related files, 12 operations-related files, 3 recipe-related files, 5 income-related files, 5 prior-year income-related files, and 2 additional financial-statement workbooks.
- Raw-file formats: **61 PDF**, **11 XLSX**, **3 JSON**, and **5 TXT**.
- `data/processed/`: **32 files**, including customer/accounting extracts, sales transaction exports, financial statement outputs, forecasts, cost/recipe and operations data.
- `analysis/data/`: **9 files**; `analysis/data_2026_06/`: **6 files**. These include invoice-header/line extracts and customer receivable/debt/bonus summary datasets.
- Two invoice CSV path entries are present in the repository tree.
- The path-name scan identified **97 file paths** containing customer/receivable/invoice/debt/balance/sales-transaction/bonus-related terms across the repository. This is a path count, not a count of unique customers or records.

### Classification and exposure assessment
1. **Customer/receivable documents and extracts — Critical confidentiality classification pending data-owner confirmation.** Filenames and directory structure establish that customer receivable/balance material is present in the public tree; some filenames themselves contain customer identifiers. The report intentionally omits those identifiers.
2. **Invoice headers and line-level exports — Critical confidentiality classification pending content review.** These datasets can contain counterparty identifiers, transaction dates, quantities, prices, and other commercially sensitive fields.
3. **Sales transaction and customer incentive summaries — High to Critical.** These may disclose customer-level sales, pricing, volumes, and incentive arrangements.
4. **Financial statements, cost sheets, BOM/recipes, and standard costs — High commercial confidentiality.** These can disclose internal financial performance, margins, formulas, product composition, and procurement/cost structures.
5. **Operations and supplier documents — High commercial confidentiality pending content review.** Review for supplier identity, purchasing terms, and operational details.

These are conservative classifications based on path names, file types, and business context. They are not a legal determination and do not assert that every file contains personal data.

### Containment recommendations — not executed
- Restrict public access to the repository and associated artifacts through a separately approved owner decision; public exposure remains active until containment is approved and completed.
- Before any history rewrite or data removal, preserve an access-controlled forensic copy and a checksum manifest. Do not overwrite the only copy of source data.
- Create a private source-data repository/storage area with least-privilege access, audit logging, retention policy, and backup/restore controls.
- Replace real business data in CI, examples, and demos with synthetic or irreversibly anonymized fixtures.
- Treat Git history, forks, cached clones, releases, workflow artifacts, and published dashboard assets as separate exposure surfaces. A future visibility change or deletion from the current tree alone does not recall already cloned or cached copies.
- If controlled content review confirms personal data or regulated information, escalate to the company's data owner/legal/privacy lead for incident assessment and any required notifications.
- Rotate credentials only if a credential is validated as exposed; Gitleaks currently reports zero matches but does not assess business-data confidentiality.

### Status
- [x] Metadata-only path classification completed at baseline.
- [x] Aggregate counts and risk categories recorded without reproducing customer identifiers or financial values.
- [ ] Controlled content-level review by an authorized data owner.
- [ ] Containment decision and private-storage plan approved.
- [ ] Git-history, forks, artifacts, and deployed/static assets exposure review completed.

No file content was modified, deleted, or moved. No visibility change, history rewrite, merge, or deployment was performed. The review and this report update are confined to the audit branch.


## 10.10 Expanded public exposure review — dashboard, branches, and template repository — 2026-11-18

### A. Published production dashboard
The public production URL `https://mobile-bi.edgeone.dev/` was inspected with a live Firecrawl scrape using PII-redaction guidance and targeted metadata questions. The normal browser fetch path was unavailable, but the Firecrawl scrape successfully rendered the page.

Observed facts:
- The root page is a live executive financial/operational dashboard, not a static product landing page.
- It visibly exposes company-level sales, collection, receivables/overdue, customer concentration, invoice, stock, supplier, and financial-statement sections/metrics.
- A targeted metadata-only check of the rendered HTML reported the presence of customer names/identifiers or customer-level transaction/receivable details, as well as aggregate company financial/sales metrics. No customer names, identifiers, row values, or financial amounts are reproduced in this report.
- The HTML contains inline data/text; no external script or stylesheet URLs were identified in the limited source extraction.
- A follow-up request to `https://mobile-bi.edgeone.dev/data.js` returned HTTP 404. This does not prove that all data is inline or that no other data endpoint exists; it only means this specific path was not found.
- Firecrawl's URL map returned only the root page. This is not proof that no hidden routes or API endpoints exist.

**Assessment:** the deployed dashboard itself is a separate public exposure surface. The presence of customer-level details in the rendered HTML is a high-priority confidentiality issue even if the GitHub repository is later restricted. A public dashboard must not rely on client-side hiding or UI filters as access control.

### B. Other public branches in the same repository
A metadata-only tree comparison was performed on six other public branches, in addition to the main and audit branches. Each of the six inspected branches contains:
- 80 files under `data/raw/`
- 32 files under `data/processed/`
- 97 customer/receivable/invoice/debt/balance/sales-transaction/bonus-related path names

The inventories match the main baseline at the path-count level. Thus, the exposure is not isolated to the default branch; multiple public refs in the same repository expose substantially the same business-data tree. No record contents were opened for this comparison.

### C. Public template repository
The repository metadata identifies `accmohanadibrahim/ABOHASHEM-sales-` as a separate public template repository. Its default branch tree was inspected by path metadata only:
- 196 file blobs in the inspected tree.
- 23 files under `data/processed/`.
- 31 paths containing customer/receivable/invoice/balance/sales/debt/bonus-related terms.
- No `data/raw/` paths were found in that tree.

This is a separate public repository and must be included in the data-owner's exposure review. The presence of customer-related processed paths is confirmed; content-level classification remains pending.

### D. GitHub releases and workflow artifacts
- The repository releases endpoint returned an empty list at the time of review.
- The inspected security workflow run `44218887824` had no associated Actions artifacts.
- GitHub Pages is disabled according to repository metadata.
- The external EdgeOne deployment is not represented by GitHub Pages metadata. Its deployment linkage, build source, and static asset inventory remain to be confirmed through the hosting provider/account.

### E. Security remediation changes observed on the audit branch
At the time of this review, the audit branch head had advanced to `623ec619895c3481abb12e82f18b2c7a20bf5d93`. Compared with the prior documented audit commit `b69c16878bf9d5dbde0f190268e628f746a5a59a`, five source files changed:
- `analysis/07_forecasting.py`: replaced `eval()` with `ast.literal_eval()`.
- `executive_dashboard/build_all.py`: replaced MD5 digest with SHA-256.
- `executive_dashboard/src/ar_history.py`, `ops_ingest.py`, and `recipes.py`: replaced embedded bidi controls with explicit Unicode escapes.

These changes are present on the audit branch only; this report does not claim they were authored or applied by this audit operation. The associated CI run `44219701215` was still `in_progress` at the time of observation, so the remediations are **not yet validated by a completed scanner/test run**. The earlier "not yet applied" statements in Sections 10.7 and 10.8 describe the state at their respective timestamps and are superseded by this section.

### F. Updated risk and next actions
1. Treat the public production dashboard as an active exposure surface; perform a controlled review of its rendered DOM, data-loading path, API routes, downloadable exports, caching/CDN behavior, and authorization model without collecting or reproducing customer data.
2. Include every public branch and the separate public template repository in the exposure inventory.
3. Have the data owner approve a containment decision for the repository, template repository, and dashboard separately. Do not assume one setting controls all three.
4. Preserve a restricted forensic copy and checksums before any history rewrite or data migration. Review forks, clones, caches, and hosting artifacts.
5. Complete the pending CI run and then run regression tests to ensure the three source remediations preserve behavior.
6. Verify the EdgeOne project source, deployment branch/commit, environment variables, build output, and public asset access through the hosting account; this was not confirmed by GitHub metadata.

No repository visibility setting, source file, business dataset, branch ref, production configuration, or deployment was changed as part of this review. This section records read-only observations and recommendations only.


## 10.11 Remediation test coverage and CI gate review — 2026-11-18

### Source-change test coverage
The current audit-branch source contains the five remediation edits listed in Section 10.10. A read-only review of the existing tests found no dedicated regression tests for:
- The BIDI sanitizer's exact Unicode code-point coverage in `test_ar_history.py`, `test_ops_ingest.py`, or `test_recipes.py`.
- The `ARIMA...` model-name parser's accepted tuple forms and rejection of unexpected input.
- The build fingerprint helper's SHA-256 behavior and output comparison compatibility.

Existing test suites cover adjacent ingestion, history, and recipe behavior, but adjacency is not equivalent to a targeted security regression test. Add focused tests before treating these remediations as behavior-preserving.

### Static-analysis gate behavior
The current `.github/workflows/security-audit.yml` runs Bandit over `analysis/` and `executive_dashboard/` and exits non-zero whenever Bandit returns status 1. Bandit returns status 1 when findings are reported, including LOW-severity findings. Therefore, even if all HIGH and MEDIUM findings are eliminated, the workflow can remain red while accepted LOW findings remain.

Recommended policy decision:
- Keep the full Bandit JSON inventory and severity/rule counts.
- Make the blocking gate explicit (recommended: fail on HIGH and MEDIUM; report LOW as non-blocking findings pending triage), or retain the all-severity blocking policy and plan to resolve/waive all LOW findings.
- Do not suppress findings without a documented rationale, owner, and expiry/review date.

No workflow change was made as part of this review.

### Latest workflow observations
- Run `44219701215`, on source-remediation head `623ec619895c3481abb12e82f18b2c7a20bf5d93`, remained `in_progress` at the latest status check.
- The report-only commit `6e8979199f8669e5796581e8e0fc8c90e6de5e87` queued run `44219919862`; it had not started at the latest check.
- No completed scanner result for the source-remediation head is available yet.

The report update does not change application code, source data, repository settings, or deployment configuration.


## 10.12 LOW-severity Bandit triage — runtime assertions and process execution — 2026-11-18

The completed Bandit scan on source-remediation head `623ec619895c3481abb12e82f18b2c7a20bf5d93` reported 79 LOW findings after the three HIGH and one MEDIUM source findings were no longer present:
- B101: 61
- B110: 1
- B404: 6
- B603: 7
- B607: 4

The previous run failed only because the workflow treated any Bandit finding as blocking. The workflow was subsequently changed on the audit branch to block HIGH and MEDIUM findings while reporting LOW findings. This is a CI policy change, not a finding suppression. The new workflow run was still in progress at the time of this report update.

### B101 — assert used as runtime validation
Read-only source review confirmed that some B101 findings are in production modules, not merely tests. Examples include:
- `executive_dashboard/src/income_2026.py`: required financial-statement fields and arithmetic reconciliation checks.
- `executive_dashboard/src/standard_cost.py`: source-sheet uniqueness, recipe identity, and cost reconciliation checks.
- `executive_dashboard/src/ops_ingest.py`: inventory, purchase, supplier, return, and source-total reconciliation checks.

Python removes `assert` statements when executed with optimization (`python -O` / `PYTHONOPTIMIZE`). These checks therefore must not be relied on as production integrity controls. This is a genuine reliability/data-integrity concern even though Bandit rates it LOW.

**Recommended remediation:** replace production assertions with explicit conditional checks that raise a domain-appropriate exception (for example `ValueError`, `RuntimeError`, or a project-specific validation exception). Preserve assertions only in tests and for internal developer invariants where optimization cannot weaken a required control. Add tests proving a deliberately mismatched source fails under both normal Python and optimized Python.

### B404 / B603 / B607 — subprocess and executable lookup
The searched execution paths use argument arrays with `subprocess.run`; no `shell=True`, `os.system`, `subprocess.Popen`, or `subprocess.call` use was identified in the reviewed search results. This reduces shell-injection exposure but does not eliminate process-execution risk.

Observed external tools include `pdftotext` and LibreOffice (`soffice` / `libreoffice`), resolved in some paths through `PATH` or `shutil.which`. Risk depends on who controls the runner environment and file paths. CI uses a controlled GitHub-hosted runner, but local or service execution should use a trusted fixed PATH or validated absolute executable paths, avoid writable directories earlier in PATH, and validate file inputs. Preserve timeouts and checked return codes.

### B110 — broad exception silently ignored
The remaining B110 finding is in `analysis/07_forecasting.py`, where an ARIMA model-fit exception is swallowed with `except Exception: pass`. This can hide unexpected defects and make a failed candidate look like an ordinary model-selection outcome.

**Recommended remediation:** catch only expected numerical/model-fit exceptions, record the failed candidate and reason in a controlled diagnostic log, and continue the grid only for expected fit failures. Unexpected exceptions should propagate and fail the analysis.

### Triage disposition
- B101: remediation recommended; production data-integrity control weakness.
- B404/B603/B607: conditional/low risk based on current argv-list use; harden executable resolution and input provenance.
- B110: narrow exception handling and add diagnostic logging.
- No blanket suppressions were added. No LOW finding was removed from the scanner inventory.

This section is based on code-path inspection and GitHub code-search excerpts; it is not a full execution test or a complete manual review of every one of the 79 LOW locations.
