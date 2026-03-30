import { useState, useEffect, FormEvent } from 'react';
import { User, updateProfile } from 'firebase/auth';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { Routes, Route, Navigate } from 'react-router-dom';
import { db } from '../firebase';
import { Transaction, Wallet, Category } from '../types';
import Sidebar from './Sidebar';
import Header from './Header';
import SummaryCards from './SummaryCards';
import TransactionList from './TransactionList';
import AddTransactionModal from './AddTransactionModal';
import ExportModal from './ExportModal';
import ActivityLog from './ActivityLog';
import Debts from './Debts';
import Goals from './Goals';
import Settings from './Settings';
import Analysis from './Analysis';
import Wallets from './Wallets';
import Categories from './Categories';
import { BellRing } from 'lucide-react';
import { MobileDrawer } from './MobileDrawer';
import BottomNav from './BottomNav';
import { isToday, isSameMonth, parseISO } from 'date-fns';

interface DashboardProps {
  user: User;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

export default function Dashboard({ user, isDarkMode, toggleDarkMode }: DashboardProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'income' | 'expense'>('income');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  
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

  useEffect(() => {
    if (!user) return;

    // Fetch Transactions
    const qTxs = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid),
      orderBy('date', 'desc'),
      limit(500)
    );

    const unsubTxs = onSnapshot(qTxs, (snapshot) => {
      const txs = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          date: data.date?.toDate ? data.date.toDate().toISOString() : data.date,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
        } as Transaction;
      });
      setTransactions(txs);
      
      if (txs.length > 0) {
        const lastTxDate = new Date(txs[0].createdAt || txs[0].date).getTime();
        const now = new Date().getTime();
        const hoursSinceLastTx = (now - lastTxDate) / (1000 * 60 * 60);
        setShowReminder(hoursSinceLastTx > 24);
      } else {
        setShowReminder(true);
      }
    });

    // Fetch Wallets
    const qWallets = query(collection(db, 'wallets'), where('userId', '==', user.uid));
    const unsubWallets = onSnapshot(qWallets, (snap) => {
      setWallets(snap.docs.map(d => ({ id: d.id, ...d.data() } as Wallet)));
    });

    // Fetch Categories
    const qCategories = query(collection(db, 'categories'), where('userId', '==', user.uid));
    const unsubCategories = onSnapshot(qCategories, (snap) => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
    });

    return () => {
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

  const incomeTransactions = searchedTransactions.filter(t => t.type === 'income');
  const expenseTransactions = searchedTransactions.filter(t => t.type === 'expense');

  const now = new Date();

  const incomeToday = incomeTransactions.filter(t => isToday(parseISO(t.date))).reduce((acc, curr) => acc + curr.amount, 0);
  const expenseToday = expenseTransactions.filter(t => isToday(parseISO(t.date))).reduce((acc, curr) => acc + curr.amount, 0);

  const incomeMonth = incomeTransactions.filter(t => isSameMonth(parseISO(t.date), now)).reduce((acc, curr) => acc + curr.amount, 0);
  const expenseMonth = expenseTransactions.filter(t => isSameMonth(parseISO(t.date), now)).reduce((acc, curr) => acc + curr.amount, 0);

  const totalIncome = incomeTransactions.reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpense = expenseTransactions.reduce((acc, curr) => acc + curr.amount, 0);
  const balance = totalIncome - totalExpense;

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

  const applyFilters = (txs: Transaction[]) => {
    return txs.filter(tx => {
      const txDate = new Date(tx.date).getTime();
      const start = startDate ? new Date(startDate).getTime() : 0;
      const end = endDate ? new Date(endDate).getTime() + 86400000 : Infinity;
      const matchDate = txDate >= start && txDate <= end;
      const matchCategory = filterCategory ? tx.category?.toLowerCase().includes(filterCategory.toLowerCase()) : true;
      return matchDate && matchCategory;
    });
  };

  const renderFilters = () => (
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
        <input type="text" placeholder="Semua kategori..." value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500" />
      </div>
      <div className="flex items-end">
        <button onClick={() => { setStartDate(''); setEndDate(''); setFilterCategory(''); }} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">Reset Filter</button>
      </div>
    </div>
  );

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
        
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 pb-24">
          <Routes>
            <Route path="/" element={
              <div className="max-w-7xl mx-auto space-y-8">
                {showReminder && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/40 rounded-2xl p-4 flex items-start gap-3 transition-colors duration-300">
                    <div className="bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 p-2 rounded-full mt-0.5">
                      <BellRing size={18} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-blue-800 dark:text-blue-300">Pengingat Harian</h4>
                      <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">Anda belum mencatat transaksi apapun dalam 24 jam terakhir. Yuk catat pengeluaran atau pemasukan Anda hari ini!</p>
                    </div>
                  </div>
                )}
                <div>
                  <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6 font-sans">Dashboard Keuangan</h1>
                  <SummaryCards 
                    incomeToday={incomeToday} 
                    expenseToday={expenseToday} 
                    incomeMonth={incomeMonth} 
                    expenseMonth={expenseMonth} 
                    balance={balance} 
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 transition-colors duration-300">
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Pemasukan Terakhir</h2>
                    <TransactionList transactions={incomeTransactions.slice(0, 5)} type="income" onEdit={openEditModal} />
                  </div>
                  
                  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 transition-colors duration-300">
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Pengeluaran Terakhir</h2>
                    <TransactionList transactions={expenseTransactions.slice(0, 5)} type="expense" onEdit={openEditModal} />
                  </div>
                </div>
              </div>
            } />
            <Route path="/uang-masuk" element={
              <div className="max-w-7xl mx-auto space-y-6">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 font-sans">Semua Pemasukan</h1>
                {renderFilters()}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 transition-colors duration-300">
                  <TransactionList transactions={applyFilters(incomeTransactions)} type="income" onEdit={openEditModal} />
                </div>
              </div>
            } />
            <Route path="/uang-keluar" element={
              <div className="max-w-7xl mx-auto space-y-6">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 font-sans">Semua Pengeluaran</h1>
                {renderFilters()}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 transition-colors duration-300">
                  <TransactionList transactions={applyFilters(expenseTransactions)} type="expense" onEdit={openEditModal} />
                </div>
              </div>
            } />
            <Route path="/log-aktivitas" element={<ActivityLog transactions={searchedTransactions} />} />
            <Route path="/analisis" element={<Analysis transactions={searchedTransactions} />} />
            <Route path="/hutang-piutang" element={<Debts user={user} />} />
            <Route path="/masa-depan" element={<Goals user={user} />} />
            <Route path="/dompet-rekening" element={<Wallets user={user} />} />
            <Route path="/kategori-transaksi" element={<Categories user={user} />} />
            <Route path="/pengaturan" element={<Settings user={user} />} />
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
        <BottomNav />
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
    </div>
  );
}
