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
