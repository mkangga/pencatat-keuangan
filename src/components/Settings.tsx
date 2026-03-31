import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { NOTIFICATION_KEY, requestNotificationPermission } from '../services/notificationService';
import { AppUser } from '../types';
import { ALL_NAV_ITEMS } from './BottomNav';

export default function Settings({ user, appUser }: { user: User, appUser: AppUser | null }) {
  const [deleteState, setDeleteState] = useState<'idle' | 'counting' | 'ready' | 'deleting'>('idle');
  const [countdown, setCountdown] = useState(5);
  const [isNotificationEnabled, setIsNotificationEnabled] = useState(
    localStorage.getItem(NOTIFICATION_KEY) === 'true'
  );
  const [selectedTabs, setSelectedTabs] = useState<string[]>([]);

  useEffect(() => {
    if (appUser?.bottomNavTabs) {
      // Filter out any saved tabs that no longer exist in ALL_NAV_ITEMS (e.g., deleted pages)
      const validTabs = appUser.bottomNavTabs.filter(tab => 
        ALL_NAV_ITEMS.some(item => item.name === tab)
      );
      setSelectedTabs(validTabs);
    }
  }, [appUser]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (deleteState === 'counting' && countdown > 0) {
      timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    } else if (deleteState === 'counting' && countdown === 0) {
      setDeleteState('ready');
    }
    return () => clearTimeout(timer);
  }, [deleteState, countdown]);

  const handleNotificationToggle = async () => {
    if (!isNotificationEnabled) {
      const granted = await requestNotificationPermission();
      if (granted) {
        localStorage.setItem(NOTIFICATION_KEY, 'true');
        setIsNotificationEnabled(true);
      } else {
        alert('Izin notifikasi ditolak oleh browser.');
      }
    } else {
      localStorage.setItem(NOTIFICATION_KEY, 'false');
      setIsNotificationEnabled(false);
    }
  };

  const handleTabToggle = async (tabName: string) => {
    let newTabs = [...selectedTabs];
    if (newTabs.includes(tabName)) {
      // Don't allow less than 1 tab
      if (newTabs.length <= 1) {
        alert('Minimal harus ada 1 tab di navigasi bawah.');
        return;
      }
      newTabs = newTabs.filter(t => t !== tabName);
    } else {
      // Limit to 5 tabs
      if (newTabs.length >= 5) {
        alert('Maksimal 5 tab di navigasi bawah.');
        return;
      }
      newTabs.push(tabName);
    }
    
    setSelectedTabs(newTabs);
    
    // Save to Firestore
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, { bottomNavTabs: newTabs });
    } catch (error) {
      console.error('Error updating tabs:', error);
    }
  };

  const handleDeleteClick = () => {
    setDeleteState('counting');
    setCountdown(5);
  };

  const confirmDelete = async () => {
    setDeleteState('deleting');
    try {
      const collections = ['transactions', 'debts', 'goals'];
      for (const coll of collections) {
        const q = query(collection(db, coll), where('userId', '==', user.uid));
        const snap = await getDocs(q);
        await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
      }
      alert('Semua data berhasil dihapus.');
      setDeleteState('idle');
    } catch (error) {
      console.error('Error deleting data:', error);
      alert('Terjadi kesalahan saat menghapus data.');
      setDeleteState('idle');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6 font-sans transition-colors duration-300">Pengaturan</h1>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-6 transition-colors duration-300">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Preferensi Aplikasi</h3>
          <div className="space-y-4">
            {/* Currency Selection */}
            <div className="flex items-center justify-between p-4 border border-gray-100 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              <div>
                <p className="font-medium text-gray-800 dark:text-gray-100">Mata Uang</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Pilih mata uang default</p>
              </div>
              <select className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg font-medium text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-colors duration-300">
                <option>IDR (Rupiah)</option>
                <option>USD (Dollar)</option>
              </select>
            </div>

            {/* Notification Toggle */}
            <div className="flex items-center justify-between p-4 border border-gray-100 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              <div>
                <p className="font-medium text-gray-800 dark:text-gray-100">Notifikasi Pengingat</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Ingatkan saya jika belum mencatat selama 24 jam</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={isNotificationEnabled}
                  onChange={handleNotificationToggle}
                />
                <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 dark:peer-focus:ring-emerald-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            {/* Bottom Nav Customization */}
            <div className="p-4 border border-gray-100 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors space-y-4">
              <div>
                <p className="font-medium text-gray-800 dark:text-gray-100">Kustomisasi Navigasi Bawah (Mobile Only)</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Pilih maksimal 5 menu untuk ditampilkan di bar bawah</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ALL_NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isSelected = selectedTabs.includes(item.name);
                  return (
                    <button
                      key={item.name}
                      onClick={() => handleTabToggle(item.name)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                        isSelected
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                          : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <Icon size={16} />
                      {item.name}
                    </button>
                  );
                })}
              </div>
              {selectedTabs.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Urutan Tampilan:</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedTabs.map((tab, index) => (
                      <div key={tab} className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300">
                        <span className="text-emerald-600 dark:text-emerald-400">{index + 1}</span>
                        {tab}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="pt-6 border-t border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 text-red-600 dark:text-red-400">Zona Bahaya</h3>
          <div className="p-5 border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 rounded-xl transition-colors duration-300">
            <p className="font-medium text-red-800 dark:text-red-300 mb-2">Hapus Semua Data</p>
            <p className="text-sm text-red-600 dark:text-red-400 mb-4">Tindakan ini tidak dapat dibatalkan. Semua transaksi, hutang, dan target akan dihapus permanen dari database.</p>
            
            {deleteState === 'idle' && (
              <button onClick={handleDeleteClick} className="bg-red-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-red-700 transition-colors shadow-sm">
                Hapus Data Saya
              </button>
            )}
            
            {deleteState === 'counting' && (
              <button disabled className="bg-red-400 text-white px-5 py-2.5 rounded-xl text-sm font-medium cursor-not-allowed shadow-sm">
                Tunggu {countdown} detik...
              </button>
            )}

            {deleteState === 'ready' && (
              <div className="flex gap-3">
                <button onClick={confirmDelete} className="bg-red-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-red-700 transition-colors shadow-sm animate-pulse">
                  Konfirmasi Hapus Permanen
                </button>
                <button onClick={() => setDeleteState('idle')} className="bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors shadow-sm">
                  Batal
                </button>
              </div>
            )}

            {deleteState === 'deleting' && (
              <button disabled className="bg-red-400 text-white px-5 py-2.5 rounded-xl text-sm font-medium cursor-not-allowed shadow-sm flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Menghapus...
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
