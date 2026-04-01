import { useState, useEffect, FormEvent, ChangeEvent, useMemo } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Debt, Wallet } from '../types';
import { Trash2, Calendar as CalendarIcon, CheckCircle2, XCircle, ArrowUpRight, ArrowDownRight, AlertCircle, RotateCcw } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import { format, isPast, isToday, parseISO, startOfDay } from 'date-fns';
import { id } from 'date-fns/locale';

interface DebtsProps {
  user: User;
  wallets: Wallet[];
}

export default function Debts({ user, wallets }: DebtsProps) {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'payable' | 'receivable'>('payable');
  const [dueDate, setDueDate] = useState('');
  const [recordTransaction, setRecordTransaction] = useState(false);
  const [selectedWalletId, setSelectedWalletId] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'unpaid' | 'paid'>('unpaid');

  // Modal for paying debt
  const [payDebt, setPayDebt] = useState<Debt | null>(null);
  const [payRecordTransaction, setPayRecordTransaction] = useState(false);
  const [payWalletId, setPayWalletId] = useState('');
  const [payLoading, setPayLoading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'debts'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setDebts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Debt)).sort((a, b) => {
        // Sort by due date (closest first), then by creation date
        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return 0;
      }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'debts');
    });
    return () => unsub();
  }, [user]);

  // Set default wallet
  useEffect(() => {
    if (wallets.length > 0 && !selectedWalletId) {
      setSelectedWalletId(wallets[0].id);
    }
    if (wallets.length > 0 && !payWalletId) {
      setPayWalletId(wallets[0].id);
    }
  }, [wallets, selectedWalletId, payWalletId]);

  const formatNominal = (value: string) => {
    if (!value) return '';
    const number = value.replace(/\D/g, '');
    return new Intl.NumberFormat('id-ID').format(Number(number));
  };

  const parseNominal = (value: string) => {
    return value.replace(/\./g, '');
  };

  const handleAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    setAmount(formatNominal(e.target.value));
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

  const summary = useMemo(() => {
    const unpaid = debts.filter(d => d.status === 'unpaid');
    const totalPayable = unpaid.filter(d => d.type === 'payable').reduce((sum, d) => sum + d.amount, 0);
    const totalReceivable = unpaid.filter(d => d.type === 'receivable').reduce((sum, d) => sum + d.amount, 0);
    return { totalPayable, totalReceivable };
  }, [debts]);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(parseNominal(amount));
    if (!numericAmount || !description) return;
    setLoading(true);
    
    try {
      const batch = writeBatch(db);
      
      const debtRef = doc(collection(db, 'debts'));
      batch.set(debtRef, {
        userId: user.uid,
        type,
        amount: numericAmount,
        description,
        status: 'unpaid',
        dueDate: dueDate || null,
        createdAt: serverTimestamp()
      });

      if (recordTransaction && selectedWalletId) {
        const txRef = doc(collection(db, 'transactions'));
        batch.set(txRef, {
          userId: user.uid,
          // Hutang (I borrow) -> Income. Piutang (I lend) -> Expense.
          type: type === 'payable' ? 'income' : 'expense',
          amount: numericAmount,
          description: `${type === 'payable' ? 'Pinjaman dari' : 'Memberi pinjaman ke'}: ${description}`,
          category: 'Hutang/Piutang',
          date: new Date().toISOString(),
          walletId: selectedWalletId,
          createdAt: serverTimestamp()
        });
      }

      await batch.commit();

      setAmount('');
      setDescription('');
      setDueDate('');
      setRecordTransaction(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'debts');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, 'debts', deleteId));
      setDeleteId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `debts/${deleteId}`);
    }
  };

  const handleConfirmPay = async () => {
    if (!payDebt) return;
    setPayLoading(true);
    
    try {
      const batch = writeBatch(db);
      
      const debtRef = doc(db, 'debts', payDebt.id);
      batch.update(debtRef, { status: 'paid' });

      if (payRecordTransaction && payWalletId) {
        const txRef = doc(collection(db, 'transactions'));
        batch.set(txRef, {
          userId: user.uid,
          // Pay Hutang (I pay back) -> Expense. Pay Piutang (I get paid back) -> Income.
          type: payDebt.type === 'payable' ? 'expense' : 'income',
          amount: payDebt.amount,
          description: `${payDebt.type === 'payable' ? 'Bayar hutang ke' : 'Terima pembayaran dari'}: ${payDebt.description}`,
          category: 'Hutang/Piutang',
          date: new Date().toISOString(),
          walletId: payWalletId,
          createdAt: serverTimestamp()
        });
      }

      await batch.commit();
      setPayDebt(null);
      setPayRecordTransaction(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `debts/${payDebt.id}`);
    } finally {
      setPayLoading(false);
    }
  };

  const handleRevertStatus = async (debt: Debt) => {
    try {
      await updateDoc(doc(db, 'debts', debt.id), { status: 'unpaid' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `debts/${debt.id}`);
    }
  };

  const filteredDebts = debts.filter(d => d.status === activeTab);

  const getStatusColor = (debt: Debt) => {
    if (debt.status === 'paid') return 'text-gray-500';
    if (!debt.dueDate) return 'text-gray-500';
    
    const due = startOfDay(parseISO(debt.dueDate));
    const today = startOfDay(new Date());
    
    if (isPast(due) && !isToday(due)) return 'text-red-500 font-bold';
    if (isToday(due)) return 'text-amber-500 font-bold';
    return 'text-gray-500';
  };

  const getStatusText = (debt: Debt) => {
    if (debt.status === 'paid') return 'Lunas';
    if (!debt.dueDate) return 'Belum Lunas';
    
    const due = startOfDay(parseISO(debt.dueDate));
    const today = startOfDay(new Date());
    
    if (isPast(due) && !isToday(due)) return 'Jatuh Tempo!';
    if (isToday(due)) return 'Jatuh Tempo Hari Ini';
    return 'Belum Lunas';
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6 font-sans">Utang & Piutang</h1>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
          <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
            <div className="p-1.5 sm:p-2 bg-red-100 dark:bg-red-900/30 rounded-xl text-red-600 dark:text-red-400">
              <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <h3 className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 leading-tight">Total Utang <span className="hidden sm:inline">(Saya Pinjam)</span></h3>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(summary.totalPayable)}</p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
          <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
            <div className="p-1.5 sm:p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400">
              <ArrowDownRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <h3 className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 leading-tight">Total Piutang <span className="hidden sm:inline">(Orang Pinjam)</span></h3>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(summary.totalReceivable)}</p>
        </div>
      </div>

      {/* Add Form */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 transition-colors duration-300">
        <h2 className="text-lg font-semibold mb-6 text-gray-800 dark:text-gray-100">Catat Baru</h2>
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Jenis</label>
              <select value={type} onChange={e => setType(e.target.value as any)} className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-gray-800 dark:text-gray-100 transition-colors duration-300">
                <option value="payable">Utang (Saya meminjam)</option>
                <option value="receivable">Piutang (Orang meminjam)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Jumlah (Rp)</label>
              <input type="text" inputMode="numeric" value={amount} onChange={handleAmountChange} className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-gray-800 dark:text-gray-100 transition-colors duration-300" placeholder="0" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Keterangan / Nama</label>
              <input type="text" maxLength={100} value={description} onChange={e => setDescription(e.target.value)} className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-gray-800 dark:text-gray-100 transition-colors duration-300" placeholder="Contoh: Pinjam Budi" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Jatuh Tempo (Opsional)</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-gray-800 dark:text-gray-100 transition-colors duration-300" />
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative flex items-center justify-center">
                  <input 
                    type="checkbox" 
                    checked={recordTransaction}
                    onChange={(e) => setRecordTransaction(e.target.checked)}
                    className="peer appearance-none w-5 h-5 border-2 border-gray-300 dark:border-gray-600 rounded-md checked:bg-emerald-500 checked:border-emerald-500 transition-colors cursor-pointer"
                  />
                  <CheckCircle2 size={14} className="absolute text-white opacity-0 peer-checked:opacity-100 pointer-events-none" />
                </div>
                <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">
                  Catat sebagai transaksi ke dompet
                </span>
              </label>
              
              {recordTransaction && (
                <div className="pl-7 animate-in fade-in slide-in-from-top-2 duration-200">
                  <select 
                    value={selectedWalletId} 
                    onChange={e => setSelectedWalletId(e.target.value)} 
                    className="px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-gray-800 dark:text-gray-100 transition-colors duration-300"
                    required={recordTransaction}
                  >
                    <option value="" disabled>Pilih Dompet</option>
                    {wallets.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {type === 'payable' 
                      ? 'Saldo dompet akan bertambah (Pemasukan)' 
                      : 'Saldo dompet akan berkurang (Pengeluaran)'}
                  </p>
                </div>
              )}
            </div>

            <button type="submit" disabled={loading} className="w-full sm:w-auto bg-emerald-500 text-white px-8 py-2.5 rounded-xl hover:bg-emerald-600 font-medium transition-colors disabled:opacity-70 flex items-center justify-center gap-2">
              {loading ? 'Menyimpan...' : 'Simpan Catatan'}
            </button>
          </div>
        </form>
      </div>

      {/* List */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300 overflow-hidden">
        <div className="flex border-b border-gray-100 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('unpaid')}
            className={`flex-1 py-4 text-sm font-medium transition-colors ${activeTab === 'unpaid' ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-500' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
          >
            Belum Lunas ({debts.filter(d => d.status === 'unpaid').length})
          </button>
          <button
            onClick={() => setActiveTab('paid')}
            className={`flex-1 py-4 text-sm font-medium transition-colors ${activeTab === 'paid' ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-500' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
          >
            Sudah Lunas ({debts.filter(d => d.status === 'paid').length})
          </button>
        </div>

        <div className="p-6 space-y-4">
          {filteredDebts.map(debt => (
            <div key={debt.id} className={`group relative flex flex-col sm:flex-row justify-between sm:items-center p-5 border rounded-xl transition-colors gap-4 ${debt.status === 'paid' ? 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-70' : 'border-gray-200 dark:border-gray-700 hover:border-emerald-200 dark:hover:border-emerald-800 hover:shadow-md'}`}>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${debt.type === 'payable' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'}`}>
                    {debt.type === 'payable' ? 'UTANG SAYA' : 'PIUTANG ORANG'}
                  </span>
                  {debt.dueDate && (
                    <span className={`flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-700 ${getStatusColor(debt)}`}>
                      {debt.status === 'unpaid' && isPast(startOfDay(parseISO(debt.dueDate))) && !isToday(startOfDay(parseISO(debt.dueDate))) ? (
                        <AlertCircle size={12} />
                      ) : (
                        <CalendarIcon size={12} />
                      )}
                      {format(parseISO(debt.dueDate), 'dd MMM yyyy', { locale: id })}
                      {debt.status === 'unpaid' && ` • ${getStatusText(debt)}`}
                    </span>
                  )}
                </div>
                <p className={`font-medium text-lg ${debt.status === 'paid' ? 'text-gray-500 dark:text-gray-400 line-through' : 'text-gray-800 dark:text-gray-100'}`}>
                  {debt.description}
                </p>
                <p className={`text-xl font-bold mt-1 ${debt.status === 'paid' ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>
                  {formatCurrency(debt.amount)}
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                {debt.status === 'unpaid' ? (
                  <button 
                    onClick={() => setPayDebt(debt)}
                    className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm transition-all hover:shadow-md flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={18} />
                    Tandai Lunas
                  </button>
                ) : (
                  <button 
                    onClick={() => handleRevertStatus(debt)}
                    className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <RotateCcw size={16} />
                    Batal Lunas
                  </button>
                )}
                <button 
                  onClick={() => setDeleteId(debt.id)}
                  className="p-2.5 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-all sm:opacity-0 sm:group-hover:opacity-100"
                  title="Hapus"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
          {filteredDebts.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} className="text-gray-300 dark:text-gray-600" />
              </div>
              <p className="text-gray-500 dark:text-gray-400 font-medium">
                {activeTab === 'unpaid' ? 'Hore! Tidak ada utang/piutang yang belum lunas.' : 'Belum ada riwayat pelunasan.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Pay Debt Modal */}
      {payDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Pelunasan {payDebt.type === 'payable' ? 'Utang' : 'Piutang'}</h3>
              <button 
                onClick={() => { setPayDebt(null); setPayRecordTransaction(false); }}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
              >
                <XCircle size={24} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{payDebt.description}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(payDebt.amount)}</p>
              </div>

              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center mt-0.5">
                    <input 
                      type="checkbox" 
                      checked={payRecordTransaction}
                      onChange={(e) => setPayRecordTransaction(e.target.checked)}
                      className="peer appearance-none w-5 h-5 border-2 border-gray-300 dark:border-gray-600 rounded-md checked:bg-emerald-500 checked:border-emerald-500 transition-colors cursor-pointer"
                    />
                    <CheckCircle2 size={14} className="absolute text-white opacity-0 peer-checked:opacity-100 pointer-events-none" />
                  </div>
                  <div className="flex-1">
                    <span className="block text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">
                      Catat pembayaran ke dompet
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {payDebt.type === 'payable' 
                        ? 'Saldo dompet akan berkurang (Pengeluaran)' 
                        : 'Saldo dompet akan bertambah (Pemasukan)'}
                    </span>
                  </div>
                </label>

                {payRecordTransaction && (
                  <div className="pl-8 animate-in fade-in slide-in-from-top-2 duration-200">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Pilih Dompet</label>
                    <select 
                      value={payWalletId} 
                      onChange={e => setPayWalletId(e.target.value)} 
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-gray-800 dark:text-gray-100 transition-colors duration-300"
                      required={payRecordTransaction}
                    >
                      <option value="" disabled>Pilih Dompet</option>
                      {wallets.map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 flex gap-3 justify-end">
              <button
                onClick={() => { setPayDebt(null); setPayRecordTransaction(false); }}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmPay}
                disabled={payLoading}
                className="px-6 py-2 text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-colors disabled:opacity-70 flex items-center gap-2"
              >
                {payLoading ? 'Menyimpan...' : 'Konfirmasi Lunas'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Hapus Catatan"
        message="Yakin ingin menghapus catatan utang/piutang ini? Tindakan ini tidak akan menghapus transaksi dompet yang sudah tercatat."
      />
    </div>
  );
}
