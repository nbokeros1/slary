// ─── Types ─────────────────────────────────────────────────────────────────

export type Country = 'CA' | 'US'
export type WorkerType = 'employee' | 'autonomous' | 'gig' | 'student'
export type Sector = 'transport' | 'tech' | 'creative' | 'service'
export type TipsMode = 'hour' | 'flat' | 'none'

export interface Region {
  code: string
  name: string
}

export interface CATaxConfig {
  prov: number
  pension: number
  ei: number
  basicFed: number
  basicProv: number
  pensionLabel: string
  eiLabel: string
  provLabel: string
  provBrackets?: [number, number][]
}

export interface USTaxConfig {
  state: number
  ss: number
  medicare: number
  stateLabel: string
  noStateTax: boolean
  stateBrackets?: [number, number][]
}

export interface Profile {
  country: Country
  region: string
  workerType: WorkerType
  sector: Sector
  savedRate?: number
}

export interface ShiftData {
  date: string
  hours: number
  rate: number
  ot15: number
  ot20: number
  tipsAmt: number
  bonus: number
  vacation: number
  taxBenefit: number
  base: number
  otPay: number
  gross: number
  fed: number
  prov: number
  pension: number
  ei: number
  selfEmployed: number
  totalTax: number
  net: number
  country: Country
  region: string
  ts: number
}

export interface EntryData {
  cat: string
  amount: number
  desc: string
  ts: number
}

export interface YtdData {
  // Pour salariés / gig / étudiants
  grossYtd: number
  taxWithheldYtd: number
  hoursYtd: number
  // Pour autonomes
  revenueYtd: number
  instalmentsYtd: number
  // Commun
  period: string
  ts: number
}

export interface CalcResult {
  fed: number
  prov: number
  pension: number
  ei: number
  selfEmployed: number
  totalTax: number
  net: number
}

export interface DeclarationCategory {
  key: string
  icon: string
  name: string
  desc: string
  type: 'income' | 'deduction'
}

export interface ChecklistItemDef {
  id: string
  label: string
  due: string
}

// ─── Regions ────────────────────────────────────────────────────────────────

export const REGIONS: Record<Country, Region[]> = {
  CA: [
    { code: 'QC', name: 'Québec' },
    { code: 'ON', name: 'Ontario' },
    { code: 'BC', name: 'Colombie-Britannique' },
    { code: 'AB', name: 'Alberta' },
    { code: 'MB', name: 'Manitoba' },
    { code: 'SK', name: 'Saskatchewan' },
    { code: 'NS', name: 'Nouvelle-Écosse' },
    { code: 'NB', name: 'Nouveau-Brunswick' },
    { code: 'PE', name: 'Île-du-Prince-Édouard' },
    { code: 'NL', name: 'Terre-Neuve' },
  ],
  US: [
    { code: 'CA-US', name: 'California' },
    { code: 'NY',    name: 'New York' },
    { code: 'TX',    name: 'Texas' },
    { code: 'FL',    name: 'Florida' },
    { code: 'WA',    name: 'Washington' },
    { code: 'IL',    name: 'Illinois' },
    { code: 'GA',    name: 'Georgia' },
    { code: 'NC',    name: 'North Carolina' },
    { code: 'AZ',    name: 'Arizona' },
    { code: 'CO',    name: 'Colorado' },
    { code: 'MA',    name: 'Massachusetts' },
    { code: 'OH',    name: 'Ohio' },
  ],
}

// ─── Bracket calculator ──────────────────────────────────────────────────────
// Applies proper marginal brackets. Each entry is [ceiling, rate].
// Last entry must have ceiling = Infinity.

export function applyBrackets(taxable: number, brackets: [number, number][]): number {
  let tax = 0
  let prev = 0
  for (const [limit, rate] of brackets) {
    if (taxable <= prev) break
    tax += (Math.min(taxable, limit) - prev) * rate
    prev = limit
  }
  return tax
}

// ─── Canada Tax Rates 2026 ───────────────────────────────────────────────────

// Federal brackets — same for all provinces (applied after basic personal amount)
export const CA_FED_BRACKETS: [number, number][] = [
  [57375,    0.15],
  [114750,   0.205],
  [158519,   0.26],
  [220000,   0.29],
  [Infinity, 0.33],
]

