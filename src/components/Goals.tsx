import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Wallet as WalletIcon, Trash2, Edit2, X } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import { Goal, Wallet as WalletType } from '../types';

export default function Goals({ user }: { user: User }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [wallets, setWallets] = useState<WalletType[]>([]);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [initialAmount, setInitialAmount] = useState('');
  const [initialWalletId, setInitialWalletId] = useState('');
  const [status, setStatus] = useState<'active' | 'completed'>('active');
  const [loading, setLoading] = useState(false);
  const [addingProgressId, setAddingProgressId] = useState<string | null>(null);
  const [progressAmount, setProgressAmount] = useState('');
  const [progressWalletId, setProgressWalletId] = useState('');
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Edit form states
  const [editName, setEditName] = useState('');
  const [editTarget, setEditTarget] = useState('');
  const [editCurrent, setEditCurrent] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'completed'>('active');
  const [editWalletId, setEditWalletId] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'goals'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setGoals(snap.docs.map(d => ({ id: d.id, ...d.data() } as Goal)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'goals');
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    const q = query(collection(db, 'wallets'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setWallets(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'wallets');
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

  const handleInitialAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInitialAmount(formatNominal(e.target.value));
  };

  const handleProgressChange = (e: ChangeEvent<HTMLInputElement>) => {
    setProgressAmount(formatNominal(e.target.value));
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    const numericTarget = Number(parseNominal(target));
    const numericInitialAmount = Number(parseNominal(initialAmount)) || 0;

    if (!name || !numericTarget) {
      alert("Mohon lengkapi nama dan nominal target.");
      return;
    }

    if (numericInitialAmount > 0 && !initialWalletId) {
      alert("Silakan pilih dompet untuk menyimpan saldo awal.");
      return;
    }

    setLoading(true);
    try {
      const goalData: any = {
        userId: user.uid,
        name,
        targetAmount: numericTarget,
        currentAmount: numericInitialAmount,
        status: numericInitialAmount >= numericTarget ? 'completed' : 'active',
        createdAt: serverTimestamp()
      };
      if (deadline) goalData.deadline = deadline;

      const docRef = await addDoc(collection(db, 'goals'), goalData);

      if (numericInitialAmount > 0 && initialWalletId) {
        addDoc(collection(db, 'transactions'), {
          userId: user.uid,
          type: 'income',
          amount: numericInitialAmount,
          description: `Saldo awal target: ${name}`,
          category: 'Tabungan',
          walletId: initialWalletId,
          goalId: docRef.id,
          date: new Date().toISOString(),
          createdAt: serverTimestamp()
        }).catch(error => {
          handleFirestoreError(error, OperationType.WRITE, 'transactions');
        });
      }
      setName('');
      setTarget('');
      setDeadline('');
      setInitialAmount('');
      setInitialWalletId('');
      setStatus('active');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'goals');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingGoal) return;

    const numericTarget = Number(parseNominal(editTarget));
    const numericCurrent = Number(parseNominal(editCurrent));

    if (!editName || !numericTarget) {
      alert("Mohon lengkapi nama dan nominal target.");
      return;
    }

    const diff = numericCurrent - editingGoal.currentAmount;
    if (diff !== 0 && !editWalletId) {
      alert("Silakan pilih dompet untuk mencatat perubahan saldo tabungan.");
      return;
    }

    setLoading(true);
    try {
      const updateData: any = {
        name: editName,
        targetAmount: numericTarget,
        currentAmount: numericCurrent,
        status: numericCurrent >= numericTarget ? 'completed' : editStatus
      };
      if (editDeadline) updateData.deadline = editDeadline;
      else updateData.deadline = null;

      await updateDoc(doc(db, 'goals', editingGoal.id), updateData);

      if (diff !== 0) {
        await addDoc(collection(db, 'transactions'), {
          userId: user.uid,
          type: diff > 0 ? 'income' : 'expense',
          amount: Math.abs(diff),
          description: `Penyesuaian tabungan: ${editName}`,
          category: 'Tabungan',
          walletId: editWalletId,
          goalId: editingGoal.id,
          date: new Date().toISOString(),
          createdAt: serverTimestamp()
        });
      }

      setIsEditModalOpen(false);
      setEditingGoal(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'goals');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      deleteDoc(doc(db, 'goals', deleteId)).catch(error => {
        handleFirestoreError(error, OperationType.DELETE, `goals/${deleteId}`);
      });
      setDeleteId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `goals/${deleteId}`);
    }
  };

  const startEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setEditName(goal.name);
    setEditTarget(formatNominal(goal.targetAmount.toString()));
    setEditCurrent(formatNominal(goal.currentAmount.toString()));
    setEditDeadline(goal.deadline || '');
    setEditStatus(goal.status || 'active');
    setEditWalletId('');
    setIsEditModalOpen(true);
  };

  const cancelEdit = () => {
    setEditingGoal(null);
    setIsEditModalOpen(false);
  };

  const handleAddProgress = async (goal: Goal) => {
    const numericAmount = Number(parseNominal(progressAmount));
    if (!numericAmount || numericAmount <= 0) {
      return;
    }
    if (!progressWalletId) {
      alert("Silakan pilih dompet untuk menyimpan tabungan.");
      return;
    }
    
    setLoading(true);
    try {
      const newAmount = goal.currentAmount + numericAmount;
      const newStatus = newAmount >= goal.targetAmount ? 'completed' : goal.status;

      // Update goal amount and potentially status
      updateDoc(doc(db, 'goals', goal.id), {
        currentAmount: newAmount,
        status: newStatus
      }).catch(error => {
        handleFirestoreError(error, OperationType.WRITE, 'goals/progress');
      });

      // Create income transaction
      addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        type: 'income',
        amount: numericAmount,
        description: `Menabung untuk: ${goal.name}`,
        category: 'Tabungan',
        walletId: progressWalletId,
        goalId: goal.id,
        date: new Date().toISOString(),
        createdAt: serverTimestamp()
      }).catch(error => {
        handleFirestoreError(error, OperationType.WRITE, 'transactions');
      });

      setAddingProgressId(null);
      setProgressAmount('');
      setProgressWalletId('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'goals/progress');
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

  const activeGoals = goals.filter(g => g.status !== 'completed');
  const completedGoals = goals.filter(g => g.status === 'completed');

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6 font-sans">Target & Tabungan</h1>
      
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-8 transition-colors duration-300">
        <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">
          Tambah Target Baru
        </h2>
        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Nama Target</label>
            <input type="text" maxLength={100} value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 dark:text-gray-100 transition-colors duration-300" placeholder="Contoh: Liburan, Beli Gadget" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Nominal Target (Rp)</label>
            <input type="text" inputMode="numeric" value={target} onChange={handleTargetChange} className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 dark:text-gray-100 transition-colors duration-300" placeholder="0" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Tenggat Waktu (Deadline) <span className="text-gray-400 dark:text-gray-500 text-xs font-normal">(Opsional)</span></label>
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 dark:text-gray-100 transition-colors duration-300" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Saldo Saat Ini (Rp) <span className="text-gray-400 dark:text-gray-500 text-xs font-normal">(Opsional)</span></label>
            <input type="text" inputMode="numeric" value={initialAmount} onChange={handleInitialAmountChange} className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 dark:text-gray-100 transition-colors duration-300" placeholder="0" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Simpan di Dompet <span className="text-gray-400 dark:text-gray-500 text-xs font-normal">(Opsional)</span></label>
            <select value={initialWalletId} onChange={e => setInitialWalletId(e.target.value)} className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 dark:text-gray-100 transition-colors duration-300">
              <option value="">Pilih Dompet...</option>
              {wallets.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-3 flex gap-2 justify-end mt-2">
            <button type="submit" disabled={loading} className="bg-blue-500 text-white px-8 py-2 rounded-xl h-[42px] hover:bg-blue-600 font-medium transition-colors disabled:opacity-70">
              {loading ? 'Menyimpan...' : 'Buat Target'}
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          Target Aktif <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs px-2 py-0.5 rounded-full">{activeGoals.length}</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {activeGoals.map(goal => {
            const progress = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
            const isAdding = addingProgressId === goal.id;

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
                    {goal.deadline && (
                      <span className="flex items-center gap-1 text-xs text-blue-500 dark:text-blue-400 font-medium mt-1">
                        Tenggat: {new Date(goal.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
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
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">* Saldo dompet akan bertambah sebagai pemasukan.</p>
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
                  <button onClick={() => { setAddingProgressId(goal.id); setProgressWalletId(''); }} className="w-full py-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors border border-gray-200 dark:border-gray-700">
                    + Tambah Tabungan
                  </button>
                )}
              </div>
            );
          })}
          {activeGoals.length === 0 && <p className="text-gray-500 dark:text-gray-400 col-span-2 text-center py-8">Belum ada target tabungan aktif.</p>}
        </div>
      </div>

      {completedGoals.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            Target Selesai <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs px-2 py-0.5 rounded-full">{completedGoals.length}</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {completedGoals.map(goal => {
              const progress = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));

              return (
                <div key={goal.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-emerald-100 dark:border-emerald-900/30 p-6 hover:shadow-md transition-all duration-300 group relative opacity-80 hover:opacity-100">
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
                      <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 line-through decoration-emerald-500/50">{goal.name}</h3>
                      {goal.deadline && (
                        <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                          Tenggat: {new Date(goal.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1 rounded-lg">Selesai</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 mb-4 overflow-hidden">
                    <div className="bg-emerald-500 h-3 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                  </div>
                  <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Terkumpul: {formatCurrency(goal.currentAmount)}</span>
                    <span>Target: {formatCurrency(goal.targetAmount)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Hapus Target Tabungan"
        message="Yakin ingin menghapus target tabungan ini? Data tabungan yang sudah terkumpul akan hilang."
      />

      {/* Edit Goal Modal */}
      {isEditModalOpen && editingGoal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Edit Target</h2>
              <button onClick={cancelEdit} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Nama Target</label>
                <input 
                  type="text" 
                  value={editName} 
                  onChange={e => setEditName(e.target.value)} 
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 dark:text-gray-100" 
                  required 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Nominal Target (Rp)</label>
                  <input 
                    type="text" 
                    inputMode="numeric" 
                    value={editTarget} 
                    onChange={e => setEditTarget(formatNominal(e.target.value))} 
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 dark:text-gray-100" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Tabungan Saat Ini (Rp)</label>
                  <input 
                    type="text" 
                    inputMode="numeric" 
                    value={editCurrent} 
                    onChange={e => setEditCurrent(formatNominal(e.target.value))} 
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 dark:text-gray-100" 
                    required 
                  />
                </div>
              </div>
              
              {/* Wallet selection if current amount changes */}
              {Number(parseNominal(editCurrent)) !== editingGoal.currentAmount && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-2xl animate-in slide-in-from-top-2 duration-200">
                  <label className="block text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">Pilih Dompet untuk Penyesuaian</label>
                  <select 
                    value={editWalletId} 
                    onChange={e => setEditWalletId(e.target.value)} 
                    className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-blue-200 dark:border-blue-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-800 dark:text-gray-100"
                    required
                  >
                    <option value="">Pilih Dompet...</option>
                    {wallets.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-blue-500 mt-2">
                    * Perubahan saldo akan dicatat sebagai {Number(parseNominal(editCurrent)) > editingGoal.currentAmount ? 'Pemasukan' : 'Pengeluaran'}.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Deadline</label>
                  <input 
                    type="date" 
                    value={editDeadline} 
                    onChange={e => setEditDeadline(e.target.value)} 
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 dark:text-gray-100" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Status</label>
                  <select 
                    value={editStatus} 
                    onChange={e => setEditStatus(e.target.value as 'active' | 'completed')} 
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 dark:text-gray-100"
                  >
                    <option value="active">Aktif</option>
                    <option value="completed">Selesai</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={cancelEdit} 
                  className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={loading} 
                  className="flex-1 py-3 bg-blue-500 text-white rounded-2xl font-bold hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-70"
                >
                  {loading ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
