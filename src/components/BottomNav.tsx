import { NavLink } from 'react-router-dom';
import { Home, ArrowUpRight, ArrowDownRight, ClipboardList, PieChart } from 'lucide-react';

export default function BottomNav() {
  const navItems = [
    { name: 'Dashboard', path: '/', icon: Home },
    { name: 'Masuk', path: '/uang-masuk', icon: ArrowUpRight },
    { name: 'Keluar', path: '/uang-keluar', icon: ArrowDownRight },
    { name: 'Log', path: '/log-aktivitas', icon: ClipboardList },
    { name: 'Analisis', path: '/analisis', icon: PieChart },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center py-2 px-1 z-50">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) => `flex flex-col items-center gap-1 p-2 rounded-lg text-xs font-medium transition-colors ${
              isActive ? 'text-emerald-600' : 'text-gray-500'
            }`}
          >
            <Icon size={20} />
            {item.name}
          </NavLink>
        );
      })}
    </nav>
  );
}
