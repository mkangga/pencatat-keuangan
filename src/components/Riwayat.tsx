import { useState, useMemo } from 'react';
import { Transaction } from '../types';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { id } from 'date-fns/locale';
import { ChevronRight, Search, Filter, PlusCircle, MinusCircle, Calendar, X } from 'lucide-react';
import TransactionList from './TransactionList';

const safeParseDate = (dateStr: string) => {
  try {
    const parsed = parseISO(dateStr);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  } catch {
    return new Date();
  }
};

interface RiwayatProps {
  transactions: Transaction[];
  onViewDetail: (tx: Transaction) => void;
  onEdit?: (tx: Transaction) => void;
}

export default function Riwayat({ transactions, onViewDetail, onEdit }: RiwayatProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterCategory, setFilterCategory] = useState('');
  const [dateFilter, setDateFilter] = useState<string>('all');

  const categories = useMemo(() => {
    const cats = transactions
      .filter(t => filterType === 'all' || t.type === filterType)
      .map(t => t.category || 'Tanpa Kategori');
    return Array.from(new Set(cats)).sort();
  }, [transactions, filterType]);

  const availableMonths = useMemo(() => {
    const months = transactions.map(t => format(parseISO(t.date), 'yyyy-MM'));
    const uniqueMonths = Array.from(new Set(months)).sort((a, b) => b.localeCompare(a));
    return uniqueMonths.map(m => ({
      value: m,
      label: format(parseISO(`${m}-01`), 'MMMM yyyy', { locale: id })
    }));
  }, [transactions]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.abs(amount));
  };

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter(t => {
        const matchesSearch = t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (t.category && t.category.toLowerCase().includes(searchQuery.toLowerCase()));
        
        const matchesType = filterType === 'all' || t.type === filterType;
        const matchesCategory = !filterCategory || t.category === filterCategory;
        
        let matchesDate = true;
        if (dateFilter !== 'all') {
          const tMonth = format(parseISO(t.date), 'yyyy-MM');
          matchesDate = tMonth === dateFilter;
        }

        return matchesSearch && matchesType && matchesCategory && matchesDate;
      })
      .sort((a, b) => {
        const dateA = safeParseDate(a.date).getTime();
        const dateB = safeParseDate(b.date).getTime();
        if (dateB !== dateA) return dateB - dateA;
        
        const createdAtA = a.createdAt ? safeParseDate(a.createdAt).getTime() : 0;
        const createdAtB = b.createdAt ? safeParseDate(b.createdAt).getTime() : 0;
        return createdAtB - createdAtA;
      });
  }, [transactions, searchQuery, filterType, dateFilter]);

  const totals = useMemo(() => {
    return filteredTransactions.reduce((acc, t) => {
      if (t.type === 'income' && t.category !== 'Pindah Saldo') acc.income += t.amount;
      if (t.type === 'expense' && t.category !== 'Pindah Saldo') acc.expense += t.amount;
      return acc;
    }, { income: 0, expense: 0 });
  }, [filteredTransactions]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header Section */}
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 font-sans">Riwayat Transaksi</h1>
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
              {filteredTransactions.length} Transaksi
            </span>
          </div>
        </div>

        {/* Search and Quick Filters */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-purple-500 transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Cari kategori atau deskripsi..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-purple-500/20 text-gray-800 dark:text-gray-100 transition-all"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-gray-400"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
              <select 
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value as any);
                  setFilterCategory('');
                }}
                className="px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl text-xs font-bold outline-none text-gray-700 dark:text-gray-300 min-w-[100px]"
              >
                <option value="all">Semua Tipe</option>
                <option value="income">Pemasukan</option>
                <option value="expense">Pengeluaran</option>
              </select>

              <select 
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl text-xs font-bold outline-none text-gray-700 dark:text-gray-300 min-w-[120px]"
              >
                <option value="">Semua Kategori</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              <select 
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl text-xs font-bold outline-none text-gray-700 dark:text-gray-300 min-w-[120px]"
              >
                <option value="all">Semua Waktu</option>
                {availableMonths.map(month => (
                  <option key={month.value} value={month.value}>{month.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Summary Bar */}
          <div className="bg-purple-50/50 dark:bg-purple-900/10 px-4 py-3 rounded-xl border border-purple-100/50 dark:border-purple-900/20">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <PlusCircle size={14} strokeWidth={2.5} />
                  <span>+{formatCurrency(totals.income)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-red-500 dark:text-red-400">
                  <MinusCircle size={14} strokeWidth={2.5} />
                  <span>-{formatCurrency(totals.expense)}</span>
                </div>
              </div>
              <div className={`flex items-center gap-1.5 ${totals.income - totals.expense >= 0 ? 'text-purple-600 dark:text-purple-400' : 'text-red-600 dark:text-red-400'}`}>
                <span>Selisih: {totals.income - totals.expense >= 0 ? '+' : ''}{formatCurrency(totals.income - totals.expense)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction List */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6 transition-colors duration-300">
        {filteredTransactions.length > 0 ? (
          <TransactionList 
            transactions={filteredTransactions} 
            type="all" 
            onViewDetail={onViewDetail} 
            onEdit={onEdit} 
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-300 dark:text-gray-700">
              <Calendar size={32} />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">Tidak ada riwayat</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs">
                {searchQuery || filterType !== 'all' || dateFilter !== 'all' 
                  ? "Tidak ada transaksi yang sesuai dengan filter pencarian Anda." 
                  : "Mulai catat transaksi Anda untuk melihat riwayat di sini."}
              </p>
            </div>
            {(searchQuery || filterType !== 'all' || filterCategory !== '' || dateFilter !== 'all') && (
              <button 
                onClick={() => {
                  setSearchQuery('');
                  setFilterType('all');
                  setFilterCategory('');
                  setDateFilter('all');
                }}
                className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline"
              >
                Reset Filter
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
