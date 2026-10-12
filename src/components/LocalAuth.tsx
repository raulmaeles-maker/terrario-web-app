import { useState, useEffect } from 'react';
import { Leaf, Lock } from 'lucide-react';

interface LocalAuthProps {
  onSuccess: () => void;
}

export function LocalAuth({ onSuccess }: LocalAuthProps) {
  const [pin, setPin] = useState('');
  const [errorMSG, setErrorMSG] = useState('');
  
  const CORRECT_PIN = import.meta.env.VITE_LOCAL_PIN || '1234';

  useEffect(() => {
    // Restaurar sesión sin pedir PIN si es válido
    const saved = localStorage.getItem('terrarium_auth');
    if (saved === 'true') {
      onSuccess();
    }
  }, [onSuccess]);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMSG('');

    if (pin === CORRECT_PIN) {
      localStorage.setItem('terrarium_auth', 'true');
      onSuccess();
    } else {
      setErrorMSG('PIN incorrecto. Inténtalo de nuevo.');
      setPin('');
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 shadow-xl">
        <div className="flex flex-col items-center mb-8">
          <div className="p-3 bg-primary/20 rounded-2xl mb-4">
            <Leaf className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Terrarium<span className="text-primary">+</span></h1>
          <p className="text-foreground/60 mt-2 text-center">Inicia sesión localmente para controlar tu ecosistema.</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-6">
          {errorMSG && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-xl text-sm text-center">
              {errorMSG}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium mb-2 text-center text-foreground/80">Código PIN de Acceso</label>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-4 outline-none focus:ring-2 focus:ring-primary/50 transition-all text-center text-2xl tracking-widest font-mono font-bold"
              placeholder="••••"
              required
              autoFocus
            />
          </div>

          <button
            type="submit"
            className="w-full bg-primary text-primary-foreground font-bold rounded-xl px-4 py-3 flex justify-center items-center gap-2 hover:bg-primary/90 transition-colors"
          >
            {'Desbloquear Panel'}
            <Lock className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
