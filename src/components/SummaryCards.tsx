import { ArrowUp, ArrowDown, CreditCard } from 'lucide-react';

interface SummaryCardsProps {
  income: number;
  expense: number;
  balance: number;
}

export default function SummaryCards({ income, expense, balance }: SummaryCardsProps) {
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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 transition-transform hover:-translate-y-1 duration-200">
        <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
          <ArrowUp size={24} strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-400 mb-1">Total Pemasukan</p>
          <p className="text-xl font-bold text-gray-800">{formatCurrency(income)}</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 transition-transform hover:-translate-y-1 duration-200">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500">
          <ArrowDown size={24} strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-400 mb-1">Total Pengeluaran</p>
          <p className="text-xl font-bold text-gray-800">{formatCurrency(expense)}</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 transition-transform hover:-translate-y-1 duration-200">
        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
          <CreditCard size={24} strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-400 mb-1">Saldo Saat Ini</p>
          <p className="text-xl font-bold text-gray-800">{formatCurrency(balance)}</p>
        </div>
      </div>
    </div>
  );
}
