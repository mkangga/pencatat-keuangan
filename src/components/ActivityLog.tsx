import { Transaction } from '../types';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface ActivityLogProps {
  transactions: Transaction[];
  onViewDetail: (tx: Transaction) => void;
}

export default function ActivityLog({ transactions, onViewDetail }: ActivityLogProps) {
  const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
    return formatted.replace('Rp', 'Rp ');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6 font-sans">Log Aktivitas</h1>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 transition-colors duration-300">
        {transactions.length > 0 ? (
          <div className="space-y-4">
            {transactions.map(tx => (
              <div 
                key={tx.id} 
                onClick={() => onViewDetail(tx)}
                className="flex justify-between items-center p-4 border-b border-gray-50 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-xl transition-colors cursor-pointer gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 dark:text-gray-100 break-words">{tx.description}</p>
                  {tx.notes && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 break-words">{tx.notes}</p>
                  )}
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {format(new Date(tx.date), 'dd MMMM yyyy', { locale: id })}
                    {tx.category && ` • ${tx.category}`}
                  </p>
                </div>
                <div className={`font-bold whitespace-nowrap flex-shrink-0 ${tx.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {tx.type === 'income' ? '+' : '-'} {formatCurrency(tx.amount)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">Belum ada aktivitas.</p>
        )}
      </div>
    </div>
  );
}
