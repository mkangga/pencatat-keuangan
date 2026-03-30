import { useState, useEffect, FormEvent, useMemo } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Wallet as WalletType, Transaction } from '../types';
import { Wallet, Trash2 } from 'lucide-react';
import ConfirmModal from './ConfirmModal';

export default function Wallets({ user }: { user: User }) {
  const [wallets, setWallets] = useState<WalletType[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [name, setName] = useState('');
  const [initialBalance, setInitialBalance] = useState('0');
  const [loading, setLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'wallets'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setWallets(snap.docs.map(d => ({ id: d.id, ...d.data() } as WalletType)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'wallets');
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    const q = query(collection(db, 'transactions'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });
    return () => unsub();
  }, [user]);

  const walletBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    wallets.forEach(w => balances[w.id] = 0);
    
    transactions.forEach(tx => {
      if (tx.walletId && balances[tx.walletId] !== undefined) {
        if (tx.type === 'income') {
          balances[tx.walletId] += tx.amount;
        } else {
          balances[tx.walletId] -= tx.amount;
        }
      }
    });
    return balances;
  }, [wallets, transactions]);

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

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const numericBalance = Number(parseNominal(initialBalance));
    setLoading(true);
    try {
      const walletRef = doc(collection(db, 'wallets'));
      await setDoc(walletRef, {
        userId: user.uid,
        name: name.trim(),
        createdAt: serverTimestamp()
      });

      if (numericBalance > 0) {
        await addDoc(collection(db, 'transactions'), {
          userId: user.uid,
          type: 'income',
          amount: numericBalance,
          description: `Saldo Awal: ${name.trim()}`,
          category: 'Saldo Awal',
          walletId: walletRef.id,
          date: new Date(),
          createdAt: serverTimestamp()
        });
      }

      setName('');
      setInitialBalance('0');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'wallets');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, 'wallets', deleteId));
      setDeleteId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `wallets/${deleteId}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6 font-sans">Dompet & Rekening</h1>
      
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-8 transition-colors duration-300">
        <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">Tambah Dompet/Rekening Baru</h2>
        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Nama (Contoh: BCA, Tunai)</label>
            <input type="text" maxLength={50} value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500" required placeholder="Masukkan nama dompet..." />
          </div>
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Saldo Awal (Rp)</label>
            <input type="text" inputMode="numeric" value={initialBalance} onChange={e => setInitialBalance(formatNominal(e.target.value))} className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500" placeholder="0" />
          </div>
          <button type="submit" disabled={loading} className="bg-emerald-500 text-white px-6 py-2 rounded-xl h-[42px] hover:bg-emerald-600 font-medium transition-colors disabled:opacity-70">
            {loading ? 'Menyimpan...' : 'Tambah Dompet'}
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {wallets.map(wallet => (
          <div key={wallet.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex flex-col justify-between group hover:shadow-md dark:hover:shadow-gray-900/50 transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 text-blue-500 dark:text-blue-400 rounded-full flex items-center justify-center">
                <Wallet size={24} />
              </div>
              <button onClick={() => setDeleteId(wallet.id)} className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                <Trash2 size={18} />
              </button>
            </div>
            <div className="mt-auto">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">{wallet.name}</h3>
              <p className={`text-sm font-semibold mt-1 ${walletBalances[wallet.id] >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(walletBalances[wallet.id] || 0)}
              </p>
            </div>
          </div>
        ))}
        {wallets.length === 0 && (
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
    </div>
  );
}
