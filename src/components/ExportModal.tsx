import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Transaction, Wallet } from '../types';
import { X, Download, FileSpreadsheet, FileText, Calendar as CalendarIcon } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { id } from 'date-fns/locale/id';

const safeParseDate = (dateStr: string) => {
  try {
    const parsed = parseISO(dateStr);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  } catch {
    return new Date();
  }
};

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  wallets: Wallet[];
}

type ExportFilter = 'this_month' | 'date_range' | 'all';
type ExportFormat = 'excel' | 'pdf';

export default function ExportModal({ isOpen, onClose, user, wallets }: ExportModalProps) {
  const [filter, setFilter] = useState<ExportFilter>('this_month');
  const [formatType, setFormatType] = useState<ExportFormat>('excel');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleExport = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'transactions'),
        where('userId', '==', user.uid)
      );
      const snap = await getDocs(q);
      console.log("Fetched transactions count:", snap.docs.length);
      
      let transactions = snap.docs.map(d => {
        const data = d.data();
        // Konversi Firestore Timestamp ke ISO String jika perlu
        const txDate = data.date?.toDate ? data.date.toDate().toISOString() : data.date;
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt;
        
        return {
          id: d.id,
          ...data,
          date: txDate,
          createdAt: createdAt,
        } as Transaction;
      });

      if (transactions.length === 0) {
        alert("Tidak ada data transaksi yang ditemukan untuk filter ini.");
        setLoading(false);
        return;
      }

      // Sort in memory to avoid index requirement
      transactions.sort((a, b) => {
        const dateA = safeParseDate(a.date).getTime();
        const dateB = safeParseDate(b.date).getTime();
        return dateB - dateA;
      });

      const walletMap = new Map(wallets.map(w => [w.id, w.name]));

      // Determine period boundaries
      let periodStart = new Date(0); // Beginning of time
      let periodEnd = new Date(); // Default to now
      
      if (filter === 'this_month') {
        periodStart = startOfMonth(new Date());
        periodEnd = endOfMonth(new Date());
      } else if (filter === 'date_range') {
        periodStart = new Date(startDate);
        periodStart.setHours(0, 0, 0, 0);
        periodEnd = new Date(endDate);
        periodEnd.setHours(23, 59, 59, 999);
      } else if (filter === 'all') {
        // Find the earliest transaction date for periodStart
        if (transactions.length > 0) {
          const dates = transactions.map(tx => safeParseDate(tx.date).getTime());
          periodStart = new Date(Math.min(...dates));
        }
      }

      // Calculate balances for the period
      const walletBalances = wallets.map(w => {
        let balanceAtStart = w.initialBalance || 0;
        let balanceAtEnd = w.initialBalance || 0;
        let currentBalance = w.initialBalance || 0;
        
        transactions.forEach(tx => {
          const txDate = safeParseDate(tx.date);
          if (tx.walletId === w.id) {
            // Balance BEFORE the period starts
            if (txDate < periodStart) {
              if (tx.type === 'income') balanceAtStart += tx.amount;
              else if (tx.type === 'expense' && tx.category !== 'Savings' && tx.category !== 'Tabungan') balanceAtStart -= tx.amount;
            }
            // Balance AT THE END of the period
            if (txDate <= periodEnd) {
              if (tx.type === 'income') balanceAtEnd += tx.amount;
              else if (tx.type === 'expense' && tx.category !== 'Savings' && tx.category !== 'Tabungan') balanceAtEnd -= tx.amount;
            }
            // CURRENT Balance (all time)
            if (tx.type === 'income') currentBalance += tx.amount;
            else if (tx.type === 'expense' && tx.category !== 'Savings' && tx.category !== 'Tabungan') currentBalance -= tx.amount;
          }
        });
        return { 
          nama: w.name, 
          saldoAwal: balanceAtStart, 
          saldoAkhir: balanceAtEnd,
          saldoSaatIni: currentBalance,
          selisih: balanceAtEnd - balanceAtStart
        };
      });

      let totalIncome = 0;
      let totalExpense = 0;

      // Filter data for the report (transactions WITHIN the period)
      const filteredTransactions = transactions.filter(tx => {
        const txDate = safeParseDate(tx.date);
        return txDate >= periodStart && txDate <= periodEnd;
      });

      const exportData = filteredTransactions.map(tx => {
        let formattedDate = '-';
        try {
          if (tx.date) {
            formattedDate = format(safeParseDate(tx.date), 'dd-MM-yyyy HH:mm', { locale: id });
          }
        } catch (e) {
          console.error("Error formatting date:", tx.date, e);
        }

        if (tx.type === 'income') {
          totalIncome += tx.amount;
        } else {
          totalExpense += tx.amount;
        }

        return {
          Tanggal: formattedDate,
          Tipe: tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
          Kategori: tx.category || '-',
          Dompet: tx.walletId ? walletMap.get(tx.walletId) || '-' : '-',
          Keterangan: tx.description || '-',
          Pemasukan: tx.type === 'income' ? tx.amount : null,
          Pengeluaran: tx.type === 'expense' ? tx.amount : null
        };
      });

      const summary = {
        totalIncome,
        totalExpense,
        netBalance: totalIncome - totalExpense,
        totalSaldoAwal: walletBalances.reduce((sum, w) => sum + w.saldoAwal, 0),
        totalSaldoAkhir: walletBalances.reduce((sum, w) => sum + w.saldoAkhir, 0),
        totalSaldoSaatIni: walletBalances.reduce((sum, w) => sum + w.saldoSaatIni, 0)
      };

      if (formatType === 'excel') {
        exportToExcel(exportData, summary, walletBalances);
      } else {
        exportToPDF(exportData, summary, walletBalances);
      }
      onClose();
    } catch (error) {
      console.error("Error exporting data: ", error);
      alert("Gagal mengekspor data.");
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = (data: any[], summary: any, walletBalances: any[]) => {
    const wb = XLSX.utils.book_new();
    
    // 1. Wallet Balances Sheet
    const walletData = walletBalances.map(w => ({
      'Nama Dompet/Rekening': w.nama,
      'Saldo Awal Periode': w.saldoAwal,
      'Selisih Periode': w.selisih,
      'Saldo Akhir Periode': w.saldoAkhir,
      'Saldo Saat Ini (Real-time)': w.saldoSaatIni
    }));
    const wsWallets = XLSX.utils.json_to_sheet(walletData);
    XLSX.utils.book_append_sheet(wb, wsWallets, "Saldo Dompet");

    // 2. Transactions Sheet
    const wsTxs = XLSX.utils.json_to_sheet(data);
    
    // Add summary rows at the bottom
    XLSX.utils.sheet_add_aoa(wsTxs, [
      [],
      ['', '', '', '', 'Total Saldo Awal', summary.totalSaldoAwal, ''],
      ['', '', '', '', 'Total Pemasukan', summary.totalIncome, ''],
      ['', '', '', '', 'Total Pengeluaran', '', summary.totalExpense],
      ['', '', '', '', 'Selisih Periode', summary.netBalance, ''],
      ['', '', '', '', 'Total Saldo Akhir', summary.totalSaldoAkhir, ''],
      ['', '', '', '', 'Total Saldo Saat Ini', summary.totalSaldoSaatIni, ''],
    ], { origin: -1 });

    // Set column widths
    wsTxs['!cols'] = [
      { wch: 18 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 35 }, { wch: 15 }, { wch: 15 }
    ];
    wsWallets['!cols'] = [
      { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 25 }
    ];

    XLSX.utils.book_append_sheet(wb, wsTxs, "Transaksi");
    XLSX.writeFile(wb, `Laporan_Keuangan_${format(new Date(), 'ddMMyyyy')}.xlsx`);
  };

  const exportToPDF = (data: any[], summary: any, walletBalances: any[]) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.setTextColor(16, 185, 129);
    doc.text("Laporan Keuangan CatatUang", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Dicetak pada: ${format(new Date(), 'dd MMM yyyy HH:mm', { locale: id })}`, 14, 28);
    
    let filterText = 'Semua Data';
    if (filter === 'this_month') filterText = `Bulan Ini (${format(new Date(), 'MMMM yyyy', { locale: id })})`;
    else if (filter === 'date_range') filterText = `Periode: ${format(new Date(startDate), 'dd MMM yyyy', { locale: id })} - ${format(new Date(endDate), 'dd MMM yyyy', { locale: id })}`;
    
    doc.text(`Filter: ${filterText}`, 14, 34);

    // Summary Box
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(16, 185, 129);
    doc.roundedRect(14, 40, 182, 35, 3, 3, 'FD');
    
    doc.setFontSize(10);
    doc.setTextColor(30);
    doc.setFont("helvetica", "normal");
    doc.text("Saldo Awal Periode:", 20, 48);
    doc.text(new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(summary.totalSaldoAwal), 60, 48);
    
    doc.text("Total Pemasukan:", 20, 56);
    doc.text(new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(summary.totalIncome), 60, 56);
    
    doc.text("Total Pengeluaran:", 20, 64);
    doc.text(new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(summary.totalExpense), 60, 64);
    
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30);
    doc.text("Selisih Periode:", 110, 48);
    const selisihColor = summary.netBalance >= 0 ? [16, 185, 129] : [239, 68, 68];
    doc.setTextColor(selisihColor[0], selisihColor[1], selisihColor[2]);
    doc.text(new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(summary.netBalance), 155, 48);

    doc.setTextColor(30);
    doc.text("Saldo Akhir Periode:", 110, 56);
    const balanceColor = summary.totalSaldoAkhir >= 0 ? [16, 185, 129] : [239, 68, 68];
    doc.setTextColor(balanceColor[0], balanceColor[1], balanceColor[2]);
    doc.text(new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(summary.totalSaldoAkhir), 155, 56);
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30);
    doc.text("Saldo Saat Ini (Real-time):", 110, 64);
    const currentBalanceColor = summary.totalSaldoSaatIni >= 0 ? [16, 185, 129] : [239, 68, 68];
    doc.setTextColor(currentBalanceColor[0], currentBalanceColor[1], currentBalanceColor[2]);
    doc.text(new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(summary.totalSaldoSaatIni), 155, 64);
    
    // Wallet Balances Table
    doc.setFontSize(12);
    doc.setTextColor(16, 185, 129);
    doc.text("Ringkasan Saldo Per Dompet", 14, 85);
    
    autoTable(doc, {
      head: [["Nama Dompet/Rekening", "Saldo Awal", "Selisih", "Saldo Akhir", "Saldo Saat Ini"]],
      body: walletBalances.map(w => [
        w.nama, 
        new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(w.saldoAwal),
        new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(w.selisih),
        new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(w.saldoAkhir),
        new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(w.saldoSaatIni)
      ]),
      startY: 90,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
      margin: { bottom: 10 }
    });

    // Transactions Table
    const finalY = (doc as any).lastAutoTable.finalY || 90;
    doc.setFontSize(12);
    doc.setTextColor(16, 185, 129);
    doc.text("Detail Transaksi", 14, finalY + 15);

    const tableColumn = ["Tanggal", "Tipe", "Kategori", "Dompet", "Keterangan", "Pemasukan", "Pengeluaran"];
    const tableRows = data.map(item => [
      item.Tanggal,
      item.Tipe,
      item.Kategori,
      item.Dompet,
      item.Keterangan,
      item.Pemasukan ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(item.Pemasukan) : '-',
      item.Pengeluaran ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(item.Pengeluaran) : '-'
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: finalY + 20,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: {
        5: { halign: 'right' },
        6: { halign: 'right' }
      }
    });

    doc.save(`Laporan_Keuangan_${format(new Date(), 'ddMMyyyy')}.pdf`);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b dark:border-gray-700 flex justify-between items-center bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/50">
          <h3 className="font-semibold text-lg text-emerald-800 dark:text-emerald-400 flex items-center gap-2">
            <Download size={20} /> Ekspor Data
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Pilih Filter Data</label>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => setFilter('this_month')}
                className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                  filter === 'this_month' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <CalendarIcon size={18} />
                  <span className="text-sm font-medium">Bulan Ini</span>
                </div>
                {filter === 'this_month' && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
              </button>
              <button
                onClick={() => setFilter('date_range')}
                className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                  filter === 'date_range' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <CalendarIcon size={18} />
                  <span className="text-sm font-medium">Rentang Tanggal</span>
                </div>
                {filter === 'date_range' && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
              </button>
              <button
                onClick={() => setFilter('all')}
                className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                  filter === 'all' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <CalendarIcon size={18} />
                  <span className="text-sm font-medium">Semua Data</span>
                </div>
                {filter === 'all' && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
              </button>
            </div>
          </div>

          {filter === 'date_range' && (
            <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-200">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Dari Tanggal</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Sampai Tanggal</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>
          )}

          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Pilih Format File</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setFormatType('excel')}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                  formatType === 'excel' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                <FileSpreadsheet size={24} className={formatType === 'excel' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'} />
                <span className="text-xs font-bold">EXCEL</span>
              </button>
              <button
                onClick={() => setFormatType('pdf')}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                  formatType === 'pdf' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                <FileText size={24} className={formatType === 'pdf' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'} />
                <span className="text-xs font-bold">PDF</span>
              </button>
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleExport}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Mengekspor...
                </>
              ) : (
                <>
                  <Download size={18} />
                  Ekspor Sekarang
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
