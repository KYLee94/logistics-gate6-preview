const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..', '..');
const FORMULA_PATH = path.join(
  ROOT,
  'supabase',
  'functions',
  'll-dashboard-api',
  'v2',
  'formulas.ts',
);

async function main() {
  const checks = [];
  const check = async (id, fn) => {
    try {
      checks.push({ id, ok: true, evidence: await fn() });
    } catch (error) {
      checks.push({ id, ok: false, error: error.message });
    }
  };

  let formulas;
  await check('formula-module-loads', async () => {
    assert.ok(fs.existsSync(FORMULA_PATH), 'missing v2/formulas.ts');
    formulas = await import(`${pathToFileURL(FORMULA_PATH).href}?contract=${Date.now()}`);
    return FORMULA_PATH;
  });

  if (formulas) {
    await check('registry-is-single-versioned-source', () => {
      assert.equal(formulas.FORMULA_REGISTRY_VERSION, 'gate6-logistics-core-1');
      assert.equal(formulas.SCENARIO_CALCULATION_AUTHORITY, 'v2/calculations/explain');
      assert.deepEqual(Object.keys(formulas.FORMULA_REGISTRY), [
        'contractual_rent_monthly',
        'potential_gross_income',
        'income_loss',
        'effective_gross_income',
        'operating_expense',
        'net_operating_income',
        'asset_net_cash_flow',
        'post_debt_cash_flow',
      ]);
      assert.equal(Object.values(formulas.FORMULA_REGISTRY).every((row) => row.version === 1), true);
      return formulas.FORMULA_REGISTRY_VERSION;
    });

    await check('registry-carries-approval-and-test-vector-evidence', () => {
      for (const [key, row] of Object.entries(formulas.FORMULA_REGISTRY)) {
        assert.match(row.status, /^(?:draft|approved)$/u, `${key} approval status`);
        assert.match(row.testVectorHash, /^[a-f0-9]{64}$/u, `${key} test vector SHA-256`);
        assert.equal(typeof row.approvedBy === 'string' || row.approvedBy === null, true, `${key} approver`);
      }
      return 'formula approval metadata';
    });

    await check('draft-formulas-cannot-execute', () => {
      assert.equal(typeof formulas.assertFormulaApproved, 'function');
      for (const [key, row] of Object.entries(formulas.FORMULA_REGISTRY)) {
        if (row.status === 'draft') {
          assert.throws(() => formulas.assertFormulaApproved(key), /FORMULA_NOT_APPROVED/u);
        }
      }
      return 'draft formulas are blocked';
    });

    await check('korean-income-statement-separates-noi-ncf-and-debt', () => {
      const result = formulas.calculateKoreanIncomeStatement({
        contractualRent: 100,
        recoverableCharges: 10,
        depositIncome: 2,
        otherPotentialIncome: 3,
        vacancyLoss: 5,
        rentFreeLoss: 2,
        badDebtLoss: 1,
        contractAdjustmentLoss: 1,
        otherOperatingIncome: 4,
        operatingExpenses: {
          assetManagement: 3,
          facilityManagement: 4,
          cleaningSecurityParkingLandscaping: 3,
          repairsMaintenance: 2,
          landlordUtilities: 2,
          insurance: 1,
          propertyTaxes: 3,
          recurringLeasingManagement: 1,
          other: 1,
        },
        belowNoi: {
          majorRepairs: 2,
          capitalExpenditure: 8,
          tenantImprovements: 2,
          leasingCommissions: 1,
          facilityReplacement: 3,
          reserves: 4,
          nonCashAdjustment: 5,
        },
        debtService: {
          interest: 6,
          principal: 2,
          financingFees: 1,
          hedgeCosts: 1,
        },
      });
      assert.deepEqual(result, {
        potentialGrossIncome: 115,
        incomeLoss: 9,
        effectiveGrossIncome: 110,
        operatingExpense: 20,
        netOperatingIncome: 90,
        assetNetCashFlow: 75,
        postDebtCashFlow: 65,
        formulaRegistryVersion: 'gate6-logistics-core-1',
      });

      const withExtremeDebt = formulas.calculateKoreanIncomeStatement({
        contractualRent: 100,
        debtService: { interest: 9999, principal: 9999 },
      });
      assert.equal(withExtremeDebt.netOperatingIncome, 100, 'debt must not alter NOI');
      return result;
    });

    await check('contract-rent-applies-escalation-rent-free-and-proration', () => {
      const escalated = formulas.calculateMonthlyContractRent({
        baseMonthlyRent: 100,
        termStartMonth: '2026-01-01',
        targetMonth: '2027-01-01',
        escalationRate: 0.1,
        escalationIntervalMonths: 12,
      });
      const rentFree = formulas.calculateMonthlyContractRent({
        baseMonthlyRent: 100,
        termStartMonth: '2026-01-01',
        targetMonth: '2026-01-01',
        rentFree: true,
      });
      const prorated = formulas.calculateMonthlyContractRent({
        baseMonthlyRent: 110,
        termStartMonth: '2026-01-01',
        targetMonth: '2026-02-01',
        occupiedDays: 15,
        daysInMonth: 30,
      });
      assert.equal(escalated, 110);
      assert.equal(rentFree, 0);
      assert.equal(prorated, 55);
      return { escalated, rentFree, prorated };
    });

    await check('monthly-is-the-only-source-and-quarter-year-are-derived', () => {
      const rows = [
        { month: '2026-01-01', amount: 10 },
        { month: '2026-02-01', amount: 20 },
        { month: '2026-04-01', amount: 30 },
        { month: '2027-01-01', amount: 40 },
      ];
      const result = formulas.aggregateMonthlyRows(rows);
      assert.deepEqual(result.quarters, {
        '2026-Q1': 30,
        '2026-Q2': 30,
        '2027-Q1': 40,
      });
      assert.deepEqual(result.years, { 2026: 60, 2027: 40 });
      assert.throws(
        () => formulas.aggregateMonthlyRows([{ month: '2026-01-15', amount: 1 }]),
        /MONTH_MUST_BE_FIRST_DAY/u,
      );
      return result;
    });

    await check('scenario-and-accounting-basis-are-explicit', () => {
      assert.deepEqual([...formulas.LEDGER_SCENARIOS], ['actual', 'budget', 'forecast']);
      assert.deepEqual([...formulas.ACCOUNTING_BASES], ['accrual', 'cash']);
      return { scenarios: formulas.LEDGER_SCENARIOS, bases: formulas.ACCOUNTING_BASES };
    });
  }

  const report = {
    ok: checks.every((row) => row.ok),
    mode: 'executable-formula-contract',
    network_used: false,
    database_write_used: false,
    checks,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, fatal: error.message }, null, 2));
  process.exitCode = 1;
});
