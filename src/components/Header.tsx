import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { PlusCircle, MinusCircle, Menu, Search, Download, Sidebar as SidebarIcon, Wifi, WifiOff } from 'lucide-react';

interface HeaderProps {
  user: User;
  onAddIncome: () => void;
  onAddExpense: () => void;
  onExport: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onToggleDrawer: () => void;
  onToggleSidebar: () => void;
  isSidebarCollapsed: boolean;
}

export default function Header({ 
  user, 
  onAddIncome, 
  onAddExpense, 
  onExport, 
  searchQuery, 
  setSearchQuery, 
  onToggleDrawer,
  onToggleSidebar,
  isSidebarCollapsed
}: HeaderProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <button onClick={onToggleDrawer} className="md:hidden text-gray-500 hover:text-gray-700">
          <Menu size={24} />
        </button>
        <button 
          onClick={onToggleSidebar} 
          className="hidden md:flex text-gray-500 hover:text-emerald-600 p-2 hover:bg-emerald-50 rounded-lg transition-all"
          title={isSidebarCollapsed ? "Buka Sidebar" : "Tutup Sidebar"}
        >
          <SidebarIcon size={20} className={isSidebarCollapsed ? 'rotate-180' : ''} />
        </button>
        <div className="flex flex-col">
          <h1 className="text-lg font-bold text-emerald-600">
            CatatUang
          </h1>
          <h2 className="text-sm font-semibold text-gray-800 hidden lg:block">
            Selamat Datang, {user.displayName?.split(' ')[0] || 'User'}!
          </h2>
        </div>
      </div>

      <div className="flex-1 max-w-md mx-4 hidden sm:block">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Cari transaksi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${isOnline ? 'text-emerald-500 bg-emerald-50' : 'text-amber-500 bg-amber-50'}`}>
          {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
          <span className="hidden xs:inline">{isOnline ? 'Online' : 'Offline'}</span>
        </div>
        <button
          onClick={onExport}
          title="Ekspor Data"
          className="p-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
        >
          <Download size={20} />
        </button>
        <button
          onClick={onAddIncome}
          className="flex items-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          <PlusCircle size={18} />
          <span className="hidden md:inline">Pemasukan</span>
        </button>
        <button
          onClick={onAddExpense}
          className="flex items-center gap-2 bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          <MinusCircle size={18} />
          <span className="hidden md:inline">Pengeluaran</span>
        </button>
      </div>
    </header>
  );
}
