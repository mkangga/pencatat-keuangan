import { useState, useEffect, FormEvent, ChangeEvent, useMemo } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Trash2, 
  Edit2, 
  X, 
  Briefcase, 
  Coins, 
  Home as HomeIcon, 
  PieChart, 
  ArrowUpRight, 
  ArrowDownRight,
  Info,
  Wallet as WalletIcon,
  ChevronDown,
  ArrowDownToLine,
  PlusCircle,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Asset, Wallet as WalletType } from '../types';
import ConfirmModal from './ConfirmModal';

export default function Assets({ user, wallets }: { user: User, wallets: WalletType[] }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isLiquidateModalOpen, setIsLiquidateModalOpen] = useState(false);
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [isUpdateValueModalOpen, setIsUpdateValueModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [liquidatingAsset, setLiquidatingAsset] = useState<Asset | null>(null);
  const [topUpAsset, setTopUpAsset] = useState<Asset | null>(null);
  const [updatingValueAsset, setUpdatingValueAsset] = useState<Asset | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [type, setType] = useState<string>('');
  const [initialValue, setInitialValue] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [liquidateAmount, setLiquidateAmount] = useState('');
  const [topUpAmount, setTopUpAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [recordTransaction, setRecordTransaction] = useState(false);
  const [walletId, setWalletId] = useState('');

  function getAssetIcon(type: string) {
    const t = type.toLowerCase();
    if (t === 'stock' || t === 'saham') return <TrendingUp className="text-blue-500" />;
    if (t === 'crypto' || t === 'kripto') return <Coins className="text-orange-500" />;
    if (t === 'gold' || t === 'emas') return <PieChart className="text-yellow-500" />;
    if (t === 'property' || t === 'properti') return <HomeIcon className="text-emerald-500" />;
    return <Briefcase className="text-gray-500" />;
  }

  function getAssetTypeName(type: string) {
    if (!type) return '';
    const t = type.toLowerCase();
    if (t === 'stock') return 'Saham';
    if (t === 'crypto') return 'Crypto';
    if (t === 'gold') return 'Emas';
    if (t === 'property') return 'Properti';
    return type.charAt(0).toUpperCase() + type.slice(1);
  }

  useEffect(() => {
    const q = query(collection(db, 'assets'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setAssets(snap.docs.map(d => ({ id: d.id, ...d.data() } as Asset)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'assets');
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount).replace('Rp', 'Rp ');
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    const numericInitial = Number(parseNominal(initialValue));
    const numericCurrent = Number(parseNominal(currentValue)) || numericInitial;

    if (!name || !numericInitial || !type) {
      alert("Mohon lengkapi nama, jenis, dan nilai awal aset.");
      return;
    }

    if (recordTransaction && !walletId) {
      alert("Silakan pilih dompet untuk mencatat transaksi pembelian.");
      return;
    }

    setLoading(true);
    try {
      const assetData: any = {
        userId: user.uid,
        name,
        type: type.trim(),
        initialValue: numericInitial,
        currentValue: numericCurrent,
        notes,
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'assets'), assetData);

      if (recordTransaction && walletId) {
        await addDoc(collection(db, 'transactions'), {
          userId: user.uid,
          type: 'expense',
          amount: numericInitial,
          description: `Pembelian Aset: ${name}`,
          category: 'Investasi',
          walletId,
          date: new Date().toISOString(),
          createdAt: serverTimestamp()
        });
      }

      setIsAddModalOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'assets');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingAsset) return;

    const numericCurrent = Number(parseNominal(currentValue));

    if (!name || isNaN(numericCurrent) || !type) {
      alert("Mohon lengkapi data aset.");
      return;
    }

    setLoading(true);
    try {
      const updateData: any = {
        name,
        type: type.trim(),
        currentValue: numericCurrent,
        notes
      };

      await updateDoc(doc(db, 'assets', editingAsset.id), updateData);

      setIsEditModalOpen(false);
      setEditingAsset(null);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'assets');
    } finally {
      setLoading(false);
    }
  };

  const handleLiquidate = async (e: FormEvent) => {
    e.preventDefault();
    if (!liquidatingAsset) return;

    const amount = Number(parseNominal(liquidateAmount));
    if (!amount || !walletId) {
      alert("Mohon lengkapi jumlah pencairan dan pilih dompet tujuan.");
      return;
    }

    if (amount > liquidatingAsset.currentValue) {
      alert("Jumlah pencairan tidak boleh melebihi nilai aset saat ini.");
      return;
    }

    setLoading(true);
    try {
      // 1. Add income transaction
      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        type: 'income',
        amount,
        description: `Pencairan Aset: ${liquidatingAsset.name}`,
        category: 'Investasi',
        walletId,
        date: new Date().toISOString(),
        createdAt: serverTimestamp()
      });

      // 2. Update or delete asset
      if (amount === liquidatingAsset.currentValue) {
        // Full liquidation
        await deleteDoc(doc(db, 'assets', liquidatingAsset.id));
      } else {
        // Partial liquidation
        await updateDoc(doc(db, 'assets', liquidatingAsset.id), {
          currentValue: liquidatingAsset.currentValue - amount
        });
      }

      setIsLiquidateModalOpen(false);
      setLiquidatingAsset(null);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'assets');
    } finally {
      setLoading(false);
    }
  };

  const handleTopUp = async (e: FormEvent) => {
    e.preventDefault();
    if (!topUpAsset) return;

    const amount = Number(parseNominal(topUpAmount));
    if (!amount) {
      alert("Mohon masukkan jumlah penambahan nilai.");
      return;
    }

    if (recordTransaction && !walletId) {
      alert("Silakan pilih dompet untuk mencatat transaksi pengeluaran.");
      return;
    }

    setLoading(true);
    try {
      // 1. Record transaction if requested
      if (recordTransaction && walletId) {
        await addDoc(collection(db, 'transactions'), {
          userId: user.uid,
          type: 'expense',
          amount,
          description: `Top-up Aset: ${topUpAsset.name}`,
          category: 'Investasi',
          walletId,
          date: new Date().toISOString(),
          createdAt: serverTimestamp()
        });
      }

      // 2. Update asset values
      await updateDoc(doc(db, 'assets', topUpAsset.id), {
        initialValue: topUpAsset.initialValue + amount,
        currentValue: topUpAsset.currentValue + amount
      });

      setIsTopUpModalOpen(false);
      setTopUpAsset(null);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'assets');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateValue = async (e: FormEvent) => {
    e.preventDefault();
    if (!updatingValueAsset) return;

    const numericCurrent = Number(parseNominal(currentValue));
    if (isNaN(numericCurrent)) {
      alert("Mohon masukkan nilai yang valid.");
      return;
    }

    setLoading(true);
    try {
      await updateDoc(doc(db, 'assets', updatingValueAsset.id), {
        currentValue: numericCurrent
      });

      setIsUpdateValueModalOpen(false);
      setUpdatingValueAsset(null);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'assets');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, 'assets', deleteId));
      setDeleteId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'assets');
    }
  };

  const resetForm = () => {
    setName('');
    setType('');
    setInitialValue('');
    setCurrentValue('');
    setLiquidateAmount('');
    setTopUpAmount('');
    setNotes('');
    setRecordTransaction(false);
    setWalletId('');
  };

  const startEdit = (asset: Asset) => {
    setEditingAsset(asset);
    setName(asset.name);
    setType(getAssetTypeName(asset.type));
    setInitialValue(formatNominal(asset.initialValue.toString()));
    setCurrentValue(formatNominal(asset.currentValue.toString()));
    setNotes(asset.notes || '');
    setIsEditModalOpen(true);
  };

  const startLiquidate = (asset: Asset) => {
    setLiquidatingAsset(asset);
    setLiquidateAmount(formatNominal(asset.currentValue.toString()));
    setWalletId('');
    setIsLiquidateModalOpen(true);
  };

  const startTopUp = (asset: Asset) => {
    setTopUpAsset(asset);
    setTopUpAmount('');
    setWalletId('');
    setRecordTransaction(false);
    setIsTopUpModalOpen(true);
  };

  const startUpdateValue = (asset: Asset) => {
    setUpdatingValueAsset(asset);
    setCurrentValue(formatNominal(asset.currentValue.toString()));
    setIsUpdateValueModalOpen(true);
  };

  const totals = useMemo(() => {
    const totalInitial = assets.reduce((sum, a) => sum + a.initialValue, 0);
    const totalCurrent = assets.reduce((sum, a) => sum + a.currentValue, 0);
    const totalProfit = totalCurrent - totalInitial;
    const profitPercentage = totalInitial > 0 ? (totalProfit / totalInitial) * 100 : 0;

    return { totalInitial, totalCurrent, totalProfit, profitPercentage };
  }, [assets]);

  const suggestedTypes = useMemo(() => {
    const defaults = ['Saham', 'Crypto', 'Emas', 'Properti', 'Reksadana', 'Obligasi', 'Koleksi'];
    const existing = assets
      .map(a => getAssetTypeName(a.type))
      .filter(t => t && t.trim() !== '');
    return Array.from(new Set([...defaults, ...existing])).sort();
  }, [assets]);

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24 sm:pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 font-sans">Aset & Investasi</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Kelola dan pantau pertumbuhan kekayaan Anda.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setIsAddModalOpen(true); }}
          className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-emerald-500/25"
        >
          <Plus size={20} />
          <span>Tambah Aset</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm"
        >
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Total Nilai Aset</p>
          <h3 className="text-2xl font-extrabold text-gray-800 dark:text-gray-100">{formatCurrency(totals.totalCurrent)}</h3>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-gray-400">Modal: {formatCurrency(totals.totalInitial)}</span>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm"
        >
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Total Profit / Loss</p>
          <div className="flex items-center gap-2">
            <h3 className={`text-2xl font-extrabold ${totals.totalProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {totals.totalProfit >= 0 ? '+' : ''}{formatCurrency(totals.totalProfit)}
            </h3>
            <div className={`flex items-center px-2 py-0.5 rounded-lg text-xs font-bold ${totals.totalProfit >= 0 ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30' : 'bg-red-100 text-red-600 dark:bg-red-900/30'}`}>
              {totals.totalProfit >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {Math.abs(totals.profitPercentage).toFixed(2)}%
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between"
        >
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Jumlah Aset</p>
            <h3 className="text-2xl font-extrabold text-gray-800 dark:text-gray-100">{assets.length} <span className="text-sm font-normal text-gray-400">Instrumen</span></h3>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-2xl">
            <Briefcase className="text-blue-500" size={24} />
          </div>
        </motion.div>
      </div>

      {/* Asset List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AnimatePresence mode="popLayout">
          {assets.map((asset, index) => {
            const profit = asset.currentValue - asset.initialValue;
            const profitPercent = asset.initialValue > 0 ? (profit / asset.initialValue) * 100 : 0;

            return (
              <motion.div
                key={asset.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 p-6 hover:shadow-md transition-all group relative overflow-hidden"
              >
                <div className="flex items-start justify-between relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl group-hover:scale-110 transition-transform">
                      {getAssetIcon(asset.type)}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800 dark:text-gray-100">{asset.name}</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">{getAssetTypeName(asset.type)}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => startTopUp(asset)}
                      title="Tambah Nilai / Top-up"
                      className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-all"
                    >
                      <PlusCircle size={18} />
                    </button>
                    <button 
                      onClick={() => startLiquidate(asset)}
                      title="Cairkan Aset"
                      className="p-2 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-xl transition-all"
                    >
                      <ArrowDownToLine size={18} />
                    </button>
                    <button 
                      onClick={() => startEdit(asset)}
                      className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-all"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={() => setDeleteId(asset.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-4 relative z-10">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Nilai Saat Ini</p>
                    <div className="flex flex-col items-start gap-1">
                      <p className="text-lg font-bold text-gray-800 dark:text-gray-100 leading-none">{formatCurrency(asset.currentValue)}</p>
                      <button 
                        onClick={() => startUpdateValue(asset)}
                        className="flex items-center gap-1 text-[10px] font-bold text-blue-500 hover:text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-lg transition-colors"
                      >
                        <RefreshCw size={10} />
                        Update Harga
                      </button>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400 mb-1">Profit / Loss</p>
                    <div className={`flex items-center justify-end gap-1 font-bold ${profit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {profit >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      <span>{formatCurrency(Math.abs(profit))}</span>
                    </div>
                    <p className={`text-[10px] font-bold ${profit >= 0 ? 'text-emerald-600/70' : 'text-red-600/70'}`}>
                      {profit >= 0 ? '+' : '-'}{Math.abs(profitPercent).toFixed(2)}%
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-50 dark:border-gray-700/50 flex justify-between items-center relative z-10">
                  <span className="text-[10px] text-gray-400">Modal: {formatCurrency(asset.initialValue)}</span>
                  {asset.notes && (
                    <div className="group/note relative">
                      <Info size={14} className="text-gray-300 cursor-help" />
                      <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-gray-800 text-white text-[10px] rounded-lg opacity-0 group-hover/note:opacity-100 transition-opacity pointer-events-none z-20">
                        {asset.notes}
                      </div>
                    </div>
                  )}
                </div>

                {/* Decorative background element */}
                <div className={`absolute -bottom-4 -right-4 w-24 h-24 rounded-full opacity-[0.03] dark:opacity-[0.05] ${profit >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {assets.length === 0 && (
          <div className="lg:col-span-2 py-20 text-center bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700">
            <div className="inline-flex p-4 bg-gray-50 dark:bg-gray-700/50 rounded-full mb-4">
              <Briefcase className="text-gray-300" size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Belum ada aset</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-xs mx-auto mt-2">Mulai catat investasi Anda seperti saham, emas, atau crypto untuk memantau pertumbuhannya.</p>
          </div>
        )}
      </div>

      {/* Add Asset Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <motion.div 
            key="add-asset-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Tambah Aset Baru</h2>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                  <X size={24} className="text-gray-500" />
                </button>
              </div>
              <form onSubmit={handleAdd} className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-400 mb-2">Nama Aset</label>
                    <input 
                      type="text" 
                      value={name} 
                      onChange={e => setName(e.target.value)} 
                      className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-gray-800 dark:text-gray-100 transition-all" 
                      placeholder="Contoh: Saham BBCA, Bitcoin, Emas Antam"
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-400 mb-2">Jenis Aset</label>
                    <div className="relative group">
                      <input 
                        type="text" 
                        list="asset-types"
                        value={type} 
                        onChange={e => setType(e.target.value)}
                        className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-gray-800 dark:text-gray-100 transition-all pr-12"
                        placeholder="Pilih atau ketik jenis aset..."
                        required
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none group-focus-within:text-emerald-500 transition-colors">
                        <ChevronDown size={20} />
                      </div>
                    </div>
                    <datalist id="asset-types">
                      {suggestedTypes.map(t => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-400 mb-2">Modal Awal (Rp)</label>
                    <input 
                      type="text" 
                      inputMode="numeric" 
                      value={initialValue} 
                      onChange={e => setInitialValue(formatNominal(e.target.value))} 
                      className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-gray-800 dark:text-gray-100 transition-all font-bold" 
                      placeholder="0"
                      required 
                    />
                  </div>
                </div>

                <div className="p-5 bg-emerald-50 dark:bg-emerald-900/20 rounded-3xl border border-emerald-100 dark:border-emerald-900/30">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={recordTransaction} 
                      onChange={e => setRecordTransaction(e.target.checked)}
                      className="w-5 h-5 rounded-lg text-emerald-500 focus:ring-emerald-500 border-emerald-300"
                    />
                    <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Catat sebagai Pengeluaran</span>
                  </label>
                  {recordTransaction && (
                    <div className="mt-4 animate-in slide-in-from-top-2 duration-200">
                      <label className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">Pilih Sumber Dana</label>
                      <select 
                        value={walletId} 
                        onChange={e => setWalletId(e.target.value)}
                        className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-emerald-200 dark:border-emerald-800 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm text-gray-800 dark:text-gray-100"
                        required
                      >
                        <option value="">Pilih Dompet...</option>
                        {wallets.map(w => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-400 mb-2">Catatan <span className="text-gray-400 font-normal">(Opsional)</span></label>
                  <textarea 
                    value={notes} 
                    onChange={e => setNotes(e.target.value)}
                    className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-gray-800 dark:text-gray-100 transition-all resize-none" 
                    rows={2}
                    placeholder="Contoh: Beli di harga $50.000"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setIsAddModalOpen(false)} 
                    className="flex-1 py-4 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit" 
                    disabled={loading} 
                    className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-70"
                  >
                    {loading ? 'Menyimpan...' : 'Simpan Aset'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Asset Modal */}
      <AnimatePresence>
        {isEditModalOpen && editingAsset && (
          <motion.div 
            key="edit-asset-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Edit Aset</h2>
                <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                  <X size={24} className="text-gray-500" />
                </button>
              </div>
              <form onSubmit={handleUpdate} className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-400 mb-2">Nama Aset</label>
                    <input 
                      type="text" 
                      value={name} 
                      onChange={e => setName(e.target.value)} 
                      className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 dark:text-gray-100 transition-all" 
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-400 mb-2">Jenis Aset</label>
                    <div className="relative group">
                      <input 
                        type="text" 
                        list="asset-types-edit"
                        value={type} 
                        onChange={e => setType(e.target.value)}
                        className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 dark:text-gray-100 transition-all pr-12"
                        placeholder="Pilih atau ketik jenis aset..."
                        required
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none group-focus-within:text-blue-500 transition-colors">
                        <ChevronDown size={20} />
                      </div>
                    </div>
                    <datalist id="asset-types-edit">
                      {suggestedTypes.map(t => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-400 mb-2">Nilai Saat Ini (Rp)</label>
                    <input 
                      type="text" 
                      inputMode="numeric" 
                      value={currentValue} 
                      onChange={e => setCurrentValue(formatNominal(e.target.value))} 
                      className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 dark:text-gray-100 transition-all font-bold" 
                      required 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-400 mb-2">Catatan</label>
                  <textarea 
                    value={notes} 
                    onChange={e => setNotes(e.target.value)}
                    className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 dark:text-gray-100 transition-all resize-none" 
                    rows={2}
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setIsEditModalOpen(false)} 
                    className="flex-1 py-4 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit" 
                    disabled={loading} 
                    className="flex-1 py-4 bg-blue-500 text-white rounded-2xl font-bold hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-70"
                  >
                    {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Update Value Modal */}
      <AnimatePresence>
        {isUpdateValueModalOpen && updatingValueAsset && (
          <motion.div 
            key="update-value-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600">
                    <RefreshCw size={20} />
                  </div>
                  <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Update Harga</h2>
                </div>
                <button onClick={() => setIsUpdateValueModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                  <X size={24} className="text-gray-500" />
                </button>
              </div>
              <form onSubmit={handleUpdateValue} className="p-6 space-y-6">
                <div className="text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{updatingValueAsset.name}</p>
                  <p className="text-xs text-gray-400">Modal: {formatCurrency(updatingValueAsset.initialValue)}</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-400 mb-2">Nilai Saat Ini (Rp)</label>
                  <input 
                    type="text" 
                    inputMode="numeric" 
                    value={currentValue} 
                    onChange={e => setCurrentValue(formatNominal(e.target.value))} 
                    className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 dark:text-gray-100 transition-all font-bold text-xl text-center" 
                    placeholder="0"
                    autoFocus
                    required 
                  />
                  <p className="text-[10px] text-center text-gray-400 mt-2">Update nominal ini untuk melihat profit/loss terbaru.</p>
                </div>

                <div className="flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsUpdateValueModalOpen(false)} 
                    className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit" 
                    disabled={loading} 
                    className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-70"
                  >
                    {loading ? '...' : 'Update'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top-up Asset Modal */}
      <AnimatePresence>
        {isTopUpModalOpen && topUpAsset && (
          <motion.div 
            key="top-up-asset-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600">
                    <PlusCircle size={20} />
                  </div>
                  <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Tambah Nilai Aset</h2>
                </div>
                <button onClick={() => setIsTopUpModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                  <X size={24} className="text-gray-500" />
                </button>
              </div>
              <form onSubmit={handleTopUp} className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Aset yang ditambah:</p>
                  <p className="font-bold text-gray-800 dark:text-gray-100">{topUpAsset.name}</p>
                  <p className="text-sm text-blue-500 font-bold mt-1">Nilai saat ini: {formatCurrency(topUpAsset.currentValue)}</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-400 mb-2">Jumlah Penambahan (Rp)</label>
                    <input 
                      type="text" 
                      inputMode="numeric" 
                      value={topUpAmount} 
                      onChange={e => setTopUpAmount(formatNominal(e.target.value))} 
                      className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 dark:text-gray-100 transition-all font-bold text-lg" 
                      placeholder="0"
                      required 
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Masukkan jumlah dana yang Anda tambahkan ke aset ini.</p>
                  </div>

                  <div className="p-5 bg-blue-50 dark:bg-blue-900/20 rounded-3xl border border-blue-100 dark:border-blue-900/30">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={recordTransaction} 
                        onChange={e => setRecordTransaction(e.target.checked)}
                        className="w-5 h-5 rounded-lg text-blue-500 focus:ring-blue-500 border-blue-300"
                      />
                      <span className="text-sm font-bold text-blue-700 dark:text-blue-300">Catat sebagai Pengeluaran</span>
                    </label>
                    {recordTransaction && (
                      <div className="mt-4 animate-in slide-in-from-top-2 duration-200">
                        <label className="block text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Pilih Sumber Dana</label>
                        <select 
                          value={walletId} 
                          onChange={e => setWalletId(e.target.value)}
                          className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-blue-200 dark:border-blue-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-800 dark:text-gray-100"
                          required
                        >
                          <option value="">Pilih Dompet...</option>
                          {wallets.map(w => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setIsTopUpModalOpen(false)} 
                    className="flex-1 py-4 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit" 
                    disabled={loading} 
                    className="flex-1 py-4 bg-blue-500 text-white rounded-2xl font-bold hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-70"
                  >
                    {loading ? 'Memproses...' : 'Tambah Nilai'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Liquidate Asset Modal */}
      <AnimatePresence>
        {isLiquidateModalOpen && liquidatingAsset && (
          <motion.div 
            key="liquidate-asset-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl text-emerald-600">
                    <ArrowDownToLine size={20} />
                  </div>
                  <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Cairkan Aset</h2>
                </div>
                <button onClick={() => setIsLiquidateModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                  <X size={24} className="text-gray-500" />
                </button>
              </div>
              <form onSubmit={handleLiquidate} className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Aset yang dicairkan:</p>
                  <p className="font-bold text-gray-800 dark:text-gray-100">{liquidatingAsset.name}</p>
                  <p className="text-sm text-emerald-500 font-bold mt-1">Nilai saat ini: {formatCurrency(liquidatingAsset.currentValue)}</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-400 mb-2">Jumlah Pencairan (Rp)</label>
                    <input 
                      type="text" 
                      inputMode="numeric" 
                      value={liquidateAmount} 
                      onChange={e => setLiquidateAmount(formatNominal(e.target.value))} 
                      className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-gray-800 dark:text-gray-100 transition-all font-bold text-lg" 
                      placeholder="0"
                      required 
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Masukkan jumlah yang ingin dicairkan ke dompet.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-400 mb-2">Dompet Tujuan</label>
                    <select 
                      value={walletId} 
                      onChange={e => setWalletId(e.target.value)}
                      className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-gray-800 dark:text-gray-100 transition-all"
                      required
                    >
                      <option value="">Pilih Dompet...</option>
                      {wallets.map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setIsLiquidateModalOpen(false)} 
                    className="flex-1 py-4 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit" 
                    disabled={loading} 
                    className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-70"
                  >
                    {loading ? 'Memproses...' : 'Cairkan Sekarang'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Hapus Aset"
        message="Yakin ingin menghapus aset ini dari daftar pantauan Anda?"
      />
    </div>
  );
}
