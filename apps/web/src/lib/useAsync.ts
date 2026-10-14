import { useCallback, useEffect, useState } from 'react'

/** Runs `load` on mount; `reload` re-runs it. */
export function useAsync<T>(load: () => Promise<T>) {
  const [state, setState] = useState<{ data?: T; error?: Error; loading: boolean }>({ loading: true })
  const run = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: undefined }))
    load().then(
      (data) => setState({ data, loading: false }),
      (error: Error) => setState({ error, loading: false }),
    )
  }, [])
  useEffect(run, [run])
  return { ...state, reload: run }
}
