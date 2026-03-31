import { NavLink } from 'react-router-dom';
import { 
  Home, PlusCircle, MinusCircle, PieChart, ReceiptText, 
  ClipboardList, CreditCard, TrendingUp, Wallet, Tags, Settings, User
} from 'lucide-react';

export const ALL_NAV_ITEMS = [
  { name: 'Dashboard', path: '/', icon: Home },
  { name: 'Transaksi', path: '/transaksi', icon: ReceiptText },
  { name: 'Masuk', path: '/uang-masuk', icon: PlusCircle },
  { name: 'Keluar', path: '/uang-keluar', icon: MinusCircle },
  { name: 'Analisis', path: '/analisis', icon: PieChart },
  { name: 'Log', path: '/log-aktivitas', icon: ClipboardList },
  { name: 'Hutang', path: '/hutang-piutang', icon: CreditCard },
  { name: 'Masa Depan', path: '/masa-depan', icon: TrendingUp },
  { name: 'Dompet', path: '/dompet-rekening', icon: Wallet },
  { name: 'Kategori', path: '/kategori-transaksi', icon: Tags },
  { name: 'Pengaturan', path: '/pengaturan', icon: Settings },
  { name: 'Profil', path: '/profil', icon: User },
];

interface BottomNavProps {
  tabs?: string[];
}

export default function BottomNav({ tabs }: BottomNavProps) {
  const defaultTabs = ['Dashboard', 'Transaksi', 'Masuk', 'Keluar', 'Analisis'];
  const activeTabs = tabs || defaultTabs;

  const navItems = ALL_NAV_ITEMS.filter(item => activeTabs.includes(item.name));

  return (
    <nav className="md:hidden fixed bottom-4 left-4 right-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-white/20 dark:border-gray-700/30 flex justify-around items-center py-3 px-1 z-50 rounded-3xl shadow-2xl shadow-emerald-900/10 transition-all duration-300">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) => `flex flex-col items-center gap-1.5 px-3 py-1 rounded-2xl text-[10px] font-bold transition-all ${
              isActive 
                ? 'text-emerald-600 dark:text-emerald-400 scale-110' 
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            {({ isActive }) => (
              <>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                <span className={isActive ? 'opacity-100' : 'opacity-70'}>{item.name}</span>
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
