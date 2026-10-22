import { describe, expect, it } from 'vitest'
import {
  attendanceMeta,
  formatDate,
  formatPercent,
  initials,
  percentageBar,
  percentageTone,
  slugify,
  titleCase,
} from './utils'

describe('formatting helpers', () => {
  it('formats ISO dates and falls back for empty values', () => {
    expect(formatDate('2026-10-05', 'dd MMM yyyy')).toBe('05 Oct 2026')
    expect(formatDate(null)).toBe('—')
    expect(formatDate('not-a-date')).toBe('—')
  })

  it('formats percentages without trailing zeros', () => {
    expect(formatPercent(75)).toBe('75%')
    expect(formatPercent(72.456)).toBe('72.5%')
    expect(formatPercent(0)).toBe('0%')
    expect(formatPercent(null)).toBe('—')
  })

  it('derives initials and title casing', () => {
    expect(initials('Priya Raman')).toBe('PR')
    expect(initials('  arjun   rao ')).toBe('AR')
    expect(titleCase('bulk_status_updated')).toBe('Bulk Status Updated')
  })

  it('builds URL-safe slugs', () => {
    expect(slugify('Attendance — III CSE / 2026')).toBe('attendance-iii-cse-2026')
  })
})

describe('attendance presentation', () => {
  it('exposes a label and short code for every status', () => {
    expect(attendanceMeta.present).toMatchObject({ label: 'Present', short: 'P' })
    expect(attendanceMeta.absent).toMatchObject({ label: 'Absent', short: 'A' })
    expect(attendanceMeta.od).toMatchObject({ label: 'On duty', short: 'OD' })
    expect(attendanceMeta.leave).toMatchObject({ label: 'Leave', short: 'L' })
  })

  it('tones percentages relative to the threshold', () => {
    expect(percentageTone(80, 75)).toContain('emerald')
    expect(percentageTone(65, 75)).toContain('amber')
    expect(percentageTone(40, 75)).toContain('rose')
    expect(percentageBar(80)).toContain('emerald')
    expect(percentageBar(55)).toContain('rose')
  })
})
