export const EXPENSE_CATEGORIES = ['Food', 'Travel', 'Other'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
