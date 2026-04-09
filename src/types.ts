export interface Transaction {
  id: string;
  userId: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  notes?: string;
  date: string; // ISO string
  category?: string;
  walletId?: string;
  goalId?: string; // For saving to a goal
  createdAt: string; // ISO string
}

export interface Debt {
  id: string;
  userId: string;
  type: 'payable' | 'receivable';
  amount: number;
  expectedAmount?: number;
  description: string;
  status: 'unpaid' | 'paid';
  dueDate?: string; // ISO string
  createdAt: string;
}

export interface Goal {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string; // ISO string
  status: 'active' | 'completed';
  createdAt: string;
}

export interface Wallet {
  id: string;
  userId: string;
  name: string;
  initialBalance?: number;
  createdAt: string;
}

export interface CategoryGroup {
  id: string;
  userId: string;
  name: string;
  type: 'needs' | 'wants' | 'savings' | 'debts' | string;
  createdAt: string;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  type: 'income' | 'expense';
  groupId?: string;
  createdAt: string;
}

export interface Budget {
  id: string;
  userId: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  month: string; // Format: YYYY-MM
  createdAt: string;
}

export interface Asset {
  id: string;
  userId: string;
  name: string;
  type: string;
  currentValue: number;
  initialValue: number;
  notes?: string;
  createdAt: string;
}

export interface AppUser {
  id: string;
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  role: 'user' | 'admin';
  bottomNavTabs?: string[];
  createdAt: string;
}
