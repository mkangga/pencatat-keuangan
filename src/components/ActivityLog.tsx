import { Transaction } from '../types';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface ActivityLogProps {
  transactions: Transaction[];
}

export default function ActivityLog({ transactions }: ActivityLogProps) {
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
      <h1 className="text-2xl font-bold text-gray-800 mb-6 font-sans">Log Aktivitas</h1>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        {transactions.length > 0 ? (
          <div className="space-y-4">
            {transactions.map(tx => (
              <div key={tx.id} className="flex justify-between items-center p-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 rounded-xl transition-colors">
                <div>
                  <p className="font-medium text-gray-800">{tx.description}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {format(new Date(tx.date), 'dd MMMM yyyy', { locale: id })}
                    {tx.category && ` • ${tx.category}`}
                  </p>
                </div>
                <div className={`font-bold ${tx.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {tx.type === 'income' ? '+' : '-'} {formatCurrency(tx.amount)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">Belum ada aktivitas.</p>
        )}
      </div>
    </div>
  );
}
