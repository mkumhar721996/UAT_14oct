import { createContext, useContext, type ReactNode } from 'react'

export type ActorRole = 'hiring_manager' | 'recruiter' | 'hr_admin'

export interface Actor {
  id: string
  name: string
  role: ActorRole
}

export const ROLE_LABELS: Record<ActorRole, string> = {
  hiring_manager: 'Hiring Manager',
  recruiter: 'Recruiter',
  hr_admin: 'HR Admin',
}

export const isReviewer = (actor: Actor) => actor.role !== 'hiring_manager'

/**
 * Temporary stand-in for a real signed-in session (see the API's ActorMiddleware).
 * Choose a dev identity with VITE_ACTOR_ROLE=hiring_manager|recruiter|hr_admin.
 */
const DEV_ACTORS: Record<ActorRole, Actor> = {
  hiring_manager: { id: 'priya', name: 'Priya Nathan', role: 'hiring_manager' },
  hr_admin: { id: 'morgan', name: 'Morgan Clarke', role: 'hr_admin' },
  recruiter: { id: 'devon', name: 'Devon Blake', role: 'recruiter' },
}

const configuredRole = import.meta.env.VITE_ACTOR_ROLE as ActorRole | undefined
const DEFAULT_ACTOR = DEV_ACTORS[configuredRole ?? 'hiring_manager'] ?? DEV_ACTORS.hiring_manager

const ActorContext = createContext<Actor>(DEFAULT_ACTOR)

export function ActorProvider({ actor = DEFAULT_ACTOR, children }: { actor?: Actor; children: ReactNode }) {
  return <ActorContext.Provider value={actor}>{children}</ActorContext.Provider>
}

export function useActor(): Actor {
  return useContext(ActorContext)
}
