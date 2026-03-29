import { Transaction } from '../types';
import { ArrowUp, ArrowDown, Trash2, Edit2 } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useState } from 'react';
import ConfirmModal from './ConfirmModal';

interface TransactionListProps {
  transactions: Transaction[];
  type: 'income' | 'expense';
  onEdit?: (tx: Transaction) => void;
}

export default function TransactionList({ transactions, type, onEdit }: TransactionListProps) {
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
      console.error("Error deleting transaction: ", error);
    }
  };

  const isIncome = type === 'income';
  const Icon = isIncome ? ArrowUp : ArrowDown;

  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        Belum ada data {isIncome ? 'pemasukan' : 'pengeluaran'}.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {transactions.map((tx) => (
        <div key={tx.id} className="group flex items-center justify-between py-3 hover:bg-gray-50 rounded-xl transition-colors px-2">
          <div className="flex items-center gap-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              isIncome ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
            }`}>
              <Icon size={16} strokeWidth={3} />
            </div>
            <div>
              <p className="font-medium text-gray-800 text-sm">{tx.description}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {format(new Date(tx.date), 'dd-MM-yyyy HH:mm', { locale: id })}
                {tx.category && ` - ${tx.category}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className={`font-semibold text-sm ${isIncome ? 'text-emerald-600' : 'text-red-600'}`}>
              {isIncome ? '+' : '-'} {formatCurrency(tx.amount)}
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {onEdit && (
                <button 
                  onClick={() => onEdit(tx)}
                  className="text-gray-300 hover:text-blue-500 transition-colors p-1"
                >
                  <Edit2 size={16} />
                </button>
              )}
              <button 
                onClick={() => setDeleteId(tx.id)}
                className="text-gray-300 hover:text-red-500 transition-colors p-1"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>
      ))}

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
