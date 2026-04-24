import { useState, useEffect, FormEvent, useMemo } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, setDoc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Wallet as WalletType, Transaction } from '../types';
import { Wallet, Trash2, RefreshCw, X } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import CustomSelect from './CustomSelect';

export default function Wallets({ user }: { user: User }) {
  const [wallets, setWallets] = useState<WalletType[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [walletsLoaded, setWalletsLoaded] = useState(false);
  const [transactionsLoaded, setTransactionsLoaded] = useState(false);
  const [name, setName] = useState('');
  const [initialBalance, setInitialBalance] = useState('0');
  const [recordAsTransaction, setRecordAsTransaction] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [correctingWallet, setCorrectingWallet] = useState<WalletType | null>(null);
  const [selectedWallet, setSelectedWallet] = useState<WalletType | null>(null);
  const [newBalance, setNewBalance] = useState('');

  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [fromWalletId, setFromWalletId] = useState('');
  const [toWalletId, setToWalletId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNote, setTransferNote] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'wallets'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setWallets(snap.docs.map(d => ({ id: d.id, ...d.data() } as WalletType)));
      setWalletsLoaded(true);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'wallets');
      setWalletsLoaded(true);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    const q = query(collection(db, 'transactions'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
      setTransactionsLoaded(true);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
      setTransactionsLoaded(true);
    });
    return () => unsub();
  }, [user]);

  const walletBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    wallets.forEach(w => balances[w.id] = w.initialBalance || 0);
    
    transactions.forEach(tx => {
      if (tx.walletId && balances[tx.walletId] !== undefined) {
        if (tx.type === 'income') {
          balances[tx.walletId] += tx.amount;
        } else if (tx.type === 'expense') {
          // Ignore 'Savings' expenses so they don't reduce the wallet balance
          if (tx.category !== 'Savings' && tx.category !== 'Tabungan') {
            balances[tx.walletId] -= tx.amount;
          }
        }
      }
    });
    return balances;
  }, [wallets, transactions]);

  const totalSaldo = useMemo(() => {
    return Object.values(walletBalances).reduce((sum: number, bal: number) => sum + bal, 0);
  }, [walletBalances]);

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
    return value.replace(/\./g, '');
  };

  const formatNominal = (value: string) => {
    if (!value) return '';
    const number = value.replace(/\D/g, '');
    return new Intl.NumberFormat('id-ID').format(Number(number));
  };

  const safeDate = (dateVal: any) => {
    if (!dateVal) return new Date();
    if (typeof dateVal.toDate === 'function') {
      return dateVal.toDate();
    }
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const numericBalance = Number(parseNominal(initialBalance));
    setLoading(true);
    try {
      const batch = writeBatch(db);
      const walletRef = doc(collection(db, 'wallets'));
      const actualInitialBalance = recordAsTransaction ? 0 : numericBalance;

      batch.set(walletRef, {
        userId: user.uid,
        name: name.trim(),
        initialBalance: actualInitialBalance,
        createdAt: serverTimestamp()
      });

      if (recordAsTransaction && numericBalance > 0) {
        const txRef = doc(collection(db, 'transactions'));
        batch.set(txRef, {
          userId: user.uid,
          type: 'income',
          amount: numericBalance,
          description: `Saldo Awal: ${name.trim()}`,
          category: 'Saldo Awal',
          walletId: walletRef.id,
          date: new Date().toISOString(),
          createdAt: serverTimestamp()
        });
      }

      batch.commit().catch(error => handleFirestoreError(error, OperationType.WRITE, 'wallets'));

      setName('');
      setInitialBalance('0');
      setRecordAsTransaction(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'wallets');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      deleteDoc(doc(db, 'wallets', deleteId)).catch(error => {
        handleFirestoreError(error, OperationType.DELETE, `wallets/${deleteId}`);
      });
      setDeleteId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `wallets/${deleteId}`);
    }
  };

  const handleCorrection = async (e: FormEvent) => {
    e.preventDefault();
    if (!correctingWallet) return;

    const currentBal = walletBalances[correctingWallet.id] || 0;
    const targetBal = Number(parseNominal(newBalance));
    const diff = targetBal - currentBal;

    if (diff === 0) {
      setCorrectingWallet(null);
      return;
    }

    setLoading(true);
    try {
      addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        type: diff > 0 ? 'income' : 'expense',
        amount: Math.abs(diff),
        description: `Koreksi Saldo: ${correctingWallet.name}`,
        category: 'Koreksi Saldo',
        walletId: correctingWallet.id,
        date: new Date().toISOString(),
        createdAt: serverTimestamp()
      }).catch(error => handleFirestoreError(error, OperationType.WRITE, 'transactions'));

      setCorrectingWallet(null);
      setNewBalance('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async (e: FormEvent) => {
    e.preventDefault();
    if (!fromWalletId || !toWalletId || fromWalletId === toWalletId) return;
    const numericAmount = Number(parseNominal(transferAmount));
    if (numericAmount <= 0) return;

    setLoading(true);
    try {
      const fromWallet = wallets.find(w => w.id === fromWalletId);
      const toWallet = wallets.find(w => w.id === toWalletId);

      const batch = writeBatch(db);

      // Record expense in source wallet
      const expenseRef = doc(collection(db, 'transactions'));
      batch.set(expenseRef, {
        userId: user.uid,
        type: 'expense',
        amount: numericAmount,
        description: `Transfer ke ${toWallet?.name}${transferNote ? ` • ${transferNote}` : ''}`,
        category: 'Pindah Saldo',
        walletId: fromWalletId,
        date: new Date().toISOString(),
        createdAt: serverTimestamp()
      });

      // Record income in destination wallet
      const incomeRef = doc(collection(db, 'transactions'));
      batch.set(incomeRef, {
        userId: user.uid,
        type: 'income',
        amount: numericAmount,
        description: `Transfer dari ${fromWallet?.name}${transferNote ? ` • ${transferNote}` : ''}`,
        category: 'Pindah Saldo',
        walletId: toWalletId,
        date: new Date().toISOString(),
        createdAt: serverTimestamp()
      });

      batch.commit().catch(error => handleFirestoreError(error, OperationType.WRITE, 'transactions'));

      setIsTransferModalOpen(false);
      setTransferAmount('');
      setFromWalletId('');
      setToWalletId('');
      setTransferNote('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'transactions');
    } finally {
      setLoading(false);
    }
  };

  const isDataReady = walletsLoaded && transactionsLoaded;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 font-sans">Dompet & Rekening</h1>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Total Saldo</span>
            {!isDataReady ? (
              <div className="h-9 w-48 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg mt-1"></div>
            ) : (
              <span className={`text-3xl font-black tracking-tight ${totalSaldo >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(totalSaldo)}
              </span>
            )}
          </div>
        </div>
        
        <button 
          onClick={() => setIsTransferModalOpen(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-2xl font-bold hover:bg-blue-600 transition-all shadow-lg shadow-blue-200 dark:shadow-none active:scale-95"
        >
          <RefreshCw size={18} />
          Pindah Saldo
        </button>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-8 transition-colors duration-300">
        <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">Tambah Dompet/Rekening Baru</h2>
        <form onSubmit={handleAdd} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Nama (Contoh: BCA, Tunai)</label>
              <input type="text" maxLength={50} value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500" required placeholder="Masukkan nama dompet..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Saldo Awal (Rp)</label>
              <input type="text" inputMode="numeric" value={initialBalance} onChange={e => setInitialBalance(formatNominal(e.target.value))} className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500" placeholder="0" />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className="relative flex items-center">
                <input 
                  type="checkbox" 
                  checked={recordAsTransaction} 
                  onChange={e => setRecordAsTransaction(e.target.checked)} 
                  className="peer appearance-none w-5 h-5 border-2 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 checked:bg-emerald-500 checked:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all"
                />
                <svg className="absolute w-3.5 h-3.5 pointer-events-none opacity-0 peer-checked:opacity-100 text-white left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200 transition-colors">Catat saldo awal sebagai transaksi pemasukan</span>
            </label>
            <button type="submit" disabled={loading} className="w-full sm:w-auto bg-emerald-500 text-white px-6 py-2.5 rounded-xl hover:bg-emerald-600 font-medium transition-colors disabled:opacity-70">
              {loading ? 'Menyimpan...' : 'Tambah Dompet'}
            </button>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {!isDataReady ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 h-40 animate-pulse">
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full mb-4"></div>
              <div className="h-5 w-24 bg-gray-100 dark:bg-gray-700 rounded mb-2"></div>
              <div className="h-4 w-32 bg-gray-100 dark:bg-gray-700 rounded"></div>
            </div>
          ))
        ) : wallets.map(wallet => (
          <div 
            key={wallet.id} 
            onClick={() => setSelectedWallet(wallet)}
            className="cursor-pointer bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex flex-col justify-between group hover:shadow-md dark:hover:shadow-gray-900/50 transition-all duration-300"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 text-blue-500 dark:text-blue-400 rounded-full flex items-center justify-center">
                <Wallet size={24} />
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setCorrectingWallet(wallet);
                    setNewBalance(formatNominal((walletBalances[wallet.id] || 0).toString()));
                  }} 
                  className="text-gray-300 dark:text-gray-600 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors"
                  title="Koreksi Saldo"
                >
                  <RefreshCw size={18} />
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteId(wallet.id);
                  }} 
                  className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
            <div className="mt-auto">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">{wallet.name}</h3>
              <p className={`text-sm font-semibold mt-1 ${walletBalances[wallet.id] >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(walletBalances[wallet.id] || 0)}
              </p>
            </div>
          </div>
        ))}
        {isDataReady && wallets.length === 0 && (
          <div className="col-span-full text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 border-dashed transition-colors duration-300">
            <Wallet size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Belum ada dompet atau rekening yang ditambahkan.</p>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Hapus Dompet/Rekening"
        message="Yakin ingin menghapus dompet/rekening ini? Transaksi yang sudah ada tidak akan terhapus, namun dompet ini tidak akan muncul lagi di pilihan."
      />

      <AnimatePresence>
        {selectedWallet && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden border border-gray-100 dark:border-gray-700"
            >
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">{selectedWallet.name}</h3>
                  <p className={`text-sm font-semibold mt-1 ${walletBalances[selectedWallet.id] >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatCurrency(walletBalances[selectedWallet.id] || 0)}
                  </p>
                </div>
                <button onClick={() => setSelectedWallet(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-400">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 overflow-y-auto flex-1">
                {(() => {
                  const walletTxs = transactions
                    .filter(t => t.walletId === selectedWallet.id)
                    .sort((a, b) => safeDate(b.date).getTime() - safeDate(a.date).getTime());

                  if (walletTxs.length === 0) {
                    return (
                      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        <Wallet size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                        <p>Belum ada transaksi untuk dompet ini.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {walletTxs.map(tx => (
                        <div key={tx.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800">
                          <div>
                            <p className="font-semibold text-gray-800 dark:text-gray-200">{tx.category || 'Tanpa Kategori'}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {format(safeDate(tx.date), 'd MMM yyyy, HH:mm', { locale: id })}
                              {tx.description && ` • ${tx.description}`}
                            </p>
                          </div>
                          <span className={`font-bold ${tx.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                            {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}

        {correctingWallet && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 dark:border-gray-700"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Koreksi Saldo</h3>
                  <button onClick={() => setCorrectingWallet(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-400">
                    <X size={20} />
                  </button>
                </div>

                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800">
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Dompet</p>
                  <p className="text-lg font-bold text-blue-900 dark:text-blue-100">{correctingWallet.name}</p>
                  <div className="mt-2 pt-2 border-t border-blue-100 dark:border-blue-800 flex justify-between items-center">
                    <span className="text-xs text-blue-600 dark:text-blue-400">Saldo Saat Ini</span>
                    <span className="text-sm font-bold text-blue-900 dark:text-blue-100">{formatCurrency(walletBalances[correctingWallet.id] || 0)}</span>
                  </div>
                </div>

                <form onSubmit={handleCorrection} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">Saldo Baru (Rp)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={newBalance}
                      onChange={e => setNewBalance(formatNominal(e.target.value))}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-xl font-bold text-gray-800 dark:text-gray-100"
                      autoFocus
                    />
                    <p className="mt-2 text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold tracking-widest">
                      *Akan dibuat transaksi penyesuaian otomatis
                    </p>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setCorrectingWallet(null)}
                      className="flex-1 px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 px-6 py-3 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-200 dark:shadow-none disabled:opacity-50"
                    >
                      {loading ? 'Menyimpan...' : 'Simpan'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}

        {isTransferModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 dark:border-gray-700"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Pindah Saldo</h3>
                  <button onClick={() => setIsTransferModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-400">
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleTransfer} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <CustomSelect
                        label="Dari"
                        value={fromWalletId}
                        onChange={(val) => setFromWalletId(val)}
                        options={wallets.map(w => ({ value: w.id, label: w.name }))}
                        placeholder="Pilih Dompet"
                        required
                      />
                    </div>
                    <div>
                      <CustomSelect
                        label="Ke"
                        value={toWalletId}
                        onChange={(val) => setToWalletId(val)}
                        options={wallets.map(w => ({ value: w.id, label: w.name, disabled: w.id === fromWalletId }))}
                        placeholder="Pilih Dompet"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">Jumlah (Rp)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={transferAmount}
                      onChange={e => setTransferAmount(formatNominal(e.target.value))}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-xl font-bold text-gray-800 dark:text-gray-100"
                      placeholder="0"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">Catatan (Opsional)</label>
                    <input
                      type="text"
                      maxLength={50}
                      value={transferNote}
                      onChange={e => setTransferNote(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm text-gray-800 dark:text-gray-100"
                      placeholder="Contoh: Titip tarik tunai"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsTransferModalOpen(false)}
                      className="flex-1 px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !fromWalletId || !toWalletId || fromWalletId === toWalletId}
                      className="flex-1 px-6 py-3 bg-blue-500 text-white rounded-2xl font-bold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-200 dark:shadow-none disabled:opacity-50"
                    >
                      {loading ? 'Memproses...' : 'Transfer'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
