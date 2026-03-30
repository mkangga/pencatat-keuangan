import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    // Fallback timeout in case onAuthStateChanged never fires
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('Firebase auth state check timed out, showing auth screen as fallback.');
        setLoading(false);
      }
    }, 5000);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
      clearTimeout(timeout);
    });
    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, [loading]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-emerald-500 mb-4"></div>
        <p className="text-gray-500 dark:text-gray-400 font-medium">Memuat aplikasi...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-300">
        {user ? (
          <Dashboard user={user} isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />
        ) : (
          <Auth isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />
        )}
      </div>
    </BrowserRouter>
  );
}
