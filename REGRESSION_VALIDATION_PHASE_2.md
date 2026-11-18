# Regression Validation — Phase 2

**Status:** Focused pytest suite passed on the latest commit; full security workflow is still running / awaiting scanner completion.  
**Branch:** `audit/regression-tests-2026-11`  
**Base:** `audit/phase-1-security-ci-2026-11` at the reviewed Phase 1 report commit.  
**Scope:** Security-remediation regression coverage and optimization-safe financial reconciliations.

## Changes made

4. Converted all runtime `assert` statements in `executive_dashboard/src/standard_cost.py` to explicit `_require(...)` checks raising `ValueError`. This covers standard-cost row arithmetic, confirmed product identity, casing source cells and costs, recipe consistency, monthly recipe availability, sales-code links, duplicate standard-cost links, and missing confirmed rows.

5. Converted all runtime `assert` statements in `executive_dashboard/src/ops_ingest.py` to explicit `_require_condition(...)` checks raising `ValueError`. This covers inventory valuation, purchase totals, supplier totals, returns parsing and totals, recipe merges, September purchase-to-PDF matching, stock-count reconciliation, and required sales-family links. No source workbook/PDF contents or generated outputs were changed.

6. Added AST-based tests confirming that `standard_cost.py` and `ops_ingest.py` contain no runtime `assert` statements, plus direct and `python -O` tests for their explicit validation helpers.

1. Added `executive_dashboard/tests/test_security_regressions.py` with synthetic-only tests for:
   - targeted Unicode bidi controls in both text-cleaning functions;
   - preservation/normalization of representative Arabic and compatibility text;
   - AST verification that forecasting uses `ast.literal_eval`, not executable `eval`;
   - accepted ARIMA tuple literals and rejection of executable/computed expressions;
   - SHA-256 digest stability, content sensitivity, and missing-file marker behavior;
   - inventory valuation reconciliation pass/fail cases;
   - income-statement reconciliation pass/fail cases, including non-finite values;
   - a subprocess check under `python -O` to ensure reconciliation failures still raise.

2. Updated `.github/workflows/security-audit.yml` on this branch to run the focused pytest module and to trigger on pushes to this branch. The security scanner steps remain in the workflow.

3. Replaced runtime `assert` checks in:
   - `executive_dashboard/src/ops_ingest.py::check_valuation`
   - critical income statement field/section checks and reconciliation checks in `executive_dashboard/src/income_2026.py`

   These checks now raise `ValueError` explicitly and remain active under optimized Python. The tolerance predicates were written to preserve the previous strict comparisons, including rejecting non-finite values such as NaN.

## Validation status and limitations

- The prior focused security workflow run 44221792749 completed successfully, including pytest, Gitleaks, pip-audit, and Bandit. It predates the latest Standard Cost and Operations Ingestion assertion conversions.
- Latest branch commit after these conversions: `94c748c2e2233a5407f4331e140f04f3116dd242`; its workflow run 44222247145 was queued/pending when this report was updated. Do not claim the new conversions passed CI until this exact commit's run completes successfully.

- Latest focused test run: GitHub Actions run [44221792749](https://github.com/accmohanadibrahim/ABOHASHEM-sales/actions/runs/44221792749), commit `706b5818ee47e8c772bac2651d230128a2355de0`. The `Run focused security remediation regression tests` step completed successfully. Gitleaks, pip-audit, and Bandit steps had not yet completed at the time of this report update.
- Earlier run 44221716574 exposed three test-design issues: synthetic income values did not exceed the configured one-unit tolerance, and a compact test harness needed correction. Those were corrected on the isolated branch; latest pytest step now passes.
- The commit combined-status endpoint may show Vercel build contexts failing with an account/build-rate-limit response. These are hosting/build checks, not evidence that pytest or the security scanner failed.
- Do not treat the focused pytest success as a successful full security workflow until the remaining scanner steps complete.
- The focused changes do not replace all production assertions. `executive_dashboard/src/standard_cost.py` and additional parsing/reconciliation paths in `ops_ingest.py` still contain assertions and require a separate inventory, conversion, and regression coverage.
- No production dataset, generated dashboard output, published deployment, repository visibility, or default branch was changed.

## Next validation steps

1. Obtain and inspect the actual Actions run and pytest output for this branch.
2. Fix test or environment failures before broadening the gate.
3. Convert remaining production assertions in `standard_cost.py` and the remaining production paths in `ops_ingest.py` to explicit validation exceptions, one function group at a time.
4. Add boundary, duplicate, missing-row, mismatch, and non-finite test cases for each converted invariant.
5. Run the full available test suite and the complete security workflow; compare generated outputs only in an isolated environment and do not overwrite committed business outputs.
6. Review the diff and reconcile KPI/output totals before any proposal to merge.

## Safety boundary

No merge to `main`, deployment, repository visibility change, business-data deletion/movement, or customer-file content inspection is authorized by this phase.
