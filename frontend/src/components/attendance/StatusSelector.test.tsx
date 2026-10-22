import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { StatusSelector } from './StatusSelector'

describe('StatusSelector', () => {
  it('marks the selected status as pressed', () => {
    render(<StatusSelector value="present" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Present' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Absent' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('emits the chosen status', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<StatusSelector value={null} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'On duty' }))
    expect(onChange).toHaveBeenCalledWith('od')
  })

  it('does not emit when disabled', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<StatusSelector value="present" onChange={onChange} disabled />)
    await user.click(screen.getByRole('button', { name: 'Leave' }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
