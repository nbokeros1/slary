'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  REGIONS, CA_TAX, US_TAX,
  calcTax, estimateAnnualTax, getCategories, getChecklist,
  fmtCurrency, fmtShort, DEFAULT_PROFILE,
  type Profile, type ShiftData, type EntryData, type YtdData,
  type Country, type WorkerType, type TipsMode,
} from '@slary/functions'
import { supabase, type User } from '@slary/infra'
import {
  dbLoadAll, dbUpsertProfile,
  dbInsertShift, dbDeleteShift,
  dbInsertEntry, dbMigrateLocal,
} from '@slary/infra'

// ─── Persisance ──────────────────────────────────────────────────────────────

function load<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback }
  catch { return fallback }
}
function save(key: string, value: unknown) {
  if (typeof window !== 'undefined') localStorage.setItem(key, JSON.stringify(value))
}

// ─── Types ───────────────────────────────────────────────────────────────────

type TabId       = 'paie' | 'decl' | 'history' | 'export'
type ExportFmt   = 'pdf' | 'csv' | 'json'
type PayMethod   = 'card' | 'wallet' | 'crypto'

// ─── Shared CSS ───────────────────────────────────────────────────────────────

const INPUT  = 'bg-[#232830] border-[1.5px] border-transparent rounded-[10px] px-3.5 py-3 text-[#E8E6E0] text-[15px] font-semibold outline-none w-full appearance-none focus:border-[#C8F135] focus:bg-[#161920] transition-all placeholder:text-[rgba(232,230,224,0.38)] placeholder:font-normal'
const SELECT = 'bg-[#232830] border-[1.5px] border-transparent rounded-[10px] px-3.5 py-3 text-[#E8E6E0] text-[14px] font-medium outline-none w-full appearance-none cursor-pointer focus:border-[#C8F135] transition-all'
const BTN    = 'w-full py-4 bg-[#C8F135] text-[#0F1117] rounded-[10px] text-[15px] font-black cursor-pointer transition-all hover:opacity-90 hover:-translate-y-px flex items-center justify-center gap-2'
const BTN2   = 'w-full py-4 bg-[#232830] text-[#E8E6E0] border border-[rgba(255,255,255,0.07)] rounded-[10px] text-[14px] font-black cursor-pointer hover:border-[rgba(255,255,255,0.13)] transition-all flex items-center justify-center gap-2'

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-black tracking-[0.1em] uppercase text-[rgba(232,230,224,0.38)]">{label}</label>
      {children}
    </div>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#1C2028] border border-[rgba(255,255,255,0.07)] rounded-2xl p-5 ${className}`}>
      {children}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-black tracking-[0.12em] uppercase text-[rgba(232,230,224,0.38)] mb-2 flex items-center gap-1.5">{children}</div>
}

function BigNum({ value, color = 'lime' }: { value: string; color?: 'lime' | 'red' | 'amber' }) {
  const c = color === 'red' ? 'text-[#FF5C5C]' : color === 'amber' ? 'text-[#FFB547]' : 'text-[#C8F135]'
  return <div className={`font-serif italic text-[48px] leading-none tracking-[-0.03em] ${c}`}>{value}</div>
}

function StatBox({ label, value, color = '' }: { label: string; value: string; color?: string }) {
  const c = color === 'lime' ? 'text-[#C8F135]' : color === 'red' ? 'text-[#FF5C5C]' : color === 'teal' ? 'text-[#3EFFC8]' : color === 'amber' ? 'text-[#FFB547]' : 'text-[#E8E6E0]'
  return (
    <div className="bg-[#1C2028] border border-[rgba(255,255,255,0.07)] rounded-[10px] px-4 py-3.5">
      <div className="text-[10px] font-black tracking-[0.08em] uppercase text-[rgba(232,230,224,0.38)] mb-1.5">{label}</div>
      <div className={`font-serif italic text-[24px] tracking-[-0.02em] leading-none ${c}`}>{value}</div>
    </div>
  )
}

function BRow({ label, value, color }: { label: string; value: string; color?: 'teal' | 'red' }) {
  const c = color === 'teal' ? 'text-[#3EFFC8]' : color === 'red' ? 'text-[#FF5C5C]' : 'text-[#E8E6E0]'
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-[rgba(255,255,255,0.07)] last:border-0 text-[13px]">
      <span className="text-[rgba(232,230,224,0.62)] font-medium">{label}</span>
      <span className={`font-mono text-[12px] ${c}`}>{value}</span>
    </div>
  )
}

function AnnRow({ label, value, color }: { label: string; value: string; color?: 'lime' | 'red' | 'teal' | 'amber' }) {
  const c = color === 'lime' ? 'text-[#C8F135]' : color === 'red' ? 'text-[#FF5C5C]' : color === 'teal' ? 'text-[#3EFFC8]' : color === 'amber' ? 'text-[#FFB547]' : 'text-[#E8E6E0]'
  return (
    <div className="flex justify-between text-[13px] px-3 py-2 bg-[rgba(255,255,255,0.03)] rounded-lg">
      <span className="text-[rgba(232,230,224,0.62)] font-medium">{label}</span>
      <span className={`font-mono text-[12px] ${c}`}>{value}</span>
    </div>
  )
}

function ShiftRow({ shift, fmt, onDelete }: { shift: ShiftData; fmt: (n: number) => string; onDelete?: () => void }) {
  return (
    <div className="px-4 py-3.5 flex items-center gap-2 border-b border-[rgba(255,255,255,0.07)] last:border-0 hover:bg-[#232830] transition-colors group">
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-black mb-0.5">{shift.date}</div>
        <div className="text-[11px] text-[rgba(232,230,224,0.38)] truncate">
          {shift.hours}h @ {fmt(shift.rate)}/h
          {shift.tipsAmt > 0 ? ` · tips ${fmt(shift.tipsAmt)}` : ''}
          {shift.ot15 > 0 ? ` · ${shift.ot15}h×1.5` : ''}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="font-mono text-[13px] text-[#C8F135]">{fmt(shift.net)}</div>
        <div className="font-mono text-[11px] text-[rgba(232,230,224,0.38)]">{fmt(shift.gross)} brut</div>
      </div>
      {onDelete && (
        <button onClick={onDelete}
          className="w-6 h-6 flex items-center justify-center rounded-full text-[rgba(232,230,224,0.38)] hover:text-[#FF5C5C] hover:bg-[rgba(255,92,92,0.1)] transition-all opacity-0 group-hover:opacity-100 flex-shrink-0 cursor-pointer text-[14px]">
          ×
        </button>
      )}
    </div>
  )
}

function BottomSheet({ open, onClose, title, subtitle, children }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 bg-[rgba(15,17,23,0.85)] backdrop-blur-md z-50 flex items-end justify-center"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-[#1C2028] rounded-t-3xl px-6 pt-7 pb-12 w-full max-w-[480px] max-h-[88vh] overflow-y-auto animate-fade-up">
        <div className="w-9 h-0.5 bg-[rgba(255,255,255,0.13)] rounded mx-auto mb-6" />
        <h2 className="text-[20px] font-black tracking-[-0.03em] mb-1">{title}</h2>
        {subtitle && <p className="font-serif italic text-[14px] text-[rgba(232,230,224,0.38)] mb-6">{subtitle}</p>}
        {children}
      </div>
    </div>
  )
}

// ─── Export helpers ───────────────────────────────────────────────────────────

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}

// ════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════════════════════

