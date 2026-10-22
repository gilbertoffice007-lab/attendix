import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AttendanceBadge, ListStatusBadge } from './Badge'
import { ProgressBar } from './ProgressBar'
import { Pagination } from './Pagination'
import type { StatusOption } from '@/types'

const options: StatusOption[] = [
  { key: 'done', label: 'Completed', color: 'green' },
  { key: 'todo', label: 'Not started', color: 'slate' },
]

describe('AttendanceBadge', () => {
  it('renders the human label and dot', () => {
    render(<AttendanceBadge status="od" />)
    expect(screen.getByText('On duty')).toBeInTheDocument()
  })
})

describe('ListStatusBadge', () => {
  it('resolves custom list status labels', () => {
    render(<ListStatusBadge status="done" options={options} />)
    expect(screen.getByText('Completed')).toBeInTheDocument()
  })

  it('falls back to the raw key for unknown statuses', () => {
    render(<ListStatusBadge status="unknown" options={options} />)
    expect(screen.getByText('unknown')).toBeInTheDocument()
  })
})

describe('ProgressBar', () => {
  it('clamps the value and exposes it accessibly', () => {
    render(<ProgressBar value={140} threshold={75} showThreshold />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '100')
    expect(screen.getByTitle('Threshold 75%')).toBeInTheDocument()
  })
})

describe('Pagination', () => {
  it('reports the visible range and page changes', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(
      <Pagination page={1} pageSize={10} total={25} onPageChange={onPageChange} />,
    )
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })
})
