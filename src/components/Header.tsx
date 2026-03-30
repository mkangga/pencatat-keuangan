import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { useLocation } from 'react-router-dom';
import { PlusCircle, MinusCircle, Menu, Search, Download, Sidebar as SidebarIcon, Wifi, WifiOff, Moon, Sun } from 'lucide-react';

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
  isDarkMode: boolean;
  toggleDarkMode: () => void;
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
  isSidebarCollapsed,
  isDarkMode,
  toggleDarkMode
}: HeaderProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const location = useLocation();

  const showSearch = ['/', '/transaksi', '/uang-masuk', '/uang-keluar', '/log-aktivitas'].includes(location.pathname);

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
    <header className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-6 py-4 flex items-center justify-between sticky top-0 z-10 transition-colors duration-300">
      <div className="flex items-center gap-4">
        <button onClick={onToggleDrawer} className="md:hidden text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
          <Menu size={24} />
        </button>
        <button 
          onClick={onToggleSidebar} 
          className="hidden md:flex text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 p-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-all"
          title={isSidebarCollapsed ? "Buka Sidebar" : "Tutup Sidebar"}
        >
          <SidebarIcon size={20} className={isSidebarCollapsed ? 'rotate-180' : ''} />
        </button>
        <div className="flex flex-col">
          <h1 className="text-lg font-bold text-emerald-600 dark:text-emerald-500">
            CatatUang
          </h1>
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 hidden lg:block">
            Selamat Datang, {user.displayName?.split(' ')[0] || 'User'}!
          </h2>
        </div>
      </div>

      <div className="flex-1 max-w-md mx-4 hidden sm:block">
        {showSearch && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
            <input
              type="text"
              placeholder="Cari transaksi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-xl focus:bg-white dark:focus:bg-gray-600 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm text-gray-900 dark:text-gray-100"
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={toggleDarkMode}
          className="p-2 text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-xl transition-all"
          title={isDarkMode ? "Mode Terang" : "Mode Gelap"}
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <button
          onClick={onExport}
          title="Ekspor Data"
          className="p-2 text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-xl transition-all"
        >
          <Download size={20} />
        </button>
        
        <div className="h-6 w-px bg-gray-100 dark:bg-gray-700 mx-1 hidden xs:block"></div>

        <button
          onClick={onAddIncome}
          className="flex items-center justify-center w-10 h-10 sm:w-auto sm:px-4 sm:py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold transition-all shadow-sm shadow-emerald-200 dark:shadow-none"
          title="Tambah Pemasukan"
        >
          <PlusCircle size={20} />
          <span className="hidden md:inline ml-2">Pemasukan</span>
        </button>
        <button
          onClick={onAddExpense}
          className="flex items-center justify-center w-10 h-10 sm:w-auto sm:px-4 sm:py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold transition-all shadow-sm shadow-red-200 dark:shadow-none"
          title="Tambah Pengeluaran"
        >
          <MinusCircle size={20} />
          <span className="hidden md:inline ml-2">Pengeluaran</span>
        </button>
      </div>
    </header>
  );
}
