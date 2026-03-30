import { useState, useEffect, FormEvent } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Category } from '../types';
import { Tags, Trash2 } from 'lucide-react';
import ConfirmModal from './ConfirmModal';

export default function Categories({ user }: { user: User }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [loading, setLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'categories'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
    });
    return () => unsub();
  }, [user]);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      addDoc(collection(db, 'categories'), {
        userId: user.uid,
        name: name.trim(),
        type,
        createdAt: serverTimestamp()
      });
      setName('');
    } catch (error) {
      console.error("Error adding category: ", error);
      alert("Gagal menambahkan kategori.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      deleteDoc(doc(db, 'categories', deleteId));
      setDeleteId(null);
    } catch (error) {
      console.error("Error deleting category: ", error);
    }
  };

  const incomeCategories = categories.filter(c => c.type === 'income');
  const expenseCategories = categories.filter(c => c.type === 'expense');

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6 font-sans">Kategori Transaksi</h1>
      
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-8 transition-colors duration-300">
        <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">Tambah Kategori Baru</h2>
        <form onSubmit={handleAdd} className="flex gap-4 flex-wrap items-end">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Jenis</label>
            <select value={type} onChange={e => setType(e.target.value as any)} className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-gray-800 dark:text-gray-100">
              <option value="expense">Pengeluaran</option>
              <option value="income">Pemasukan</option>
            </select>
          </div>
          <div className="flex-[2] min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Nama Kategori</label>
            <input type="text" maxLength={50} value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500" required placeholder="Contoh: Makanan, Transportasi, Gaji..." />
          </div>
          <button type="submit" disabled={loading} className="bg-emerald-500 text-white px-6 py-2 rounded-xl h-[42px] hover:bg-emerald-600 font-medium transition-colors disabled:opacity-70">
            {loading ? 'Menyimpan...' : 'Tambah'}
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-4 flex items-center gap-2">
            <Tags size={20} /> Kategori Pengeluaran
          </h3>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors duration-300">
            {expenseCategories.map(cat => (
              <div key={cat.id} className="flex items-center justify-between p-4 border-b border-gray-50 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <span className="font-medium text-gray-700 dark:text-gray-300">{cat.name}</span>
                <button onClick={() => setDeleteId(cat.id)} className="text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
            {expenseCategories.length === 0 && (
              <div className="p-6 text-center text-gray-500 dark:text-gray-400 text-sm">Belum ada kategori pengeluaran.</div>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-emerald-600 dark:text-emerald-400 mb-4 flex items-center gap-2">
            <Tags size={20} /> Kategori Pemasukan
          </h3>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors duration-300">
            {incomeCategories.map(cat => (
              <div key={cat.id} className="flex items-center justify-between p-4 border-b border-gray-50 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <span className="font-medium text-gray-700 dark:text-gray-300">{cat.name}</span>
                <button onClick={() => setDeleteId(cat.id)} className="text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
            {incomeCategories.length === 0 && (
              <div className="p-6 text-center text-gray-500 dark:text-gray-400 text-sm">Belum ada kategori pemasukan.</div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Hapus Kategori"
        message="Yakin ingin menghapus kategori ini? Transaksi yang sudah ada tidak akan terhapus, namun kategori ini tidak akan muncul lagi di pilihan."
      />
    </div>
  );
}
