import { useState, FormEvent, useEffect, ChangeEvent } from 'react';
import { User } from 'firebase/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { X, ArrowRightLeft, AlertCircle } from 'lucide-react';
import { Wallet } from '../types';
import { useNavigate } from 'react-router-dom';
import CustomSelect from './CustomSelect';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  wallets: Wallet[];
}

export default function TransferModal({ 
  isOpen, 
  onClose, 
  user, 
  wallets 
}: TransferModalProps) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('Pindah Saldo');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(new Date().toTimeString().split(' ')[0].slice(0, 5));
  const [fromWalletId, setFromWalletId] = useState('');
  const [toWalletId, setToWalletId] = useState('');
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

  useEffect(() => {
    if (isOpen) {
      if (wallets.length >= 2) {
        setFromWalletId(wallets[0].id);
        setToWalletId(wallets[1].id);
      } else if (wallets.length === 1) {
        setFromWalletId(wallets[0].id);
      }
      setAmount('');
      setDescription('Pindah Saldo');
      setDate(new Date().toISOString().split('T')[0]);
      setTime(new Date().toTimeString().split(' ')[0].slice(0, 5));
    }
  }, [isOpen, wallets]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(parseNominal(amount));
    if (!numericAmount || !fromWalletId || !toWalletId || fromWalletId === toWalletId) {
      if (fromWalletId === toWalletId) alert("Dompet asal dan tujuan tidak boleh sama.");
      return;
    }

    setLoading(true);
    try {
      const [year, month, day] = date.split('-').map(Number);
      const [hours, minutes] = time.split(':').map(Number);
      const fullDate = new Date(year, month - 1, day, hours, minutes);
      
      const fromWallet = wallets.find(w => w.id === fromWalletId);
      const toWallet = wallets.find(w => w.id === toWalletId);

      const commonData = {
        userId: user.uid,
        amount: numericAmount,
        description: `${description}: ${fromWallet?.name} ke ${toWallet?.name}`,
        category: 'Pindah Saldo',
        date: fullDate,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // 1. Create expense from source wallet
      addDoc(collection(db, 'transactions'), {
        ...commonData,
        type: 'expense',
        walletId: fromWalletId,
      }).catch(error => handleFirestoreError(error, OperationType.WRITE, 'transactions'));

      // 2. Create income to destination wallet
      addDoc(collection(db, 'transactions'), {
        ...commonData,
        type: 'income',
        walletId: toWalletId,
      }).catch(error => handleFirestoreError(error, OperationType.WRITE, 'transactions'));

      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'transactions');
    } finally {
      setLoading(false);
    }
  };

  const hasEnoughWallets = wallets.length >= 2;

  if (!hasEnoughWallets) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 transition-colors duration-300">
          <div className="px-6 py-4 border-b flex justify-between items-center bg-blue-50 dark:bg-blue-900/30 border-blue-100 dark:border-blue-800">
            <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300">
              <AlertCircle size={20} />
              <h3 className="font-semibold text-lg">Persiapan Diperlukan</h3>
            </div>
            <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              <X size={20} />
            </button>
          </div>
          <div className="p-6 space-y-6">
            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
              Untuk memindahkan saldo, Anda perlu memiliki setidaknya <strong>dua Dompet/Rekening</strong>.
            </p>
            
            <button 
              onClick={() => { navigate('/dompet-rekening'); onClose(); }}
              className="w-full py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium shadow-sm flex items-center justify-center gap-2"
            >
              Buat Dompet Sekarang
            </button>

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
        <div className="px-6 py-4 border-b flex justify-between items-center bg-blue-50 dark:bg-blue-900/30 border-blue-100 dark:border-blue-800">
          <h3 className="font-semibold text-lg text-blue-800 dark:text-blue-300 flex items-center gap-2">
            <ArrowRightLeft size={20} /> Pindah Saldo
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
              className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="0"
            />
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <CustomSelect
                label="Dari Dompet"
                value={fromWalletId}
                required
                onChange={setFromWalletId}
                options={wallets.map(w => ({ value: w.id, label: w.name }))}
              />
            </div>
            <div className="flex justify-center">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-full">
                <ArrowRightLeft size={20} className="rotate-90" />
              </div>
            </div>
            <div>
              <CustomSelect
                label="Ke Dompet"
                value={toWalletId}
                required
                onChange={setToWalletId}
                options={wallets.map(w => ({ value: w.id, label: w.name }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Keterangan</label>
            <input
              type="text"
              required
              maxLength={100}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="Contoh: Pindah Saldo"
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
                className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-800 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Waktu</label>
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-800 dark:text-gray-100"
              />
            </div>
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
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors disabled:opacity-70"
            >
              {loading ? 'Memproses...' : 'Pindah Saldo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
