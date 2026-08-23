import type { DashboardStackParamList } from '../../navigation/types';

export const addExpenseDashboardAction = {
  icon: 'receipt-outline',
  title: 'Add expense',
  subtitle: 'Record a property expense',
  color: '#8a5a12',
  background: '#fff7e8',
} as const;

type DashboardRoute = keyof DashboardStackParamList;

export function navigateToAddExpense(
  navigate: (route: DashboardRoute) => void,
): void {
  navigate('AddExpense');
}
