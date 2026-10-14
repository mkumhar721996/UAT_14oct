import { fireEvent } from '@testing-library/react'

/** Tiny stand-in for user-event (not installed) built on fireEvent. */
export const userEvent = {
  setup: () => ({
    type: async (el: HTMLElement, text: string) => {
      fireEvent.change(el, { target: { value: text } })
    },
    selectOptions: async (el: HTMLElement, value: string) => {
      fireEvent.change(el, { target: { value } })
    },
    click: async (el: HTMLElement) => {
      fireEvent.click(el)
    },
  }),
}
