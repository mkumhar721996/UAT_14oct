// Re-exported from DrupalModule's token so this route's guard-protected controller and
// PagesService (the in-process consumer that actually refetches on a stale tag) share the
// exact same registry instance instead of each getting an independent, disconnected one.
export { REVALIDATION_REGISTRY } from '../drupal/drupal.tokens';
