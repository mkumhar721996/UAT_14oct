import type { DefectSeverity } from './types'

export const DEFECT_SEVERITIES: DefectSeverity[] = ['Critical', 'High', 'Medium', 'Low']

export const SEVERITY_META: Record<DefectSeverity, { icon: string; className: string }> = {
  Critical: { icon: '⛔', className: 'sev-critical' },
  High: { icon: '▲', className: 'sev-high' },
  Medium: { icon: '◆', className: 'sev-medium' },
  Low: { icon: '▽', className: 'sev-low' },
}

export const REQUIRED_DEFECT_FIELDS = [
  { key: 'title', label: 'Title', message: 'Enter a title for the defect.' },
  { key: 'description', label: 'Description', message: 'Describe the defect.' },
  { key: 'severity', label: 'Severity', message: 'Choose a severity.' },
  { key: 'reproSteps', label: 'Steps to reproduce', message: 'Describe the steps to reproduce the defect.' },
] as const
