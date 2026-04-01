import { useMemo } from 'react';
import { Transaction } from '../types';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import TransactionList from './TransactionList';
import { Calendar } from 'lucide-react';

const safeParseDate = (dateStr: string) => {
  try {
    const parsed = parseISO(dateStr);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  } catch {
    return new Date();
  }
};

interface GroupedTransactionListProps {
  transactions: Transaction[];
  onViewDetail: (tx: Transaction) => void;
  onEdit?: (tx: Transaction) => void;
  emptyMessage?: string;
  hideGroupHeader?: boolean;
  type?: 'all' | 'income' | 'expense';
}

export default function GroupedTransactionList({ 
  transactions, 
  onViewDetail, 
  onEdit, 
  emptyMessage = "Belum ada data transaksi.", 
  hideGroupHeader = false,
  type = 'all'
}: GroupedTransactionListProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.abs(amount));
  };

  const groupedTransactions = useMemo(() => {
    return transactions.reduce((groups: { [key: string]: Transaction[] }, transaction) => {
      const dateObj = safeParseDate(transaction.date);
      const date = format(dateObj, 'yyyy-MM-dd');
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(transaction);
      return groups;
    }, {});
  }, [transactions]);

  const sortedDates = useMemo(() => Object.keys(groupedTransactions).sort((a, b) => b.localeCompare(a)), [groupedTransactions]);

  if (transactions.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6 transition-colors duration-300">
        <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
          <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-300 dark:text-gray-700">
            <Calendar size={32} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">Tidak ada transaksi</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs">
              {emptyMessage}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (hideGroupHeader || sortedDates.length <= 1) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6 transition-colors duration-300">
        <TransactionList 
          transactions={transactions} 
          type={type} 
          onViewDetail={onViewDetail} 
          onEdit={onEdit} 
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {sortedDates.map(dateStr => {
        const dateObj = parseISO(dateStr);
        const dayNum = format(dateObj, 'dd');
        const dayName = format(dateObj, 'EEEE', { locale: id });
        const monthYear = format(dateObj, 'MMMM yyyy', { locale: id });
        
        const dayTransactions = groupedTransactions[dateStr];
        const income = dayTransactions.filter(t => t.type === 'income' && t.category !== 'Pindah Saldo').reduce((sum, t) => sum + t.amount, 0);
        const expense = dayTransactions.filter(t => t.type === 'expense' && t.category !== 'Pindah Saldo').reduce((sum, t) => sum + t.amount, 0);

        return (
          <div key={dateStr} className="space-y-3">
            {/* Date Header */}
            <div className="flex items-end justify-between px-2">
              <div className="flex items-center gap-3">
                <span className="text-4xl font-black text-gray-200 dark:text-gray-700 leading-none">{dayNum}</span>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">{dayName}</span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-medium">{monthYear}</span>
                </div>
              </div>
              <div className="flex gap-3 text-[10px] font-bold items-center">
                {type === 'income' ? (
                  <span className="text-emerald-600 dark:text-emerald-400">+{formatCurrency(income)}</span>
                ) : type === 'expense' ? (
                  <span className="text-red-500 dark:text-red-400">-{formatCurrency(expense)}</span>
                ) : (
                  <>
                    {income > 0 && <span className="text-emerald-600 dark:text-emerald-400">+{formatCurrency(income)}</span>}
                    {expense > 0 && <span className="text-gray-400 dark:text-gray-500">-{formatCurrency(expense)}</span>}
                    <div className="h-3 w-px bg-gray-200 dark:bg-gray-700 mx-0.5" />
                    <span className={income - expense >= 0 ? 'text-purple-600 dark:text-purple-400' : 'text-red-500 dark:text-red-400'}>
                      {income - expense >= 0 ? '+' : ''}{formatCurrency(income - expense)}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Transactions Card */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6 transition-colors duration-300">
              <TransactionList 
                transactions={dayTransactions} 
                type={type} 
                onViewDetail={onViewDetail} 
                onEdit={onEdit} 
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
