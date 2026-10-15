export const ACTOR_ROLES = ['hiring_manager', 'recruiter', 'hr_admin'] as const;

export type ActorRole = (typeof ACTOR_ROLES)[number];

export interface Actor {
  id: string;
  role: ActorRole;
}

export interface ActorRequest {
  headers: Record<string, string | string[] | undefined>;
  actor?: Actor;
}
