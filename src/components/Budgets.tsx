import React, { useState, useEffect, FormEvent, useMemo } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Transaction, Category, Budget } from '../types';
import { Target, Plus, Edit2, Trash2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, addMonths, subMonths } from 'date-fns';
import { id } from 'date-fns/locale';
import ConfirmModal from './ConfirmModal';

interface BudgetsProps {
  user: User;
  categories: Category[];
  transactions: Transaction[];
}

export default function Budgets({ user, categories, transactions }: BudgetsProps) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentMonthStr = format(currentDate, 'yyyy-MM');
  const expenseCategories = categories.filter(c => c.type === 'expense');

  useEffect(() => {
    if (!user) return;
    
    const q = query(
      collection(db, 'budgets'),
      where('userId', '==', user.uid),
      where('month', '==', currentMonthStr)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const budgetData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Budget));
      setBudgets(budgetData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'budgets');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, currentMonthStr]);

  const handlePrevMonth = () => setCurrentDate(prev => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentDate(prev => addMonths(prev, 1));

  const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
    return formatted.replace('Rp', 'Rp ');
  };

  const parseNominal = (value: string) => {
    return value.replace(/[^0-9]/g, '');
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = parseNominal(e.target.value);
    if (rawValue) {
      const formatted = new Intl.NumberFormat('id-ID').format(Number(rawValue));
      setAmount(formatted);
    } else {
      setAmount('');
    }
  };

  const openAddModal = () => {
    setEditingBudget(null);
    setCategoryId('');
    setAmount('');
    setIsModalOpen(true);
  };

  const openEditModal = (budget: Budget) => {
    setEditingBudget(budget);
    setCategoryId(budget.categoryId);
    setAmount(new Intl.NumberFormat('id-ID').format(budget.amount));
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(parseNominal(amount));
    if (!numericAmount || !categoryId) return;
    
    setIsSubmitting(true);
    try {
      const selectedCategory = categories.find(c => c.id === categoryId);
      const categoryName = selectedCategory ? selectedCategory.name : 'Unknown';

      const budgetData = {
        categoryId,
        categoryName,
        amount: numericAmount,
      };

      if (editingBudget) {
        updateDoc(doc(db, 'budgets', editingBudget.id), budgetData)
          .catch(error => handleFirestoreError(error, OperationType.WRITE, 'budgets'));
      } else {
        // Check if budget already exists for this category and month
        const existingBudget = budgets.find(b => b.categoryId === categoryId);
        if (existingBudget) {
          updateDoc(doc(db, 'budgets', existingBudget.id), {
            amount: numericAmount,
          }).catch(error => handleFirestoreError(error, OperationType.WRITE, 'budgets'));
        } else {
          addDoc(collection(db, 'budgets'), {
            userId: user.uid,
            ...budgetData,
            month: currentMonthStr,
            createdAt: serverTimestamp()
          }).catch(error => handleFirestoreError(error, OperationType.WRITE, 'budgets'));
        }
      }
      setIsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'budgets');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, 'budgets', deleteId));
      setDeleteId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `budgets/${deleteId}`);
    }
  };

  // Calculate realizations
  const budgetRealizations = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    
    // Filter expenses for the current month
    const monthExpenses = transactions.filter(t => {
      if (t.type !== 'expense') return false;
      const tDate = parseISO(t.date);
      return isWithinInterval(tDate, { start, end });
    });

    return budgets.map(budget => {
      // Sum expenses for this budget's category
      // Note: Transaction category is stored as category name, not ID.
      // We should match by categoryName.
      const spent = monthExpenses
        .filter(t => t.category === budget.categoryName)
        .reduce((sum, t) => sum + t.amount, 0);
      
      const percentage = budget.amount > 0 ? Math.min(100, (spent / budget.amount) * 100) : 0;
      const isOverBudget = spent > budget.amount;
      const remaining = budget.amount - spent;

      return {
        ...budget,
        spent,
        remaining,
        percentage,
        isOverBudget
      };
    }).sort((a, b) => b.percentage - a.percentage);
  }, [budgets, transactions, currentDate]);

  const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
  const totalSpent = budgetRealizations.reduce((sum, b) => sum + b.spent, 0);
  const totalPercentage = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;
  const totalRemaining = totalBudget - totalSpent;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 font-sans">Alokasi Budget</h1>
        
        <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-1">
          <button onClick={handlePrevMonth} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-600 dark:text-gray-300">
            <ChevronLeft size={20} />
          </button>
          <span className="px-4 font-medium text-gray-800 dark:text-gray-200 min-w-[140px] text-center">
            {format(currentDate, 'MMMM yyyy', { locale: id })}
          </span>
          <button onClick={handleNextMonth} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-600 dark:text-gray-300">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 transition-colors duration-300">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex-1">
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Total Budget Bulan Ini</h2>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(totalBudget)}</p>
            <div className="mt-4 flex items-center gap-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Terpakai: </span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(totalSpent)}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Sisa: </span>
                <span className={`font-semibold ${totalRemaining < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                  {formatCurrency(totalRemaining)}
                </span>
              </div>
            </div>
          </div>
          
          <div className="w-full md:w-1/3">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium text-gray-700 dark:text-gray-300">Realisasi</span>
              <span className="font-bold text-gray-900 dark:text-gray-100">{totalPercentage.toFixed(1)}%</span>
            </div>
            <div className="h-3 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${totalPercentage >= 100 ? 'bg-red-500' : totalPercentage >= 80 ? 'bg-orange-500' : 'bg-emerald-500'}`}
                style={{ width: `${totalPercentage}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end">
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-colors shadow-sm font-medium"
        >
          <Plus size={20} />
          <span>Buat Budget</span>
        </button>
      </div>

      {/* Budget List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-emerald-500"></div>
        </div>
      ) : budgetRealizations.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 text-center transition-colors duration-300">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Target size={32} />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Belum Ada Budget</h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Tentukan jatah maksimal pengeluaran untuk setiap kategori agar keuangan Anda lebih terkontrol bulan ini.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {budgetRealizations.map(budget => (
            <div key={budget.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 transition-colors duration-300 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-gray-100 text-lg">{budget.categoryName}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Budget: {formatCurrency(budget.amount)}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEditModal(budget)} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => setDeleteId(budget.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <div className="mt-auto">
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-gray-600 dark:text-gray-400">Terpakai: <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(budget.spent)}</span></span>
                  <span className={`font-bold ${budget.isOverBudget ? 'text-red-500' : 'text-gray-900 dark:text-gray-100'}`}>
                    {budget.percentage.toFixed(0)}%
                  </span>
                </div>
                
                <div className="h-2.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${budget.isOverBudget ? 'bg-red-500' : budget.percentage >= 80 ? 'bg-orange-500' : 'bg-emerald-500'}`}
                    style={{ width: `${budget.percentage}%` }}
                  ></div>
                </div>
                
                <div className="text-xs text-right">
                  {budget.isOverBudget ? (
                    <span className="text-red-500 font-medium flex items-center justify-end gap-1">
                      <AlertCircle size={12} /> Over budget {formatCurrency(Math.abs(budget.remaining))}
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      Sisa {formatCurrency(budget.remaining)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Add/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                {editingBudget ? 'Edit Budget' : 'Buat Budget Baru'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Bulan: {format(currentDate, 'MMMM yyyy', { locale: id })}
              </p>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Kategori Pengeluaran
                </label>
                {expenseCategories.length === 0 ? (
                  <div className="p-3 bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-xl text-sm flex items-start gap-2">
                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                    <p>Anda belum memiliki kategori pengeluaran. Silakan buat kategori terlebih dahulu di menu Kategori Transaksi.</p>
                  </div>
                ) : (
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-gray-800 dark:text-gray-100 transition-colors"
                    required
                  >
                    <option value="">Pilih Kategori</option>
                    {expenseCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Jatah Maksimal (Rp)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={amount}
                  onChange={handleAmountChange}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-gray-800 dark:text-gray-100 transition-colors"
                  placeholder="0"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || expenseCategories.length === 0}
                  className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-colors font-medium disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteId}
        title="Hapus Budget"
        message="Apakah Anda yakin ingin menghapus budget ini? Data yang dihapus tidak dapat dikembalikan."
        onConfirm={handleDelete}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
