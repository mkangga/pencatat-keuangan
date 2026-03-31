import { User } from 'firebase/auth';
import Sidebar from './Sidebar';
import { X } from 'lucide-react';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

export function MobileDrawer({ isOpen, onClose, user, isDarkMode, toggleDarkMode }: MobileDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-64 bg-white dark:bg-gray-800 h-full shadow-lg flex flex-col transition-colors duration-300">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between md:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-black text-[10px] shadow-sm shadow-emerald-200">
              Rp.
            </div>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">CatatUang</span>
          </div>
          <button onClick={onClose} className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            <X size={24} />
          </button>
        </div>
        <Sidebar user={user} onItemClick={onClose} className="flex-1 min-h-0 !h-auto" isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />
      </div>
    </div>
  );
}
