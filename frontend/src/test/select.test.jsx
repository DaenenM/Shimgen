/**
 * The site's one dropdown. Every setting that picks from a list goes through
 * it, so opening, picking, skipping what is disabled and closing again are
 * pinned here rather than trusted to each page.
 */

import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Select } from '@/components/ui/Select'

const OPTIONS = [
  { value: 1, label: 'Single game' },
  { value: 3, label: 'Best of 3', disabled: true, hint: 'soon' },
  { value: 5, label: 'Best of 5' },
]

function Harness({ initial = 1 }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <Select label="Games" value={value} onChange={setValue} options={OPTIONS} />
      <output data-testid="value">{String(value)}</output>
    </>
  )
}

const trigger = () => screen.getByRole('button', { name: 'Games' })

describe('Select', () => {
  it('shows the chosen option on the trigger', () => {
    render(<Harness initial={5} />)
    expect(trigger().textContent).toContain('Best of 5')
  })

  it('opens a listbox with the chosen option marked', () => {
    render(<Harness />)
    fireEvent.click(trigger())

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(3)
    expect(options[0].getAttribute('aria-selected')).toBe('true')
    expect(trigger().getAttribute('aria-expanded')).toBe('true')
  })

  it('picks with the pointer and closes', () => {
    render(<Harness />)
    fireEvent.click(trigger())
    fireEvent.mouseDown(screen.getByRole('option', { name: /Best of 5/ }))

    expect(screen.getByTestId('value').textContent).toBe('5')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('will not pick a disabled option', () => {
    render(<Harness />)
    fireEvent.click(trigger())
    fireEvent.mouseDown(screen.getByRole('option', { name: /Best of 3/ }))

    expect(screen.getByTestId('value').textContent).toBe('1')
  })

  it('steps over disabled options with the keyboard', () => {
    render(<Harness />)
    fireEvent.keyDown(trigger(), { key: 'ArrowDown' })
    fireEvent.keyDown(trigger(), { key: 'ArrowDown' })
    fireEvent.keyDown(trigger(), { key: 'Enter' })

    expect(screen.getByTestId('value').textContent).toBe('5')
  })

  it('closes on Escape without changing the value', () => {
    render(<Harness />)
    fireEvent.click(trigger())
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('listbox')).toBeNull()
    expect(screen.getByTestId('value').textContent).toBe('1')
  })

  it('closes on a click elsewhere', () => {
    render(<Harness />)
    fireEvent.click(trigger())
    fireEvent.mouseDown(document.body)

    expect(screen.queryByRole('listbox')).toBeNull()
  })
})

function Segments() {
  const [value, setValue] = useState('solo')
  return (
    <SegmentedControl
      label="Who is entering"
      value={value}
      onChange={setValue}
      options={[
        ['solo', 'Solo'],
        ['teams', 'Teams'],
        ['captains', 'Captains'],
      ]}
    />
  )
}

describe('SegmentedControl', () => {
  const radio = (name) => screen.getByRole('radio', { name })

  it('is a radiogroup with the chosen option checked and the only tab stop', () => {
    render(<Segments />)

    expect(screen.getByRole('radiogroup', { name: 'Who is entering' })).toBeTruthy()
    expect(radio('Solo').getAttribute('aria-checked')).toBe('true')
    expect(radio('Solo').tabIndex).toBe(0)
    expect(radio('Teams').tabIndex).toBe(-1)
  })

  it('chooses on click', () => {
    render(<Segments />)
    fireEvent.click(radio('Teams'))

    expect(radio('Teams').getAttribute('aria-checked')).toBe('true')
    expect(radio('Solo').getAttribute('aria-checked')).toBe('false')
  })

  it('moves with the arrow keys and wraps at the ends', () => {
    render(<Segments />)
    const group = screen.getByRole('radiogroup')

    fireEvent.keyDown(group, { key: 'ArrowLeft' })
    expect(radio('Captains').getAttribute('aria-checked')).toBe('true')

    fireEvent.keyDown(group, { key: 'ArrowRight' })
    expect(radio('Solo').getAttribute('aria-checked')).toBe('true')

    fireEvent.keyDown(group, { key: 'End' })
    expect(radio('Captains').getAttribute('aria-checked')).toBe('true')
  })
})
