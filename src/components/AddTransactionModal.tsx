import { useState, FormEvent, useEffect, ChangeEvent } from 'react';
import { User } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { X, Wallet as WalletIcon, Tag, AlertCircle } from 'lucide-react';
import { Wallet, Category, Transaction } from '../types';
import { useNavigate } from 'react-router-dom';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'income' | 'expense';
  user: User;
  wallets: Wallet[];
  categories: Category[];
  editingTransaction?: Transaction | null;
}

export default function AddTransactionModal({ 
  isOpen, 
  onClose, 
  type, 
  user, 
  wallets, 
  categories,
  editingTransaction 
}: AddTransactionModalProps) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(new Date().toTimeString().split(' ')[0].slice(0, 5));
  const [category, setCategory] = useState('');
  const [walletId, setWalletId] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const formatNominal = (value: string) => {
    if (!value) return '';
    const number = value.replace(/\D/g, '');
    return new Intl.NumberFormat('id-ID').format(Number(number));
  };

  const parseNominal = (value: string) => {
    return value.replace(/\./g, '');
  };

  const handleAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    const formatted = formatNominal(e.target.value);
    setAmount(formatted);
  };

  const filteredCategories = categories.filter(c => c.type === type);

  useEffect(() => {
    if (isOpen) {
      if (editingTransaction) {
        const txDate = new Date(editingTransaction.date);
        setAmount(formatNominal(editingTransaction.amount.toString()));
        setDescription(editingTransaction.description);
        setDate(txDate.toISOString().split('T')[0]);
        setTime(txDate.toTimeString().split(' ')[0].slice(0, 5));
        setCategory(editingTransaction.category || '');
        setWalletId(editingTransaction.walletId || '');
      } else {
        setAmount('');
        setDescription('');
        setDate(new Date().toISOString().split('T')[0]);
        setTime(new Date().toTimeString().split(' ')[0].slice(0, 5));
        setCategory(filteredCategories.length > 0 ? filteredCategories[0].name : '');
        setWalletId(wallets.length > 0 ? wallets[0].id : '');
      }
    }
  }, [isOpen, type, wallets, categories, editingTransaction]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(parseNominal(amount));
    if (!numericAmount || !description || !date || !time || !walletId) {
      if (!walletId) alert("Silakan pilih dompet / rekening terlebih dahulu.");
      return;
    }

    setLoading(true);
    try {
      const fullDate = new Date(`${date}T${time}`);
      const txData: any = {
        userId: user.uid,
        type,
        amount: numericAmount,
        description,
        date: fullDate,
        updatedAt: serverTimestamp(),
      };
      if (category) txData.category = category;
      txData.walletId = walletId;

      if (editingTransaction) {
        await updateDoc(doc(db, 'transactions', editingTransaction.id), txData);
      } else {
        txData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'transactions'), txData);
      }
      onClose();
    } catch (error) {
      console.error("Error saving transaction: ", error);
      alert("Gagal menyimpan transaksi.");
    } finally {
      setLoading(false);
    }
  };

  const isIncome = type === 'income';
  const isEditing = !!editingTransaction;

  const hasWallets = wallets.length > 0;
  const hasCategoriesForType = filteredCategories.length > 0;
  const setupRequired = !isEditing && (!hasWallets || !hasCategoriesForType);

  if (setupRequired) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 transition-colors duration-300">
          <div className={`px-6 py-4 border-b flex justify-between items-center ${
            isIncome ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-100 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-900/30 border-red-100 dark:border-red-800'
          }`}>
            <div className={`flex items-center gap-2 ${isIncome ? 'text-emerald-800 dark:text-emerald-300' : 'text-red-800 dark:text-red-300'}`}>
              <AlertCircle size={20} />
              <h3 className="font-semibold text-lg">Persiapan Diperlukan</h3>
            </div>
            <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              <X size={20} />
            </button>
          </div>
          <div className="p-6 space-y-6">
            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
              Sebelum mencatat transaksi, Anda perlu membuat setidaknya satu <strong>Dompet/Rekening</strong> dan satu <strong>Kategori {isIncome ? 'Pemasukan' : 'Pengeluaran'}</strong>.
            </p>
            
            <div className="space-y-3">
              {!hasWallets && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 rounded-xl flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-lg">
                      <WalletIcon size={18} />
                    </div>
                    <span className="text-sm text-red-700 dark:text-red-400 font-medium">Dompet belum ada</span>
                  </div>
                  <button 
                    onClick={() => { navigate('/dompet-rekening'); onClose(); }}
                    className="text-xs bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium shadow-sm"
                  >
                    Buat Sekarang
                  </button>
                </div>
              )}
              
              {!hasCategoriesForType && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 rounded-xl flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-lg">
                      <Tag size={18} />
                    </div>
                    <span className="text-sm text-red-700 dark:text-red-400 font-medium">Kategori {isIncome ? 'Pemasukan' : 'Pengeluaran'} belum ada</span>
                  </div>
                  <button 
                    onClick={() => { navigate('/kategori-transaksi'); onClose(); }}
                    className="text-xs bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium shadow-sm"
                  >
                    Buat Sekarang
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={onClose}
              className="w-full py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 font-medium transition-colors text-sm"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 transition-colors duration-300">
        <div className={`px-6 py-4 border-b flex justify-between items-center ${
          isIncome ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-100 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-900/30 border-red-100 dark:border-red-800'
        }`}>
          <h3 className={`font-semibold text-lg ${isIncome ? 'text-emerald-800 dark:text-emerald-300' : 'text-red-800 dark:text-red-300'}`}>
            {isEditing ? 'Edit' : 'Tambah'} {isIncome ? 'Pemasukan' : 'Pengeluaran'}
          </h3>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Jumlah (Rp)</label>
            <input
              type="text"
              inputMode="numeric"
              required
              value={amount}
              onChange={handleAmountChange}
              className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Keterangan</label>
            <input
              type="text"
              required
              maxLength={100}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="Contoh: Gaji bulan ini"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Tanggal</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-gray-800 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Waktu</label>
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-gray-800 dark:text-gray-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Kategori</label>
            {filteredCategories.length > 0 ? (
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-gray-800 dark:text-gray-100"
              >
                {filteredCategories.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                maxLength={50}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                placeholder="Buat kategori di menu Kategori Transaksi"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Dompet / Rekening</label>
            {wallets.length > 0 ? (
              <select
                value={walletId}
                required
                onChange={(e) => setWalletId(e.target.value)}
                className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-gray-800 dark:text-gray-100"
              >
                <option value="" disabled>Pilih Dompet...</option>
                {wallets.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            ) : (
              <div className="text-sm text-red-500 dark:text-red-400 font-medium px-1 py-1">Belum ada dompet, silakan buat di menu Dompet & Rekening terlebih dahulu.</div>
            )}
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 px-4 py-2 text-white rounded-xl font-medium transition-colors ${
                isIncome 
                  ? 'bg-emerald-500 hover:bg-emerald-600' 
                  : 'bg-red-500 hover:bg-red-600'
              } ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {loading ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
