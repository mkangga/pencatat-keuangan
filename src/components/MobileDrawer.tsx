import { User } from 'firebase/auth';
import Sidebar from './Sidebar';
import { X } from 'lucide-react';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
}

export function MobileDrawer({ isOpen, onClose, user }: MobileDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-64 bg-white h-full shadow-lg flex flex-col">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between md:hidden">
          <span className="font-bold text-emerald-600">CatatUang</span>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>
        <Sidebar user={user} onItemClick={onClose} className="flex-1 min-h-0 !h-auto" />
      </div>
    </div>
  );
}
