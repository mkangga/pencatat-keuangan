import { useState, FormEvent, useEffect, ChangeEvent } from 'react';
import { User } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { X } from 'lucide-react';
import { Wallet, Category, Transaction } from '../types';

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className={`px-6 py-4 border-b flex justify-between items-center ${
          isIncome ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'
        }`}>
          <h3 className={`font-semibold text-lg ${isIncome ? 'text-emerald-800' : 'text-red-800'}`}>
            {isEditing ? 'Edit' : 'Tambah'} {isIncome ? 'Pemasukan' : 'Pengeluaran'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah (Rp)</label>
            <input
              type="text"
              inputMode="numeric"
              required
              value={amount}
              onChange={handleAmountChange}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan</label>
            <input
              type="text"
              required
              maxLength={100}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
              placeholder="Contoh: Gaji bulan ini"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Waktu</label>
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
            {filteredCategories.length > 0 ? (
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white"
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
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                placeholder="Buat kategori di menu Kategori Transaksi"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dompet / Rekening</label>
            {wallets.length > 0 ? (
              <select
                value={walletId}
                required
                onChange={(e) => setWalletId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white"
              >
                <option value="" disabled>Pilih Dompet...</option>
                {wallets.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            ) : (
              <div className="text-sm text-red-500 font-medium px-1 py-1">Belum ada dompet, silakan buat di menu Dompet & Rekening terlebih dahulu.</div>
            )}
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-medium transition-colors"
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
