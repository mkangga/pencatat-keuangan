import { useState, useMemo } from 'react';
import { Transaction } from '../types';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { id } from 'date-fns/locale';
import { ChevronRight, Search, Filter, PlusCircle, MinusCircle, Calendar, X } from 'lucide-react';

interface RiwayatProps {
  transactions: Transaction[];
  onViewDetail: (tx: Transaction) => void;
}

export default function Riwayat({ transactions, onViewDetail }: RiwayatProps) {
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
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateB !== dateA) return dateB - dateA;
        
        const createdAtA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const createdAtB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-32">
      {/* Header Section */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 sticky top-0 z-20 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Riwayat Transaksi</h1>
            <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
                {filteredTransactions.length} Transaksi
              </span>
            </div>
          </div>

          {/* Search and Quick Filters */}
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
        </div>

        {/* Summary Bar */}
        <div className="bg-purple-50/50 dark:bg-purple-900/10 px-4 py-2 border-t border-purple-100/50 dark:border-purple-900/20">
          <div className="max-w-4xl mx-auto flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <PlusCircle size={12} strokeWidth={3} />
                <span>+{formatCurrency(totals.income)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-red-500 dark:text-red-400">
                <MinusCircle size={12} strokeWidth={3} />
                <span>-{formatCurrency(totals.expense)}</span>
              </div>
            </div>
            <div className={`flex items-center gap-1.5 ${totals.income - totals.expense >= 0 ? 'text-purple-600 dark:text-purple-400' : 'text-red-600 dark:text-red-400'}`}>
              <span>Selisih: {totals.income - totals.expense >= 0 ? '+' : ''}{formatCurrency(totals.income - totals.expense)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction List */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        {sortedDates.length > 0 ? (
          sortedDates.map(dateStr => {
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
                    {income > 0 && <span className="text-emerald-600 dark:text-emerald-400">+{formatCurrency(income)}</span>}
                    {expense > 0 && <span className="text-gray-400 dark:text-gray-500">-{formatCurrency(expense)}</span>}
                    <div className="h-3 w-px bg-gray-200 dark:bg-gray-700 mx-0.5" />
                    <span className={income - expense >= 0 ? 'text-purple-600 dark:text-purple-400' : 'text-red-500 dark:text-red-400'}>
                      {income - expense >= 0 ? '+' : ''}{formatCurrency(income - expense)}
                    </span>
                  </div>
                </div>

                {/* Transactions Card */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                  <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
                    {dayTransactions.map(tx => (
                      <div 
                        key={tx.id} 
                        onClick={() => onViewDetail(tx)}
                        className="px-5 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-all cursor-pointer group active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center ${
                            tx.type === 'income' 
                              ? 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-500' 
                              : 'bg-red-500/10 dark:bg-red-500/20 text-red-500'
                          }`}>
                            {tx.type === 'income' ? <PlusCircle size={20} strokeWidth={2.5} /> : <MinusCircle size={20} strokeWidth={2.5} />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-gray-800 dark:text-gray-100 text-sm truncate">{tx.category || 'Tanpa Kategori'}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                {format(parseISO(tx.date), 'HH:mm')}
                              </span>
                              <span className="text-gray-300 dark:text-gray-600">•</span>
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {tx.description}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 ml-4">
                          <span className={`font-black text-sm whitespace-nowrap ${
                            tx.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-800 dark:text-gray-100'
                          }`}>
                            {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                          </span>
                          <ChevronRight size={18} className="text-gray-300 group-hover:text-gray-400 group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-24 px-6 text-center space-y-4">
            <div className="p-6 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-300 dark:text-gray-700">
              <Calendar size={48} />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Tidak ada riwayat</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
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
                className="text-sm font-bold text-purple-600 dark:text-purple-400 hover:underline"
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
