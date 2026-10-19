import { useState } from 'react'
import { Icon } from './CustomerHeader'

/** Password input with the design's show/hide toggle; extra props (id, autoComplete, aria-*) go to the input. */
export function PasswordField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [shown, setShown] = useState(false)
  return (
    <div className="password-field">
      <input {...props} className={'input' + (props.className ? ` ${props.className}` : '')} type={shown ? 'text' : 'password'} />
      <button
        type="button"
        className="password-toggle"
        aria-label={shown ? 'Hide password' : 'Show password'}
        onClick={() => setShown((s) => !s)}
      >
        <Icon name="eye" />
      </button>
    </div>
  )
}
