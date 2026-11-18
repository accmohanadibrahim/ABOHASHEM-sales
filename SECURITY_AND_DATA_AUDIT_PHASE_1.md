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