export const CA_TAX: Record<string, CATaxConfig> = {
  QC: {
    prov: 0.19, pension: 0.059,  ei: 0.01664,
    basicFed: 15705, basicProv: 17183,
    pensionLabel: 'RRQ', eiLabel: 'AE', provLabel: 'Impôt Québec',
    provBrackets: [
      [53255,    0.14],
      [106495,   0.19],
      [129590,   0.24],
      [Infinity, 0.2575],
    ],
  },
  ON: {
    prov: 0.0915, pension: 0.0595, ei: 0.01664,
    basicFed: 15705, basicProv: 11865,
    pensionLabel: 'CPP', eiLabel: 'AE', provLabel: 'Impôt Ontario',
    provBrackets: [
      [51446,    0.0505],
      [102894,   0.0915],
      [150000,   0.1116],
      [220000,   0.1216],
      [Infinity, 0.1316],
    ],
  },
  BC: {
    prov: 0.077, pension: 0.0595, ei: 0.01664,
    basicFed: 15705, basicProv: 11981,
    pensionLabel: 'CPP', eiLabel: 'AE', provLabel: 'Impôt C.-B.',
    provBrackets: [
      [45654,    0.0506],
      [91310,    0.077],
      [104835,   0.105],
      [127299,   0.1229],
      [172602,   0.147],
      [240716,   0.168],
      [Infinity, 0.205],
    ],
  },
  AB: {
    prov: 0.10, pension: 0.0595, ei: 0.01664,
    basicFed: 15705, basicProv: 21003,
    pensionLabel: 'CPP', eiLabel: 'AE', provLabel: 'Impôt Alberta',
    provBrackets: [
      [148269,   0.10],
      [177922,   0.12],
      [237230,   0.13],
      [355845,   0.14],
      [Infinity, 0.15],
    ],
  },
  MB: {
    prov: 0.1275, pension: 0.0595, ei: 0.01664,
    basicFed: 15705, basicProv: 15780,
    pensionLabel: 'CPP', eiLabel: 'AE', provLabel: 'Impôt Manitoba',
    provBrackets: [
      [36842,    0.108],
      [79625,    0.1275],
      [Infinity, 0.174],
    ],
  },
  SK: {
    prov: 0.105, pension: 0.0595, ei: 0.01664,
    basicFed: 15705, basicProv: 17661,
    pensionLabel: 'CPP', eiLabel: 'AE', provLabel: 'Impôt Sask.',
    provBrackets: [
      [49720,    0.105],
      [142058,   0.125],
      [Infinity, 0.145],
    ],
  },
  NS: {
    prov: 0.1479, pension: 0.0595, ei: 0.01664,
    basicFed: 15705, basicProv: 8481,
    pensionLabel: 'CPP', eiLabel: 'AE', provLabel: 'Impôt N.-É.',
    provBrackets: [
      [29590,    0.0879],
      [59180,    0.1495],
      [93000,    0.1667],
      [150000,   0.175],
      [Infinity, 0.21],
    ],
  },
  NB: {
    prov: 0.141, pension: 0.0595, ei: 0.01664,
    basicFed: 15705, basicProv: 12458,
    pensionLabel: 'CPP', eiLabel: 'AE', provLabel: 'Impôt N.-B.',
    provBrackets: [
      [47715,    0.094],
      [95431,    0.14],
      [176756,   0.16],
      [Infinity, 0.195],
    ],
  },
  PE: {
    prov: 0.167, pension: 0.0595, ei: 0.01664,
    basicFed: 15705, basicProv: 12000,
    pensionLabel: 'CPP', eiLabel: 'AE', provLabel: 'Impôt IPE',
    provBrackets: [
      [32656,    0.096],
      [64313,    0.1337],
      [105000,   0.167],
      [140000,   0.18],
      [Infinity, 0.187],
    ],
  },
  NL: {
    prov: 0.153, pension: 0.0595, ei: 0.01664,
    basicFed: 15705, basicProv: 10818,
    pensionLabel: 'CPP', eiLabel: 'AE', provLabel: 'Impôt T.-N.',
    provBrackets: [
      [43198,    0.087],
      [86395,    0.145],
      [154244,   0.158],
      [215943,   0.178],
      [275870,   0.198],
      [Infinity, 0.208],
    ],
  },
}

// ─── USA Tax Rates 2026 ──────────────────────────────────────────────────────

// Federal brackets (single filer, standard deduction $15,000 for 2026 estimate)
export const US_FED_BRACKETS: [number, number][] = [
  [11925,    0.10],
  [48475,    0.12],
  [103350,   0.22],
  [197300,   0.24],
  [250525,   0.32],
  [626350,   0.35],
  [Infinity, 0.37],
]

