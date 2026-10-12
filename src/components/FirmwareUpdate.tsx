import { useState, useRef } from 'react';
import { Upload, Cpu, CheckCircle, XCircle, AlertTriangle, RefreshCw, Zap } from 'lucide-react';

type Target = 'mega1' | 'mega2';
type Status = 'idle' | 'uploading' | 'flashing' | 'done' | 'error';

const TARGET_LABELS: Record<Target, string> = {
  mega1: 'MEGA #1 — Cerebro UI (TFT + Coordinador)',
  mega2: 'MEGA #2 — Músculo I/O (Sensores + Relés)',
};

const STATUS_COLORS: Record<Status, string> = {
  idle: 'text-foreground/50',
  uploading: 'text-yellow-400',
  flashing: 'text-orange-400',
  done: 'text-primary',
  error: 'text-red-500',
};

export function FirmwareUpdate() {
  const [target, setTarget] = useState<Target>('mega1');
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState<string[]>([
    '> Sistema listo. Selecciona un objetivo y sube el archivo .hex.',
  ]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [hexContent, setHexContent] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dirección IP del NodeMCU en la red local (configurable)
  // En producción esto vendría del panel de ajustes
  const NODEMCU_IP = '192.168.1.100'; // ← Ajustar a la IP real del NodeMCU

  const addLog = (msg: string) =>
    setLog(prev => [...prev.slice(-49), `> ${msg}`]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.hex')) {
      addLog('ERROR: Solo se admiten archivos con extensión .hex');
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setHexContent(ev.target?.result as string);
      addLog(`Archivo cargado: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    };
    reader.readAsText(file);
  };

  const handleFlash = async () => {
    if (!hexContent) {
      addLog('ERROR: Primero selecciona un archivo .hex');
      return;
    }

    setStatus('uploading');
    setProgress(0);
    addLog(`Iniciando transferencia a NodeMCU → objetivo: ${TARGET_LABELS[target]}`);

    try {
      // 1. Enviar el .hex al NodeMCU por HTTP POST
      const blob = new Blob([hexContent], { type: 'text/plain' });
      const formData = new FormData();
      formData.append('file', blob, 'firmware.hex');

      addLog('Conectando con NodeMCU en ' + NODEMCU_IP + '...');

      const uploadResp = await fetch(
        `http://${NODEMCU_IP}/upload-hex?target=${target}`,
        { method: 'POST', body: formData }
      );

      if (!uploadResp.ok) throw new Error(`Error HTTP ${uploadResp.status} al subir hex`);

      setProgress(40);
      addLog('Archivo recibido por NodeMCU ✓');
      addLog(`Iniciando secuencia de flasheo STK500 sobre Serial → ${target.toUpperCase()}...`);
      addLog('Pulsando pin RESET del MEGA para entrar en modo bootloader...');
      setStatus('flashing');

      // 2. Ordenar al NodeMCU que ejecute el flasheo
      const flashResp = await fetch(
        `http://${NODEMCU_IP}/flash?target=${target}`,
        { method: 'POST' }
      );

      if (!flashResp.ok) throw new Error(`Error HTTP ${flashResp.status} al flashear`);

      // 3. Polling de progreso hasta completar
      let elapsed = 0;
      const poll = setInterval(async () => {
        elapsed += 1;
        setProgress(Math.min(40 + elapsed * 3, 95));
        addLog(`Programando página ${elapsed * 8} / ~512...`);

        try {
          const statusResp = await fetch(`http://${NODEMCU_IP}/status`);
          const statusData = await statusResp.json();

          if (statusData.state === 'done') {
            clearInterval(poll);
            setProgress(100);
            setStatus('done');
            addLog('✅ Flasheo completado con éxito. MEGA reiniciando...');
          } else if (statusData.state === 'error') {
            clearInterval(poll);
            setStatus('error');
            addLog('❌ Error durante el flasheo: ' + (statusData.error || 'desconocido'));
          }
        } catch {
          // NodeMCU puede estar ocupado durante el flasheo, ignoramos fallos de polling temporales
        }

        if (elapsed > 60) {
          clearInterval(poll);
          setStatus('error');
          addLog('❌ Timeout: El proceso tardó más de lo esperado.');
        }
      }, 1000);
    } catch (err: any) {
      setStatus('error');
      addLog('❌ ' + (err.message || 'Error de conexión con el NodeMCU'));
      addLog('Asegúrate de estar en la misma red WiFi que el NodeMCU.');
    }
  };

  const handleReset = () => {
    setStatus('idle');
    setProgress(0);
    setFileName(null);
    setHexContent(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setLog(['> Sistema reiniciado. Selecciona un objetivo y sube el archivo .hex.']);
  };

  const isRunning = status === 'uploading' || status === 'flashing';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-orange-500/10 rounded-2xl">
          <Zap className="w-7 h-7 text-orange-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Actualización de Firmware OTA</h1>
          <p className="text-sm text-foreground/60">
            Flashea los MEGA en remoto vía NodeMCU Gateway · Protocolo STK500
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Panel Izquierdo: Configuración */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <h2 className="font-bold text-lg">Configuración</h2>

          {/* Selector Objetivo */}
          <div>
            <label className="block text-sm font-medium mb-3">Objetivo a Flashear</label>
            <div className="space-y-2">
              {(Object.keys(TARGET_LABELS) as Target[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTarget(t)}
                  disabled={isRunning}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
                    target === t
                      ? 'bg-primary/10 border-primary/50 text-primary'
                      : 'bg-secondary/30 border-border hover:border-primary/30'
                  } disabled:opacity-40`}
                >
                  <Cpu className="w-5 h-5 shrink-0" />
                  <span className="text-sm font-medium">{TARGET_LABELS[t]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Selector Fichero */}
          <div>
            <label className="block text-sm font-medium mb-2">Archivo .hex</label>
            <div
              onClick={() => !isRunning && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                fileName
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-border hover:border-primary/40 hover:bg-secondary/30'
              } ${isRunning ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              <Upload className={`w-8 h-8 mx-auto mb-2 ${fileName ? 'text-primary' : 'text-foreground/30'}`} />
              {fileName ? (
                <p className="text-sm font-medium text-primary">{fileName}</p>
              ) : (
                <>
                  <p className="text-sm font-medium">Arrastra o haz clic para seleccionar</p>
                  <p className="text-xs text-foreground/50 mt-1">Solo archivos .hex (compilados desde Arduino IDE)</p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".hex"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Botones Acción */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleFlash}
              disabled={isRunning || !hexContent}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-orange-500 hover:bg-orange-400 text-white font-semibold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isRunning ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              {isRunning ? 'Flasheando...' : 'Iniciar Flasheo'}
            </button>
            <button
              onClick={handleReset}
              disabled={isRunning}
              className="px-4 py-3 bg-secondary hover:bg-secondary/70 rounded-xl transition-colors disabled:opacity-40"
              title="Reiniciar"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Panel Derecho: Estado y Progreso */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5 flex flex-col">
          <h2 className="font-bold text-lg">Estado</h2>

          {/* Icono Status */}
          <div className="flex flex-col items-center justify-center py-4 gap-3">
            {status === 'idle' && <Cpu className="w-14 h-14 text-foreground/20" />}
            {isRunning && <RefreshCw className="w-14 h-14 text-orange-400 animate-spin" />}
            {status === 'done' && <CheckCircle className="w-14 h-14 text-primary" />}
            {status === 'error' && <XCircle className="w-14 h-14 text-red-500" />}
            <p className={`font-semibold text-sm uppercase tracking-wider ${STATUS_COLORS[status]}`}>
              {status === 'idle' && 'En espera'}
              {status === 'uploading' && 'Transfiriendo .hex al NodeMCU...'}
              {status === 'flashing' && 'Flasheando MEGA vía STK500...'}
              {status === 'done' && '¡Flasheo completado!'}
              {status === 'error' && 'Error en el proceso'}
            </p>
          </div>

          {/* Barra de Progreso */}
          {status !== 'idle' && (
            <div>
              <div className="flex justify-between text-xs text-foreground/60 mb-1">
                <span>Progreso</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-3 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    status === 'error' ? 'bg-red-500' : status === 'done' ? 'bg-primary' : 'bg-orange-500'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Nota de seguridad */}
          <div className="flex gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-xs text-yellow-400/90 mt-auto">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>No desconectes el terrario durante un flasheo. El proceso dura ~30-60 segundos.</span>
          </div>
        </div>
      </div>

      {/* Consola de Log */}
      <div className="bg-black/50 border border-border rounded-2xl p-4 font-mono text-xs">
        <p className="text-foreground/40 mb-2 text-[10px] uppercase tracking-widest">Consola NodeMCU</p>
        <div className="space-y-0.5 max-h-52 overflow-y-auto">
          {log.map((line, i) => (
            <p
              key={i}
              className={
                line.includes('❌') || line.includes('ERROR')
                  ? 'text-red-400'
                  : line.includes('✅')
                  ? 'text-primary'
                  : 'text-green-400/80'
              }
            >
              {line}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
