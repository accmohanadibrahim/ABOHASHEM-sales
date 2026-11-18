# Regression Validation — Phase 2

**Status:** Implementation added; execution evidence pending.  
**Branch:** `audit/regression-tests-2026-11`  
**Base:** `audit/phase-1-security-ci-2026-11` at the reviewed Phase 1 report commit.  
**Scope:** Security-remediation regression coverage and optimization-safe financial reconciliations.

## Changes made

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

- The test file currently contains focused tests; successful execution has **not yet been evidenced** by a completed GitHub Actions job.
- The commit combined-status endpoint currently shows Vercel build contexts failing with an account/build-rate-limit response. These are hosting/build checks, not evidence that pytest or the security scanner failed.
- The connector's available workflow-run lookup does not expose a run ID for this push-triggered execution, so no successful Actions run is claimed here.
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
