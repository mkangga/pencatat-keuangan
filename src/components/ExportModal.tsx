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

      // Filter data
      if (filter === 'this_month') {
        const start = startOfMonth(new Date());
        const end = endOfMonth(new Date());
        transactions = transactions.filter(tx => {
          const txDate = safeParseDate(tx.date);
          return isWithinInterval(txDate, { start, end });
        });
      } else if (filter === 'date_range') {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        transactions = transactions.filter(tx => {
          const txDate = safeParseDate(tx.date);
          return isWithinInterval(txDate, { start, end });
        });
      }

      const walletMap = new Map(wallets.map(w => [w.id, w.name]));

      let totalIncome = 0;
      let totalExpense = 0;

      const exportData = transactions.map(tx => {
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
          Pemasukan: tx.type === 'income' ? tx.amount : 0,
          Pengeluaran: tx.type === 'expense' ? tx.amount : 0
        };
      });

      const summary = {
        totalIncome,
        totalExpense,
        netBalance: totalIncome - totalExpense
      };

      if (formatType === 'excel') {
        exportToExcel(exportData, summary);
      } else {
        exportToPDF(exportData, summary);
      }
      onClose();
    } catch (error) {
      console.error("Error exporting data: ", error);
      alert("Gagal mengekspor data.");
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = (data: any[], summary: any) => {
    const ws = XLSX.utils.json_to_sheet(data);
    
    // Add summary rows at the bottom
    XLSX.utils.sheet_add_aoa(ws, [
      [],
      ['', '', '', '', 'Total Pemasukan', summary.totalIncome, ''],
      ['', '', '', '', 'Total Pengeluaran', '', summary.totalExpense],
      ['', '', '', '', 'Saldo Bersih', summary.netBalance, ''],
    ], { origin: -1 });

    // Set column widths for better readability
    ws['!cols'] = [
      { wch: 18 }, // Tanggal
      { wch: 12 }, // Tipe
      { wch: 20 }, // Kategori
      { wch: 20 }, // Dompet
      { wch: 35 }, // Keterangan
      { wch: 15 }, // Pemasukan
      { wch: 15 }, // Pengeluaran
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transaksi");
    XLSX.writeFile(wb, `Laporan_Transaksi_${format(new Date(), 'ddMMyyyy')}.xlsx`);
  };

  const exportToPDF = (data: any[], summary: any) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.setTextColor(16, 185, 129); // emerald-500
    doc.text("Laporan Transaksi CatatUang", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Dicetak pada: ${format(new Date(), 'dd MMM yyyy HH:mm', { locale: id })}`, 14, 28);
    
    let filterText = 'Semua Data';
    if (filter === 'this_month') filterText = `Bulan Ini (${format(new Date(), 'MMMM yyyy', { locale: id })})`;
    else if (filter === 'date_range') filterText = `Periode: ${format(new Date(startDate), 'dd MMM yyyy', { locale: id })} - ${format(new Date(endDate), 'dd MMM yyyy', { locale: id })}`;
    
    doc.text(`Filter: ${filterText}`, 14, 34);

    // Summary Box
    doc.setFillColor(240, 253, 244); // emerald-50
    doc.setDrawColor(16, 185, 129);
    doc.roundedRect(14, 40, 182, 25, 3, 3, 'FD');
    
    doc.setFontSize(10);
    doc.setTextColor(30);
    doc.text("Total Pemasukan:", 20, 48);
    doc.text(new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(summary.totalIncome), 60, 48);
    
    doc.text("Total Pengeluaran:", 20, 56);
    doc.text(new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(summary.totalExpense), 60, 56);
    
    doc.setFont("helvetica", "bold");
    doc.text("Saldo Bersih:", 110, 52);
    const balanceColor = summary.netBalance >= 0 ? [16, 185, 129] : [239, 68, 68];
    doc.setTextColor(balanceColor[0], balanceColor[1], balanceColor[2]);
    doc.text(new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(summary.netBalance), 140, 52);
    
    const tableColumn = ["Tanggal", "Tipe", "Kategori", "Dompet", "Keterangan", "Pemasukan", "Pengeluaran"];
    const tableRows = data.map(item => [
      item.Tanggal,
      item.Tipe,
      item.Kategori,
      item.Dompet,
      item.Keterangan,
      item.Pemasukan > 0 ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(item.Pemasukan) : '-',
      item.Pengeluaran > 0 ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(item.Pengeluaran) : '-'
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 75,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: {
        5: { halign: 'right' },
        6: { halign: 'right' }
      }
    });

    doc.save(`Laporan_Transaksi_${format(new Date(), 'ddMMyyyy')}.pdf`);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-emerald-50 border-emerald-100">
          <h3 className="font-semibold text-lg text-emerald-800 flex items-center gap-2">
            <Download size={20} /> Ekspor Data
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Pilih Filter Data</label>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => setFilter('this_month')}
                className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                  filter === 'this_month' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-100 hover:bg-gray-50 text-gray-600'
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
                  filter === 'date_range' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-100 hover:bg-gray-50 text-gray-600'
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
                  filter === 'all' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-100 hover:bg-gray-50 text-gray-600'
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
                <label className="block text-xs font-medium text-gray-500 mb-1">Dari Tanggal</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Sampai Tanggal</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>
          )}

          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Pilih Format File</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setFormatType('excel')}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                  formatType === 'excel' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-100 hover:bg-gray-50 text-gray-600'
                }`}
              >
                <FileSpreadsheet size={24} className={formatType === 'excel' ? 'text-emerald-600' : 'text-gray-400'} />
                <span className="text-xs font-bold">EXCEL</span>
              </button>
              <button
                onClick={() => setFormatType('pdf')}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                  formatType === 'pdf' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-100 hover:bg-gray-50 text-gray-600'
                }`}
              >
                <FileText size={24} className={formatType === 'pdf' ? 'text-emerald-600' : 'text-gray-400'} />
                <span className="text-xs font-bold">PDF</span>
              </button>
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-medium transition-colors"
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
