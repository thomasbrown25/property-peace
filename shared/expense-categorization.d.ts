export interface ExpenseCategorySuggestion {
  category: string;
  name: string;
}

export function categorizeExpense(description?: string): ExpenseCategorySuggestion;
