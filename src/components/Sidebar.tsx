import { useState } from 'react';
import { User } from 'firebase/auth';
import { auth } from '../firebase';
import { NavLink } from 'react-router-dom';
import { 
  Home, PlusCircle, MinusCircle, 
  ClipboardList, CreditCard, TrendingUp, Settings, LogOut, PieChart, Wallet, Tags,
  Moon, Sun, AlertTriangle, ReceiptText, User as UserIcon, Target
} from 'lucide-react';

interface SidebarProps {
  user: User;
  className?: string;
  onItemClick?: () => void;
  isCollapsed?: boolean;
  isDarkMode?: boolean;
  toggleDarkMode?: () => void;
}

export default function Sidebar({ user, className = '', onItemClick, isCollapsed = false, isDarkMode, toggleDarkMode }: SidebarProps) {
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: Home },
    { name: 'Uang Masuk', path: '/uang-masuk', icon: PlusCircle },
    { name: 'Uang Keluar', path: '/uang-keluar', icon: MinusCircle },
    { name: 'Riwayat', path: '/riwayat', icon: ClipboardList },
    { name: 'Analisis', path: '/analisis', icon: PieChart },
    { name: 'Hutang/Piutang', path: '/hutang-piutang', icon: CreditCard },
    { name: 'Alokasi Budget', path: '/alokasi-budget', icon: Target },
    { name: 'Masa Depan', path: '/masa-depan', icon: TrendingUp },
    { name: 'Dompet & Rekening', path: '/dompet-rekening', icon: Wallet },
    { name: 'Kategori Transaksi', path: '/kategori-transaksi', icon: Tags },
    { name: 'Pengaturan', path: '/pengaturan', icon: Settings },
  ];

  return (
    <aside className={`bg-white dark:bg-gray-800 border-r border-gray-100 dark:border-gray-700 flex-shrink-0 flex flex-col h-full min-h-0 transition-colors duration-300 ${className}`}>
      <NavLink 
        to="/profil" 
        onClick={onItemClick}
        className={`p-4 flex items-center gap-3 border-b border-gray-50 dark:border-gray-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors ${isCollapsed ? 'justify-center' : ''}`}
      >
        <img 
          src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || 'User'}&background=10b981&color=fff`} 
          alt="Profile" 
          className="w-10 h-10 rounded-xl shadow-sm object-cover"
          referrerPolicy="no-referrer"
        />
        {!isCollapsed && (
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-gray-800 dark:text-gray-100 truncate">
              {user.displayName || 'User'}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
              Lihat Profil
            </span>
          </div>
        )}
      </NavLink>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 pb-20">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.path}
              onClick={onItemClick}
              title={isCollapsed ? item.name : ''}
              className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors w-full text-left ${
                isActive 
                  ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200' 
                  : 'text-gray-600 dark:text-gray-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-600 dark:hover:text-emerald-400'
              } ${isCollapsed ? 'justify-center px-0' : ''}`}
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} className={isActive ? 'text-white' : 'text-gray-400 dark:text-gray-500'} />
                  {!isCollapsed && item.name}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-50 dark:border-gray-700 pb-8 md:pb-4 space-y-2">
        {toggleDarkMode && (
          <button
            onClick={() => { toggleDarkMode(); onItemClick?.(); }}
            title={isCollapsed ? (isDarkMode ? "Mode Terang" : "Mode Gelap") : ""}
            className={`flex items-center gap-3 px-4 py-3 w-full rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors ${isCollapsed ? 'justify-center px-0' : ''}`}
          >
            {isDarkMode ? <Sun size={18} className="opacity-70" /> : <Moon size={18} className="opacity-70" />}
            {!isCollapsed && (isDarkMode ? 'Mode Terang' : 'Mode Gelap')}
          </button>
        )}
        <button
          onClick={() => setIsLogoutModalOpen(true)}
          title={isCollapsed ? "Logout" : ""}
          className={`flex items-center gap-3 px-4 py-3 w-full rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors ${isCollapsed ? 'justify-center px-0' : ''}`}
        >
          <LogOut size={18} className="opacity-70" />
          {!isCollapsed && 'Logout'}
        </button>
      </div>

      {/* Logout Confirmation Modal */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 mx-auto mb-4">
              <AlertTriangle className="text-red-600 dark:text-red-400" size={24} />
            </div>
            <h3 className="text-lg font-bold text-center text-gray-900 dark:text-gray-100 mb-2">Konfirmasi Logout</h3>
            <p className="text-sm text-center text-gray-500 dark:text-gray-400 mb-6">
              Apakah Anda yakin ingin keluar dari aplikasi? Anda harus login kembali untuk mencatat keuangan.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setIsLogoutModalOpen(false)}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  setIsLogoutModalOpen(false);
                  handleLogout();
                  onItemClick?.();
                }}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors"
              >
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
