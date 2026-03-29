import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Wallet as WalletIcon, Trash2, Edit2 } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import { Goal, Wallet as WalletType } from '../types';

export default function Goals({ user }: { user: User }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [wallets, setWallets] = useState<WalletType[]>([]);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [current, setCurrent] = useState('0');
  const [selectedWalletId, setSelectedWalletId] = useState('');
  const [loading, setLoading] = useState(false);
  const [addingProgressId, setAddingProgressId] = useState<string | null>(null);
  const [progressAmount, setProgressAmount] = useState('');
  const [progressWalletId, setProgressWalletId] = useState('');
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'goals'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setGoals(snap.docs.map(d => ({ id: d.id, ...d.data() } as Goal)));
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    const q = query(collection(db, 'wallets'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setWallets(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    });
    return () => unsub();
  }, [user]);

  const formatNominal = (value: string) => {
    if (!value) return '';
    const number = value.replace(/\D/g, '');
    return new Intl.NumberFormat('id-ID').format(Number(number));
  };

  const parseNominal = (value: string) => {
    return value.replace(/\./g, '');
  };

  const handleTargetChange = (e: ChangeEvent<HTMLInputElement>) => {
    setTarget(formatNominal(e.target.value));
  };

  const handleCurrentChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCurrent(formatNominal(e.target.value));
  };

  const handleProgressChange = (e: ChangeEvent<HTMLInputElement>) => {
    setProgressAmount(formatNominal(e.target.value));
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    const numericTarget = Number(parseNominal(target));
    const numericCurrent = Number(parseNominal(current));
    if (!name || !numericTarget || !selectedWalletId) {
      if (!selectedWalletId) alert("Silakan pilih dompet / rekening penyimpanan.");
      return;
    }
    setLoading(true);
    try {
      if (editingGoal) {
        await updateDoc(doc(db, 'goals', editingGoal.id), {
          name,
          targetAmount: numericTarget,
          currentAmount: numericCurrent,
          walletId: selectedWalletId
        });
        setEditingGoal(null);
      } else {
        const goalRef = await addDoc(collection(db, 'goals'), {
          userId: user.uid,
          name,
          targetAmount: numericTarget,
          currentAmount: numericCurrent,
          walletId: selectedWalletId,
          createdAt: serverTimestamp()
        });

        // If initial balance is provided and wallet is selected, create a transaction
        if (numericCurrent > 0 && selectedWalletId) {
          await addDoc(collection(db, 'transactions'), {
            userId: user.uid,
            type: 'income',
            amount: numericCurrent,
            description: `Saldo Awal Tabungan: ${name}`,
            category: 'Tabungan',
            walletId: selectedWalletId,
            date: new Date(),
            createdAt: serverTimestamp()
          });
        }
      }
      setName('');
      setTarget('');
      setCurrent('0');
      setSelectedWalletId('');
    } catch (error) {
      console.error("Error saving goal: ", error);
      alert("Gagal menyimpan target.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, 'goals', deleteId));
      setDeleteId(null);
    } catch (error) {
      console.error("Error deleting goal: ", error);
      alert("Gagal menghapus target.");
    }
  };

  const startEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setName(goal.name);
    setTarget(formatNominal(goal.targetAmount.toString()));
    setCurrent(formatNominal(goal.currentAmount.toString()));
    setSelectedWalletId(goal.walletId || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingGoal(null);
    setName('');
    setTarget('');
    setCurrent('0');
    setSelectedWalletId('');
  };

  const handleAddProgress = async (goal: Goal) => {
    const numericAmount = Number(parseNominal(progressAmount));
    if (!numericAmount || numericAmount <= 0 || !progressWalletId) {
      if (!progressWalletId) alert("Silakan pilih dompet / rekening sumber dana.");
      return;
    }
    
    setLoading(true);
    try {
      // Update goal amount
      await updateDoc(doc(db, 'goals', goal.id), {
        currentAmount: goal.currentAmount + numericAmount
      });

      setAddingProgressId(null);
      setProgressAmount('');
      const walletToUse = progressWalletId;
      setProgressWalletId('');

      // Create transaction
      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        type: 'income',
        amount: numericAmount,
        description: `Tabungan: ${goal.name}`,
        category: 'Tabungan',
        walletId: walletToUse,
        date: new Date(),
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error updating progress: ", error);
      alert("Gagal menambah tabungan.");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
    return formatted.replace('Rp', 'Rp ');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6 font-sans">Masa Depan (Tabungan)</h1>
      
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-8 transition-colors duration-300">
        <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">
          {editingGoal ? 'Edit Target Tabungan' : 'Buat Target Baru'}
        </h2>
        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Nama Target</label>
            <input type="text" maxLength={100} value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 dark:text-gray-100 transition-colors duration-300" placeholder="Contoh: Beli Motor" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Target Dana (Rp)</label>
            <input type="text" inputMode="numeric" value={target} onChange={handleTargetChange} className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 dark:text-gray-100 transition-colors duration-300" placeholder="0" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Saldo Saat Ini (Rp)</label>
            <input type="text" inputMode="numeric" value={current} onChange={handleCurrentChange} className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 dark:text-gray-100 transition-colors duration-300" placeholder="0" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Simpan Di</label>
            <select value={selectedWalletId} onChange={e => setSelectedWalletId(e.target.value)} className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 dark:text-gray-100 transition-colors duration-300" required>
              <option value="" disabled>Pilih Dompet...</option>
              {wallets.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-4 flex gap-2 justify-end">
            <button type="submit" disabled={loading} className="bg-blue-500 text-white px-8 py-2 rounded-xl h-[42px] hover:bg-blue-600 font-medium transition-colors disabled:opacity-70">
              {loading ? 'Menyimpan...' : editingGoal ? 'Update Target' : 'Buat Target'}
            </button>
            {editingGoal && (
              <button type="button" onClick={cancelEdit} className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-8 py-2 rounded-xl h-[42px] hover:bg-gray-200 dark:hover:bg-gray-600 font-medium transition-colors">
                Batal
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {goals.map(goal => {
          const progress = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
          const isAdding = addingProgressId === goal.id;
          const wallet = wallets.find(w => w.id === goal.walletId);

          return (
            <div key={goal.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 hover:shadow-md transition-all duration-300 group relative">
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => startEdit(goal)} className="p-2 text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors">
                  <Edit2 size={18} />
                </button>
                <button onClick={() => setDeleteId(goal.id)} className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                  <Trash2 size={18} />
                </button>
              </div>
              <div className="flex justify-between items-start mb-2 pr-16">
                <div>
                  <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">{goal.name}</h3>
                  {wallet && (
                    <span className="flex items-center gap-1 text-xs text-blue-500 dark:text-blue-400 font-medium mt-1">
                      <WalletIcon size={12} />
                      {wallet.name}
                    </span>
                  )}
                </div>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-lg">{progress}%</span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 mb-4 overflow-hidden">
                <div className="bg-blue-500 h-3 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
              </div>
              <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-6">
                <span className="font-medium text-gray-700 dark:text-gray-300">Terkumpul: {formatCurrency(goal.currentAmount)}</span>
                <span>Target: {formatCurrency(goal.targetAmount)}</span>
              </div>
              
              {isAdding ? (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input 
                      type="text" 
                      inputMode="numeric"
                      autoFocus
                      placeholder="Jumlah (Rp)..." 
                      value={progressAmount}
                      onChange={handleProgressChange}
                      className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-blue-200 dark:border-blue-900/40 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 dark:text-gray-100 transition-colors duration-300"
                    />
                    <select 
                      value={progressWalletId} 
                      required
                      onChange={e => setProgressWalletId(e.target.value)}
                      className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-blue-200 dark:border-blue-900/40 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-800 dark:text-gray-100 transition-colors duration-300"
                    >
                      <option value="" disabled>Pilih Dompet...</option>
                      {wallets.map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">* Saldo dompet akan bertambah otomatis.</p>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleAddProgress(goal)}
                      disabled={loading}
                      className="flex-1 py-2 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors disabled:opacity-70"
                    >
                      {loading ? '...' : 'Simpan'}
                    </button>
                    <button 
                      onClick={() => { setAddingProgressId(null); setProgressAmount(''); setProgressWalletId(''); }}
                      className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => { setAddingProgressId(goal.id); setProgressWalletId(goal.walletId || ''); }} className="w-full py-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors border border-gray-200 dark:border-gray-700">
                  + Tambah Tabungan
                </button>
              )}
            </div>
          );
        })}
        {goals.length === 0 && <p className="text-gray-500 dark:text-gray-400 col-span-2 text-center py-8">Belum ada target tabungan.</p>}
      </div>
      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Hapus Target Tabungan"
        message="Yakin ingin menghapus target tabungan ini? Data tabungan yang sudah terkumpul akan hilang."
      />
    </div>
  );
}
