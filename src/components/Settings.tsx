import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function Settings({ user }: { user: User }) {
  const [deleteState, setDeleteState] = useState<'idle' | 'counting' | 'ready' | 'deleting'>('idle');
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (deleteState === 'counting' && countdown > 0) {
      timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    } else if (deleteState === 'counting' && countdown === 0) {
      setDeleteState('ready');
    }
    return () => clearTimeout(timer);
  }, [deleteState, countdown]);

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
      <h1 className="text-2xl font-bold text-gray-800 mb-6 font-sans">Pengaturan</h1>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Preferensi Aplikasi</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
              <div>
                <p className="font-medium text-gray-800">Mata Uang</p>
                <p className="text-sm text-gray-500">Pilih mata uang default</p>
              </div>
              <select className="px-4 py-2 border border-gray-200 rounded-lg bg-white font-medium text-gray-700 outline-none focus:ring-2 focus:ring-emerald-500">
                <option>IDR (Rupiah)</option>
                <option>USD (Dollar)</option>
              </select>
            </div>
            <div className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
              <div>
                <p className="font-medium text-gray-800">Notifikasi</p>
                <p className="text-sm text-gray-500">Terima pengingat harian</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" value="" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>
          </div>
        </div>
        
        <div className="pt-6 border-t border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 text-red-600">Zona Bahaya</h3>
          <div className="p-5 border border-red-100 bg-red-50 rounded-xl">
            <p className="font-medium text-red-800 mb-2">Hapus Semua Data</p>
            <p className="text-sm text-red-600 mb-4">Tindakan ini tidak dapat dibatalkan. Semua transaksi, hutang, dan target akan dihapus permanen dari database.</p>
            
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
                <button onClick={() => setDeleteState('idle')} className="bg-white text-gray-700 border border-gray-300 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm">
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
