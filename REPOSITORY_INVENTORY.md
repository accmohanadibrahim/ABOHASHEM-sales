# Repository Inventory — ABOHASHEM-sales

**Audit date:** 2026-11-18  
**Baseline:** `main` at `61ba60a7f5745c789958b313ca012c7d88802d41`  
**Audit branch:** `audit/repository-inventory-2026-11-18`  
**Scope:** read-only repository inventory and selected architecture/test inspection. No application code or source data changed.

## 1. Repository snapshot

- Git tree contains **554 entries**: **515 blobs** and **39 directories**.
- Repository is public; connected GitHub identity has repository push permission.
- Root README describes the project as an integrated financial and operational intelligence platform for Abohashem Meat Industries.
- Main data principle documented by the project: figures must remain traceable to uploaded source files; missing information is not to be estimated or fabricated without an explicit label.

## 2. Main project areas

| Path | Responsibility | Observed contents |
|---|---|---|
| `analysis/` | Original sales analytics pipeline | 12 numbered Python stages, diagnostics, forecasting, exports, requirements and historical HTML dashboards |
| `data/raw/` | Source evidence | Invoice, inventory, financial-statement, receivable, recipe, purchase and other source files |
| `data/processed/` | Derived datasets | Processed CSV/JSON outputs used by downstream dashboards |
| `dashboards/` | Earlier analytical dashboard | Embedded data and modular JS/HTML sections |
| `executive_dashboard/` | Current detailed executive/mobile BI application | Build scripts, data, source modules, mobile HTML, statements, documentation and tests |
| `command_center/` | Consolidated command-center dashboard | Build script, generated data, HTML template/output and tests |
| `reports/` | Analytical deliverables | Data-quality, econometric and investor-executive reports |
| `abohashem_main/` | Preserved imported project snapshot | Unpacked source project and manifest |

## 3. KPI source of truth

The KPI register is **not at repository root**. The current register and generator are:

- `executive_dashboard/docs/KPI_REGISTER.md`
- `executive_dashboard/tools/kpi_register.py`
- Main BI source: `executive_dashboard/mobile/Abu_Hashem_Mobile_bi.html`
- Financial-statement calculations and KPI dictionary: `executive_dashboard/src/statements.py`
- Relevant tests: `executive_dashboard/tests/test_kpi_register.py`, `test_statements.py`, and browser BI tests.

The register currently documents **48 KPIs** and records formula, function, source, export table, matching test, status and missing-data notes. It also documents coverage for **54 dashboard sections**. This is a strong foundation; coverage should be validated from the generator and live export-table registry rather than by treating the Markdown file alone as authoritative.

## 4. Test and CI structure observed

- `.github/workflows/python-app.yml` runs lint and pytest, with a separate `abohashem-main` reproducibility job.
- `executive_dashboard/tests/` contains focused tests for KPI register, statements, data ingestion, recipes, AR history, mobile assembly and browser behavior.
- `command_center/tests/test_command_center.py` verifies source-total reconciliations, missing-period behavior, partial AR snapshots, recipe margins and browser execution.
- `analysis/04_data_quality.py` checks missingness, duplicate-line candidates, invoice-level totals, pricing residuals, outliers and monthly invoice-count reconciliation.
- `analysis/10_export_dashboard_data.py` consolidates processed outputs into the embedded dashboard payload.

## 5. Existing CI evidence (not a fresh local test run)

The existing CI run on `verify/kpi-coverage-2026-11` reported:

- 124 passed
- 2 failed
- 15 skipped
- 86.30 seconds

The two reported failures were:
1. `test_register_is_current`: generated KPI register differed from the committed register after test coverage additions.
2. `test_gross_margin_catalog_matches_statement`: the test's numeric extraction regex was over-escaped and did not parse the displayed percentage.

The `abohashem-main` CI job passed in that run. These results belong to the verification branch and must not be represented as a test result for the unmodified `main` branch.

A separate `audit/phase-1-security-ci-2026-11` branch has an isolated security-audit workflow. Its current result was still running at the time of this inventory; no security-clean claim is made.

## 6. Initial architecture and control observations

1. **Multiple dashboard surfaces exist.** The repository contains historical `analysis/dashboard*.html`, `dashboards/`, the detailed `executive_dashboard/`, and `command_center/`. Each needs an explicit status label (production, supported, legacy, or generated artifact) to prevent accidental edits to the wrong surface.
2. **Build outputs are committed.** Embedded data and generated HTML/JS files are tracked. Changes to source data or build logic should be followed by deterministic rebuilds and source-to-output reconciliation.
3. **Data completeness is period-specific.** README documents known missing/partial periods and management-approved caveats. Dashboards and exports must preserve these states instead of silently filling gaps.
4. **KPI register maintenance is generator-driven.** Manual-only edits are unsafe; the generator and its tests must remain the source of truth.
5. **No destructive cleanup is in scope.** Historical files, source documents, imported project files and existing dashboard surfaces are preserved.

## 7. Recommended next sequence

1. Complete the KPI coverage branch verification and obtain a fresh green CI result.
2. Reconcile all KPI definitions against source functions, export IDs and meaningful calculation tests.
3. Build a dashboard-surface map identifying canonical production entrypoints and generated artifacts.
4. Trace each pipeline from raw source to processed output to dashboard/export.
5. Add a reproducibility/data-integrity gate for generated files and source-data preservation.
6. Only then prioritize UI, performance, accessibility and operational-alert improvements.

## 8. Evidence limits

This inventory was produced from GitHub tree metadata, README, selected source modules, test files, KPI documentation and CI logs. It is **not** a claim that all 554 entries have been line-by-line reviewed, that all source PDFs/workbooks have been reprocessed, or that browser tests were executed in this chat environment.
