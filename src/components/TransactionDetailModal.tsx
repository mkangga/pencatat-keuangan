import { Transaction, Wallet, Category } from '../types';
import { X, Calendar, Clock, Tag, Wallet as WalletIcon, FileText, ArrowUp, ArrowDown, Edit2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface TransactionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  wallets: Wallet[];
  categories: Category[];
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
}

export default function TransactionDetailModal({
  isOpen,
  onClose,
  transaction,
  wallets,
  categories,
  onEdit,
  onDelete
}: TransactionDetailModalProps) {
  if (!isOpen || !transaction) return null;

  const isIncome = transaction.type === 'income';
  const wallet = wallets.find(w => w.id === transaction.walletId);
  
  const safeDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? new Date() : d;
    } catch {
      return new Date();
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount).replace('Rp', 'Rp ');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transition-colors duration-300 transform animate-in zoom-in duration-200">
        {/* Header with Color Theme */}
        <div className={`px-6 py-8 text-white relative ${isIncome ? 'bg-emerald-500' : 'bg-red-500'}`}>
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
          
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md mb-2">
              {isIncome ? <ArrowDown size={32} strokeWidth={2.5} /> : <ArrowUp size={32} strokeWidth={2.5} />}
            </div>
            <h3 className="text-sm font-medium opacity-80 uppercase tracking-widest">
              Detail {isIncome ? 'Pemasukan' : 'Pengeluaran'}
            </h3>
            <p className="text-3xl font-black tracking-tight">
              {isIncome ? '+' : '-'} {formatCurrency(transaction.amount)}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            {/* Description */}
            <div className="flex items-start gap-4">
              <div className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-xl">
                <FileText size={20} />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider mb-0.5">Judul</p>
                <p className="text-gray-800 dark:text-gray-100 font-bold">{transaction.description}</p>
              </div>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-xl">
                  <Calendar size={20} />
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider mb-0.5">Tanggal</p>
                  <p className="text-gray-800 dark:text-gray-100 font-bold text-sm">
                    {format(safeDate(transaction.date), 'd MMM yyyy', { locale: id })}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-xl">
                  <Clock size={20} />
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider mb-0.5">Waktu</p>
                  <p className="text-gray-800 dark:text-gray-100 font-bold text-sm">
                    {format(safeDate(transaction.date), 'HH:mm', { locale: id })}
                  </p>
                </div>
              </div>
            </div>

            {/* Category & Wallet */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-xl">
                  <Tag size={20} />
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider mb-0.5">Kategori</p>
                  <p className="text-gray-800 dark:text-gray-100 font-bold text-sm">
                    {transaction.category || '-'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-xl">
                  <WalletIcon size={20} />
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider mb-0.5">Dompet</p>
                  <p className="text-gray-800 dark:text-gray-100 font-bold text-sm">
                    {wallet?.name || '-'}
                  </p>
                </div>
              </div>
            </div>

            {/* Notes */}
            {transaction.notes && (
              <div className="flex items-start gap-4 pt-2 border-t border-gray-100 dark:border-gray-700">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-xl">
                  <FileText size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider mb-0.5">Catatan</p>
                  <p className="text-gray-600 dark:text-gray-400 text-sm italic leading-relaxed">
                    "{transaction.notes}"
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => {
                onEdit(transaction);
                onClose();
              }}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-2xl font-bold hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
            >
              <Edit2 size={18} />
              Edit
            </button>
            <button
              onClick={() => {
                onDelete(transaction.id);
                onClose();
              }}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl font-bold hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
            >
              <Trash2 size={18} />
              Hapus
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
