import { Transaction } from '../types';
import { PlusCircle, MinusCircle, Trash2, Edit2 } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useState } from 'react';
import ConfirmModal from './ConfirmModal';

interface TransactionListProps {
  transactions: Transaction[];
  type: 'income' | 'expense' | 'all';
  onEdit?: (tx: Transaction) => void;
  onViewDetail?: (tx: Transaction) => void;
}

export default function TransactionList({ transactions, type, onEdit, onViewDetail }: TransactionListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
    return formatted.replace('Rp', 'Rp ');
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, 'transactions', deleteId));
      setDeleteId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `transactions/${deleteId}`);
    }
  };

  const isIncome = type === 'income';
  const isExpense = type === 'expense';
  const Icon = isIncome ? PlusCircle : (isExpense ? MinusCircle : PlusCircle); // Simplistic icon logic for 'all'

  const safeDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? new Date() : d;
    } catch {
      return new Date();
    }
  };

  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
        Belum ada data transaksi.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {transactions.map((tx) => {
        const txIsIncome = tx.type === 'income';
        const TxIcon = txIsIncome ? PlusCircle : MinusCircle;
        return (
          <div 
            key={tx.id} 
            onClick={() => onViewDetail?.(tx)}
            className="group flex items-center justify-between py-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-2xl transition-all px-3 border-b border-gray-50 dark:border-gray-800 last:border-0 cursor-pointer"
          >
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <div className={`w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center shadow-sm ${
                txIsIncome ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'
              }`}>
                <TxIcon size={18} strokeWidth={2.5} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-gray-800 dark:text-gray-100 text-sm break-words">{tx.description}</p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                  <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    {format(safeDate(tx.date), 'HH:mm', { locale: id })}
                  </p>
                  {tx.category && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-md font-medium">
                      {tx.category}
                    </span>
                  )}
                </div>
                {tx.notes && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 italic break-words">{tx.notes}</p>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 ml-3 flex-shrink-0 max-w-[45%]">
              <div className={`font-bold text-sm sm:text-base whitespace-nowrap ${txIsIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {txIsIncome ? '+' : '-'} {formatCurrency(tx.amount)}
              </div>
              <div className="flex items-center gap-2 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                {onEdit && (
                  <button 
                    onClick={() => onEdit(tx)}
                    className="text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors p-1.5 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <Edit2 size={14} />
                  </button>
                )}
                <button 
                  onClick={() => setDeleteId(tx.id)}
                  className="text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1.5 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        );
      })}

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Hapus Transaksi"
        message="Yakin ingin menghapus catatan transaksi ini? Tindakan ini tidak dapat dibatalkan."
      />
    </div>
  );
}
