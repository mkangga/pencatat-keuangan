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
  createdAt: string; // ISO string
}

export interface Debt {
  id: string;
  userId: string;
  type: 'payable' | 'receivable';
  amount: number;
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
  walletId?: string;
  createdAt: string;
}

export interface Wallet {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  type: 'income' | 'expense';
  createdAt: string;
}
