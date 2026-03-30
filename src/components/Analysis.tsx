import { useMemo, useState } from 'react';
import { Transaction } from '../types';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { subMonths, isAfter, format, isSameMonth, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function Analysis({ transactions }: { transactions: Transaction[] }) {
  const months = useMemo(() => {
    const months = [];
    for (let i = 0; i < 12; i++) {
      months.push(subMonths(new Date(), i));
    }
    return months;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState(months[0]);

  const { expensePieData, incomePieData, incomeExpenseData } = useMemo(() => {
    const filteredTransactions = transactions.filter(tx => isSameMonth(parseISO(tx.date), selectedMonth));

    let income = 0;
    let expense = 0;
    const expenseCategoryMap: Record<string, number> = {};
    const incomeCategoryMap: Record<string, number> = {};

    filteredTransactions.forEach(tx => {
      const cat = tx.category || 'Lainnya';
      if (tx.type === 'income') {
        income += tx.amount;
        incomeCategoryMap[cat] = (incomeCategoryMap[cat] || 0) + tx.amount;
      } else {
        expense += tx.amount;
        expenseCategoryMap[cat] = (expenseCategoryMap[cat] || 0) + tx.amount;
      }
    });

    const expensePieData = Object.entries(expenseCategoryMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const incomePieData = Object.entries(incomeCategoryMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const incomeExpenseData = [
      { name: 'Pemasukan', value: income },
      { name: 'Pengeluaran', value: expense },
    ];

    return { expensePieData, incomePieData, incomeExpenseData };
  }, [transactions, selectedMonth]);

  const monthlySummaryData = useMemo(() => {
    const data = [];
    for (let i = 11; i >= 0; i--) {
      const monthDate = subMonths(new Date(), i);
      const monthName = format(monthDate, 'MMM yy', { locale: id });
      
      let income = 0;
      let expense = 0;
      
      transactions.forEach(tx => {
        if (isSameMonth(parseISO(tx.date), monthDate)) {
          if (tx.type === 'income') income += tx.amount;
          else expense += tx.amount;
        }
      });
      
      data.push({
        name: monthName,
        Pemasukan: income,
        Pengeluaran: expense,
        Saldo: income - expense
      });
    }
    return data;
  }, [transactions]);

  const formatCurrency = (value: number) => `Rp ${new Intl.NumberFormat('id-ID').format(value)}`;

  const renderDonutChart = (data: { name: string; value: number }[], title: string) => (
    <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-6">{title}</h2>
      <div className="h-[350px] sm:h-[300px] w-full">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="40%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)} 
                contentStyle={{ 
                  borderRadius: '12px', 
                  border: 'none', 
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  backgroundColor: document.documentElement.classList.contains('dark') ? '#1f2937' : '#ffffff',
                  color: document.documentElement.classList.contains('dark') ? '#f3f4f6' : '#1f2937'
                }} 
                itemStyle={{ color: document.documentElement.classList.contains('dark') ? '#f3f4f6' : '#1f2937' }}
              />
              <Legend 
                layout="horizontal" 
                verticalAlign="bottom" 
                align="center" 
                iconType="circle"
                wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500">Belum ada data</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 font-sans">Analisis Keuangan</h1>
        <select 
          value={format(selectedMonth, 'yyyy-MM')} 
          onChange={(e) => setSelectedMonth(parseISO(e.target.value + '-01'))}
          className="w-full sm:w-auto p-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 text-gray-800 dark:text-gray-100 transition-colors duration-300"
        >
          {months.map(month => (
            <option key={format(month, 'yyyy-MM')} value={format(month, 'yyyy-MM')}>
              {format(month, 'MMMM yyyy', { locale: id })}
            </option>
          ))}
        </select>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300 lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-6">Ringkasan Bulanan (1 Tahun Terakhir)</h2>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlySummaryData} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={document.documentElement.classList.contains('dark') ? '#374151' : '#e5e7eb'} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: document.documentElement.classList.contains('dark') ? '#9ca3af' : '#4b5563', fontSize: 12 }} />
                <YAxis 
                  width={60}
                  tickFormatter={(val) => {
                    if (val >= 1000000000) return `Rp${val / 1000000000}M`;
                    if (val >= 1000000) return `Rp${val / 1000000}jt`;
                    if (val >= 1000) return `Rp${val / 1000}k`;
                    return `Rp${val}`;
                  }} 
                  axisLine={false} 
                  tickLine={false} 
                  fontSize={12} 
                  tick={{ fill: document.documentElement.classList.contains('dark') ? '#9ca3af' : '#4b5563' }} 
                />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)} 
                  cursor={{ fill: document.documentElement.classList.contains('dark') ? '#374151' : '#f3f4f6' }} 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    backgroundColor: document.documentElement.classList.contains('dark') ? '#1f2937' : '#ffffff',
                    color: document.documentElement.classList.contains('dark') ? '#f3f4f6' : '#1f2937'
                  }}
                  itemStyle={{ color: document.documentElement.classList.contains('dark') ? '#f3f4f6' : '#1f2937' }}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }}
                />
                <Bar dataKey="Pemasukan" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Pengeluaran" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Saldo" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-6">Pemasukan vs Pengeluaran</h2>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incomeExpenseData} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={document.documentElement.classList.contains('dark') ? '#374151' : '#e5e7eb'} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: document.documentElement.classList.contains('dark') ? '#9ca3af' : '#4b5563' }} />
                <YAxis 
                  width={60}
                  tickFormatter={(val) => {
                    if (val >= 1000000000) return `Rp${val / 1000000000}M`;
                    if (val >= 1000000) return `Rp${val / 1000000}jt`;
                    if (val >= 1000) return `Rp${val / 1000}k`;
                    return `Rp${val}`;
                  }} 
                  axisLine={false} 
                  tickLine={false} 
                  fontSize={12} 
                  tick={{ fill: document.documentElement.classList.contains('dark') ? '#9ca3af' : '#4b5563' }} 
                />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)} 
                  cursor={{ fill: 'transparent' }} 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    backgroundColor: document.documentElement.classList.contains('dark') ? '#1f2937' : '#ffffff',
                    color: document.documentElement.classList.contains('dark') ? '#f3f4f6' : '#1f2937'
                  }}
                  itemStyle={{ color: document.documentElement.classList.contains('dark') ? '#f3f4f6' : '#1f2937' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40}>
                  {incomeExpenseData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        {renderDonutChart(expensePieData, 'Pengeluaran per Kategori')}
        {renderDonutChart(incomePieData, 'Pemasukan per Kategori')}
      </div>
    </div>
  );
}
