export const SERVICE_TYPES = ['Faucet repair', 'Drain cleaning', 'Water heater install', 'AC tune-up'] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];
