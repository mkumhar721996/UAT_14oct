import type { JsonApiResourceIdentifier } from './jsonapi-types';
import type { TypedFetcher } from './typed-fetcher';

export interface ResourceRegistration<T> {
  jsonApiType: string;
  fetcher: TypedFetcher<T>;
  componentKey?: string;
}

export interface ResolvedResource<T = unknown> {
  status: 'resolved';
  jsonApiType: string;
  componentKey?: string;
  data: T;
}

export interface UnresolvedResource {
  status: 'unresolved';
  jsonApiType: string;
}

export interface FailedResource {
  status: 'failed';
  jsonApiType: string;
  error: string;
}

export function createResourceRegistry() {
  const entries = new Map<string, ResourceRegistration<unknown>>();
  return {
    register<T>(registration: ResourceRegistration<T>): void {
      if (entries.has(registration.jsonApiType)) {
        throw new Error(`A fetcher is already registered for JSON:API type "${registration.jsonApiType}"`);
      }
      entries.set(registration.jsonApiType, registration as ResourceRegistration<unknown>);
    },
    resolve(jsonApiType: string): ResourceRegistration<unknown> | undefined {
      return entries.get(jsonApiType);
    },
  };
}

export type ResourceRegistry = ReturnType<typeof createResourceRegistry>;

// Unregistered types ('unresolved') and fetch/parse errors ('failed') become per-item markers
// rather than throwing, so siblings still resolve.
export async function resolveResources(
  registry: ResourceRegistry,
  resources: readonly JsonApiResourceIdentifier[],
  env?: NodeJS.ProcessEnv,
): Promise<Array<ResolvedResource<unknown> | UnresolvedResource | FailedResource>> {
  return Promise.all(
    resources.map(async (resource): Promise<ResolvedResource<unknown> | UnresolvedResource | FailedResource> => {
      const registration = registry.resolve(resource.type);
      if (!registration) {
        return { status: 'unresolved', jsonApiType: resource.type };
      }
      try {
        const data = await registration.fetcher.fetchById(resource.id, env);
        return { status: 'resolved', jsonApiType: resource.type, componentKey: registration.componentKey, data };
      } catch (error) {
        return {
          status: 'failed',
          jsonApiType: resource.type,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );
}
