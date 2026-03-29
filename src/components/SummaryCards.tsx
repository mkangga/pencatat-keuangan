import { ArrowUp, ArrowDown, CreditCard, CalendarDays, Clock } from 'lucide-react';

interface SummaryCardsProps {
  incomeToday: number;
  expenseToday: number;
  incomeMonth: number;
  expenseMonth: number;
  balance: number;
}

export default function SummaryCards({ incomeToday, expenseToday, incomeMonth, expenseMonth, balance }: SummaryCardsProps) {
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4 transition-all hover:-translate-y-1 duration-200 sm:col-span-2 lg:col-span-1">
        <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-500 dark:text-blue-400">
          <CreditCard size={24} strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1">Saldo Saat Ini</p>
          <p className="text-xl font-bold text-gray-800 dark:text-gray-100">{formatCurrency(balance)}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4 transition-all hover:-translate-y-1 duration-200">
        <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-500 dark:text-emerald-400">
          <ArrowUp size={24} strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1 flex items-center gap-1">
            <Clock size={12} /> Pemasukan Hari Ini
          </p>
          <p className="text-xl font-bold text-gray-800 dark:text-gray-100">{formatCurrency(incomeToday)}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4 transition-all hover:-translate-y-1 duration-200">
        <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center text-red-500 dark:text-red-400">
          <ArrowDown size={24} strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1 flex items-center gap-1">
            <Clock size={12} /> Pengeluaran Hari Ini
          </p>
          <p className="text-xl font-bold text-gray-800 dark:text-gray-100">{formatCurrency(expenseToday)}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4 transition-all hover:-translate-y-1 duration-200">
        <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-500 dark:text-emerald-400">
          <ArrowUp size={24} strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1 flex items-center gap-1">
            <CalendarDays size={12} /> Pemasukan Bulan Ini
          </p>
          <p className="text-xl font-bold text-gray-800 dark:text-gray-100">{formatCurrency(incomeMonth)}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4 transition-all hover:-translate-y-1 duration-200">
        <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center text-red-500 dark:text-red-400">
          <ArrowDown size={24} strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1 flex items-center gap-1">
            <CalendarDays size={12} /> Pengeluaran Bulan Ini
          </p>
          <p className="text-xl font-bold text-gray-800 dark:text-gray-100">{formatCurrency(expenseMonth)}</p>
        </div>
      </div>
    </div>
  );
}
