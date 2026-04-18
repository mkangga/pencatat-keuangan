import { useState, useEffect, FormEvent } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Category, CategoryGroup, Transaction } from '../types';
import { Tags, Trash2, Edit2, X } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import GroupedTransactionList from './GroupedTransactionList';

export default function Categories({ user, transactions = [] }: { user: User, transactions?: Transaction[] }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [name, setName] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [groupId, setGroupId] = useState('');
  const [loading, setLoading] = useState(false);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [selectedCategoryForTransactions, setSelectedCategoryForTransactions] = useState<Category | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<'income' | 'expense'>('expense');
  const [editGroupId, setEditGroupId] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'categories'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'categories');
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    const q = query(collection(db, 'categoryGroups'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setCategoryGroups(snap.docs.map(d => ({ id: d.id, ...d.data() } as CategoryGroup)));
      setGroupsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'categoryGroups');
      setGroupsLoading(false);
    });
    return () => unsub();
  }, [user]);

  const handleSetupGroups = async (groupCount: 3 | 4) => {
    setLoading(true);
    try {
      const batch = writeBatch(db);
      const groups = [
        { name: 'Needs', type: 'needs' },
        { name: 'Wants', type: 'wants' },
        { name: 'Savings', type: 'savings' }
      ];
      if (groupCount === 4) {
        groups.push({ name: 'Debts', type: 'debts' });
      }

      groups.forEach(g => {
        const docRef = doc(collection(db, 'categoryGroups'));
        batch.set(docRef, {
          userId: user.uid,
          name: g.name,
          type: g.type,
          createdAt: serverTimestamp()
        });
      });

      batch.commit().catch(error => handleFirestoreError(error, OperationType.WRITE, 'categoryGroups'));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'categoryGroups');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleGroupCount = async () => {
    setLoading(true);
    try {
      if (categoryGroups.length === 3) {
        // Add Debts group
        addDoc(collection(db, 'categoryGroups'), {
          userId: user.uid,
          name: 'Debts',
          type: 'debts',
          createdAt: serverTimestamp()
        }).catch(error => handleFirestoreError(error, OperationType.WRITE, 'categoryGroups'));
      } else {
        // Remove Debts group
        const debtsGroup = categoryGroups.find(g => g.type === 'debts');
        if (debtsGroup) {
          deleteDoc(doc(db, 'categoryGroups', debtsGroup.id))
            .catch(error => handleFirestoreError(error, OperationType.DELETE, `categoryGroups/${debtsGroup.id}`));
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'categoryGroups');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (type === 'expense' && !groupId) {
      alert('Silakan pilih kelompok kategori.');
      return;
    }
    setLoading(true);
    try {
      addDoc(collection(db, 'categories'), {
        userId: user.uid,
        name: name.trim(),
        type,
        groupId: type === 'expense' ? groupId : null,
        createdAt: serverTimestamp()
      }).catch(error => handleFirestoreError(error, OperationType.WRITE, 'categories'));
      setName('');
      setGroupId('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'categories');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editName.trim()) return;
    if (editType === 'expense' && !editGroupId) {
      alert('Silakan pilih kelompok kategori.');
      return;
    }
    setLoading(true);
    try {
      const oldName = editingCategory.name;
      const newName = editName.trim();

      // 1. Update Category
      updateDoc(doc(db, 'categories', editingCategory.id), {
        name: newName,
        groupId: editType === 'expense' ? editGroupId : null
      }).catch(error => handleFirestoreError(error, OperationType.UPDATE, 'categories'));

      // 2. Update Transactions that use this category (only if name changed)
      if (oldName !== newName) {
        const q = query(
          collection(db, 'transactions'), 
          where('userId', '==', user.uid), 
          where('category', '==', oldName),
          where('type', '==', editingCategory.type)
        );
        
        getDocs(q).then((querySnapshot) => {
          const batch = writeBatch(db);
          querySnapshot.forEach((transactionDoc) => {
            batch.update(transactionDoc.ref, { category: newName });
          });
          batch.commit().catch(error => handleFirestoreError(error, OperationType.UPDATE, 'transactions'));
        }).catch(error => handleFirestoreError(error, OperationType.GET, 'transactions'));
      }
      setEditingCategory(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'categories');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (category: Category) => {
    setEditingCategory(category);
    setEditName(category.name);
    setEditType(category.type);
    setEditGroupId(category.groupId || '');
  };

  const cancelEdit = () => {
    setEditingCategory(null);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      deleteDoc(doc(db, 'categories', deleteId)).catch(error => {
        handleFirestoreError(error, OperationType.DELETE, `categories/${deleteId}`);
      });
      setDeleteId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `categories/${deleteId}`);
    }
  };

  const incomeCategories = categories.filter(c => c.type === 'income');
  const expenseCategories = categories.filter(c => c.type === 'expense');

  if (groupsLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-emerald-500"></div>
      </div>
    );
  }

  if (categoryGroups.length === 0) {
    return (
      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6 font-sans">Setup Kelompok Kategori</h1>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Pilih Template Kelompok Kategori</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-xl mx-auto">
            Untuk membantu menganalisis kesehatan finansial Anda, kami akan mengelompokkan kategori pengeluaran Anda. Pilih template yang paling sesuai dengan kebutuhan Anda.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button 
              onClick={() => handleSetupGroups(3)}
              disabled={loading}
              className="p-6 border-2 border-emerald-100 dark:border-emerald-900/30 rounded-2xl hover:border-emerald-500 dark:hover:border-emerald-500 transition-colors text-left group"
            >
              <h3 className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mb-2 group-hover:text-emerald-700 dark:group-hover:text-emerald-300">3 Kelompok Dasar</h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
                <li>Needs (Kebutuhan)</li>
                <li>Wants (Keinginan)</li>
                <li>Savings (Tabungan/Investasi)</li>
              </ul>
            </button>
            <button 
              onClick={() => handleSetupGroups(4)}
              disabled={loading}
              className="p-6 border-2 border-blue-100 dark:border-blue-900/30 rounded-2xl hover:border-blue-500 dark:hover:border-blue-500 transition-colors text-left group"
            >
              <h3 className="text-lg font-bold text-blue-600 dark:text-blue-400 mb-2 group-hover:text-blue-700 dark:group-hover:text-blue-300">4 Kelompok (Dengan Hutang)</h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
                <li>Needs (Kebutuhan)</li>
                <li>Wants (Keinginan)</li>
                <li>Savings (Tabungan/Investasi)</li>
                <li>Debts (Cicilan/Hutang)</li>
              </ul>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 font-sans">Kategori Transaksi</h1>
        <button
          onClick={handleToggleGroupCount}
          disabled={loading}
          className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
        >
          {categoryGroups.length === 3 ? 'Ubah ke 4 Kelompok (Tambah Debts)' : 'Ubah ke 3 Kelompok (Hapus Debts)'}
        </button>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-8 transition-colors duration-300">
        <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">
          Tambah Kategori Baru
        </h2>
        <form onSubmit={handleAdd} className="flex gap-4 flex-wrap items-end">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Jenis</label>
            <select 
              value={type} 
              onChange={e => setType(e.target.value as any)} 
              className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-gray-800 dark:text-gray-100"
            >
              <option value="expense">Pengeluaran</option>
              <option value="income">Pemasukan</option>
            </select>
          </div>
          <div className="flex-[2] min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Nama Kategori</label>
            <input type="text" maxLength={50} value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500" required placeholder="Contoh: Makanan, Transportasi, Gaji..." />
          </div>
          {type === 'expense' && (
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Kelompok</label>
              <select 
                value={groupId} 
                onChange={e => setGroupId(e.target.value)} 
                required
                className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-gray-800 dark:text-gray-100"
              >
                <option value="" disabled>Pilih Kelompok</option>
                {categoryGroups.filter(g => g.type !== 'savings').map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="bg-emerald-500 text-white px-6 py-2 rounded-xl h-[42px] hover:bg-emerald-600 font-medium transition-colors disabled:opacity-70">
              {loading ? '...' : 'Tambah'}
            </button>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-4 flex items-center gap-2">
            <Tags size={20} /> Kategori Pengeluaran
          </h3>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors duration-300">
            {expenseCategories.map(cat => (
              <div 
                key={cat.id} 
                onClick={() => setSelectedCategoryForTransactions(cat)}
                className="flex items-center justify-between p-4 border-b border-gray-50 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group cursor-pointer"
              >
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300 block">{cat.name}</span>
                  {cat.groupId && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-md mt-1 inline-block">
                      {categoryGroups.find(g => g.id === cat.groupId)?.name || 'Unknown'}
                    </span>
                  )}
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); startEdit(cat); }} className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors bg-white dark:bg-gray-800 rounded-lg">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setDeleteId(cat.id); }} className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors bg-white dark:bg-gray-800 rounded-lg">
                    <Trash2 size={16} />
                  </button>
                </div>
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
              <div 
                key={cat.id} 
                onClick={() => setSelectedCategoryForTransactions(cat)}
                className="flex items-center justify-between p-4 border-b border-gray-50 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group cursor-pointer"
              >
                <span className="font-medium text-gray-700 dark:text-gray-300">{cat.name}</span>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); startEdit(cat); }} className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors bg-white dark:bg-gray-800 rounded-lg">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setDeleteId(cat.id); }} className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors bg-white dark:bg-gray-800 rounded-lg">
                    <Trash2 size={16} />
                  </button>
                </div>
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

      {/* Edit Category Modal */}
      {editingCategory && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Edit Kategori</h2>
              <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Jenis</label>
                <select 
                  value={editType} 
                  disabled
                  className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none text-gray-500 dark:text-gray-400 opacity-70"
                >
                  <option value="expense">Pengeluaran</option>
                  <option value="income">Pemasukan</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Jenis kategori tidak dapat diubah.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Nama Kategori</label>
                <input 
                  type="text" 
                  maxLength={50} 
                  value={editName} 
                  onChange={e => setEditName(e.target.value)} 
                  className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-gray-800 dark:text-gray-100" 
                  required 
                />
              </div>
              {editType === 'expense' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Kelompok</label>
                  <select 
                    value={editGroupId} 
                    onChange={e => setEditGroupId(e.target.value)} 
                    required
                    className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-gray-800 dark:text-gray-100"
                  >
                    <option value="" disabled>Pilih Kelompok</option>
                    {categoryGroups.filter(g => g.type !== 'savings').map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={cancelEdit}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={loading} 
                  className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors disabled:opacity-70"
                >
                  {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Selected Category Transactions Modal */}
      {selectedCategoryForTransactions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-gray-50 dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{selectedCategoryForTransactions.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Semua transaksi untuk kategori {selectedCategoryForTransactions.type === 'expense' ? 'pengeluaran' : 'pemasukan'} ini
                </p>
              </div>
              <button 
                onClick={() => setSelectedCategoryForTransactions(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-400 transition-colors"
                title="Tutup"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {(() => {
                const categoryTxs = transactions.filter(t => 
                  t.type === selectedCategoryForTransactions.type && 
                  t.category === selectedCategoryForTransactions.name
                );

                return (
                  <GroupedTransactionList 
                    transactions={categoryTxs} 
                    onViewDetail={() => {}} 
                    emptyMessage={`Belum ada transaksi untuk kategori ${selectedCategoryForTransactions.name}.`}
                    type={selectedCategoryForTransactions.type}
                  />
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
