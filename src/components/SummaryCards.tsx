import { PlusCircle, MinusCircle, CreditCard, CalendarDays, Clock } from 'lucide-react';
import { ReactNode } from 'react';

interface SummaryCardsProps {
  incomeToday: number;
  expenseToday: number;
  incomeMonth: number;
  expenseMonth: number;
  balance: number;
  isLoading?: boolean;
}

export default function SummaryCards({ incomeToday, expenseToday, incomeMonth, expenseMonth, balance, isLoading = false }: SummaryCardsProps) {
  const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
    return formatted.replace('Rp', 'Rp ');
  };

  const renderCardContent = (title: string, value: number, icon: ReactNode, iconBg: string, iconColor: string, subIcon?: ReactNode) => (
    <>
      <div className={`w-12 h-12 rounded-full ${iconBg} flex-shrink-0 flex items-center justify-center ${iconColor}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1 flex items-center gap-1">
          {subIcon} {title}
        </p>
        {isLoading ? (
          <div className="h-7 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg mt-1"></div>
        ) : (
          <p className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100 break-words">{formatCurrency(value)}</p>
        )}
      </div>
    </>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4 transition-all hover:-translate-y-1 duration-200 sm:col-span-2 lg:col-span-1">
        {renderCardContent('Saldo Saat Ini', balance, <CreditCard size={24} strokeWidth={2.5} />, 'bg-blue-50 dark:bg-blue-900/30', 'text-blue-500 dark:text-blue-400')}
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4 transition-all hover:-translate-y-1 duration-200">
        {renderCardContent('Pemasukan Hari Ini', incomeToday, <PlusCircle size={24} strokeWidth={2.5} />, 'bg-emerald-50 dark:bg-emerald-900/30', 'text-emerald-500 dark:text-emerald-400', <Clock size={12} />)}
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4 transition-all hover:-translate-y-1 duration-200">
        {renderCardContent('Pengeluaran Hari Ini', expenseToday, <MinusCircle size={24} strokeWidth={2.5} />, 'bg-red-50 dark:bg-red-900/30', 'text-red-500 dark:text-red-400', <Clock size={12} />)}
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4 transition-all hover:-translate-y-1 duration-200">
        {renderCardContent('Pemasukan Bulan Ini', incomeMonth, <PlusCircle size={24} strokeWidth={2.5} />, 'bg-emerald-50 dark:bg-emerald-900/30', 'text-emerald-500 dark:text-emerald-400', <CalendarDays size={12} />)}
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4 transition-all hover:-translate-y-1 duration-200">
        {renderCardContent('Pengeluaran Bulan Ini', expenseMonth, <MinusCircle size={24} strokeWidth={2.5} />, 'bg-red-50 dark:bg-red-900/30', 'text-red-500 dark:text-red-400', <CalendarDays size={12} />)}
      </div>
    </div>
  );
}