export const US_TAX: Record<string, USTaxConfig> = {
  'CA-US': { state: 0.093,  ss: 0.062, medicare: 0.0145, stateLabel: 'California State',    noStateTax: false,
    stateBrackets: [[10756, 0.01],[25499, 0.02],[40245, 0.04],[55866, 0.06],[70606, 0.08],[360659, 0.093],[432787, 0.103],[721314, 0.113],[Infinity, 0.123]] },
  'NY':    { state: 0.0685, ss: 0.062, medicare: 0.0145, stateLabel: 'New York State',      noStateTax: false,
    stateBrackets: [[17150, 0.04],[23600, 0.045],[27900, 0.0525],[161550, 0.0585],[323200, 0.0625],[2155350, 0.0685],[Infinity, 0.0965]] },
  'TX':    { state: 0.00,   ss: 0.062, medicare: 0.0145, stateLabel: 'No State Tax',        noStateTax: true  },
  'FL':    { state: 0.00,   ss: 0.062, medicare: 0.0145, stateLabel: 'No State Tax',        noStateTax: true  },
  'WA':    { state: 0.00,   ss: 0.062, medicare: 0.0145, stateLabel: 'No State Tax',        noStateTax: true  },
  'IL':    { state: 0.0495, ss: 0.062, medicare: 0.0145, stateLabel: 'Illinois State',      noStateTax: false },
  'GA':    { state: 0.055,  ss: 0.062, medicare: 0.0145, stateLabel: 'Georgia State',       noStateTax: false,
    stateBrackets: [[750, 0.01],[2250, 0.02],[3750, 0.03],[5250, 0.04],[7000, 0.05],[Infinity, 0.055]] },
  'NC':    { state: 0.0499, ss: 0.062, medicare: 0.0145, stateLabel: 'North Carolina State',noStateTax: false },
  'AZ':    { state: 0.025,  ss: 0.062, medicare: 0.0145, stateLabel: 'Arizona State',       noStateTax: false },
  'CO':    { state: 0.044,  ss: 0.062, medicare: 0.0145, stateLabel: 'Colorado State',      noStateTax: false },
  'MA':    { state: 0.05,   ss: 0.062, medicare: 0.0145, stateLabel: 'Massachusetts State', noStateTax: false },
  'OH':    { state: 0.04,   ss: 0.062, medicare: 0.0145, stateLabel: 'Ohio State',          noStateTax: false,
    stateBrackets: [[26050, 0],[100000, 0.027],[Infinity, 0.035]] },
}

// ─── Calc functions ──────────────────────────────────────────────────────────

export function calcCA(
  base: number,
  ot: number,
  bonus: number,
  vacation: number,
  tips: number,
  benefit: number,
  region: string,
  workerType: WorkerType,
): CalcResult {
  const t = CA_TAX[region] ?? CA_TAX['QC']
  const gross = base + ot + bonus + vacation + tips + benefit

  // Annualize for bracket lookup (260 working days per year)
  const annGross = gross * 260

  // Federal — proper marginal brackets after basic personal amount
  const annFedTaxable = Math.max(0, annGross - t.basicFed)
  const annFed = applyBrackets(annFedTaxable, CA_FED_BRACKETS)
  // Quebec residents get a 16.5% federal abatement (province runs own programs)
  const fedAbatement = region === 'QC' ? 0.165 : 0
  const fed = (annFed * (1 - fedAbatement)) / 260

  // Provincial — use per-province brackets when available, else flat rate
  const annProvTaxable = Math.max(0, annGross - t.basicProv)
  const annProv = t.provBrackets
    ? applyBrackets(annProvTaxable, t.provBrackets)
    : annProvTaxable * t.prov
  const prov = annProv / 260

  // Payroll deductions (per-shift caps)
  const pension = Math.min(gross * t.pension, 13.5)
  const ei = Math.min(gross * t.ei, 5.0)
  // Autonomous/gig pay both employee + employer pension share
  const selfEmployed =
    workerType === 'autonomous' || workerType === 'gig'
      ? Math.min(gross * t.pension, 13.5)
      : 0

  const totalTax = fed + prov + pension + ei + selfEmployed
  return { fed, prov, pension, ei, selfEmployed, totalTax, net: gross - totalTax }
}

