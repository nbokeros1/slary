import { supabase } from './supabase'
import type { Profile, ShiftData, EntryData, Country } from '@slary/functions'

// ─── Row mappers ─────────────────────────────────────────────────────────────

function shiftToRow(userId: string, s: ShiftData) {
  return {
    user_id:      userId,
    ts:           s.ts,
    date:         s.date,
    hours:        s.hours,
    rate:         s.rate,
    ot15:         s.ot15,
    ot20:         s.ot20,
    tips_amt:     s.tipsAmt,
    bonus:        s.bonus,
    vacation:     s.vacation,
    tax_benefit:  s.taxBenefit,
    base:         s.base,
    ot_pay:       s.otPay,
    gross:        s.gross,
    fed:          s.fed,
    prov:         s.prov,
    pension:      s.pension,
    ei:           s.ei,
    self_employed: s.selfEmployed,
    total_tax:    s.totalTax,
    net:          s.net,
    country:      s.country,
    region:       s.region,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToShift(r: any): ShiftData {
  return {
    ts:          r.ts,
    date:        r.date,
    hours:       r.hours,
    rate:        r.rate,
    ot15:        r.ot15 ?? 0,
    ot20:        r.ot20 ?? 0,
    tipsAmt:     r.tips_amt ?? 0,
    bonus:       r.bonus ?? 0,
    vacation:    r.vacation ?? 0,
    taxBenefit:  r.tax_benefit ?? 0,
    base:        r.base,
    otPay:       r.ot_pay ?? 0,
    gross:       r.gross,
    fed:         r.fed,
    prov:        r.prov,
    pension:     r.pension,
    ei:          r.ei,
    selfEmployed: r.self_employed ?? 0,
    totalTax:    r.total_tax,
    net:         r.net,
    country:     r.country as Country,
    region:      r.region,
  }
}

// ─── Load all ────────────────────────────────────────────────────────────────

export async function dbLoadAll(userId: string) {
  if (!supabase) return null
  const [{ data: profileRow }, { data: shiftRows }, { data: entryRows }] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('shifts').select('*').eq('user_id', userId).order('ts', { ascending: false }),
      supabase.from('entries').select('*').eq('user_id', userId).order('ts', { ascending: false }),
    ])

  const profile: Profile | null = profileRow
    ? {
        country:    profileRow.country as Country,
        region:     profileRow.region,
        workerType: profileRow.worker_type as Profile['workerType'],
        sector:     profileRow.sector as Profile['sector'],
        savedRate:  profileRow.saved_rate ?? undefined,
      }
    : null

  return {
    profile,
    shifts:    (shiftRows  ?? []).map(rowToShift),
    entries:   (entryRows  ?? []).map((r: any) => ({
      cat:    r.cat as string,
      amount: r.amount as number,
      desc:   r.description as string,
      ts:     r.ts as number,
    })) as EntryData[],
    checklist: (profileRow?.checklist ?? {}) as Record<string, boolean>,
  }
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export async function dbUpsertProfile(
  userId: string,
  profile: Profile,
  checklist: Record<string, boolean>,
) {
  if (!supabase) return
  await supabase.from('profiles').upsert({
    id:          userId,
    country:     profile.country,
    region:      profile.region,
    worker_type: profile.workerType,
    sector:      profile.sector,
    saved_rate:  profile.savedRate ?? null,
    checklist,
  })
}

// ─── Shifts ──────────────────────────────────────────────────────────────────

export async function dbInsertShift(userId: string, shift: ShiftData) {
  if (!supabase) return
  await supabase.from('shifts').insert(shiftToRow(userId, shift))
}

export async function dbDeleteShift(userId: string, ts: number) {
  if (!supabase) return
  await supabase.from('shifts').delete().eq('user_id', userId).eq('ts', ts)
}

// ─── Entries ─────────────────────────────────────────────────────────────────

export async function dbInsertEntry(userId: string, entry: EntryData) {
  if (!supabase) return
  await supabase.from('entries').insert({
    user_id:     userId,
    ts:          entry.ts,
    cat:         entry.cat,
    amount:      entry.amount,
    description: entry.desc,
  })
}

export async function dbDeleteEntry(userId: string, ts: number) {
  if (!supabase) return
  await supabase.from('entries').delete().eq('user_id', userId).eq('ts', ts)
}

// ─── Migration localStorage → Supabase ───────────────────────────────────────

export async function dbMigrateLocal(
  userId: string,
  data: {
    profile:   Profile
    shifts:    ShiftData[]
    entries:   EntryData[]
    checklist: Record<string, boolean>
  },
) {
  if (!supabase) return
  await dbUpsertProfile(userId, data.profile, data.checklist)
  if (data.shifts.length > 0) {
    await supabase.from('shifts').insert(data.shifts.map(s => shiftToRow(userId, s)))
  }
  if (data.entries.length > 0) {
    await supabase.from('entries').insert(
      data.entries.map(e => ({
        user_id:     userId,
        ts:          e.ts,
        cat:         e.cat,
        amount:      e.amount,
        description: e.desc,
      })),
    )
  }
}
