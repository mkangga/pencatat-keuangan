import { User } from 'firebase/auth';
import { auth } from '../firebase';
import { NavLink } from 'react-router-dom';
import { 
  Home, User as UserIcon, ArrowUpRight, ArrowDownRight, 
  ClipboardList, CreditCard, TrendingUp, Settings, LogOut, PieChart, Wallet, Tags
} from 'lucide-react';

interface SidebarProps {
  user: User;
  className?: string;
  onItemClick?: () => void;
  isCollapsed?: boolean;
}

export default function Sidebar({ user, className = '', onItemClick, isCollapsed = false }: SidebarProps) {
  const handleLogout = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: Home },
    { name: 'Profil', path: '/profil', icon: UserIcon },
    { name: 'Uang Masuk', path: '/uang-masuk', icon: ArrowUpRight },
    { name: 'Uang Keluar', path: '/uang-keluar', icon: ArrowDownRight },
    { name: 'Log Aktivitas', path: '/log-aktivitas', icon: ClipboardList },
    { name: 'Analisis', path: '/analisis', icon: PieChart },
    { name: 'Hutang/Piutang', path: '/hutang-piutang', icon: CreditCard },
    { name: 'Masa Depan', path: '/masa-depan', icon: TrendingUp },
    { name: 'Dompet & Rekening', path: '/dompet-rekening', icon: Wallet },
    { name: 'Kategori Transaksi', path: '/kategori-transaksi', icon: Tags },
    { name: 'Pengaturan', path: '/pengaturan', icon: Settings },
  ];

  return (
    <aside className={`bg-white border-r border-gray-100 flex-shrink-0 flex flex-col h-full ${className}`}>
      <div className={`p-6 flex items-center gap-3 border-b border-gray-50 ${isCollapsed ? 'justify-center' : ''}`}>
        <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex-shrink-0 flex items-center justify-center font-bold text-sm">
          {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'A'}
        </div>
        {!isCollapsed && <span className="font-semibold text-gray-800 truncate">{user.displayName || 'User'}</span>}
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
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
                  : 'text-gray-600 hover:bg-emerald-50 hover:text-emerald-600'
              } ${isCollapsed ? 'justify-center px-0' : ''}`}
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} className={isActive ? 'text-white' : 'text-gray-400'} />
                  {!isCollapsed && item.name}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-50">
        <button
          onClick={() => { handleLogout(); onItemClick?.(); }}
          title={isCollapsed ? "Logout" : ""}
          className={`flex items-center gap-3 px-4 py-3 w-full rounded-xl text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors ${isCollapsed ? 'justify-center px-0' : ''}`}
        >
          <LogOut size={18} className="text-gray-400" />
          {!isCollapsed && 'Logout'}
        </button>
      </div>
    </aside>
  );
}