export function calcUS(
  base: number,
  ot: number,
  bonus: number,
  vacation: number,
  tips: number,
  benefit: number,
  region: string,
  workerType: WorkerType,
): CalcResult {
  const t = US_TAX[region] ?? US_TAX['CA-US']
  const gross = base + ot + bonus + vacation + tips + benefit

  // Annualize for bracket lookup
  const annGross = gross * 260
  const standardDeduction = 15000
  const annFedTaxable = Math.max(0, annGross - standardDeduction)
  const annFed = applyBrackets(annFedTaxable, US_FED_BRACKETS)
  const fed = annFed / 260

  // State — use brackets if available, else flat rate
  const annStateTax = t.stateBrackets
    ? applyBrackets(annGross, t.stateBrackets)
    : annGross * t.state
  const prov = annStateTax / 260

  // FICA (Social Security + Medicare, per-shift)
  const pension = Math.min(gross * t.ss, 25.0)
  const ei = gross * t.medicare
  // Self-employed pay both halves of FICA
  const selfEmployed =
    workerType === 'autonomous' || workerType === 'gig' ? gross * t.ss : 0

  const totalTax = fed + prov + pension + ei + selfEmployed
  return { fed, prov, pension, ei, selfEmployed, totalTax, net: gross - totalTax }
}

export function calcTax(
  base: number,
  ot: number,
  bonus: number,
  vacation: number,
  tips: number,
  benefit: number,
  country: Country,
  region: string,
  workerType: WorkerType,
): CalcResult {
  return country === 'CA'
    ? calcCA(base, ot, bonus, vacation, tips, benefit, region, workerType)
    : calcUS(base, ot, bonus, vacation, tips, benefit, region, workerType)
}

// ─── Annual tax estimate (for declaration tab) ────────────────────────────────

export function estimateAnnualTax(
  annGross: number,
  deductions: number,
  country: Country,
  region: string,
): { tax: number; credits: number } {
  if (country === 'CA') {
    const t = CA_TAX[region] ?? CA_TAX['QC']
    const fedTaxable = Math.max(0, annGross - deductions - t.basicFed)
    const fedAbatement = region === 'QC' ? 0.165 : 0
    const fedTax = applyBrackets(fedTaxable, CA_FED_BRACKETS) * (1 - fedAbatement)
    const provTaxable = Math.max(0, annGross - deductions - t.basicProv)
    const provTax = t.provBrackets
      ? applyBrackets(provTaxable, t.provBrackets)
      : provTaxable * t.prov
    const tax = fedTax + provTax
    const credits = deductions * 0.15
    return { tax, credits }
  } else {
    const t = US_TAX[region] ?? US_TAX['CA-US']
    const fedTaxable = Math.max(0, annGross - deductions - 15000)
    const fedTax = applyBrackets(fedTaxable, US_FED_BRACKETS)
    const stateTax = t.stateBrackets
      ? applyBrackets(Math.max(0, annGross - deductions), t.stateBrackets)
      : Math.max(0, annGross - deductions) * t.state
    const tax = fedTax + stateTax
    const credits = deductions * 0.22
    return { tax, credits }
  }
}

// ─── Declaration categories ──────────────────────────────────────────────────

export const CATEGORIES_CA: DeclarationCategory[] = [
  { key: 'income_emp',  icon: '💼', name: "Revenu d'emploi",     desc: 'Salaire, T4 / Relevé 1',            type: 'income'    },
  { key: 'income_self', icon: '🔧', name: 'Revenu autonome',      desc: 'Clients, facturation, contrats',    type: 'income'    },
  { key: 'income_gov',  icon: '🏛️', name: 'Prestations gouv.',    desc: 'AE, aide sociale, PCU',             type: 'income'    },
  { key: 'medical',     icon: '🏥', name: 'Frais médicaux',       desc: 'Dentiste, lunettes, médicaments',   type: 'deduction' },
  { key: 'childcare',   icon: '👶', name: 'Frais de garde',       desc: 'Garderie, CPE (reçu officiel)',     type: 'deduction' },
  { key: 'tuition',     icon: '🎓', name: 'Frais de scolarité',   desc: 'T2202, université, cégep',          type: 'deduction' },
  { key: 'transit',     icon: '🚌', name: 'Transport en commun',  desc: 'STM, OC Transpo, passes',           type: 'deduction' },
  { key: 'rrsp',        icon: '💰', name: 'REER / 401k',          desc: 'Déductible du revenu imposable',    type: 'deduction' },
  { key: 'donation',    icon: '❤️', name: 'Dons de bienfaisance', desc: 'Reçus officiels uniquement',        type: 'deduction' },
  { key: 'home_office', icon: '🏠', name: 'Bureau à domicile',    desc: '% loyer/hypothèque (autonomes)',    type: 'deduction' },
  { key: 'vehicle',     icon: '🚗', name: 'Kilométrage pro',      desc: 'Uber, livraison, déplacements',     type: 'deduction' },
]

