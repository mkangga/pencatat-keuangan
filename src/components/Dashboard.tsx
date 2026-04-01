import { useState, useEffect, FormEvent, useRef, useMemo } from 'react';
import { User, updateProfile } from 'firebase/auth';
import { collection, query, where, orderBy, onSnapshot, limit, deleteDoc, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Transaction, Wallet, Category, AppUser } from '../types';
import Sidebar from './Sidebar';
import Header from './Header';
import SummaryCards from './SummaryCards';
import GroupedTransactionList from './GroupedTransactionList';
import AddTransactionModal from './AddTransactionModal';
import ExportModal from './ExportModal';
import Riwayat from './Riwayat';
import TransactionDetailModal from './TransactionDetailModal';
import Debts from './Debts';
import Goals from './Goals';
import Settings from './Settings';
import Analysis from './Analysis';
import Wallets from './Wallets';
import Categories from './Categories';
import { BellRing, Calendar, ChevronLeft, ChevronRight, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { MobileDrawer } from './MobileDrawer';
import BottomNav from './BottomNav';
import FloatingActionButton from './FloatingActionButton';
import { isToday, isSameMonth, parseISO, isSameDay, format, addDays, subDays, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { id } from 'date-fns/locale';
import { checkAndNotify } from '../services/notificationService';

interface DashboardProps {
  user: User;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

export default function Dashboard({ user, isDarkMode, toggleDarkMode }: DashboardProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'income' | 'expense'>('income');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [selectedDetailTransaction, setSelectedDetailTransaction] = useState<Transaction | null>(null);
  
  // New states for search and filters
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  
  // Profile edit state
  const [newName, setNewName] = useState(user.displayName || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Reminder state
  const [showReminder, setShowReminder] = useState(false);
  
  // Mobile drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // Sidebar collapse state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  const location = useLocation();

  useEffect(() => {
    setSearchQuery('');
    setFilterCategory('');
    if (mainRef.current) {
      mainRef.current.scrollTo(0, 0);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!user) return;

    // Fetch AppUser data
    const userDocRef = doc(db, 'users', user.uid);
    const unsubUser = onSnapshot(userDocRef, async (snap) => {
      if (snap.exists()) {
        setAppUser({ id: snap.id, ...snap.data() } as AppUser);
      } else {
        // Initialize user doc if it doesn't exist
        const initialUser: Partial<AppUser> = {
          uid: user.uid,
          displayName: user.displayName || 'User',
          email: user.email || '',
          photoURL: user.photoURL || '',
          role: 'user',
          bottomNavTabs: ['Dashboard', 'Masuk', 'Keluar', 'Analisis', 'Riwayat'],
          createdAt: new Date().toISOString()
        };
        await setDoc(userDocRef, initialUser);
      }
    });

    // Fetch Transactions
    const qTxs = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid),
      orderBy('date', 'desc'),
      orderBy('createdAt', 'desc'),
      limit(500)
    );

    const unsubTxs = onSnapshot(qTxs, (snapshot) => {
      const txs = snapshot.docs.map((doc) => {
        const data = doc.data();
        const date = data.date?.toDate ? data.date.toDate().toISOString() : (data.date || new Date().toISOString());
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || date);
        return {
          id: doc.id,
          ...data,
          date,
          createdAt,
        } as Transaction;
      });
      setTransactions(txs);
      
      if (txs.length > 0) {
        const lastTxDateObj = safeParseDate(txs[0].createdAt || txs[0].date);
        const lastTxTime = lastTxDateObj.getTime();
        const now = new Date().getTime();
        const hoursSinceLastTx = (now - lastTxTime) / (1000 * 60 * 60);
        setShowReminder(hoursSinceLastTx > 24);
        checkAndNotify(lastTxDateObj);
      } else {
        setShowReminder(true);
        checkAndNotify(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });

    // Fetch Wallets
    const qWallets = query(collection(db, 'wallets'), where('userId', '==', user.uid));
    const unsubWallets = onSnapshot(qWallets, (snap) => {
      setWallets(snap.docs.map(d => ({ id: d.id, ...d.data() } as Wallet)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'wallets');
    });

    // Fetch Categories
    const qCategories = query(collection(db, 'categories'), where('userId', '==', user.uid));
    const unsubCategories = onSnapshot(qCategories, (snap) => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'categories');
    });

    return () => {
      unsubUser();
      unsubTxs();
      unsubWallets();
      unsubCategories();
    };
  }, [user]);

  // Global Search Filter
  const searchedTransactions = transactions.filter(t => 
    t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.category && t.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isRangeMode, setIsRangeMode] = useState(false);
  const [startDateRange, setStartDateRange] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDateRange, setEndDateRange] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isFilterExpanded, setIsFilterExpanded] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');

  // Filtered categories based on filterType
  const filteredCategoryNames = useMemo(() => {
    // Get categories from the categories collection
    let fromCategories = categories;
    if (filterType === 'income') {
      fromCategories = categories.filter(c => c.type === 'income');
    } else if (filterType === 'expense') {
      fromCategories = categories.filter(c => c.type === 'expense');
    }
    
    // Also get categories that exist in transactions but might not be in categories collection (like 'Koreksi Saldo')
    const fromTransactions = transactions
      .filter(t => filterType === 'all' || t.type === filterType)
      .map(t => t.category || 'Tanpa Kategori');
    
    // Combine both sources
    const combinedNames = [
      ...fromCategories.map(c => c.name),
      ...fromTransactions
    ];
    
    // Get unique names and sort them
    const uniqueNames = Array.from(new Set(combinedNames)) as string[];
    return uniqueNames.sort((a, b) => a.localeCompare(b));
  }, [categories, transactions, filterType]);

  // Reset category filter if it's no longer valid for the selected type
  useEffect(() => {
    if (filterCategory === '') return;
    
    const isValid = filteredCategoryNames.includes(filterCategory);
    
    if (!isValid) {
      setFilterCategory('');
    }
  }, [filterType, filteredCategoryNames, filterCategory]);

  const safeParseDate = (dateStr: string) => {
    try {
      const parsed = parseISO(dateStr);
      return isNaN(parsed.getTime()) ? new Date() : parsed;
    } catch {
      return new Date();
    }
  };

  const filteredByDateTransactions = transactions.filter(t => {
    const tDate = safeParseDate(t.date);
    
    // Date filter
    let dateMatch = false;
    if (isRangeMode) {
      const start = startOfDay(safeParseDate(startDateRange));
      const end = endOfDay(safeParseDate(endDateRange));
      dateMatch = isWithinInterval(tDate, { start, end });
    } else {
      dateMatch = isSameDay(tDate, safeParseDate(selectedDate));
    }
    
    if (!dateMatch) return false;

    // Type filter
    if (filterType !== 'all' && t.type !== filterType) return false;

    // Category filter
    if (filterCategory && t.category !== filterCategory) return false;

    return true;
  });

  const searchedFilteredTransactions = searchedTransactions.filter(t => {
    const tDate = safeParseDate(t.date);
    
    // Date filter
    let dateMatch = false;
    if (isRangeMode) {
      const start = startOfDay(safeParseDate(startDateRange));
      const end = endOfDay(safeParseDate(endDateRange));
      dateMatch = isWithinInterval(tDate, { start, end });
    } else {
      dateMatch = isSameDay(tDate, safeParseDate(selectedDate));
    }
    
    if (!dateMatch) return false;

    // Type filter
    if (filterType !== 'all' && t.type !== filterType) return false;

    // Category filter
    if (filterCategory && t.category !== filterCategory) return false;

    return true;
  });

  const incomeTransactionsDaily = filteredByDateTransactions.filter(t => t.type === 'income' && t.category !== 'Pindah Saldo');
  const expenseTransactionsDaily = filteredByDateTransactions.filter(t => t.type === 'expense' && t.category !== 'Pindah Saldo');
  
  const dailyTransactions = [...searchedFilteredTransactions].sort((a, b) => {
    const dateA = safeParseDate(a.date).getTime();
    const dateB = safeParseDate(b.date).getTime();
    if (dateB !== dateA) return dateB - dateA;
    
    const createdAtA = a.createdAt ? safeParseDate(a.createdAt).getTime() : 0;
    const createdAtB = b.createdAt ? safeParseDate(b.createdAt).getTime() : 0;
    return createdAtB - createdAtA;
  });

  const totalIncomeDaily = incomeTransactionsDaily.reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpenseDaily = expenseTransactionsDaily.reduce((acc, curr) => acc + curr.amount, 0);
  const balanceDaily = totalIncomeDaily - totalExpenseDaily;

  // Sorting state for recent transactions
  const [incomeSort, setIncomeSort] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc');
  const [expenseSort, setExpenseSort] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc');

  const searchedIncomeTransactions = searchedTransactions.filter(t => t.type === 'income' && t.category !== 'Pindah Saldo');
  const searchedExpenseTransactions = searchedTransactions.filter(t => t.type === 'expense' && t.category !== 'Pindah Saldo');

  // For Summary Cards (Unfiltered by search)
  const allTransactions = transactions;
  const allIncomeTransactions = allTransactions.filter(t => t.type === 'income' && t.category !== 'Pindah Saldo');
  const allExpenseTransactions = allTransactions.filter(t => t.type === 'expense' && t.category !== 'Pindah Saldo');

  const now = new Date();

  const incomeToday = allIncomeTransactions.filter(t => isToday(parseISO(t.date))).reduce((acc, curr) => acc + curr.amount, 0);
  const expenseToday = allExpenseTransactions.filter(t => isToday(parseISO(t.date))).reduce((acc, curr) => acc + curr.amount, 0);

  const incomeMonth = allIncomeTransactions.filter(t => isSameMonth(parseISO(t.date), now)).reduce((acc, curr) => acc + curr.amount, 0);
  const expenseMonth = allExpenseTransactions.filter(t => isSameMonth(parseISO(t.date), now)).reduce((acc, curr) => acc + curr.amount, 0);

  const totalIncome = allIncomeTransactions.reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpense = allExpenseTransactions.reduce((acc, curr) => acc + curr.amount, 0);
  const balance = totalIncome - totalExpense;

  const sortTransactions = (txs: Transaction[], sortType: string) => {
    return [...txs].sort((a, b) => {
      if (sortType === 'date-desc') return safeParseDate(b.date).getTime() - safeParseDate(a.date).getTime();
      if (sortType === 'date-asc') return safeParseDate(a.date).getTime() - safeParseDate(b.date).getTime();
      if (sortType === 'amount-desc') return b.amount - a.amount;
      if (sortType === 'amount-asc') return a.amount - b.amount;
      return 0;
    });
  };

  const sortedIncomeTransactions = sortTransactions(allIncomeTransactions, incomeSort);
  const sortedExpenseTransactions = sortTransactions(allExpenseTransactions, expenseSort);

  const openModal = (type: 'income' | 'expense') => {
    setModalType(type);
    setEditingTransaction(null);
    setIsModalOpen(true);
  };

  const openEditModal = (tx: Transaction) => {
    setModalType(tx.type);
    setEditingTransaction(tx);
    setIsModalOpen(true);
  };

  const openDetailModal = (tx: Transaction) => {
    setSelectedDetailTransaction(tx);
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'transactions', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `transactions/${id}`);
    }
  };

  const applyFilters = (txs: Transaction[]) => {
    return txs.filter(tx => {
      const txDate = safeParseDate(tx.date).getTime();
      const start = startDate ? safeParseDate(startDate).getTime() : 0;
      const end = endDate ? safeParseDate(endDate).getTime() + 86400000 : Infinity;
      const matchDate = txDate >= start && txDate <= end;
      const matchCategory = filterCategory ? tx.category?.toLowerCase().includes(filterCategory.toLowerCase()) : true;
      return matchDate && matchCategory;
    }).sort((a, b) => {
      const dateA = safeParseDate(a.date).getTime();
      const dateB = safeParseDate(b.date).getTime();
      if (dateB !== dateA) return dateB - dateA;
      
      const createdAtA = a.createdAt ? safeParseDate(a.createdAt).getTime() : 0;
      const createdAtB = b.createdAt ? safeParseDate(b.createdAt).getTime() : 0;
      return createdAtB - createdAtA;
    });
  };

  const renderFilters = (type?: 'income' | 'expense') => {
    const fromCategories = type 
      ? categories.filter(c => c.type === type)
      : categories;
    
    const fromTransactions = transactions
      .filter(t => !type || t.type === type)
      .map(t => t.category || 'Tanpa Kategori');

    const combinedNames = [
      ...fromCategories.map(c => c.name),
      ...fromTransactions
    ];
    
    // Get unique names and sort them
    const uniqueCategoryNames = Array.from(new Set(combinedNames)) as string[];
    uniqueCategoryNames.sort((a, b) => a.localeCompare(b));

    return (
      <div className="flex flex-wrap gap-4 mb-6 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Dari Tanggal</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-gray-800 dark:text-gray-100" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Sampai Tanggal</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-gray-800 dark:text-gray-100" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Kategori</label>
          <select 
            value={filterCategory} 
            onChange={e => setFilterCategory(e.target.value)} 
            className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-gray-800 dark:text-gray-100"
          >
            <option value="">Semua kategori...</option>
            {uniqueCategoryNames.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button onClick={() => { setStartDate(''); setEndDate(''); setFilterCategory(''); }} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">Reset Filter</button>
        </div>
      </div>
    );
  };

  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setIsUpdatingProfile(true);
    try {
      await updateProfile(user, { displayName: newName });
      // Update the local user object so the Header reflects the change immediately without reloading
      if (user) {
        (user as any).displayName = newName;
      }
      alert('Profil berhasil diperbarui!');
    } catch (error) {
      console.error(error);
      alert('Gagal memperbarui profil');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#f8fafc] dark:bg-gray-900 overflow-hidden transition-colors duration-300">
      <Sidebar user={user} className={`hidden md:flex transition-all duration-300 h-full ${isSidebarCollapsed ? 'w-20' : 'w-64'}`} isCollapsed={isSidebarCollapsed} isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />
      <MobileDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} user={user} isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          user={user} 
          onAddIncome={() => openModal('income')} 
          onAddExpense={() => openModal('expense')} 
          onExport={() => setIsExportModalOpen(true)}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onToggleDrawer={() => setIsDrawerOpen(true)}
          onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          isSidebarCollapsed={isSidebarCollapsed}
          isDarkMode={isDarkMode}
          toggleDarkMode={toggleDarkMode}
        />
        
        <main ref={mainRef} className="flex-1 overflow-y-auto p-6 lg:p-8 pb-24">
          <Routes>
            <Route path="/" element={
              <div className="max-w-7xl mx-auto space-y-6">
                <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 transition-all duration-300">
                  <div className="flex flex-col space-y-6">
                    {/* Header Row: Title & Controls */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center justify-between w-full sm:w-auto">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-2xl">
                            <Calendar size={22} />
                          </div>
                          <div>
                            <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">Filter Transaksi</h2>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium">
                              {isFilterExpanded ? 'Pilih periode waktu' : (
                                isRangeMode 
                                  ? `${format(safeParseDate(startDateRange), 'd MMM')} — ${format(safeParseDate(endDateRange), 'd MMM yyyy', { locale: id })}`
                                  : format(safeParseDate(selectedDate), 'EEEE, d MMM yyyy', { locale: id })
                              )}
                            </p>
                          </div>
                        </div>
                        
                        <button 
                          onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                          className="sm:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-gray-400 transition-colors"
                        >
                          {isFilterExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>
                      </div>

                      <div className={`flex items-center gap-2 ${!isFilterExpanded ? 'hidden sm:flex' : 'flex'}`}>
                        <div className="flex bg-gray-100 dark:bg-gray-700/50 p-1 rounded-xl border border-gray-200/50 dark:border-gray-600/30">
                          <button 
                            onClick={() => setIsRangeMode(false)}
                            className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all duration-200 ${!isRangeMode ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-300 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
                          >
                            Harian
                          </button>
                          <button 
                            onClick={() => setIsRangeMode(true)}
                            className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all duration-200 ${isRangeMode ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-300 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
                          >
                            Range
                          </button>
                        </div>
                        
                        <button 
                          onClick={() => {
                            setIsRangeMode(false);
                            setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-all border border-emerald-100 dark:border-emerald-900/30 active:scale-95"
                          title="Kembali ke Hari Ini"
                        >
                          <RotateCcw size={14} />
                          <span className="hidden xs:inline">Hari Ini</span>
                        </button>

                        <button 
                          onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                          className="hidden sm:flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-gray-400 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
                        >
                          {isFilterExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                      </div>
                    </div>

                    {/* Date Selector Row */}
                    {isFilterExpanded && (
                      <>
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pt-4 border-t border-gray-50 dark:border-gray-700/50 animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="flex items-center justify-center lg:justify-start gap-6">
                            {!isRangeMode ? (
                              <div className="flex items-center gap-6">
                                <button 
                                  onClick={() => setSelectedDate(format(subDays(safeParseDate(selectedDate), 1), 'yyyy-MM-dd'))}
                                  className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-2xl transition-all text-gray-400 dark:text-gray-500 border border-gray-100 dark:border-gray-700 hover:border-purple-200 dark:hover:border-purple-900/50 active:scale-90"
                                >
                                  <ChevronLeft size={22} />
                                </button>
                                
                                <div className="text-center min-w-[160px]">
                                  <p className="text-[10px] font-bold text-purple-500 dark:text-purple-400 uppercase tracking-[0.2em] mb-1">
                                    {format(safeParseDate(selectedDate), 'EEEE', { locale: id })}
                                  </p>
                                  <p className="text-lg font-black text-gray-800 dark:text-gray-100 tracking-tight">
                                    {format(safeParseDate(selectedDate), 'd MMM yyyy', { locale: id })}
                                  </p>
                                </div>

                                <button 
                                  onClick={() => setSelectedDate(format(addDays(safeParseDate(selectedDate), 1), 'yyyy-MM-dd'))}
                                  className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-2xl transition-all text-gray-400 dark:text-gray-500 border border-gray-100 dark:border-gray-700 hover:border-purple-200 dark:hover:border-purple-900/50 active:scale-90"
                                >
                                  <ChevronRight size={22} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center lg:items-start">
                                <p className="text-[10px] font-bold text-purple-500 dark:text-purple-400 uppercase tracking-[0.2em] mb-1">Rentang Terpilih</p>
                                <p className="text-lg font-black text-gray-800 dark:text-gray-100 tracking-tight">
                                  {format(safeParseDate(startDateRange), 'd MMM', { locale: id })} — {format(safeParseDate(endDateRange), 'd MMM yyyy', { locale: id })}
                                </p>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-3 w-full lg:w-auto">
                            {isRangeMode ? (
                              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900/50 p-2 rounded-2xl border border-gray-100 dark:border-gray-700 w-full lg:w-auto shadow-inner">
                                <div className="flex-1 relative">
                                  <input 
                                    type="date" 
                                    value={startDateRange} 
                                    onChange={(e) => setStartDateRange(e.target.value)}
                                    className="w-full pl-2 pr-8 py-1.5 bg-transparent text-sm font-bold outline-none text-gray-800 dark:text-gray-100"
                                  />
                                </div>
                                <div className="h-6 w-px bg-gray-200 dark:bg-gray-700" />
                                <div className="flex-1 relative">
                                  <input 
                                    type="date" 
                                    value={endDateRange} 
                                    onChange={(e) => setEndDateRange(e.target.value)}
                                    className="w-full pl-2 pr-8 py-1.5 bg-transparent text-sm font-bold outline-none text-gray-800 dark:text-gray-100"
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="relative w-full lg:w-64 group">
                                <input 
                                  type="date" 
                                  value={selectedDate} 
                                  onChange={(e) => setSelectedDate(e.target.value)}
                                  className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500/50 text-gray-800 dark:text-gray-100 transition-all shadow-inner hover:border-purple-200 dark:hover:border-purple-900/50"
                                />
                                <Calendar className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-purple-500 transition-colors pointer-events-none" size={18} />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Additional Filters Row */}
                        <div className="flex flex-col sm:flex-row items-center gap-4 pt-4 border-t border-gray-50 dark:border-gray-700/50 animate-in fade-in slide-in-from-top-2 duration-500">
                          <div className="flex-1 w-full">
                            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 ml-1">Tipe Transaksi</p>
                            <div className="flex bg-gray-100 dark:bg-gray-700/50 p-1 rounded-xl border border-gray-200/50 dark:border-gray-600/30">
                              <button 
                                onClick={() => setFilterType('all')}
                                className={`flex-1 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all duration-200 ${filterType === 'all' ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-300 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
                              >
                                Semua
                              </button>
                              <button 
                                onClick={() => setFilterType('income')}
                                className={`flex-1 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all duration-200 ${filterType === 'income' ? 'bg-white dark:bg-gray-600 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-emerald-600'}`}
                              >
                                Masuk
                              </button>
                              <button 
                                onClick={() => setFilterType('expense')}
                                className={`flex-1 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all duration-200 ${filterType === 'expense' ? 'bg-white dark:bg-gray-600 text-red-600 dark:text-red-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-red-600'}`}
                              >
                                Keluar
                              </button>
                            </div>
                          </div>

                          <div className="flex-1 w-full">
                            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 ml-1">Kategori</p>
                            <select 
                              value={filterCategory} 
                              onChange={(e) => setFilterCategory(e.target.value)}
                              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500/50 text-gray-800 dark:text-gray-100 transition-all shadow-inner"
                            >
                              <option value="">Semua Kategori</option>
                              {filteredCategoryNames.map(name => (
                                <option key={name} value={name}>{name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-600 to-indigo-700 text-white p-6 rounded-3xl shadow-xl border border-purple-400/20">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-sm font-semibold tracking-wide uppercase opacity-80">
                      Ringkasan Transaksi
                    </h2>
                    <span className="text-xs bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm font-medium">
                      {isRangeMode 
                        ? `${format(safeParseDate(startDateRange), 'd MMM')} - ${format(safeParseDate(endDateRange), 'd MMM yyyy', { locale: id })}`
                        : format(safeParseDate(selectedDate), 'd MMM yyyy', { locale: id })}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
                    <div className="flex items-center justify-between sm:flex-col sm:justify-center sm:text-center p-1 sm:p-0 min-w-0">
                      <p className="text-[10px] uppercase tracking-wider opacity-70 font-bold flex-shrink-0">Pemasukan</p>
                      <p className="text-sm sm:text-lg font-extrabold break-words text-right sm:text-center">
                        + {totalIncomeDaily.toLocaleString('id-ID')}
                      </p>
                    </div>
                    <div className="flex items-center justify-between sm:flex-col sm:justify-center sm:text-center p-1 sm:p-0 border-t border-white/10 sm:border-t-0 sm:border-x sm:border-white/10 min-w-0">
                      <p className="text-[10px] uppercase tracking-wider opacity-70 font-bold flex-shrink-0">Pengeluaran</p>
                      <p className="text-sm sm:text-lg font-extrabold break-words text-right sm:text-center">
                        - {totalExpenseDaily.toLocaleString('id-ID')}
                      </p>
                    </div>
                    <div className="flex items-center justify-between sm:flex-col sm:justify-center sm:text-center p-1 sm:p-0 border-t border-white/10 sm:border-t-0 min-w-0">
                      <p className="text-[10px] uppercase tracking-wider opacity-70 font-bold flex-shrink-0">Selisih</p>
                      <p className={`text-sm sm:text-lg font-extrabold break-words text-right sm:text-center ${balanceDaily >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                        {balanceDaily >= 0 ? '+' : ''}{balanceDaily.toLocaleString('id-ID')}
                      </p>
                    </div>
                  </div>
                </div>
                
                <GroupedTransactionList transactions={dailyTransactions} onEdit={openEditModal} onViewDetail={openDetailModal} />
              </div>
            } />
            <Route path="/uang-masuk" element={
              <div className="max-w-7xl mx-auto space-y-6">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 font-sans">Semua Pemasukan</h1>
                {renderFilters('income')}
                <GroupedTransactionList transactions={applyFilters(searchedIncomeTransactions)} onEdit={openEditModal} onViewDetail={openDetailModal} />
              </div>
            } />
            <Route path="/uang-keluar" element={
              <div className="max-w-7xl mx-auto space-y-6">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 font-sans">Semua Pengeluaran</h1>
                {renderFilters('expense')}
                <GroupedTransactionList transactions={applyFilters(searchedExpenseTransactions)} onEdit={openEditModal} onViewDetail={openDetailModal} />
              </div>
            } />
            <Route path="/riwayat" element={<Riwayat transactions={searchedTransactions} onViewDetail={openDetailModal} onEdit={openEditModal} />} />
            <Route path="/analisis" element={
              <Analysis 
                transactions={transactions}
                incomeToday={incomeToday}
                expenseToday={expenseToday}
                incomeMonth={incomeMonth}
                expenseMonth={expenseMonth}
                balance={balance}
              />
            } />
            <Route path="/hutang-piutang" element={<Debts user={user} />} />
            <Route path="/masa-depan" element={<Goals user={user} />} />
            <Route path="/dompet-rekening" element={<Wallets user={user} />} />
            <Route path="/kategori-transaksi" element={<Categories user={user} />} />
            <Route path="/pengaturan" element={<Settings user={user} appUser={appUser} />} />
            <Route path="/profil" element={
              <div className="max-w-7xl mx-auto space-y-8">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6 font-sans">Profil Pengguna</h1>
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 flex flex-col md:flex-row items-start gap-8 transition-colors duration-300">
                  <div className="flex flex-col items-center gap-4">
                    <img 
                      src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || 'User'}&background=10b981&color=fff`} 
                      alt="Profile" 
                      className="w-32 h-32 rounded-full shadow-md" 
                      referrerPolicy="no-referrer" 
                    />
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300">
                      Akun Aktif
                    </span>
                  </div>
                  <div className="flex-1 w-full">
                    <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-md">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Email</label>
                        <input type="email" value={user.email || ''} disabled className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-500 dark:text-gray-400 cursor-not-allowed" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Nama Panggilan</label>
                        <input 
                          type="text" 
                          value={newName} 
                          onChange={(e) => setNewName(e.target.value)} 
                          className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-gray-800 dark:text-gray-100" 
                          required 
                        />
                      </div>
                      <button 
                        type="submit" 
                        disabled={isUpdatingProfile || newName === user.displayName}
                        className="bg-emerald-500 text-white px-6 py-2 rounded-xl font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isUpdatingProfile ? 'Menyimpan...' : 'Simpan Perubahan'}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <footer className="mt-12 py-8 text-center text-sm text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 transition-colors duration-300">
            built by <a href="https://mka.my.id" target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium">MKA</a>
          </footer>
        </main>
        <BottomNav tabs={appUser?.bottomNavTabs} />
      </div>

      {isModalOpen && (
        <AddTransactionModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          type={modalType} 
          user={user}
          wallets={wallets}
          categories={categories}
          editingTransaction={editingTransaction}
          transactions={transactions}
        />
      )}

      {isExportModalOpen && (
        <ExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          user={user}
          wallets={wallets}
        />
      )}

      <TransactionDetailModal
        isOpen={!!selectedDetailTransaction}
        onClose={() => setSelectedDetailTransaction(null)}
        transaction={selectedDetailTransaction}
        wallets={wallets}
        categories={categories}
        onEdit={openEditModal}
        onDelete={handleDeleteTransaction}
      />

      <FloatingActionButton 
        user={user}
        wallets={wallets}
        categories={categories}
        transactions={transactions}
      />
    </div>
  );
}
