function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function slabTax(taxableIncome: number, brackets: [number, number, number][]): number {
  let tax = 0;
  for (const [lower, upper, rate] of brackets) {
    const bracketWidth = upper - lower;
    const amountInBracket = clamp(taxableIncome - lower, 0, bracketWidth);
    tax += amountInBracket * rate;
  }
  return Math.max(0, tax);
}

const OLD_BRACKETS: [number, number, number][] = [
  [0, 250000, 0],
  [250000, 500000, 0.05],
  [500000, 1000000, 0.2],
  [1000000, Infinity, 0.3],
];

const NEW_BRACKETS: [number, number, number][] = [
  [0, 400000, 0],
  [400000, 800000, 0.05],
  [800000, 1200000, 0.1],
  [1200000, 1600000, 0.15],
  [1600000, 2000000, 0.2],
  [2000000, 2400000, 0.25],
  [2400000, Infinity, 0.3],
];

const REBATE_THRESHOLD = 1200000;
const CESS_RATE = 0.04;

export interface RegimeResult {
  taxableIncome: number;
  slabTax: number;
  rebateGiven: number;
  taxPreCess: number;
  cess: number;
  totalTax: number;
  netPayable: number;
  monthlyTds: number;
  breakup: {
    totalGross: number;
    basicSalary: number;
    hra: number;
    otherAllowances: number;
    pt: number;
    tds: number;
    pfEmployee: number;
    pfEmployer: number;
    netTransfer: number;
    netAnnual: number;
  };
}

export interface ComparisonResult {
  betterRegime: "Old Tax Regime" | "New Tax Regime";
  savings: number;
}

export interface SalaryTaxOutput {
  input: { annualIncome: number; alreadyPaid: number; oldOtherDeductions: number };
  oldRegime: RegimeResult;
  newRegime: RegimeResult;
  comparison: ComparisonResult;
}

function salaryBreakup(annualIncome: number, monthlyTds: number): RegimeResult["breakup"] {
  const monthlySalary = annualIncome / 12;
  const totalGross = Math.round(monthlySalary);
  const basicSalary = Math.round(monthlySalary * 0.5);
  const hra = monthlySalary <= 40000 ? Math.round(basicSalary * 0.4) : 8000;
  const otherAllowances = Math.round(totalGross - basicSalary - hra);
  const pt = monthlySalary > 20000 ? 200 : monthlySalary > 15000 ? 150 : 0;
  const pfEmployee = 1800;
  const pfEmployer = 1800;
  const tds = Math.round(monthlyTds);
  const netTransfer = Math.round(totalGross - pt - tds - pfEmployee);
  const netAnnual = netTransfer * 12;

  return { totalGross, basicSalary, hra, otherAllowances, pt, tds, pfEmployee, pfEmployer, netTransfer, netAnnual };
}

function computeRegime(
  annualIncome: number,
  alreadyPaid: number,
  stdDeduction: number,
  otherDeductions: number,
  brackets: [number, number, number][],
  isNewRegime: boolean,
): RegimeResult {
  const taxableIncome = Math.max(0, annualIncome - stdDeduction - otherDeductions);
  const slab = slabTax(taxableIncome, brackets);

  let rebateGiven: number;
  let taxPreCess: number;

  if (isNewRegime) {
    const excess = Math.max(0, taxableIncome - REBATE_THRESHOLD);
    taxPreCess = Math.min(slab, excess);
    rebateGiven = slab - taxPreCess;
  } else {
    taxPreCess = slab;
    rebateGiven = 0;
  }

  const cess = taxPreCess * CESS_RATE;
  const totalTax = slab < 0 ? 0 : taxPreCess + cess;
  const netPayable = Math.max(0, isNewRegime ? totalTax : totalTax - alreadyPaid);
  const monthlyTds = netPayable / 12;

  return {
    taxableIncome,
    slabTax: slab,
    rebateGiven,
    taxPreCess,
    cess,
    totalTax,
    netPayable,
    monthlyTds,
    breakup: salaryBreakup(annualIncome, monthlyTds),
  };
}

export function calculateSalaryTax(
  annualIncome: number,
  alreadyPaid = 0,
  oldOtherDeductions = 0,
): SalaryTaxOutput {
  const oldRegime = computeRegime(annualIncome, alreadyPaid, 50000, oldOtherDeductions, OLD_BRACKETS, false);
  const newRegime = computeRegime(annualIncome, alreadyPaid, 75000, 0, NEW_BRACKETS, true);

  const betterRegime =
    oldRegime.netPayable <= newRegime.netPayable ? "Old Tax Regime" : "New Tax Regime";
  const savings = Math.abs(oldRegime.netPayable - newRegime.netPayable);

  return {
    input: { annualIncome, alreadyPaid, oldOtherDeductions },
    oldRegime,
    newRegime,
    comparison: { betterRegime, savings },
  };
}

export function formatInr(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}