export const CATEGORIES_US: DeclarationCategory[] = [
  { key: 'income_emp',    icon: '💼', name: 'W-2 Employment',         desc: 'Salary, wages',                      type: 'income'    },
  { key: 'income_1099',   icon: '🔧', name: 'Self-employment / 1099', desc: 'Freelance, contracts, gig',          type: 'income'    },
  { key: 'medical',       icon: '🏥', name: 'Medical expenses',       desc: 'Dentist, prescriptions (>7.5% AGI)', type: 'deduction' },
  { key: 'student_loan',  icon: '🎓', name: 'Student loan interest',  desc: 'Up to $2,500 deductible',            type: 'deduction' },
  { key: 'ira',           icon: '💰', name: 'IRA / Roth contribution',desc: 'Tax-advantaged retirement',          type: 'deduction' },
  { key: 'home_office',   icon: '🏠', name: 'Home office',            desc: 'Exclusive business use',             type: 'deduction' },
  { key: 'vehicle',       icon: '🚗', name: 'Business mileage',       desc: '67¢/mile standard 2026',             type: 'deduction' },
  { key: 'donation',      icon: '❤️', name: 'Charitable donations',   desc: 'Itemized deduction',                 type: 'deduction' },
]

// ─── Checklist ───────────────────────────────────────────────────────────────

export const CHECKLIST_CA: ChecklistItemDef[] = [
  { id: 'T4',        label: 'T4 / Relevé 1 (employeur)',             due: '28 fév'            },
  { id: 'T5',        label: 'T5 (revenus placements)',               due: '28 fév'            },
  { id: 'T2202',     label: 'T2202 (frais de scolarité)',            due: '1 mars'            },
  { id: 'RRSP',      label: 'Reçus REER',                           due: '1 mars'            },
  { id: 'MEDICAL',   label: 'Reçus frais médicaux',                 due: 'Collecte continue' },
  { id: 'CHILDCARE', label: 'Reçus de garderie (officiel)',          due: 'Collecte continue' },
  { id: 'DONATION',  label: 'Reçus de dons',                        due: 'Collecte continue' },
  { id: 'TRANSIT',   label: 'Passes transport en commun',           due: 'Collecte continue' },
  { id: 'T2200',     label: 'T2200 (bureau domicile – si salarié)', due: 'Fév'               },
  { id: 'NAS',       label: 'NAS confirmé',                         due: 'Toujours'          },
  { id: 'RENTAL',    label: 'Revenus de location',                  due: 'Avr'               },
  { id: 'FOREIGN',   label: 'Revenus étrangers (T1135)',            due: 'Avr'               },
]

export const CHECKLIST_US: ChecklistItemDef[] = [
  { id: 'W2',       label: 'W-2 from employer(s)',              due: 'Jan 31'  },
  { id: '1099',     label: '1099-NEC / 1099-K (freelance/gig)', due: 'Jan 31'  },
  { id: '1099INT',  label: '1099-INT (bank interest)',          due: 'Jan 31'  },
  { id: 'SSN',      label: 'SSN or ITIN confirmed',             due: 'Always'  },
  { id: 'MEDICAL',  label: 'Medical expense receipts',          due: 'Ongoing' },
  { id: 'IRA',      label: 'IRA contribution statement',        due: 'Apr 15'  },
  { id: 'MORTGAGE', label: 'Form 1098 (mortgage interest)',     due: 'Jan 31'  },
  { id: 'STUDENT',  label: '1098-E (student loan interest)',    due: 'Jan 31'  },
  { id: 'VEHICLE',  label: 'Mileage log (business)',            due: 'Ongoing' },
  { id: 'DONATION', label: 'Charitable donation receipts',      due: 'Ongoing' },
  { id: 'FOREIGN',  label: 'Foreign income / FBAR',             due: 'Apr 15'  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getCategories(country: Country): DeclarationCategory[] {
  return country === 'CA' ? CATEGORIES_CA : CATEGORIES_US
}

export function getChecklist(country: Country): ChecklistItemDef[] {
  return country === 'CA' ? CHECKLIST_CA : CHECKLIST_US
}

export function fmtCurrency(n: number, country: Country): string {
  const locale = country === 'CA' ? 'fr-CA' : 'en-US'
  const currency = country === 'CA' ? 'CAD' : 'USD'
  return (n || 0).toLocaleString(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  })
}

export function fmtShort(n: number): string {
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  if (abs >= 1000) return sign + '$' + (abs / 1000).toFixed(1) + 'k'
  return sign + '$' + Math.round(abs).toLocaleString()
}

export const DEFAULT_PROFILE: Profile = {
  country: 'CA',
  region: 'QC',
  workerType: 'employee',
  sector: 'transport',
}
