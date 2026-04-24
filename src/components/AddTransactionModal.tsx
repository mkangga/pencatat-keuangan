import { useState, FormEvent, useEffect, ChangeEvent, useMemo } from 'react';
import { User } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, updateDoc, doc, query, where, onSnapshot, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { X, Wallet as WalletIcon, Tag, AlertCircle, Target } from 'lucide-react';
import { Wallet, Category, Transaction, Goal } from '../types';
import { useNavigate } from 'react-router-dom';
import CustomSelect from './CustomSelect';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'income' | 'expense';
  user: User;
  wallets: Wallet[];
  categories: Category[];
  editingTransaction?: Transaction | null;
  transactions: Transaction[];
}

export default function AddTransactionModal({ 
  isOpen, 
  onClose, 
  type, 
  user, 
  wallets, 
  categories,
  editingTransaction,
  transactions
}: AddTransactionModalProps) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(new Date().toTimeString().split(' ')[0].slice(0, 5));
  const [category, setCategory] = useState('');
  const [walletId, setWalletId] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
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

  const topDescriptions = useMemo(() => {
    const counts: Record<string, number> = {};
    transactions.filter(t => t.type === type).forEach(t => {
      if (t.description) {
        const desc = t.description.trim();
        if (desc) {
          counts[desc] = (counts[desc] || 0) + 1;
        }
      }
    });
    
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(entry => entry[0]);
  }, [transactions, type]);

  const allUniqueDescriptions = useMemo(() => {
    const descSet = new Set<string>();
    transactions.filter(t => t.type === type).forEach(t => {
      if (t.description) descSet.add(t.description.trim());
    });
    return Array.from(descSet);
  }, [transactions, type]);

  const filteredSuggestions = useMemo(() => {
    if (!description) return [];
    return allUniqueDescriptions
      .filter(desc => desc.toLowerCase().includes(description.toLowerCase()) && desc !== description)
      .slice(0, 5);
  }, [description, allUniqueDescriptions]);

  const handleDescriptionChange = (newDesc: string) => {
    setDescription(newDesc);
    
    // Find the most recent transaction with this exact description
    const pastTx = transactions.find(t => 
      t.type === type && 
      t.description?.toLowerCase() === newDesc.toLowerCase()
    );
    
    if (pastTx) {
      if (pastTx.category && filteredCategories.some(c => c.name === pastTx.category)) {
        setCategory(pastTx.category);
      }
      if (pastTx.walletId && wallets.some(w => w.id === pastTx.walletId)) {
        setWalletId(pastTx.walletId);
      }
    }
  };

  useEffect(() => {
    if (isOpen && !hasInitialized) {
      if (editingTransaction) {
        const txDate = new Date(editingTransaction.date);
        setAmount(formatNominal(editingTransaction.amount.toString()));
        setDescription(editingTransaction.description);
        setNotes(editingTransaction.notes || '');
        setDate(txDate.toISOString().split('T')[0]);
        setTime(txDate.toTimeString().split(' ')[0].slice(0, 5));
        setCategory(editingTransaction.category || '');
        setWalletId(editingTransaction.walletId || '');
      } else {
        setAmount('');
        setDescription('');
        setNotes('');
        setDate(new Date().toISOString().split('T')[0]);
        setTime(new Date().toTimeString().split(' ')[0].slice(0, 5));
        
        // Calculate most frequent category
        const catCounts: Record<string, number> = {};
        transactions.filter(t => t.type === type).forEach(t => {
          if (t.category) catCounts[t.category] = (catCounts[t.category] || 0) + 1;
        });
        let maxCatCount = 0;
        let mostFreqCat = filteredCategories.length > 0 ? filteredCategories[0].name : '';
        for (const catName in catCounts) {
          if (catCounts[catName] > maxCatCount && filteredCategories.some(c => c.name === catName)) {
            maxCatCount = catCounts[catName];
            mostFreqCat = catName;
          }
        }

        // Calculate most frequent wallet
        const walCounts: Record<string, number> = {};
        transactions.forEach(t => {
          if (t.walletId) walCounts[t.walletId] = (walCounts[t.walletId] || 0) + 1;
        });
        let maxWalCount = 0;
        let mostFreqWal = wallets.length > 0 ? wallets[0].id : '';
        for (const wId in walCounts) {
          if (walCounts[wId] > maxWalCount && wallets.some(w => w.id === wId)) {
            maxWalCount = walCounts[wId];
            mostFreqWal = wId;
          }
        }

        setCategory(mostFreqCat);
        setWalletId(mostFreqWal);
      }
      setHasInitialized(true);
    } else if (!isOpen) {
      setHasInitialized(false);
    }
  }, [isOpen, hasInitialized, type, wallets, filteredCategories, editingTransaction, transactions]);

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
      const [year, month, day] = date.split('-').map(Number);
      const [hours, minutes] = time.split(':').map(Number);
      const fullDate = new Date(year, month - 1, day, hours, minutes);
      
      if (isNaN(fullDate.getTime())) {
        throw new Error("Invalid date or time format");
      }

      const txData: any = {
        userId: user.uid,
        type,
        amount: numericAmount,
        description,
        notes,
        date: fullDate.toISOString(),
        updatedAt: serverTimestamp(),
      };
      if (category) txData.category = category;
      txData.walletId = walletId;

      if (editingTransaction) {
        if (editingTransaction.goalId) {
          const goalRef = doc(db, 'goals', editingTransaction.goalId);
          const goalSnap = await getDoc(goalRef);
          if (goalSnap.exists()) {
            const currentAmount = goalSnap.data().currentAmount || 0;
            // Reverse the old amount, then apply the new amount
            const oldImpact = editingTransaction.type === 'income' ? editingTransaction.amount : -editingTransaction.amount;
            const newImpact = type === 'income' ? numericAmount : -numericAmount;
            
            await updateDoc(goalRef, {
              currentAmount: currentAmount - oldImpact + newImpact
            });
          }
        }
        updateDoc(doc(db, 'transactions', editingTransaction.id), txData).catch(error => {
          handleFirestoreError(error, OperationType.WRITE, 'transactions');
        });
      } else {
        txData.createdAt = serverTimestamp();
        addDoc(collection(db, 'transactions'), txData).catch(error => {
          handleFirestoreError(error, OperationType.WRITE, 'transactions');
        });
      }
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'transactions');
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Judul</label>
            <div className="relative">
              <input
                type="text"
                required
                maxLength={100}
                value={description}
                onChange={(e) => {
                  handleDescriptionChange(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                placeholder="Contoh: Gaji bulan ini"
              />
              {showSuggestions && filteredSuggestions.length > 0 && (
                <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-40 overflow-auto">
                  {filteredSuggestions.map((suggestion, idx) => (
                    <li
                      key={idx}
                      onClick={() => {
                        handleDescriptionChange(suggestion);
                        setShowSuggestions(false);
                      }}
                      className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 cursor-pointer transition-colors"
                    >
                      {suggestion}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {topDescriptions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {topDescriptions.map((desc, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleDescriptionChange(desc)}
                    className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full hover:bg-emerald-100 hover:text-emerald-700 dark:hover:bg-emerald-900/50 dark:hover:text-emerald-400 transition-colors border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800"
                  >
                    {desc}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Deskripsi <span className="text-gray-400 dark:text-gray-500 text-xs font-normal">(Opsional)</span></label>
            <textarea
              rows={2}
              maxLength={250}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 resize-none"
              placeholder="Tambahkan catatan tambahan jika perlu..."
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
              <CustomSelect
                value={category}
                onChange={setCategory}
                options={filteredCategories.map(c => ({ value: c.name, label: c.name }))}
              />
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
              <CustomSelect
                value={walletId}
                required
                onChange={setWalletId}
                placeholder="Pilih Dompet..."
                options={wallets.map(w => ({ value: w.id, label: w.name }))}
              />
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
