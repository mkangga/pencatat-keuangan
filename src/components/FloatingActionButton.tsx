import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, ArrowRightLeft, HandCoins, ShoppingBasket } from 'lucide-react';
import { User } from 'firebase/auth';
import { Wallet, Category, Transaction } from '../types';
import AddTransactionModal from './AddTransactionModal';
import TransferModal from './TransferModal';

interface FloatingActionButtonProps {
  user: User;
  wallets: Wallet[];
  categories: Category[];
  transactions: Transaction[];
}

export default function FloatingActionButton({ 
  user, 
  wallets, 
  categories, 
  transactions 
}: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<'income' | 'expense' | 'transfer' | null>(null);

  const toggleOpen = () => setIsOpen(!isOpen);

  const actions = [
    {
      id: 'transfer',
      label: 'Pindah Saldo',
      icon: <ArrowRightLeft size={20} />,
      color: 'bg-gray-500',
      onClick: () => {
        setActiveModal('transfer');
        setIsOpen(false);
      }
    },
    {
      id: 'income',
      label: 'Pemasukan',
      icon: <HandCoins size={20} />,
      color: 'bg-orange-500',
      onClick: () => {
        setActiveModal('income');
        setIsOpen(false);
      }
    },
    {
      id: 'expense',
      label: 'Pengeluaran',
      icon: <ShoppingBasket size={20} />,
      color: 'bg-red-500',
      onClick: () => {
        setActiveModal('expense');
        setIsOpen(false);
      }
    }
  ];

  return (
    <>
      <div className="fixed bottom-24 right-6 z-40 flex flex-col items-end gap-4">
        <AnimatePresence>
          {isOpen && (
            <div className="flex flex-col items-end gap-3 mb-2">
              {actions.map((action, index) => (
                <motion.div
                  key={action.id}
                  initial={{ opacity: 0, y: 20, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.8 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-3"
                >
                  <span className="bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg shadow-md text-sm font-medium text-gray-700 dark:text-gray-200 border border-gray-100 dark:border-gray-700">
                    {action.label}
                  </span>
                  <button
                    onClick={action.onClick}
                    className={`${action.color} text-white p-3 rounded-full shadow-lg hover:scale-110 transition-transform`}
                  >
                    {action.icon}
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>

        <motion.button
          onClick={toggleOpen}
          animate={{ rotate: isOpen ? 45 : 0 }}
          className="bg-purple-500 text-white p-4 rounded-full shadow-xl hover:bg-purple-600 transition-colors z-50"
        >
          <Plus size={28} />
        </motion.button>
      </div>

      {/* Modals */}
      <AddTransactionModal
        isOpen={activeModal === 'income' || activeModal === 'expense'}
        onClose={() => setActiveModal(null)}
        type={activeModal === 'income' ? 'income' : 'expense'}
        user={user}
        wallets={wallets}
        categories={categories}
        transactions={transactions}
      />

      <TransferModal
        isOpen={activeModal === 'transfer'}
        onClose={() => setActiveModal(null)}
        user={user}
        wallets={wallets}
      />
    </>
  );
}
