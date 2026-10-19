export const DEFECT_PRIORITIES = ['P1', 'P2', 'P3', 'P4'] as const;
export type DefectPriority = (typeof DEFECT_PRIORITIES)[number];