export default function DashboardPage() {
  // ── Hydration ──────────────────────────────────────────────────────────────
  const [ready, setReady]             = useState(false)
  const [phase, setPhase]             = useState<'onboarding' | 'app'>('onboarding')

  // ── Persisted state ────────────────────────────────────────────────────────
  const [profile,   setProfile]       = useState<Profile>(DEFAULT_PROFILE)
  const [shifts,    setShifts]        = useState<ShiftData[]>([])
  const [entries,   setEntries]       = useState<EntryData[]>([])
  const [checklist, setChecklist]     = useState<Record<string, boolean>>({})

  // ── Onboarding ─────────────────────────────────────────────────────────────
  const [obCountry, setObCountry]     = useState<Country>('CA')
  const [obRegion,  setObRegion]      = useState('QC')
  const [obWorker,  setObWorker]      = useState<WorkerType>('employee')
  const [obSector,  setObSector]      = useState('transport')

  // ── Paie inputs ────────────────────────────────────────────────────────────
  const [hours,      setHours]        = useState('')
  const [rate,       setRate]         = useState('')
  const [tipsMode,   setTipsMode]     = useState<TipsMode>('hour')
  const [tipsVal,    setTipsVal]      = useState('')
  const [ot15,       setOt15]         = useState('')
  const [ot20,       setOt20]         = useState('')
  const [bonus,      setBonus]        = useState('')
  const [vacation,   setVacation]     = useState('')
  const [taxBenefit, setTaxBenefit]   = useState('')
  const [extrasOpen, setExtrasOpen]   = useState(false)
  const [breakdown,  setBreakdown]    = useState<ShiftData | null>(null)
  const [pending,    setPending]      = useState<ShiftData | null>(null)

  // ── Navigation ─────────────────────────────────────────────────────────────
  const [tab, setTab]                 = useState<TabId>('paie')

  // ── Modals ─────────────────────────────────────────────────────────────────
  const [profileModal, setProfileModal]   = useState(false)
  const [entryModal,   setEntryModal]     = useState(false)
  const [entryCat,     setEntryCat]       = useState('')
  const [entryAmt,     setEntryAmt]       = useState('')
  const [entryDesc,    setEntryDesc]      = useState('')

  // Profile modal temp
  const [pmCountry, setPmCountry]     = useState<Country>('CA')
  const [pmRegion,  setPmRegion]      = useState('QC')
  const [pmWorker,  setPmWorker]      = useState<WorkerType>('employee')

  // ── YTD Rattrapage ────────────────────────────────────────────────────────
  const [ytdData,          setYtdData]          = useState<YtdData | null>(null)
  const [ytdModal,         setYtdModal]         = useState(false)
  const [ytdGrossInput,    setYtdGrossInput]    = useState('')
  const [ytdTaxInput,      setYtdTaxInput]      = useState('')
  const [ytdHoursInput,    setYtdHoursInput]    = useState('')
  const [ytdRevenueInput,  setYtdRevenueInput]  = useState('')
  const [ytdInstalInput,   setYtdInstalInput]   = useState('')
  const [ytdPeriod,        setYtdPeriod]        = useState('Jan–Mai 2026')

  // ── Auth / Sync ────────────────────────────────────────────────────────────
  const [user,      setUser]          = useState<User | null>(null)
  const [authModal, setAuthModal]     = useState(false)
  const [authEmail, setAuthEmail]     = useState('')
  const [authSent,  setAuthSent]      = useState(false)
  const [syncing,   setSyncing]       = useState(false)

  // ── Export ─────────────────────────────────────────────────────────────────
  const [exportYear, setExportYear]   = useState(2026)
  const [exportFmt,  setExportFmt]    = useState<ExportFmt>('pdf')
  const [dlPct,      setDlPct]        = useState(0)
  const [dlLabel,    setDlLabel]      = useState('')
  const [dlRunning,  setDlRunning]    = useState(false)

  // ── Toast ──────────────────────────────────────────────────────────────────
  const [toastMsg,     setToastMsg]       = useState('')
  const [toastVisible, setToastVisible]   = useState(false)

  // ── Hydrate localStorage ───────────────────────────────────────────────────
  useEffect(() => {
    const p = load<Profile>('slary_profile', DEFAULT_PROFILE)
    const s = load<ShiftData[]>('slary_shifts', [])
    const e = load<EntryData[]>('slary_entries', [])
    const c = load<Record<string, boolean>>('slary_checklist', {})
    setProfile(p); setShifts(s); setEntries(e); setChecklist(c)
    setObCountry(p.country); setObRegion(p.region)
    setObWorker(p.workerType); setObSector(p.sector)
    if (p.savedRate) setRate(String(p.savedRate))
    setPmCountry(p.country); setPmRegion(p.region); setPmWorker(p.workerType)
    const y = load<YtdData | null>('slary_ytd', null)
    if (y) {
      setYtdData(y)
      setYtdGrossInput(String(y.grossYtd || ''))
      setYtdTaxInput(String(y.taxWithheldYtd || ''))
      setYtdHoursInput(String(y.hoursYtd || ''))
      setYtdRevenueInput(String(y.revenueYtd || ''))
      setYtdInstalInput(String(y.instalmentsYtd || ''))
      setYtdPeriod(y.period)
    }
    setReady(true)
    if (localStorage.getItem('slary_profile')) setPhase('app')
  }, [])

  // ── Auth Supabase ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!supabase) return
    // Restore existing session (page refresh / return visit)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        void loadFromSupabase(session.user.id)
      }
    })
    // Listen for sign-in via magic link redirect
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user)
        void migrateAndLoad(session.user.id)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
      }
    })
    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toast = useCallback((msg: string) => {
    setToastMsg(msg); setToastVisible(true)
    setTimeout(() => setToastVisible(false), 2600)
  }, [])

  // ── Derived ────────────────────────────────────────────────────────────────
  const fmt = useCallback((n: number) => fmtCurrency(n, profile.country), [profile.country])

  // Live preview recalculates as user types (no button press needed)
  const liveResult = useMemo(() => {
    const h = parseFloat(hours) || 0
    const r = parseFloat(rate)  || 0
    if (!h || !r) return null
    const o15  = parseFloat(ot15)       || 0
    const o20  = parseFloat(ot20)       || 0
    const bon  = parseFloat(bonus)      || 0
    const vac  = parseFloat(vacation)   || 0
    const ben  = parseFloat(taxBenefit) || 0
    const tips = tipsMode === 'none' ? 0
               : tipsMode === 'hour' ? (parseFloat(tipsVal) || 0) * h
               : (parseFloat(tipsVal) || 0)
    const base  = h * r
    const otPay = o15 * r * 1.5 + o20 * r * 2
    const gross = base + otPay + bon + vac + tips + ben
    return { net: calcTax(base, otPay, bon, vac, tips, ben, profile.country, profile.region, profile.workerType).net, gross }
  }, [hours, rate, tipsMode, tipsVal, ot15, ot20, bonus, vacation, taxBenefit, profile])

  const now = new Date()
  const monthShifts = ready
    ? shifts.filter(s => {
        const d = new Date(s.ts)
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      })
    : []

  const sum = <K extends keyof ShiftData>(arr: ShiftData[], key: K) =>
    arr.reduce((a, s) => a + (s[key] as number), 0)

  const monthNet   = sum(monthShifts, 'net')
  const monthGross = sum(monthShifts, 'gross')
  const monthHours = monthShifts.reduce((a, s) => a + s.hours + (s.ot15 || 0) + (s.ot20 || 0), 0)
  const monthTax   = sum(monthShifts, 'totalTax')
  const monthTips  = monthShifts.reduce((a, s) => a + (s.tipsAmt || 0), 0)

  const isAutonomous = profile.workerType === 'autonomous' || profile.workerType === 'gig'
  const ytdGross   = ytdData ? (isAutonomous ? ytdData.revenueYtd : ytdData.grossYtd) : 0
  const ytdTaxPaid = ytdData ? (isAutonomous ? ytdData.instalmentsYtd : ytdData.taxWithheldYtd) : 0

  const annGross   = sum(shifts, 'gross') + ytdGross
  const annNet     = sum(shifts, 'net')
  const annTax     = sum(shifts, 'totalTax') + ytdTaxPaid
  const annHours   = sum(shifts, 'hours') + (ytdData?.hoursYtd ?? 0)
  const annTips    = shifts.reduce((a, s) => a + (s.tipsAmt || 0), 0)

  const incomeKeys   = ['income_emp', 'income_self', 'income_gov', 'income_w2', 'income_1099']
  const entryIncome  = entries.filter(e => incomeKeys.includes(e.cat)).reduce((a, e) => a + e.amount, 0)
  const totalIncome  = entryIncome + annGross
  const deductionAmt = entries.filter(e => !incomeKeys.includes(e.cat)).reduce((a, e) => a + e.amount, 0)

  const { tax: estimatedTax, credits } = estimateAnnualTax(
    totalIncome, deductionAmt, profile.country, profile.region,
  )
  const refund = annTax + credits - estimatedTax

  const checkDocs    = getChecklist(profile.country)
  const checkDone    = checkDocs.filter(d => checklist[d.id]).length
  const checkPct     = checkDocs.length ? Math.round((checkDone / checkDocs.length) * 100) : 0
  const categories   = getCategories(profile.country)
  const headerRegion = REGIONS[profile.country].find(r => r.code === profile.region)
  const workerMap: Record<WorkerType, string> = { employee: 'Salarié', autonomous: 'Autonome', gig: 'Gig', student: 'Étudiant' }

  const ENTRY_HINTS: Record<string, string> = {
    vehicle:     profile.country === 'CA' ? 'Taux 2026 : 0,72 $/km (premiers 5 000 km)' : '2026 rate: 67¢/mile for business use',
    home_office: profile.country === 'CA' ? 'Méthode détaillée ou 2 $/jour (max 500 jours)' : 'Must be exclusive business use only',
    rrsp:        'Limite : 18 % du revenu précédent (max 32 490 $ pour 2026)',
    medical:     profile.country === 'CA' ? 'Seulement les frais non remboursés par assurance' : 'Only unreimbursed expenses exceeding 7.5% AGI',
  }

  // ── Auth actions ───────────────────────────────────────────────────────────

  async function loadFromSupabase(userId: string) {
    const data = await dbLoadAll(userId)
    if (!data) return
    if (data.profile) {
      const p = data.profile
      setProfile(p); setObCountry(p.country); setObRegion(p.region)
      setObWorker(p.workerType); setObSector(p.sector)
      if (p.savedRate) setRate(String(p.savedRate))
      setPmCountry(p.country); setPmRegion(p.region); setPmWorker(p.workerType)
      setPhase('app')
    }
    setShifts(data.shifts); setEntries(data.entries); setChecklist(data.checklist)
  }

  async function migrateAndLoad(userId: string) {
    const data = await dbLoadAll(userId)
    if (!data) return
    const localHasData = shifts.length > 0 || entries.length > 0
    if (data.shifts.length === 0 && localHasData) {
      setSyncing(true)
      await dbMigrateLocal(userId, { profile, shifts, entries, checklist })
      setSyncing(false)
      toast('✓ Données migrées vers le cloud !')
    } else if (data.shifts.length > 0) {
      await loadFromSupabase(userId)
      if (!localHasData) toast('✓ Données chargées depuis le cloud !')
    }
    setPhase('app')
  }

  async function sendMagicLink() {
    if (!supabase || !authEmail.trim()) return
    const { error } = await supabase.auth.signInWithOtp({
      email: authEmail.trim(),
      options: { emailRedirectTo: window.location.origin + '/dashboard' },
    })
    if (error) { toast('⚠️ ' + error.message); return }
    setAuthSent(true)
  }

  async function signOut() {
    if (!supabase) return
    await supabase.auth.signOut()
    setUser(null); toast('👋 Déconnecté')
  }

  // ── App actions ────────────────────────────────────────────────────────────

  function startApp() {
    const p: Profile = { country: obCountry, region: obRegion, workerType: obWorker, sector: obSector as Profile['sector'] }
    setProfile(p); save('slary_profile', p); setPhase('app')
    if (user) void dbUpsertProfile(user.id, p, checklist)
  }

  function calculate() {
    const h = parseFloat(hours) || 0
    const r = parseFloat(rate)  || 0
    if (!h || !r) { toast('⚠️ Entre les heures et ton taux'); return }

    const o15  = parseFloat(ot15)       || 0
    const o20  = parseFloat(ot20)       || 0
    const bon  = parseFloat(bonus)      || 0
    const vac  = parseFloat(vacation)   || 0
    const ben  = parseFloat(taxBenefit) || 0
    const tips = tipsMode === 'none' ? 0
               : tipsMode === 'hour' ? (parseFloat(tipsVal) || 0) * h
               : (parseFloat(tipsVal) || 0)

    const base  = h * r
    const otPay = o15 * r * 1.5 + o20 * r * 2
    const gross = base + otPay + bon + vac + tips + ben
    const res   = calcTax(base, otPay, bon, vac, tips, ben, profile.country, profile.region, profile.workerType)

    const shift: ShiftData = {
      date: new Date().toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' }),
      hours: h, rate: r, ot15: o15, ot20: o20, tipsAmt: tips,
      bonus: bon, vacation: vac, taxBenefit: ben,
      base, otPay, gross, ...res,
      country: profile.country, region: profile.region, ts: Date.now(),
    }
    setBreakdown(shift)
    setPending(shift)
  }

  function saveShift() {
    if (!pending) return
    const next = [pending, ...shifts]
    setShifts(next); save('slary_shifts', next)
    if (pending.rate) {
      const p2 = { ...profile, savedRate: pending.rate }
      setProfile(p2); save('slary_profile', p2)
      if (user) void dbUpsertProfile(user.id, p2, checklist)
    }
    if (user) void dbInsertShift(user.id, pending)
    setPending(null); setBreakdown(null)
    setHours(''); setOt15(''); setOt20(''); setBonus(''); setVacation(''); setTaxBenefit(''); setTipsVal('')
    toast('✓ Quart enregistré !')
  }

  function saveEntry() {
    const amt = parseFloat(entryAmt)
    if (!amt || amt <= 0) { toast('⚠️ Montant invalide'); return }
    const entry: EntryData = { cat: entryCat, amount: amt, desc: entryDesc, ts: Date.now() }
    const next = [...entries, entry]
    setEntries(next); save('slary_entries', next)
    if (user) void dbInsertEntry(user.id, entry)
    setEntryModal(false); setEntryAmt(''); setEntryDesc('')
    toast('✓ Entrée ajoutée !')
  }

  function toggleDoc(id: string) {
    const next = { ...checklist, [id]: !checklist[id] }
    setChecklist(next); save('slary_checklist', next)
    if (user) void dbUpsertProfile(user.id, profile, next)
  }

  function saveProfileModal() {
    const p: Profile = { ...profile, country: pmCountry, region: pmRegion, workerType: pmWorker }
    setProfile(p); save('slary_profile', p)
    if (user) void dbUpsertProfile(user.id, p, checklist)
    setProfileModal(false); toast('✓ Profil mis à jour')
  }

  function deleteShift(ts: number) {
    const next = shifts.filter(s => s.ts !== ts)
    setShifts(next); save('slary_shifts', next)
    if (user) void dbDeleteShift(user.id, ts)
    toast('🗑 Quart supprimé')
  }

  function saveYtd() {
    const ytd: YtdData = {
      grossYtd:       isAutonomous ? 0 : (parseFloat(ytdGrossInput)   || 0),
      taxWithheldYtd: isAutonomous ? 0 : (parseFloat(ytdTaxInput)     || 0),
      hoursYtd:       parseFloat(ytdHoursInput)   || 0,
      revenueYtd:     isAutonomous ? (parseFloat(ytdRevenueInput) || 0) : 0,
      instalmentsYtd: isAutonomous ? (parseFloat(ytdInstalInput)  || 0) : 0,
      period:         ytdPeriod,
      ts:             Date.now(),
    }
    setYtdData(ytd); save('slary_ytd', ytd)
    setYtdModal(false)
    toast('✓ Revenus passés enregistrés !')
  }

  function clearYtd() {
    setYtdData(null); save('slary_ytd', null)
    toast('🗑 Revenus passés supprimés')
  }

  function clearData() {
    if (!confirm('Supprimer tous les quarts et entrées ?')) return
    setShifts([]); setEntries([]); setChecklist({})
    save('slary_shifts', []); save('slary_entries', []); save('slary_checklist', {})
    toast('🗑 Données effacées')
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  function buildCSV() {
    const lines = ['Date,Type,Catégorie,Description,Montant,Brut,Net,Impôts']
    for (const s of shifts) {
      lines.push(`"${s.date}","Quart","Revenu d'emploi","${s.hours}h @ $${s.rate}/h","${s.gross.toFixed(2)}","${s.gross.toFixed(2)}","${s.net.toFixed(2)}","${s.totalTax.toFixed(2)}"`)
    }
    for (const e of entries) {
      const isInc = incomeKeys.includes(e.cat)
      lines.push(`"${new Date(e.ts).toLocaleDateString('fr-CA')}","${isInc ? 'Revenu' : 'Dépense'}","${e.cat}","${e.desc || ''}","${e.amount.toFixed(2)}","","","" `)
    }
    return lines.join('\n')
  }

  function buildJSON() {
    return JSON.stringify({
      slary_export: true, version: '2.0', year: exportYear,
      generated: new Date().toISOString(),
      profile: { country: profile.country, region: profile.region, workerType: profile.workerType },
      summary: { gross: annGross, net: annNet, tax: annTax, tips: annTips, shifts: shifts.length },
      shifts, entries,
    }, null, 2)
  }

  function buildTextReport() {
    const regionName = REGIONS[profile.country].find(r => r.code === profile.region)?.name ?? profile.region
    const basicAmt   = profile.country === 'CA'
      ? (CA_TAX[profile.region] ?? CA_TAX['QC']).basicFed
      : 15000
    const isCA       = profile.country === 'CA'
    const disclaimer = isCA
      ? '⚠ Estimation — utilise TurboTax CA / H&R Block ou l\'ARC impôtnet'
      : '⚠ Estimate only — use IRS Free File, TurboTax, or H&R Block'
    return [
      `╔═══════════════════════════════════════════════════╗`,
      `║       SLARY — FISCAL REPORT ${exportYear}               ║`,
      `╚═══════════════════════════════════════════════════╝`,
      ``,
      `Generated : ${new Date().toLocaleDateString(isCA ? 'fr-CA' : 'en-US')}`,
      `Region    : ${regionName}`,
      `Status    : ${workerMap[profile.workerType]}`,
      ``,
      `━━ ${isCA ? 'REVENUS' : 'INCOME'} ${'─'.repeat(40)}`,
      `${isCA ? "Revenu d'emploi (quarts)" : 'Employment income (shifts)'}  ${fmt(annGross)}`,
      `${isCA ? 'Autres revenus déclarés' : 'Other declared income'}     ${fmt(entryIncome)}`,
      `${isCA ? 'TOTAL REVENUS' : 'TOTAL INCOME'}                 ${fmt(totalIncome)}`,
      ``,
      `━━ ${isCA ? 'DÉDUCTIONS' : 'DEDUCTIONS'} ${'─'.repeat(38)}`,
      `${isCA ? 'Déductions totales' : 'Total deductions'}            ${fmt(deductionAmt)}`,
      `${isCA ? 'Montant de base personnel' : 'Standard deduction'}     ${fmt(basicAmt)}`,
      `${isCA ? 'Crédits estimés' : 'Estimated credits'}              ${fmt(credits)}`,
      ``,
      `━━ ${isCA ? 'IMPÔTS' : 'TAX'} ${'─'.repeat(43)}`,
      `${isCA ? 'Impôt estimé dû' : 'Estimated tax owed'}             ${fmt(estimatedTax)}`,
      `${isCA ? 'Retenues à la source' : 'Withheld (Slary)'}          ${fmt(annTax)}`,
      ``,
      `╔═══════════════════════════════════════════════════╗`,
      `║  ${refund >= 0 ? (isCA ? 'REMBOURSEMENT ESTIMÉ' : 'ESTIMATED REFUND') : (isCA ? 'SOLDE DÛ ESTIMÉ' : 'ESTIMATED BALANCE DUE')}  ${(refund >= 0 ? '+' : '') + fmt(refund)}  ║`,
      `╚═══════════════════════════════════════════════════╝`,
      ``,
      disclaimer,
      ``,
      `Slary — slary.app`,
    ].join('\n')
  }

  async function runExport() {
    if (dlRunning) return
    setDlRunning(true)
    const steps = [
      [10, 'Collecte des données…'],
      [35, 'Calcul des déductions…'],
      [60, `Application des taux ${exportYear}…`],
      [80, 'Génération du document…'],
      [95, 'Finalisation…'],
      [100, '✓ Prêt !'],
    ] as [number, string][]
    for (const [pct, lbl] of steps) {
      setDlPct(pct); setDlLabel(lbl)
      await new Promise(r => setTimeout(r, 320))
    }
    await new Promise(r => setTimeout(r, 400))
    if (exportFmt === 'csv') {
      downloadBlob(buildCSV(), `slary_${exportYear}.csv`, 'text/csv;charset=utf-8')
    } else if (exportFmt === 'json') {
      downloadBlob(buildJSON(), `slary_${exportYear}.json`, 'application/json')
    } else {
      downloadBlob(buildTextReport(), `slary_declaration_${exportYear}.txt`, 'text/plain;charset=utf-8')
    }
    toast(`✓ Fichier téléchargé !`)
    setDlRunning(false); setDlPct(0); setDlLabel('')
  }

  // ── Guard ──────────────────────────────────────────────────────────────────
  if (!ready) return <div className="min-h-screen bg-[#0F1117]" />

  // ══════════════════════════════════════════════════════════════════════════
  // ONBOARDING
  // ══════════════════════════════════════════════════════════════════════════
  if (phase === 'onboarding') return (
    <div className="min-h-screen bg-[#0F1117] text-[#E8E6E0] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-[480px] flex flex-col items-center">

        {/* Logo */}
        <div className="text-[13px] font-black tracking-[0.15em] uppercase text-[#C8F135] mb-10 flex items-center gap-2">
          <span className="block w-6 h-0.5 bg-[#C8F135]" />Slary
        </div>

        <h1 className="font-serif text-[clamp(32px,7vw,52px)] font-light italic leading-[1.1] tracking-[-0.02em] text-center mb-3">
          Ta paie.<br />
          <strong className="not-italic font-black font-sans text-[#C8F135]">Sans surprises.</strong>
        </h1>
        <p className="text-[14px] text-[rgba(232,230,224,0.62)] text-center leading-[1.6] mb-10 max-w-[340px]">
          Calcul net en temps réel, suivi fiscal annuel, adapté à ta province ou ton état.
        </p>

        {/* Pays */}
        <p className="text-[11px] font-black tracking-[0.1em] uppercase text-[rgba(232,230,224,0.38)] self-start w-full mb-3">Ton pays</p>
        <div className="flex gap-3 w-full mb-7">
          {(['CA', 'US'] as Country[]).map(c => (
            <button key={c} onClick={() => { setObCountry(c); setObRegion(REGIONS[c][0].code) }}
              className={`flex-1 py-5 px-3 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all cursor-pointer
                ${obCountry === c ? 'border-[#C8F135] bg-[rgba(200,241,53,0.1)]' : 'border-[rgba(255,255,255,0.07)] bg-[#1C2028] hover:bg-[#232830]'}`}>
              <span className="text-3xl">{c === 'CA' ? '🇨🇦' : '🇺🇸'}</span>
              <span className="text-[14px] font-black">{c === 'CA' ? 'Canada' : 'États-Unis'}</span>
              <span className="text-[11px] text-[rgba(232,230,224,0.38)]">{c === 'CA' ? 'CRA · Revenu Québec' : 'IRS · State Tax'}</span>
            </button>
          ))}
        </div>

        {/* Province */}
        <p className="text-[11px] font-black tracking-[0.1em] uppercase text-[rgba(232,230,224,0.38)] self-start w-full mb-3">Ta province / ton état</p>
        <select value={obRegion} onChange={e => setObRegion(e.target.value)} className={`${SELECT} mb-7`}>
          {REGIONS[obCountry].map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
        </select>

        {/* Type */}
        <p className="text-[11px] font-black tracking-[0.1em] uppercase text-[rgba(232,230,224,0.38)] self-start w-full mb-3">Ton type de travail</p>
        <div className="grid grid-cols-2 gap-2.5 w-full mb-7">
          {([
            { w: 'employee'  as WorkerType, icon: '💼', name: 'Salarié(e)',      sub: 'Employeur fixe, T4/W-2'     },
            { w: 'autonomous'as WorkerType, icon: '🔧', name: 'Autonome',        sub: 'Freelance, contrats'        },
            { w: 'gig'       as WorkerType, icon: '🚗', name: 'Gig / Livraison', sub: 'Uber, DoorDash, Instacart'  },
            { w: 'student'   as WorkerType, icon: '🎓', name: 'Étudiant(e)',     sub: 'Temps partiel'              },
          ]).map(({ w, icon, name, sub }) => (
            <button key={w} onClick={() => setObWorker(w)}
              className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer
                ${obWorker === w ? 'border-[#C8F135] bg-[rgba(200,241,53,0.1)]' : 'border-[rgba(255,255,255,0.07)] bg-[#1C2028] hover:border-[rgba(255,255,255,0.13)]'}`}>
              <span className="block text-[22px] mb-2">{icon}</span>
              <span className="block text-[13px] font-black">{name}</span>
              <span className="block text-[11px] text-[rgba(232,230,224,0.38)] mt-0.5">{sub}</span>
            </button>
          ))}
        </div>

        {/* Secteur */}
        {(obWorker === 'autonomous' || obWorker === 'gig') && (
          <>
            <p className="text-[11px] font-black tracking-[0.1em] uppercase text-[rgba(232,230,224,0.38)] self-start w-full mb-3">Ton secteur</p>
            <div className="grid grid-cols-2 gap-2.5 w-full mb-7">
              {([
                { s: 'transport', icon: '🚗', name: 'Transport / Livraison' },
                { s: 'tech',      icon: '💻', name: 'Tech / Freelance'      },
                { s: 'creative',  icon: '🎨', name: 'Créatif / Design'      },
                { s: 'service',   icon: '🍽️', name: 'Service / Resto'       },
              ]).map(({ s, icon, name }) => (
                <button key={s} onClick={() => setObSector(s)}
                  className={`p-3.5 rounded-[10px] border-2 text-left transition-all cursor-pointer
                    ${obSector === s ? 'border-[#3EFFC8] bg-[rgba(62,255,200,0.1)]' : 'border-[rgba(255,255,255,0.07)] bg-[#1C2028]'}`}>
                  <span className="block text-[18px] mb-1.5">{icon}</span>
                  <span className="block text-[12px] font-black">{name}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <button onClick={startApp}
          className="w-full py-5 bg-[#C8F135] text-[#0F1117] rounded-2xl text-[16px] font-black cursor-pointer transition-all hover:opacity-90 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(200,241,53,0.2)]">
          Commencer →
        </button>
      </div>
    </div>
  )

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN APP
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#0F1117] text-[#E8E6E0]">
      <div className="max-w-[480px] mx-auto min-h-screen flex flex-col">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="bg-[#161920] border-b border-[rgba(255,255,255,0.07)] px-5 py-3 sticky top-0 z-40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-[18px] font-black tracking-[-0.04em]">
                Slary<span className="text-[#C8F135]">·</span>
              </span>
              <span className="font-mono text-[10px] tracking-[0.06em] text-[rgba(232,230,224,0.38)] uppercase">
                {{ paie: 'Paie', decl: 'Déclaration', history: 'Historique', export: 'Export' }[tab]}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Auth / sync pill */}
              <button
                onClick={() => user ? void signOut() : setAuthModal(true)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[9px] tracking-[0.06em] cursor-pointer transition-all
                  ${user
                    ? 'bg-[rgba(62,255,200,0.1)] border border-[rgba(62,255,200,0.2)] text-[#3EFFC8] hover:bg-[rgba(255,92,92,0.1)] hover:border-[rgba(255,92,92,0.2)] hover:text-[#FF5C5C]'
                    : 'bg-[rgba(200,241,53,0.1)] border border-[rgba(200,241,53,0.2)] text-[#C8F135] hover:opacity-80'}`}>
                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${user ? 'bg-[#3EFFC8]' : 'bg-[#C8F135]'}`} />
                {syncing ? 'Sync…' : user ? (user.email?.split('@')[0] ?? 'Cloud') : 'Connexion'}
              </button>
              {/* Region / profile */}
              <button onClick={() => { setPmCountry(profile.country); setPmRegion(profile.region); setPmWorker(profile.workerType); setProfileModal(true) }}
                className="flex items-center gap-1.5 bg-[#1C2028] border border-[rgba(255,255,255,0.07)] rounded-full py-1.5 px-3 text-[12px] font-semibold text-[rgba(232,230,224,0.62)] cursor-pointer hover:text-[#E8E6E0] hover:border-[rgba(255,255,255,0.13)] transition-all">
                <span>{profile.country === 'CA' ? '🇨🇦' : '🇺🇸'}</span>
                <span>{headerRegion?.code ?? profile.region}</span>
              </button>
            </div>
          </div>
        </header>

        {/* ═══════════════════════════════════════════════════════════════
            TAB: PAIE
        ═══════════════════════════════════════════════════════════════ */}
        {tab === 'paie' && (
          <div className="flex flex-col gap-3.5 p-5 pb-28 animate-fade-up">

            {/* Region bar */}
            <div className="bg-[rgba(200,241,53,0.1)] border border-[rgba(200,241,53,0.2)] rounded-lg px-3.5 py-2.5 text-[12px] text-[#C8F135] font-semibold flex items-center gap-2">
              🟢 {profile.country === 'CA' ? '🇨🇦' : '🇺🇸'} {headerRegion?.name ?? profile.region} · Taux 2026
            </div>

            {/* Net du mois */}
            <Card>
              <Label>🟢 Net estimé · ce mois</Label>
              <BigNum value={fmtShort(monthNet)} />
              <div className="text-[12px] text-[rgba(232,230,224,0.38)] mt-1">
                {monthShifts.length === 0
                  ? '0 quart enregistré'
                  : `${monthShifts.length} quart${monthShifts.length > 1 ? 's' : ''} · ${monthHours}h travaillées`}
              </div>
            </Card>

            {/* Formulaire quart */}
            <Card>
              <Label>⏱ Nouveau quart</Label>

              <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                <Field label="Heures normales">
                  <input type="number" value={hours} onChange={e => setHours(e.target.value)} placeholder="8" min="0" step="0.5" className={INPUT} />
                </Field>
                <Field label="Taux ($/h)">
                  <input type="number" value={rate} onChange={e => setRate(e.target.value)} placeholder="22.00" step="0.25" className={INPUT} />
                </Field>
              </div>

              {/* Tips */}
              <Field label="Tips / Pourboires">
                <div className="flex border border-[rgba(255,255,255,0.07)] rounded-[10px] overflow-hidden mb-2">
                  {(['hour', 'flat', 'none'] as TipsMode[]).map(m => (
                    <button key={m} onClick={() => setTipsMode(m)}
                      className={`flex-1 py-2.5 text-[12px] font-black cursor-pointer transition-all
                        ${tipsMode === m ? 'bg-[#C8F135] text-[#0F1117]' : 'text-[rgba(232,230,224,0.38)] hover:text-[#E8E6E0]'}`}>
                      {{ hour: '$/h', flat: 'Forfait', none: 'Aucun' }[m]}
                    </button>
                  ))}
                </div>
                {tipsMode !== 'none' && (
                  <>
                    <input type="number" value={tipsVal} onChange={e => setTipsVal(e.target.value)} placeholder="0.00" step="0.01" min="0" className={INPUT} />
                    <p className="text-[11px] text-[rgba(232,230,224,0.38)] mt-1">
                      {tipsMode === 'hour' ? 'Tips moyens par heure travaillée' : 'Montant total de tips pour ce quart'}
                    </p>
                  </>
                )}
              </Field>

              {/* Extras */}
              <div className="flex items-center justify-between mt-2.5 mb-1">
                <span className="text-[12px] font-semibold text-[rgba(232,230,224,0.62)]">⚡ Heures sup. &amp; extras</span>
                <button onClick={() => setExtrasOpen(v => !v)}
                  className={`w-10 h-[22px] rounded-full relative cursor-pointer border-[1.5px] transition-all flex-shrink-0
                    ${extrasOpen ? 'bg-[#C8F135] border-[#C8F135]' : 'bg-[#232830] border-[rgba(255,255,255,0.07)]'}`}>
                  <span className={`absolute top-[3px] w-3.5 h-3.5 rounded-full transition-all ${extrasOpen ? 'left-[18px] bg-[#0F1117]' : 'left-[2px] bg-[rgba(232,230,224,0.38)]'}`} />
                </button>
              </div>

              {extrasOpen && (
                <div className="bg-[#161920] border border-[rgba(255,255,255,0.07)] rounded-[10px] p-3.5 mt-1 flex flex-col gap-2.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <Field label="H. sup. 1.5x"><input type="number" value={ot15} onChange={e => setOt15(e.target.value)} placeholder="0" min="0" step="0.5" className={INPUT} /></Field>
                    <Field label="H. sup. 2x"><input type="number" value={ot20} onChange={e => setOt20(e.target.value)} placeholder="0" min="0" step="0.5" className={INPUT} /></Field>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <Field label="Boni ($)"><input type="number" value={bonus} onChange={e => setBonus(e.target.value)} placeholder="0" min="0" className={INPUT} /></Field>
                    <Field label="Vacances ($)"><input type="number" value={vacation} onChange={e => setVacation(e.target.value)} placeholder="0" min="0" className={INPUT} /></Field>
                  </div>
                  <Field label="Avantage imposable ($)">
                    <input type="number" value={taxBenefit} onChange={e => setTaxBenefit(e.target.value)} placeholder="0" min="0" className={INPUT} />
                  </Field>
                </div>
              )}

              <button onClick={calculate} className={`${BTN} mt-4`}>
                {liveResult
                  ? <>NET estimé · <span className="font-serif italic font-normal">{fmt(liveResult.net)}</span> →</>
                  : 'Calculer mon net →'}
              </button>

              {/* Breakdown */}
              {breakdown && (
                <div className="bg-[#161920] border border-[rgba(255,255,255,0.07)] rounded-[10px] p-4 mt-3 animate-fade-up">
                  <BRow label="Salaire de base"     value={fmt(breakdown.base)}  color="teal" />
                  {breakdown.otPay > 0      && <BRow label="Heures supplémentaires" value={fmt(breakdown.otPay)}        color="teal" />}
                  {breakdown.tipsAmt > 0    && <BRow label="Tips / Pourboires"      value={fmt(breakdown.tipsAmt)}      color="teal" />}
                  {breakdown.bonus > 0      && <BRow label="Boni / Prime"           value={fmt(breakdown.bonus)}        color="teal" />}
                  {breakdown.vacation > 0   && <BRow label="Indemnité vacances"     value={fmt(breakdown.vacation)}     color="teal" />}
                  {breakdown.taxBenefit > 0 && <BRow label="Avantage imposable"     value={'+ ' + fmt(breakdown.taxBenefit) + ' imposable'} color="red" />}
                  <BRow label="Impôt fédéral" value={'− ' + fmt(breakdown.fed)} color="red" />
                  {profile.country === 'CA' ? (
                    <>
                      <BRow label={(CA_TAX[profile.region] ?? CA_TAX['QC']).provLabel}    value={'− ' + fmt(breakdown.prov)}    color="red" />
                      <BRow label={(CA_TAX[profile.region] ?? CA_TAX['QC']).pensionLabel} value={'− ' + fmt(breakdown.pension)} color="red" />
                      <BRow label={(CA_TAX[profile.region] ?? CA_TAX['QC']).eiLabel}      value={'− ' + fmt(breakdown.ei)}      color="red" />
                    </>
                  ) : (
                    <>
                      {!(US_TAX[profile.region] ?? US_TAX['CA-US']).noStateTax &&
                        <BRow label={(US_TAX[profile.region] ?? US_TAX['CA-US']).stateLabel} value={'− ' + fmt(breakdown.prov)} color="red" />}
                      <BRow label="Social Security" value={'− ' + fmt(breakdown.pension)} color="red" />
                      <BRow label="Medicare"        value={'− ' + fmt(breakdown.ei)}      color="red" />
                    </>
                  )}
                  {breakdown.selfEmployed > 0 && <BRow label="Cotisation autonome" value={'− ' + fmt(breakdown.selfEmployed)} color="red" />}
                  <div className="flex justify-between items-center pt-3 mt-1 border-t border-[rgba(255,255,255,0.13)]">
                    <span className="text-[14px] font-black">NET estimé</span>
                    <span className="font-mono text-[16px] text-[#C8F135]">{fmt(breakdown.net)}</span>
                  </div>
                </div>
              )}

              {pending && (
                <button onClick={saveShift} className={`${BTN} mt-2.5 bg-[#3EFFC8] text-[#0F1117] hover:bg-[#3EFFC8]/90`}>
                  ✓ Enregistrer ce quart
                </button>
              )}
            </Card>

            {/* Stats mois */}
            <div className="grid grid-cols-2 gap-2.5">
              <StatBox label="Brut mois"   value={fmtShort(monthGross)} color="lime" />
              <StatBox label="Heures mois" value={`${monthHours}h`}     />
              <StatBox label="Impôts mois" value={fmtShort(monthTax)}   color="red"  />
              <StatBox label="Tips mois"   value={fmtShort(monthTips)}  color="teal" />
            </div>

            {/* Quarts récents */}
            <div className="bg-[#1C2028] border border-[rgba(255,255,255,0.07)] rounded-2xl overflow-hidden">
              <div className="px-4 py-3.5 border-b border-[rgba(255,255,255,0.07)] flex justify-between items-center">
                <h3 className="text-[12px] font-black tracking-[0.04em] uppercase text-[rgba(232,230,224,0.38)]">Quarts récents</h3>
                <span className="font-mono text-[11px] text-[rgba(232,230,224,0.38)]">{shifts.length} entrée{shifts.length !== 1 ? 's' : ''}</span>
              </div>
              {shifts.length === 0
                ? <p className="p-8 text-center font-serif italic text-[15px] text-[rgba(232,230,224,0.38)]">Aucun quart encore.<br />Entre tes heures ci-dessus.</p>
                : shifts.slice(0, 8).map((s, i) => <ShiftRow key={s.ts + i} shift={s} fmt={fmt} onDelete={() => deleteShift(s.ts)} />)}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            TAB: DÉCLARATION
        ═══════════════════════════════════════════════════════════════ */}
        {tab === 'decl' && (
          <div className="flex flex-col gap-3.5 p-5 pb-28 animate-fade-up">

            {/* Bannière YTD rattrapage */}
            {!ytdData ? (
              <button onClick={() => setYtdModal(true)}
                className="flex items-center gap-3 bg-[rgba(255,181,71,0.08)] border border-[rgba(255,181,71,0.25)] rounded-xl px-4 py-3.5 cursor-pointer hover:bg-[rgba(255,181,71,0.13)] transition-all text-left w-full">
                <span className="text-[22px] flex-shrink-0">📥</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-black text-[#FFB547]">Revenus avant Slary ?</div>
                  <div className="text-[11px] text-[rgba(232,230,224,0.38)] mt-0.5">Ajoute tes salaires passés pour un calcul annuel précis</div>
                </div>
                <span className="text-[#FFB547] font-black text-[12px] flex-shrink-0">Ajouter →</span>
              </button>
            ) : (
              <div className="flex items-center gap-3 bg-[rgba(62,255,200,0.06)] border border-[rgba(62,255,200,0.2)] rounded-xl px-4 py-3 text-left">
                <span className="text-[18px] flex-shrink-0">✓</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-black text-[#3EFFC8]">Revenus passés inclus · {ytdData.period}</div>
                  <div className="text-[11px] text-[rgba(232,230,224,0.38)] mt-0.5">
                    {isAutonomous
                      ? `${fmt(ytdData.revenueYtd)} revenus · ${fmt(ytdData.instalmentsYtd)} acomptes`
                      : `${fmt(ytdData.grossYtd)} brut · ${fmt(ytdData.taxWithheldYtd)} retenus`}
                  </div>
                </div>
                <button onClick={() => setYtdModal(true)} className="text-[11px] font-black text-[rgba(232,230,224,0.38)] hover:text-[#E8E6E0] cursor-pointer transition-colors flex-shrink-0">Modifier</button>
              </div>
            )}

            {/* Annual hero */}
            <div className="bg-gradient-to-br from-[#1C2028] to-[#232830] border border-[rgba(255,255,255,0.07)] rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-[-40px] right-[-40px] w-40 h-40 rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(200,241,53,0.1) 0%, transparent 70%)' }} />
              <div className="text-[10px] font-black tracking-[0.12em] uppercase text-[rgba(232,230,224,0.38)] mb-1.5">
                Déclaration 2025 · Saison 2026
              </div>
              <div className={`font-serif italic text-[44px] tracking-[-0.03em] leading-none mb-1 ${refund >= 0 ? 'text-[#C8F135]' : 'text-[#FF5C5C]'}`}>
                {fmtShort(Math.abs(refund))}
              </div>
              <p className="text-[12px] text-[rgba(232,230,224,0.38)] mb-5">{refund >= 0 ? 'Remboursement estimé' : 'Solde dû estimé'}</p>
              <div className="flex flex-col gap-2">
                <AnnRow label="Revenus totaux"        value={fmt(totalIncome)}        />
                <AnnRow label="Impôts estimés"        value={'− ' + fmt(estimatedTax)} color="red"  />
                <AnnRow label="Crédits & déductions"  value={'+ ' + fmt(credits)}      color="teal" />
                <AnnRow label="Retenues à la source"  value={'+ ' + fmt(annTax)}       color="lime" />
              </div>
            </div>

            {/* Progress */}
            <Card>
              <div className="flex justify-between items-center mb-3.5">
                <h3 className="text-[13px] font-black tracking-[-0.01em]">📁 Documents collectés</h3>
                <span className="font-mono text-[10px] bg-[rgba(200,241,53,0.1)] text-[#C8F135] px-2.5 py-1 rounded-full">{checkPct}%</span>
              </div>
              <div className="h-[5px] bg-[#232830] rounded-full mb-2 overflow-hidden">
                <div className="h-full bg-[#C8F135] rounded-full transition-all duration-700" style={{ width: `${checkPct}%` }} />
              </div>
              <div className="flex justify-between text-[11px] text-[rgba(232,230,224,0.38)]">
                <span>{checkDone} / {checkDocs.length} documents</span>
                <span>{profile.country === 'CA' ? 'Saison 2026 — export maintenant !' : 'Deadline: Apr 15, 2026'}</span>
              </div>
            </Card>

            {/* Catégories */}
            <p className="text-[11px] font-black tracking-[0.1em] uppercase text-[rgba(232,230,224,0.38)]">Revenus &amp; Déductions</p>
            <div className="flex flex-col gap-2">
              {categories.map(c => {
                let total = entries.filter(e => e.cat === c.key).reduce((a, e) => a + e.amount, 0)
                if (c.key === 'income_emp') total += annGross
                return (
                  <button key={c.key} onClick={() => { setEntryCat(c.key); setEntryAmt(''); setEntryDesc(''); setEntryModal(true) }}
                    className={`flex items-center gap-3 px-3.5 py-3 rounded-[10px] border-[1.5px] cursor-pointer transition-all text-left
                      ${total > 0 ? 'border-[rgba(62,255,200,0.3)] bg-[rgba(62,255,200,0.1)] hover:translate-x-1' : 'border-[rgba(255,255,255,0.07)] bg-[#1C2028] hover:border-[rgba(255,255,255,0.13)] hover:translate-x-1'}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[15px] flex-shrink-0 ${total > 0 ? 'bg-[rgba(62,255,200,0.15)]' : 'bg-[#232830]'}`}>{c.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-black mb-0.5">{c.name}</div>
                      <div className="text-[11px] text-[rgba(232,230,224,0.38)] truncate">{c.desc}</div>
                    </div>
                    <div className={`font-mono text-[12px] flex-shrink-0 ${total > 0 ? 'text-[#3EFFC8]' : 'text-[rgba(232,230,224,0.38)]'}`}>
                      {total > 0 ? fmt(total) : '+ Ajouter'}
                    </div>
                  </button>
                )
              })}
            </div>

            <button onClick={() => { setEntryCat(categories[0]?.key ?? ''); setEntryAmt(''); setEntryDesc(''); setEntryModal(true) }} className={BTN2}>
              + Ajouter revenus ou dépenses
            </button>

            {/* Checklist */}
            <div className="bg-[#1C2028] border border-[rgba(255,255,255,0.07)] rounded-2xl overflow-hidden">
              <div className="px-4 py-3.5 border-b border-[rgba(255,255,255,0.07)] flex justify-between items-center">
                <h3 className="text-[12px] font-black tracking-[0.04em] uppercase text-[rgba(232,230,224,0.38)]">Checklist documents</h3>
                <span className="font-mono text-[11px] text-[rgba(232,230,224,0.38)]">{checkDone} / {checkDocs.length}</span>
              </div>
              {checkDocs.map(d => (
                <button key={d.id} onClick={() => toggleDoc(d.id)}
                  className="w-full px-4 py-3 flex items-center gap-3 border-b border-[rgba(255,255,255,0.07)] last:border-0 cursor-pointer hover:bg-[#232830] transition-colors text-left">
                  <div className={`w-[18px] h-[18px] border-[1.5px] rounded flex items-center justify-center text-[10px] flex-shrink-0 transition-all
                    ${checklist[d.id] ? 'bg-[#3EFFC8] border-[#3EFFC8] text-[#0F1117]' : 'border-[rgba(255,255,255,0.13)]'}`}>
                    {checklist[d.id] ? '✓' : ''}
                  </div>
                  <span className={`text-[13px] font-semibold flex-1 ${checklist[d.id] ? 'line-through text-[rgba(232,230,224,0.38)]' : ''}`}>{d.label}</span>
                  <span className="text-[10px] text-[rgba(232,230,224,0.38)] font-mono whitespace-nowrap">{d.due}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            TAB: HISTORIQUE
        ═══════════════════════════════════════════════════════════════ */}
        {tab === 'history' && (() => {
          // Group shifts by year-month
          const groups = shifts.reduce<Record<string, ShiftData[]>>((acc, s) => {
            const d = new Date(s.ts)
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            ;(acc[key] ??= []).push(s)
            return acc
          }, {})
          const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a))
          const MONTH_NAMES = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
          return (
            <div className="flex flex-col gap-3.5 p-5 pb-28 animate-fade-up">
              <Card>
                <Label>📊 Résumé annuel</Label>
                <BigNum value={fmtShort(annGross)} />
                <p className="text-[12px] text-[rgba(232,230,224,0.38)] mt-1">Revenu brut · {new Date().getFullYear()}</p>
              </Card>
              <div className="grid grid-cols-2 gap-2.5">
                <StatBox label="Total net"    value={fmtShort(annNet)}   color="lime" />
                <StatBox label="Total impôts" value={fmtShort(annTax)}   color="red"  />
                <StatBox label="Total heures" value={`${annHours}h`}     />
                <StatBox label="Total tips"   value={fmtShort(annTips)}  color="teal" />
              </div>

              {/* Entrée YTD importée */}
              {ytdData && (
                <div className="bg-[#1C2028] border border-[rgba(255,181,71,0.2)] rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 bg-[rgba(255,181,71,0.05)] flex justify-between items-center">
                    <div>
                      <span className="text-[13px] font-black text-[#FFB547]">📥 Revenus importés</span>
                      <span className="ml-2 font-mono text-[10px] text-[rgba(232,230,224,0.38)]">{ytdData.period}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-[12px] text-[#FFB547]">{fmt(ytdGross)} brut</div>
                      <div className="font-mono text-[10px] text-[rgba(232,230,224,0.38)]">{fmt(ytdTaxPaid)} {isAutonomous ? 'acomptes' : 'retenus'}</div>
                    </div>
                  </div>
                  <div className="px-4 py-3 flex justify-between items-center">
                    <span className="text-[12px] text-[rgba(232,230,224,0.38)]">
                      {isAutonomous ? 'Revenus clients avant Slary' : 'Salaires avant Slary · bulletin de paie'}
                    </span>
                    <button onClick={clearYtd} className="text-[11px] font-semibold text-[rgba(232,230,224,0.38)] hover:text-[#FF5C5C] transition-colors cursor-pointer">Supprimer</button>
                  </div>
                </div>
              )}

              {shifts.length === 0 && !ytdData
                ? (
                  <div className="bg-[#1C2028] border border-[rgba(255,255,255,0.07)] rounded-2xl p-8 text-center">
                    <p className="font-serif italic text-[15px] text-[rgba(232,230,224,0.38)]">Aucun quart enregistré.</p>
                  </div>
                )
                : sortedKeys.map(key => {
                  const [yr, mo] = key.split('-')
                  const label = `${MONTH_NAMES[parseInt(mo) - 1]} ${yr}`
                  const group = groups[key]
                  const mNet   = group.reduce((a, s) => a + s.net, 0)
                  const mGross = group.reduce((a, s) => a + s.gross, 0)
                  const mHours = group.reduce((a, s) => a + s.hours, 0)
                  return (
                    <div key={key} className="bg-[#1C2028] border border-[rgba(255,255,255,0.07)] rounded-2xl overflow-hidden">
                      <div className="px-4 py-3 bg-[#232830] flex justify-between items-center">
                        <div>
                          <span className="text-[13px] font-black tracking-[-0.01em]">{label}</span>
                          <span className="ml-2 font-mono text-[10px] text-[rgba(232,230,224,0.38)]">{group.length} quart{group.length > 1 ? 's' : ''} · {mHours}h</span>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-[12px] text-[#C8F135]">{fmt(mNet)} net</div>
                          <div className="font-mono text-[10px] text-[rgba(232,230,224,0.38)]">{fmt(mGross)} brut</div>
                        </div>
                      </div>
                      {group.map((s, i) => (
                        <ShiftRow key={s.ts + i} shift={s} fmt={fmt} onDelete={() => deleteShift(s.ts)} />
                      ))}
                    </div>
                  )
                })
              }

              {shifts.length > 0 && (
                <button onClick={clearData} className="text-[12px] font-semibold text-[rgba(232,230,224,0.38)] hover:text-[#FF5C5C] transition-colors cursor-pointer py-2 text-center">
                  🗑 Effacer toutes les données
                </button>
              )}
            </div>
          )
        })()}

        {/* ═══════════════════════════════════════════════════════════════
            TAB: EXPORT
        ═══════════════════════════════════════════════════════════════ */}
        {tab === 'export' && (
          <div className="flex flex-col gap-3.5 p-5 pb-28 animate-fade-up">

            {/* Hero */}
            <div className="bg-gradient-to-br from-[#1C2028] to-[#232830] border border-[rgba(255,255,255,0.07)] rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute bottom-[-50px] right-[-50px] w-40 h-40 rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(200,241,53,0.08) 0%, transparent 70%)' }} />
              <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-[#C8F135] mb-2.5 flex items-center gap-2">
                <span className="block w-4 h-px bg-[#C8F135]" />Étape 4 — Export &amp; Comptabilité
              </div>
              <h2 className="font-serif italic text-[26px] font-light tracking-[-0.02em] mb-1.5">
                Ton dossier fiscal.<br /><strong className="not-italic font-black font-sans text-[#C8F135]">Prêt en 10 sec.</strong>
              </h2>
              <p className="text-[12px] text-[rgba(232,230,224,0.62)] leading-[1.6]">
                PDF déclaration, CSV comptable, JSON API — tout généré depuis tes données Slary.
              </p>
            </div>

            {/* Année */}
            <div>
              <p className="font-mono text-[9px] tracking-[0.15em] uppercase text-[rgba(232,230,224,0.38)] mb-2.5">Année fiscale</p>
              <div className="flex gap-2 bg-[#1C2028] border border-[rgba(255,255,255,0.07)] rounded-[10px] p-1">
                {[2024, 2025, 2026].map(y => (
                  <button key={y} onClick={() => setExportYear(y)}
                    className={`flex-1 py-2.5 rounded-[7px] font-mono text-[11px] tracking-[0.06em] cursor-pointer transition-all
                      ${exportYear === y ? 'bg-[#232830] text-[#C8F135]' : 'text-[rgba(232,230,224,0.38)] hover:text-[#E8E6E0]'}`}>
                    {y}
                  </button>
                ))}
              </div>
            </div>

            {/* Résumé */}
            <div className="bg-[#1C2028] border border-[rgba(255,255,255,0.07)] rounded-2xl overflow-hidden">
              <div className="px-4 py-3.5 bg-[#232830] border-b border-[rgba(255,255,255,0.07)] flex justify-between items-center">
                <h3 className="text-[11px] font-black tracking-[0.08em] uppercase text-[rgba(232,230,224,0.38)]">Résumé fiscal {exportYear}</h3>
                <div className="flex items-center gap-1.5 font-mono text-[10px] text-[#C8F135]">
                  <span className="w-[5px] h-[5px] rounded-full bg-[#C8F135] animate-pulse" />Données Slary
                </div>
              </div>
              <div>
                {[
                  ['Revenu brut total',      fmt(annGross),             'lime'],
                  ['Retenues à la source',   '− ' + fmt(annTax),        'red'],
                  ['Déductions & crédits',   '+ ' + fmt(credits),       'teal'],
                  ['Revenu imposable net',   fmt(Math.max(0, totalIncome - deductionAmt)), ''],
                  ['Remboursement estimé',   (refund >= 0 ? '+ ' : '− ') + fmt(Math.abs(refund)), 'lime'],
                ].map(([label, value, color], i) => {
                  const c = color === 'lime' ? 'text-[#C8F135]' : color === 'red' ? 'text-[#FF5C5C]' : color === 'teal' ? 'text-[#3EFFC8]' : 'text-[#E8E6E0]'
                  const last = i === 4
                  return (
                    <div key={label} className={`flex justify-between items-center px-4 py-3 border-b border-[rgba(255,255,255,0.07)] last:border-0 text-[13px]
                      ${last ? 'bg-[rgba(200,241,53,0.05)]' : ''}`}>
                      <span className={`${last ? 'font-black text-[14px] text-[#E8E6E0]' : 'font-normal text-[rgba(232,230,224,0.62)]'}`}>{label}</span>
                      <span className={`font-mono text-[12px] ${c} ${last ? 'text-[16px] font-serif italic' : ''}`}>{value}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Format */}
            <div>
              <p className="font-mono text-[9px] tracking-[0.15em] uppercase text-[rgba(232,230,224,0.38)] mb-3">Format d'export</p>
              <div className="grid grid-cols-2 gap-2.5">
                {([
                  ['pdf',  '📄', 'PDF Déclaration', 'Résumé complet prêt pour ton comptable',      'TurboTax · H&R Block'],
                  ['csv',  '📊', 'CSV Comptable',   'Toutes les transactions catégorisées',          'QuickBooks · Wave'],
                  ['json', '⚡', 'JSON / API',      'Données brutes pour intégration développeur',  'Dev · Zapier'],
                ] as [ExportFmt, string, string, string, string][]).map(([id, icon, name, desc, badge]) => (
                  <button key={id} onClick={() => setExportFmt(id)}
                    className={`p-4 rounded-2xl border-[1.5px] text-left cursor-pointer transition-all relative overflow-hidden
                      ${exportFmt === id ? 'border-[#C8F135] bg-[rgba(200,241,53,0.08)]' : 'border-[rgba(255,255,255,0.07)] bg-[#1C2028] hover:border-[rgba(255,255,255,0.13)] hover:-translate-y-0.5'}`}>
                    <span className="text-[26px] mb-2.5 block">{icon}</span>
                    <div className="text-[14px] font-black tracking-[-0.02em] mb-1">{name}</div>
                    <div className="text-[10px] text-[rgba(232,230,224,0.38)] leading-[1.5] mb-2">{desc}</div>
                    <div className={`inline-block font-mono text-[9px] px-2 py-0.5 rounded-full border
                      ${exportFmt === id ? 'bg-[rgba(200,241,53,0.1)] text-[#C8F135] border-[rgba(200,241,53,0.3)]' : 'bg-[#232830] text-[rgba(232,230,224,0.38)] border-[rgba(255,255,255,0.07)]'}`}>
                      {badge}
                    </div>
                    {exportFmt === id && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C8F135]" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Barre de progression */}
            {dlRunning && (
              <div className="bg-[#1C2028] border border-[rgba(255,255,255,0.07)] rounded-[10px] p-4 animate-fade-up">
                <div className="flex justify-between items-center font-mono text-[10px] text-[rgba(232,230,224,0.38)] tracking-[0.06em] mb-2">
                  <span>{dlLabel}</span>
                  <span>{dlPct}%</span>
                </div>
                <div className="h-[3px] bg-[#232830] rounded-full overflow-hidden">
                  <div className="h-full bg-[#C8F135] rounded-full transition-all duration-200"
                    style={{ width: `${dlPct}%`, boxShadow: '0 0 8px rgba(200,241,53,0.4)' }} />
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="flex flex-col gap-2.5">
              <button onClick={runExport} disabled={dlRunning}
                className="w-full py-4 bg-[#C8F135] text-[#0F1117] rounded-[10px] text-[15px] font-black cursor-pointer transition-all hover:-translate-y-0.5 hover:bg-[#3EFFC8] hover:shadow-[0_8px_32px_rgba(200,241,53,0.2)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2.5">
                {{ pdf: '📥', csv: '📊', json: '⚡' }[exportFmt]} Générer &amp; Télécharger
              </button>
              <button onClick={() => toast('📧 Fonctionnalité email — Plan Pro requis')} className={BTN2}>
                📧 Envoyer par email à mon comptable
              </button>
            </div>

            {/* Intégrations */}
            <div>
              <p className="font-mono text-[9px] tracking-[0.15em] uppercase text-[rgba(232,230,224,0.38)] mb-3">Intégrations directes</p>
              <div className="flex flex-col gap-2">
                {([
                  ['🦅', 'TurboTax Canada',  'Importer tes données directement',          '#FF5C5C'],
                  ['🏦', 'H&R Block',         'Export compatible Tax Software',             '#FF5C5C'],
                  ['📗', 'QuickBooks',        'Sync des dépenses catégorisées',             '#3EFFC8'],
                  ['🌊', 'Wave Accounting',   'Gratuit · Parfait pour les autonomes',       '#C8F135'],
                ]).map(([icon, name, desc, color]) => (
                  <button key={name} onClick={() => toast(`🔗 ${name} — Intégration bientôt disponible`)}
                    className="flex items-center gap-3.5 p-3.5 bg-[#1C2028] border border-[rgba(255,255,255,0.07)] rounded-[10px] cursor-pointer hover:border-[rgba(255,255,255,0.13)] hover:translate-x-1 transition-all text-left">
                    <div className="w-[38px] h-[38px] rounded-[9px] flex items-center justify-center text-[18px] flex-shrink-0"
                      style={{ background: color + '18' }}>
                      {icon}
                    </div>
                    <div className="flex-1">
                      <div className="text-[13px] font-black mb-0.5">{name}</div>
                      <div className="text-[11px] text-[rgba(232,230,224,0.38)]">{desc}</div>
                    </div>
                    <div className="font-mono text-[9px] bg-[rgba(62,255,200,0.1)] text-[#3EFFC8] border border-[rgba(62,255,200,0.2)] rounded-full px-2 py-0.5">Bientôt</div>
                    <span className="text-[rgba(232,230,224,0.38)]">→</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom nav ──────────────────────────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#161920] border-t border-[rgba(255,255,255,0.07)]" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="max-w-[480px] mx-auto flex">
          {([
            ['paie',    '💼', 'Paie'],
            ['decl',    '📋', 'Décl.'],
            ['history', '📊', 'Historique'],
            ['export',  '📤', 'Export'],
          ] as [TabId, string, string][]).map(([id, icon, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 cursor-pointer transition-all relative
                ${tab === id ? 'text-[#E8E6E0]' : 'text-[rgba(232,230,224,0.38)] hover:text-[rgba(232,230,224,0.62)]'}`}>
              <span className="text-[18px] leading-none">{icon}</span>
              <span className="text-[9px] font-black tracking-[0.04em] uppercase">{label}</span>
              {tab === id && (
                <span className={`absolute top-0 left-[20%] right-[20%] h-[2px] rounded-b ${id === 'export' ? 'bg-[#FFB547]' : 'bg-[#C8F135]'}`} />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL: YTD RATTRAPAGE
      ═══════════════════════════════════════════════════════════════════ */}
      <BottomSheet
        open={ytdModal}
        onClose={() => setYtdModal(false)}
        title="Revenus avant Slary"
        subtitle={isAutonomous ? 'Revenus clients reçus · acomptes déjà versés' : 'Depuis ton bulletin de paie · cumul annuel (YTD)'}>
        <div className="flex flex-col gap-3.5">

          <Field label="Période couverte">
            <input
              type="text"
              value={ytdPeriod}
              onChange={e => setYtdPeriod(e.target.value)}
              placeholder="Ex : Jan–Mai 2026"
              className={INPUT}
            />
          </Field>

          {isAutonomous ? (
            <>
              <div className="bg-[rgba(255,181,71,0.08)] border border-[rgba(255,181,71,0.2)] rounded-lg px-3.5 py-2.5 text-[12px] text-[#FFB547] leading-[1.6]">
                ℹ️ Entre le total des paiements reçus de tes clients (pas tes factures envoyées — ce que tu as <strong>encaissé</strong>).
              </div>
              <Field label="Revenus encaissés ($)">
                <input type="number" value={ytdRevenueInput} onChange={e => setYtdRevenueInput(e.target.value)}
                  placeholder="0.00" step="0.01" min="0" className={INPUT} />
              </Field>
              <Field label="Acomptes provisionnels déjà payés à l'ARC / IRS ($)">
                <input type="number" value={ytdInstalInput} onChange={e => setYtdInstalInput(e.target.value)}
                  placeholder="0.00" step="0.01" min="0" className={INPUT} />
              </Field>
              <Field label="Heures travaillées (optionnel)">
                <input type="number" value={ytdHoursInput} onChange={e => setYtdHoursInput(e.target.value)}
                  placeholder="0" min="0" className={INPUT} />
              </Field>
            </>
          ) : (
            <>
              <div className="bg-[rgba(255,181,71,0.08)] border border-[rgba(255,181,71,0.2)] rounded-lg px-3.5 py-2.5 text-[12px] text-[#FFB547] leading-[1.6]">
                ℹ️ Trouve ces chiffres dans la section <strong>« Cumul annuel »</strong> de ton bulletin de paie le plus récent.
              </div>
              <Field label="Revenu brut cumulé YTD ($)">
                <input type="number" value={ytdGrossInput} onChange={e => setYtdGrossInput(e.target.value)}
                  placeholder="0.00" step="0.01" min="0" className={INPUT} />
              </Field>
              <Field label="Impôts retenus cumulés YTD ($)">
                <input type="number" value={ytdTaxInput} onChange={e => setYtdTaxInput(e.target.value)}
                  placeholder="0.00" step="0.01" min="0" className={INPUT} />
              </Field>
              <Field label="Heures travaillées (optionnel)">
                <input type="number" value={ytdHoursInput} onChange={e => setYtdHoursInput(e.target.value)}
                  placeholder="0" min="0" className={INPUT} />
              </Field>
            </>
          )}

          <button onClick={saveYtd} className={BTN}>✓ Enregistrer →</button>
          {ytdData && (
            <button onClick={() => { clearYtd(); setYtdModal(false) }}
              className="text-[12px] text-[rgba(232,230,224,0.38)] hover:text-[#FF5C5C] cursor-pointer py-1 text-center transition-colors">
              🗑 Supprimer les revenus importés
            </button>
          )}
        </div>
      </BottomSheet>

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL: PROFIL
      ═══════════════════════════════════════════════════════════════════ */}
      <BottomSheet open={profileModal} onClose={() => setProfileModal(false)} title="Mon profil" subtitle="Modifie tes paramètres à tout moment">
        <div className="flex flex-col gap-3.5">
          <Field label="Pays">
            <select value={pmCountry} onChange={e => { setPmCountry(e.target.value as Country); setPmRegion(REGIONS[e.target.value as Country][0].code) }} className={SELECT}>
              <option value="CA">🇨🇦 Canada</option>
              <option value="US">🇺🇸 États-Unis</option>
            </select>
          </Field>
          <Field label="Province / État">
            <select value={pmRegion} onChange={e => setPmRegion(e.target.value)} className={SELECT}>
              {REGIONS[pmCountry].map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
            </select>
          </Field>
          <Field label="Type de travail">
            <select value={pmWorker} onChange={e => setPmWorker(e.target.value as WorkerType)} className={SELECT}>
              <option value="employee">Salarié(e)</option>
              <option value="autonomous">Travailleur autonome</option>
              <option value="gig">Gig / Livraison</option>
              <option value="student">Étudiant(e)</option>
            </select>
          </Field>
          <button onClick={saveProfileModal} className={BTN}>Enregistrer</button>
          <button onClick={() => { setProfileModal(false); setPhase('onboarding') }}
            className="text-[12px] text-[rgba(232,230,224,0.38)] hover:text-[#E8E6E0] cursor-pointer py-2 text-center transition-colors">
            ↩ Refaire l'onboarding
          </button>
        </div>
      </BottomSheet>

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL: AJOUTER ENTRÉE
      ═══════════════════════════════════════════════════════════════════ */}
      <BottomSheet open={entryModal} onClose={() => setEntryModal(false)} title="Ajouter une entrée" subtitle="Revenus, dépenses déductibles, reçus">
        <div className="flex flex-col gap-3.5">
          <Field label="Catégorie">
            <select value={entryCat} onChange={e => setEntryCat(e.target.value)} className={SELECT}>
              {categories.map(c => <option key={c.key} value={c.key}>{c.icon} {c.name}</option>)}
            </select>
          </Field>
          <Field label="Montant ($)">
            <input type="number" value={entryAmt} onChange={e => setEntryAmt(e.target.value)} placeholder="0.00" step="0.01" min="0" className={INPUT} />
          </Field>
          <Field label="Description (optionnel)">
            <input type="text" value={entryDesc} onChange={e => setEntryDesc(e.target.value)} placeholder="Ex : Dentiste, 15 jan" className={INPUT} />
          </Field>
          {ENTRY_HINTS[entryCat] && (
            <div className="text-[12px] text-[#FFB547] bg-[rgba(255,181,71,0.12)] border border-[rgba(255,181,71,0.2)] px-3.5 py-2.5 rounded-lg leading-[1.6]">
              ℹ️ {ENTRY_HINTS[entryCat]}
            </div>
          )}
          <button onClick={saveEntry} className={BTN}>Ajouter →</button>
        </div>
      </BottomSheet>

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL: AUTH
      ═══════════════════════════════════════════════════════════════════ */}
      <BottomSheet
        open={authModal}
        onClose={() => { setAuthModal(false); setAuthSent(false); setAuthEmail('') }}
        title="Compte Slary"
        subtitle="Sauvegarde tes données dans le cloud · sync entre appareils">
        {!authSent ? (
          <div className="flex flex-col gap-3.5">
            <Field label="Ton adresse email">
              <input
                type="email"
                value={authEmail}
                onChange={e => setAuthEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && void sendMagicLink()}
                placeholder="toi@exemple.com"
                className={INPUT}
                autoComplete="email"
              />
            </Field>
            <button onClick={() => void sendMagicLink()} className={BTN}>
              ✉️ Envoyer le lien magique
            </button>
            <p className="text-[11px] text-[rgba(232,230,224,0.38)] text-center leading-[1.7]">
              Pas de mot de passe — on t'envoie un lien par email.<br />
              Tes données restent privées et chiffrées (RLS Supabase).
            </p>
            <div className="border-t border-[rgba(255,255,255,0.07)] pt-3.5">
              <div className="flex flex-col gap-2 text-[12px] text-[rgba(232,230,224,0.62)]">
                <div className="flex items-center gap-2.5">
                  <span className="text-[#3EFFC8]">✓</span>Sync sur tous tes appareils
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-[#3EFFC8]">✓</span>Récupère tes données si tu changes de téléphone
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-[#3EFFC8]">✓</span>Gratuit · aucune carte requise
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="text-5xl">📬</div>
            <p className="text-[18px] font-black tracking-[-0.02em]">Vérifie tes emails !</p>
            <p className="text-[13px] text-[rgba(232,230,224,0.62)] text-center leading-[1.7] max-w-[280px]">
              Un lien de connexion a été envoyé à<br />
              <strong className="text-[#E8E6E0]">{authEmail}</strong>.<br />
              Clique dessus pour te connecter — il expire dans 1h.
            </p>
            <button onClick={() => { setAuthSent(false) }} className={BTN2}>
              ↩ Changer l'email
            </button>
          </div>
        )}
      </BottomSheet>

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#232830] border border-[rgba(255,255,255,0.13)] text-[#E8E6E0] px-5 py-2.5 rounded-full text-[13px] font-black z-[9999] whitespace-nowrap pointer-events-none transition-all duration-300
        ${toastVisible ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0'}`}
        style={{ transform: `translateX(-50%) translateY(${toastVisible ? '0' : '4rem'})` }}>
        {toastMsg}
      </div>
    </div>
  )
}
