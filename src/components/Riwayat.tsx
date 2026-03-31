import { useState } from 'react';
import { Transaction } from '../types';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { ChevronRight } from 'lucide-react';

interface RiwayatProps {
  transactions: Transaction[];
  onViewDetail: (tx: Transaction) => void;
}

export default function Riwayat({ transactions, onViewDetail }: RiwayatProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.abs(amount));
  };

  const filteredTransactions = transactions.filter(t => 
    t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.category && t.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Group by date
  const groupedTransactions = filteredTransactions.reduce((groups: { [key: string]: Transaction[] }, transaction) => {
    const date = format(parseISO(transaction.date), 'yyyy-MM-dd');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(transaction);
    return groups;
  }, {});

  const sortedDates = Object.keys(groupedTransactions).sort((a, b) => b.localeCompare(a));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
      {/* Search Bar */}
      <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <div className="relative flex-1">
          <input 
            type="text" 
            placeholder="Pencarian" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-4 pr-10 py-2 bg-transparent text-gray-800 dark:text-gray-100 outline-none placeholder-gray-400"
          />
        </div>
      </div>

      {/* Transaction List */}
      <div className="space-y-4">
        {sortedDates.length > 0 ? (
          sortedDates.map(dateStr => {
            const dateObj = parseISO(dateStr);
            const dayNum = format(dateObj, 'dd');
            const monthYear = format(dateObj, 'MM yyyy');
            const dayName = format(dateObj, 'EEEE', { locale: id });
            
            const dayTransactions = groupedTransactions[dateStr];
            const income = dayTransactions.filter(t => t.type === 'income' && t.category !== 'Pindah Saldo').reduce((sum, t) => sum + t.amount, 0);
            const expense = dayTransactions.filter(t => t.type === 'expense' && t.category !== 'Pindah Saldo').reduce((sum, t) => sum + t.amount, 0);
            const net = income - expense;

            return (
              <div key={dateStr} className="bg-white dark:bg-gray-800 shadow-sm">
                {/* Date Header */}
                <div className="px-4 py-3 border-b border-gray-50 dark:border-gray-700 flex items-center gap-4 bg-gray-50/50 dark:bg-gray-800/50">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-bold text-gray-600 dark:text-gray-300">{dayNum}</span>
                    <div className="bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded text-[10px] text-gray-600 dark:text-gray-300 leading-tight">
                      <div>{monthYear}</div>
                      <div className="font-bold">{dayName}</div>
                    </div>
                  </div>
                  
                  <div className="flex-1 flex justify-end gap-4 sm:gap-6">
                    <div className="text-right flex flex-col justify-center">
                      <span className="text-[10px] uppercase text-gray-500 dark:text-gray-400 font-bold leading-none mb-1">Masuk</span>
                      <span className="text-xs font-bold leading-none text-emerald-600 dark:text-emerald-400">
                        +{formatCurrency(income)}
                      </span>
                    </div>
                    <div className="text-right flex flex-col justify-center">
                      <span className="text-[10px] uppercase text-gray-500 dark:text-gray-400 font-bold leading-none mb-1">Keluar</span>
                      <span className="text-xs font-bold leading-none text-gray-600 dark:text-gray-300">
                        -{formatCurrency(expense)}
                      </span>
                    </div>
                    <div className="text-right flex flex-col justify-center">
                      <span className="text-[10px] uppercase text-gray-500 dark:text-gray-400 font-bold leading-none mb-1">Selisih</span>
                      <span className={`text-xs font-bold leading-none ${net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {net >= 0 ? '+' : '-'}{formatCurrency(net)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Transactions */}
                <div className="divide-y divide-gray-50 dark:divide-gray-700">
                  {dayTransactions.map(tx => (
                    <div 
                      key={tx.id} 
                      onClick={() => onViewDetail(tx)}
                      className="px-4 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-700 dark:text-gray-200 text-sm">{tx.category || 'Tanpa Kategori'}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                          {format(parseISO(tx.date), 'HH:mm', { locale: id })} • {tx.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-bold text-sm ${tx.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-300'}`}>
                          {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                        </span>
                        <ChevronRight size={18} className="text-gray-300 group-hover:text-gray-400 transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-20 text-gray-500 dark:text-gray-400">
            Belum ada riwayat transaksi.
          </div>
        )}
      </div>
    </div>
  );
}
