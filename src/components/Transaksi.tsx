import { useState } from 'react';
import { User } from 'firebase/auth';
import { Transaction } from '../types';
import TransactionList from './TransactionList';
import { format, isSameDay, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { Calendar } from 'lucide-react';

interface TransaksiProps {
  transactions: Transaction[];
  searchedTransactions: Transaction[];
  onEdit: (tx: Transaction) => void;
  onViewDetail: (tx: Transaction) => void;
}

export default function Transaksi({ transactions, searchedTransactions, onEdit, onViewDetail }: TransaksiProps) {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const safeParseDate = (dateStr: string) => {
    try {
      const parsed = parseISO(dateStr);
      return isNaN(parsed.getTime()) ? new Date() : parsed;
    } catch {
      return new Date();
    }
  };

  const filteredTransactions = transactions.filter(t => 
    isSameDay(safeParseDate(t.date), safeParseDate(selectedDate))
  );

  const searchedFilteredTransactions = searchedTransactions.filter(t => 
    isSameDay(safeParseDate(t.date), safeParseDate(selectedDate))
  );

  const incomeTransactions = filteredTransactions.filter(t => t.type === 'income');
  const expenseTransactions = filteredTransactions.filter(t => t.type === 'expense');
  const allTransactions = [...searchedFilteredTransactions].sort((a, b) => {
    const dateA = safeParseDate(a.date).getTime();
    const dateB = safeParseDate(b.date).getTime();
    return dateB - dateA;
  });

  const totalIncome = incomeTransactions.reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpense = expenseTransactions.reduce((acc, curr) => acc + curr.amount, 0);
  const balance = totalIncome - totalExpense;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl">
            <Calendar size={20} />
          </div>
          <div>
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">Pilih Tanggal</h2>
            <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
              {format(safeParseDate(selectedDate), 'EEEE, d MMM yyyy', { locale: id })}
            </p>
          </div>
        </div>
        <input 
          type="date" 
          value={selectedDate} 
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500 text-gray-800 dark:text-gray-100 transition-all"
        />
      </div>

      <div className="bg-gradient-to-br from-purple-600 to-indigo-700 text-white p-6 rounded-3xl shadow-xl border border-purple-400/20">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-semibold tracking-wide uppercase opacity-80">
            Ringkasan Transaksi
          </h2>
          <span className="text-xs bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm font-medium">
            {format(safeParseDate(selectedDate), 'd MMM yyyy', { locale: id })}
          </span>
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col items-center text-center space-y-1">
            <p className="text-[10px] uppercase tracking-wider opacity-70 font-bold">Pemasukan</p>
            <p className="text-sm sm:text-lg font-extrabold truncate w-full">
              + {totalIncome.toLocaleString('id-ID')}
            </p>
          </div>
          <div className="flex flex-col items-center text-center space-y-1 border-x border-white/10">
            <p className="text-[10px] uppercase tracking-wider opacity-70 font-bold">Pengeluaran</p>
            <p className="text-sm sm:text-lg font-extrabold truncate w-full">
              - {totalExpense.toLocaleString('id-ID')}
            </p>
          </div>
          <div className="flex flex-col items-center text-center space-y-1">
            <p className="text-[10px] uppercase tracking-wider opacity-70 font-bold">Selisih</p>
            <p className={`text-sm sm:text-lg font-extrabold truncate w-full ${balance >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
              {balance >= 0 ? '+' : ''}{balance.toLocaleString('id-ID')}
            </p>
          </div>
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 transition-colors duration-300">
        <TransactionList transactions={allTransactions} type="all" onEdit={onEdit} onViewDetail={onViewDetail} />
      </div>
    </div>
  );
}
