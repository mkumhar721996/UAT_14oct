export const DEFECT_SEVERITIES = ['Critical', 'High', 'Medium', 'Low'] as const;
export type DefectSeverity = (typeof DEFECT_SEVERITIES)[number];
