import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Debt } from '../types';
import { Trash2, Calendar as CalendarIcon } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import { format } from 'date-fns';

export default function Debts({ user }: { user: User }) {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'payable' | 'receivable'>('payable');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'debts'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setDebts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Debt)));
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

  const handleAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    setAmount(formatNominal(e.target.value));
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(parseNominal(amount));
    if (!numericAmount || !description) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'debts'), {
        userId: user.uid,
        type,
        amount: numericAmount,
        description,
        status: 'unpaid',
        dueDate: dueDate || null,
        createdAt: serverTimestamp()
      });
      setAmount('');
      setDescription('');
      setDueDate('');
    } catch (error) {
      console.error("Error adding debt: ", error);
      alert("Gagal menambahkan catatan.");
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
      console.error("Error deleting debt: ", error);
      alert("Gagal menghapus catatan.");
    }
  };

  const toggleStatus = async (debt: Debt) => {
    try {
      await updateDoc(doc(db, 'debts', debt.id), {
        status: debt.status === 'paid' ? 'unpaid' : 'paid'
      });
    } catch (error) {
      console.error("Error updating status: ", error);
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
      <h1 className="text-2xl font-bold text-gray-800 mb-6 font-sans">Hutang & Piutang</h1>
      
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">Catat Baru</h2>
        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jenis</label>
            <select value={type} onChange={e => setType(e.target.value as any)} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none">
              <option value="payable">Hutang (Saya meminjam)</option>
              <option value="receivable">Piutang (Orang meminjam)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah (Rp)</label>
            <input type="text" inputMode="numeric" value={amount} onChange={handleAmountChange} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="0" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan / Nama</label>
            <input type="text" maxLength={100} value={description} onChange={e => setDescription(e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Contoh: Pinjam Budi" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jatuh Tempo (Opsional)</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" />
          </div>
          <div className="lg:col-span-4 flex justify-end">
            <button type="submit" disabled={loading} className="bg-emerald-500 text-white px-8 py-2 rounded-xl h-[42px] hover:bg-emerald-600 font-medium transition-colors disabled:opacity-70">
              {loading ? 'Menyimpan...' : 'Simpan Catatan'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">Daftar Catatan</h2>
        <div className="space-y-4">
          {debts.map(debt => (
            <div key={debt.id} className="group relative flex flex-col sm:flex-row justify-between sm:items-center p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${debt.type === 'payable' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                    {debt.type === 'payable' ? 'HUTANG' : 'PIUTANG'}
                  </span>
                  {debt.dueDate && (
                    <span className="flex items-center gap-1 text-[10px] text-gray-500 font-medium">
                      <CalendarIcon size={10} />
                      Jatuh Tempo: {format(new Date(debt.dueDate), 'dd MMM yyyy')}
                    </span>
                  )}
                </div>
                <p className="font-medium text-gray-800">{debt.description}</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(debt.amount)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => toggleStatus(debt)}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-sm font-medium transition-colors ${debt.status === 'paid' ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
                >
                  {debt.status === 'paid' ? 'Sudah Lunas' : 'Tandai Lunas'}
                </button>
                <button 
                  onClick={() => setDeleteId(debt.id)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
          {debts.length === 0 && <p className="text-gray-500 text-center py-8">Belum ada catatan hutang/piutang.</p>}
        </div>
      </div>

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Hapus Catatan"
        message="Yakin ingin menghapus catatan hutang/piutang ini?"
      />
    </div>
  );
}
