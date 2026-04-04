import { useMemo, useState, useEffect } from 'react';
import { Transaction, Category, CategoryGroup } from '../types';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { subMonths, isAfter, format, isSameMonth, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import SummaryCards from './SummaryCards';
import { User } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

interface AnalysisProps {
  transactions: Transaction[];
  incomeToday: number;
  expenseToday: number;
  incomeMonth: number;
  expenseMonth: number;
  balance: number;
  user: User;
  categories: Category[];
  isDarkMode: boolean;
  isLoading?: boolean;
}

export default function Analysis({ 
  transactions,
  incomeToday,
  expenseToday,
  incomeMonth,
  expenseMonth,
  balance,
  user,
  categories,
  isDarkMode,
  isLoading = false
}: AnalysisProps) {
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'categoryGroups'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setCategoryGroups(snap.docs.map(d => ({ id: d.id, ...d.data() } as CategoryGroup)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'categoryGroups');
    });
    return () => unsub();
  }, [user]);
  const months = useMemo(() => {
    const months = [];
    for (let i = 0; i < 12; i++) {
      months.push(subMonths(new Date(), i));
    }
    return months;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState(months[0]);
  const [expenseChartType, setExpenseChartType] = useState<'donut' | 'pie' | null>(null);
  const [incomeChartType, setIncomeChartType] = useState<'donut' | 'pie' | null>(null);

  const { expensePieData, incomePieData, incomeExpenseData } = useMemo(() => {
    const filteredTransactions = transactions.filter(tx => 
      isSameMonth(parseISO(tx.date), selectedMonth) && 
      tx.category !== 'Pindah Saldo'
    );

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

  const healthAnalysisData = useMemo(() => {
    const groupTotals: Record<string, number> = {
      needs: 0,
      wants: 0,
      savings: 0,
      debts: 0,
      uncategorized: 0
    };

    expensePieData.forEach(item => {
      // Find the corresponding expense category to get its group
      const category = categories.find(c => 
        c.type === 'expense' && 
        c.name.trim().toLowerCase() === item.name.trim().toLowerCase()
      );
      
      const debtGroup = categoryGroups.find(g => 
        g.type === 'debts' || 
        g.name.toLowerCase().includes('hutang') || 
        g.name.toLowerCase().includes('debt')
      );
      
      if (category && category.groupId) {
        const group = categoryGroups.find(g => g.id === category.groupId);
        if (group) {
          const groupType = group.type.toLowerCase();
          if (groupType === 'needs' || groupType === 'kebutuhan') groupTotals.needs += item.value;
          else if (groupType === 'wants' || groupType === 'keinginan') groupTotals.wants += item.value;
          else if (groupType === 'savings' || groupType === 'tabungan' || groupType === 'investasi') groupTotals.savings += item.value;
          else if (groupType === 'debts' || groupType === 'hutang' || group.name.toLowerCase().includes('hutang') || group.name.toLowerCase().includes('debt') || group.name.toLowerCase() === 'debts') groupTotals.debts += item.value;
          else groupTotals.uncategorized += item.value;
        } else {
          groupTotals.uncategorized += item.value;
        }
      } else if (
        item.name === 'Hutang/Piutang' || 
        item.name.toLowerCase().includes('hutang') || 
        item.name.toLowerCase().includes('pinjaman') || 
        item.name.toLowerCase().includes('cicilan') || 
        item.name.toLowerCase().includes('paylater')
      ) {
        // Fallback for built-in debt transactions or categories containing debt keywords
        groupTotals.debts += item.value;
      } else {
        groupTotals.uncategorized += item.value;
      }
    });

    incomePieData.forEach(item => {
      const category = categories.find(c => 
        c.type === 'income' && 
        c.name.trim().toLowerCase() === item.name.trim().toLowerCase()
      );
      
      if (category && category.groupId) {
        const group = categoryGroups.find(g => g.id === category.groupId);
        if (group) {
          const groupType = group.type.toLowerCase();
          if (groupType === 'savings' || groupType === 'tabungan' || groupType === 'investasi') {
            groupTotals.savings += item.value;
          }
        }
      } else if (item.name.toLowerCase() === 'tabungan' || item.name.toLowerCase() === 'investasi') {
        groupTotals.savings += item.value;
      }
    });

    const totalExpense = Object.values(groupTotals).reduce((a, b) => a + b, 0);

    const data = [
      { name: 'Needs (Kebutuhan)', value: groupTotals.needs, color: '#3b82f6', percentage: totalExpense ? (groupTotals.needs / totalExpense) * 100 : 0 },
      { name: 'Wants (Keinginan)', value: groupTotals.wants, color: '#f59e0b', percentage: totalExpense ? (groupTotals.wants / totalExpense) * 100 : 0 },
      { name: 'Savings (Tabungan)', value: groupTotals.savings, color: '#10b981', percentage: totalExpense ? (groupTotals.savings / totalExpense) * 100 : 0 },
      { name: 'Debts (Hutang)', value: groupTotals.debts, color: '#ef4444', percentage: totalExpense ? (groupTotals.debts / totalExpense) * 100 : 0 },
      { name: 'Lainnya', value: groupTotals.uncategorized, color: '#9ca3af', percentage: totalExpense ? (groupTotals.uncategorized / totalExpense) * 100 : 0 }
    ].filter(d => d.value > 0);

    let conclusion = '';
    if (totalExpense > 0) {
      const needsPct = (groupTotals.needs / totalExpense) * 100;
      const wantsPct = (groupTotals.wants / totalExpense) * 100;
      const savingsPct = (groupTotals.savings / totalExpense) * 100;
      const debtsPct = (groupTotals.debts / totalExpense) * 100;

      const insights = [];
      if (needsPct > 50) insights.push('Pengeluaran Kebutuhan (Needs) Anda melebihi batas ideal 50%.');
      if (wantsPct > 30) insights.push('Pengeluaran Keinginan (Wants) Anda melebihi batas ideal 30%.');
      
      // For savings and debts, we consider them together as "financial future"
      const totalFinancialFuture = savingsPct + debtsPct;
      if (totalFinancialFuture < 20) {
        insights.push('Alokasi untuk Tabungan & Pelunasan Hutang Anda masih di bawah target ideal 20%.');
      }
      
      if (debtsPct > 15) {
        insights.push('Porsi pembayaran Hutang/Cicilan Anda cukup tinggi (di atas 15%), usahakan untuk menguranginya.');
      }
      
      if (insights.length === 0) {
        conclusion = 'Kesehatan finansial Anda sangat baik! Anda telah mengikuti aturan alokasi keuangan dengan disiplin.';
      } else {
        conclusion = insights.join(' ');
      }
    }
    
    return { data, conclusion };
  }, [expensePieData, incomePieData, categories, categoryGroups]);

  const monthlySummaryData = useMemo(() => {
    const data = [];
    for (let i = 11; i >= 0; i--) {
      const monthDate = subMonths(new Date(), i);
      const monthName = format(monthDate, 'MMM yy', { locale: id });
      
      let income = 0;
      let expense = 0;
      
      transactions.forEach(tx => {
        if (isSameMonth(parseISO(tx.date), monthDate) && tx.category !== 'Pindah Saldo') {
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

  const renderCategoryChart = (
    data: { name: string; value: number }[],
    title: string,
    chartType: 'donut' | 'pie' | null,
    setChartType: (type: 'donut' | 'pie') => void
  ) => (
    <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{title}</h2>
        {chartType && data.length > 0 && (
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setChartType('donut')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                chartType === 'donut'
                  ? 'bg-white dark:bg-gray-600 text-gray-800 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              Donut
            </button>
            <button
              onClick={() => setChartType('pie')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                chartType === 'pie'
                  ? 'bg-white dark:bg-gray-600 text-gray-800 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              Pie
            </button>
          </div>
        )}
      </div>
      
      <div className="h-[350px] sm:h-[300px] w-full relative">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500">Belum ada data</div>
        ) : (
          <>
            {!chartType && (
              <div className="absolute inset-0 z-10 bg-white dark:bg-gray-800 flex flex-col items-center justify-center gap-4">
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-2">Pilih jenis grafik untuk menampilkan data</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setChartType('donut')}
                    className="px-4 py-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-xl text-sm font-medium hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                  >
                    Tampilkan Donut Chart
                  </button>
                  <button
                    onClick={() => setChartType('pie')}
                    className="px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-xl text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                  >
                    Tampilkan Pie Chart
                  </button>
                </div>
              </div>
            )}
            <div className={`w-full h-full transition-opacity duration-300 ${!chartType ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="40%"
                    outerRadius={90}
                    {...(chartType === 'donut' ? { innerRadius: 60, paddingAngle: 5 } : {})}
                    dataKey="value"
                    stroke={chartType === 'pie' ? (isDarkMode ? '#1f2937' : '#ffffff') : 'none'}
                    strokeWidth={chartType === 'pie' ? 2 : undefined}
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
                      backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                      color: isDarkMode ? '#f3f4f6' : '#1f2937'
                    }} 
                    itemStyle={{ color: isDarkMode ? '#f3f4f6' : '#1f2937' }}
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
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6 font-sans">Analisis Keuangan</h1>
        <SummaryCards 
          incomeToday={incomeToday} 
          expenseToday={expenseToday} 
          incomeMonth={incomeMonth} 
          expenseMonth={expenseMonth} 
          balance={balance} 
          isLoading={isLoading}
        />
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 font-sans">Grafik Analisis</h2>
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
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: isDarkMode ? '#9ca3af' : '#4b5563', fontSize: 12 }} />
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
                  tick={{ fill: isDarkMode ? '#9ca3af' : '#4b5563' }} 
                />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)} 
                  cursor={{ fill: isDarkMode ? '#374151' : '#f3f4f6' }} 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                    color: isDarkMode ? '#f3f4f6' : '#1f2937'
                  }}
                  itemStyle={{ color: isDarkMode ? '#f3f4f6' : '#1f2937' }}
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
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-6">Financial Health Analysis</h2>
          <div className="h-[300px] w-full relative">
            {healthAnalysisData.data.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
                Belum ada data pengeluaran bulan ini
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={healthAnalysisData.data}
                    cx="50%"
                    cy="40%"
                    outerRadius={90}
                    innerRadius={60}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {healthAnalysisData.data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
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
            )}
          </div>
          {healthAnalysisData.conclusion && (
            <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
              <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-300 mb-1">Kesimpulan:</h3>
              <p className="text-sm text-emerald-700 dark:text-emerald-400">{healthAnalysisData.conclusion}</p>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-6">Pemasukan vs Pengeluaran</h2>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incomeExpenseData} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: isDarkMode ? '#9ca3af' : '#4b5563' }} />
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
                  tick={{ fill: isDarkMode ? '#9ca3af' : '#4b5563' }} 
                />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)} 
                  cursor={{ fill: 'transparent' }} 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                    color: isDarkMode ? '#f3f4f6' : '#1f2937'
                  }}
                  itemStyle={{ color: isDarkMode ? '#f3f4f6' : '#1f2937' }}
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
        {renderCategoryChart(expensePieData, 'Pengeluaran per Kategori', expenseChartType, setExpenseChartType)}
        {renderCategoryChart(incomePieData, 'Pemasukan per Kategori', incomeChartType, setIncomeChartType)}
      </div>
    </div>
  );
}
