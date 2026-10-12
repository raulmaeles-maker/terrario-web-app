import { useState, useEffect } from 'react';
import { Leaf, Droplets, Thermometer, Waves, Zap, Menu, X, LogOut, Clock, Settings, HardDrive, AlertTriangle, Activity, LayoutDashboard } from 'lucide-react';
import { TerrariumView } from './components/TerrariumView';
import { HistoryChart } from './components/HistoryChart';
import { LiveCharts } from './components/LiveCharts';
import { FirmwareUpdate } from './components/FirmwareUpdate';
import { LocalAuth } from './components/LocalAuth';
import { ConfigPanel } from './components/ConfigPanel';
import { mqttService } from './lib/mqtt';
import type { TerrariumData } from './lib/mqtt';

function App() {
  const [isDark, setIsDark] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [now, setNow] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'dashboard' | 'firmware' | 'config'>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [telemetry, setTelemetry] = useState<TerrariumData | null>(null);
  const [mqttStatus, setMqttStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  const [hasRecentTelemetry, setHasRecentTelemetry] = useState(false);
  const [gatewayStatus, setGatewayStatus] = useState(false); // LWT state
  const [selectedSensor, setSelectedSensor] = useState<'S1' | 'S2' | 'S3' | 'S4'>('S1');

  useEffect(() => {
    if (isAuthenticated) {
      mqttService.connect();
      mqttService.onStatus(setMqttStatus);
      mqttService.onData(setTelemetry);
      mqttService.onGwStatus(setGatewayStatus);
    }
  }, [isAuthenticated]);

  // Si pasamos 10 segundos sin recibir datos, marcamos que no hay telemetría reciente
  useEffect(() => {
    if (telemetry) {
      setHasRecentTelemetry(true);
      const timer = setTimeout(() => setHasRecentTelemetry(false), 10000); // 10s límite
      return () => clearTimeout(timer);
    }
  }, [telemetry]);

  // Reloj local (sincronizable con la hora del MEGA1 vía MQTT)
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Apply dark mode class to root element
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  if (!isAuthenticated) {
    return <LocalAuth onSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300 pb-16 md:pb-0">
      {/* Navbar */}
      <nav className="border-b border-border bg-card/70 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <Leaf className="w-6 h-6 text-primary" />
              <span className="text-xl font-bold tracking-tight">Terrarium<span className="text-primary">+</span></span>
            </div>

            {/* Tabs de Navegación Desktop */}
            <div className="hidden md:flex items-center bg-secondary/50 rounded-xl p-1 gap-1">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'dashboard'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-foreground/60 hover:text-foreground'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab('config')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'config'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-foreground/60 hover:text-foreground'
                }`}
              >
                <Settings className="w-4 h-4 inline mr-1" />
                Configuración
              </button>
              <button
                onClick={() => setActiveTab('firmware')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'firmware'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-foreground/60 hover:text-foreground'
                }`}
              >
                ⚡ Firmware OTA
              </button>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <button 
                onClick={() => setIsDark(!isDark)}
                className="p-2 hover:bg-secondary rounded-full transition-colors text-lg"
                title={isDark ? "Modo Claro" : "Modo Oscuro"}
              >
                {isDark ? '🌙' : '☀️'}
              </button>
              <button 
                onClick={() => {
                  localStorage.removeItem('terrarium_auth');
                  setIsAuthenticated(false);
                }}
                className="p-2 hover:bg-red-500/20 text-red-500 rounded-full transition-colors"
                title="Bloquear Panel"
              >
                <LogOut className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 hover:bg-secondary rounded-xl transition-colors md:hidden text-foreground"
                aria-label="Abrir menú"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Menú Desplegable Móvil */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-card/95 backdrop-blur-md px-4 py-3 flex flex-col gap-2">
            <button
              onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                activeTab === 'dashboard' ? 'bg-primary text-primary-foreground' : 'text-foreground/70 hover:bg-secondary/50'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" /> Dashboard Principal
            </button>
            <button
              onClick={() => { setActiveTab('config'); setIsMobileMenuOpen(false); }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                activeTab === 'config' ? 'bg-primary text-primary-foreground' : 'text-foreground/70 hover:bg-secondary/50'
              }`}
            >
              <Settings className="w-4 h-4" /> Configuración y Tareas
            </button>
            <button
              onClick={() => { setActiveTab('firmware'); setIsMobileMenuOpen(false); }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                activeTab === 'firmware' ? 'bg-primary text-primary-foreground' : 'text-foreground/70 hover:bg-secondary/50'
              }`}
            >
              <Zap className="w-4 h-4" /> Firmware OTA
            </button>
          </div>
        )}
      </nav>

      {/* Barra de Navegación Inferior en Móvil */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card/90 backdrop-blur-lg border-t border-border flex items-center justify-around py-2 px-2 shadow-lg">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition-all ${
            activeTab === 'dashboard' ? 'text-primary font-bold scale-105' : 'text-foreground/60'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[11px]">Dashboard</span>
        </button>
        <button
          onClick={() => setActiveTab('config')}
          className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition-all ${
            activeTab === 'config' ? 'text-primary font-bold scale-105' : 'text-foreground/60'
          }`}
        >
          <Settings className="w-5 h-5" />
          <span className="text-[11px]">Ajustes</span>
        </button>
        <button
          onClick={() => setActiveTab('firmware')}
          className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition-all ${
            activeTab === 'firmware' ? 'text-primary font-bold scale-105' : 'text-foreground/60'
          }`}
        >
          <Zap className="w-5 h-5" />
          <span className="text-[11px]">OTA</span>
        </button>
      </div>

      {/* Main Content */}
      {activeTab === 'firmware' ? (
        <FirmwareUpdate />
      ) : activeTab === 'config' ? (
        <ConfigPanel telemetry={telemetry} />
      ) : (
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-24 md:pb-8">
        
        {/* Alerta de Crash Log */}
        {((telemetry?.mega2_crash_mem ?? 0) > 0) && (
          <div className="mb-4 sm:mb-6 bg-red-500/10 border border-red-500/50 text-red-500 rounded-xl p-3 sm:p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
            <div>
              <h4 className="font-bold text-sm sm:text-base">¡Cuelgue del sistema detectado!</h4>
              <p className="text-xs sm:text-sm">El MEGA2 se reinició recientemente. Memoria antes del cuelgue: {telemetry?.mega2_crash_mem} bytes.</p>
            </div>
          </div>
        )}

        {/* 8 Tarjetas KPI - 2 columnas en móvil, 4 en tablet/desktop */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-6 mb-6 sm:mb-8">
          
          {/* Tarjeta 1: Temperatura */}
          <div className="bg-card border border-border rounded-xl sm:rounded-2xl p-3 sm:p-6 shadow-sm flex items-start justify-between group hover:border-primary/50 transition-colors">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 sm:gap-2 mb-1 flex-wrap">
                <p className="text-xs sm:text-sm font-medium text-foreground/60">Temp</p>
                <select 
                  value={selectedSensor} 
                  onChange={(e) => setSelectedSensor(e.target.value as any)}
                  className="bg-secondary/50 text-[10px] sm:text-xs rounded px-1 py-0.5 border border-border outline-none focus:ring-1 focus:ring-primary/50"
                >
                  <option value="S1">S1 (Arriba)</option>
                  <option value="S2">S2 (Centro)</option>
                  <option value="S3">S3 (Abajo)</option>
                  <option value="S4">S4 (Casa)</option>
                </select>
              </div>
              <h3 className="text-xl sm:text-3xl font-bold truncate">
                {telemetry ? ((telemetry as any)[`${selectedSensor.toLowerCase()}_temp`]?.toFixed(1) ?? '---') + '°C' : '---'}
              </h3>
              <p className="text-[10px] sm:text-xs text-primary mt-1 sm:mt-2 truncate">Manual ({selectedSensor})</p>
            </div>
            <div className="p-2 sm:p-3 bg-red-500/10 rounded-lg sm:rounded-xl group-hover:scale-110 transition-transform flex-shrink-0 ml-1">
              <Thermometer className="w-4 h-4 sm:w-6 sm:h-6 text-red-500" />
            </div>
          </div>

          {/* Tarjeta 2: Humedad */}
          <div className="bg-card border border-border rounded-xl sm:rounded-2xl p-3 sm:p-6 shadow-sm flex items-start justify-between group hover:border-primary/50 transition-colors">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-foreground/60 mb-1 truncate">Hum ({selectedSensor})</p>
              <h3 className="text-xl sm:text-3xl font-bold truncate">
                {telemetry ? ((telemetry as any)[`${selectedSensor.toLowerCase()}_hum`]?.toFixed(0) ?? '---') + '%' : '---'}
              </h3>
              <p className="text-[10px] sm:text-xs text-primary mt-1 sm:mt-2 truncate">{selectedSensor === 'S4' ? 'N/A' : 'Óptimo'}</p>
            </div>
            <div className="p-2 sm:p-3 bg-blue-500/10 rounded-lg sm:rounded-xl group-hover:scale-110 transition-transform flex-shrink-0 ml-1">
              <Droplets className="w-4 h-4 sm:w-6 sm:h-6 text-blue-500" />
            </div>
          </div>

          {/* Tarjeta 3: Temp. Agua */}
          <div className="bg-card border border-border rounded-xl sm:rounded-2xl p-3 sm:p-6 shadow-sm flex items-start justify-between group hover:border-primary/50 transition-colors">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-foreground/60 mb-1 truncate">T. Agua</p>
              <h3 className="text-xl sm:text-3xl font-bold truncate">{telemetry ? `${telemetry.agua_temp.toFixed(1)}°C` : '---'}</h3>
              <p className="text-[10px] sm:text-xs text-primary mt-1 sm:mt-2 truncate">{telemetry?.agua_temp && telemetry.agua_temp < 25 ? 'Calentando' : 'Estable'}</p>
            </div>
            <div className="p-2 sm:p-3 bg-cyan-500/10 rounded-lg sm:rounded-xl group-hover:scale-110 transition-transform flex-shrink-0 ml-1">
              <Waves className="w-4 h-4 sm:w-6 sm:h-6 text-cyan-500" />
            </div>
          </div>

          {/* Tarjeta 4: Nivel Depósito */}
          <div className="bg-card border border-border rounded-xl sm:rounded-2xl p-3 sm:p-6 shadow-sm flex items-start justify-between group hover:border-primary/50 transition-colors">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-foreground/60 mb-1 truncate">Depósito</p>
              <h3 className={`text-xl sm:text-3xl font-bold truncate ${telemetry?.nivel_max === false ? 'text-red-500' : 'text-green-500'}`}>
                {telemetry ? (telemetry.nivel_max === false ? 'BAJO' : 'OK') : '---'}
              </h3>
              <p className="text-[10px] sm:text-xs text-primary mt-1 sm:mt-2 truncate">{telemetry?.agua_dist ? `${telemetry.agua_dist.toFixed(1)} cm` : 'Sensor'}</p>
            </div>
            <div className={`p-2 sm:p-3 rounded-lg sm:rounded-xl group-hover:scale-110 transition-transform flex-shrink-0 ml-1 ${telemetry?.nivel_max === false ? 'bg-red-500/10 animate-pulse' : 'bg-green-500/10'}`}>
              <Droplets className={`w-4 h-4 sm:w-6 sm:h-6 ${telemetry?.nivel_max === false ? 'text-red-500' : 'text-green-500'}`} />
            </div>
          </div>

          {/* Tarjeta 5: Estado IOT */}
          <div className="bg-card border border-border rounded-xl sm:rounded-2xl p-3 sm:p-6 shadow-sm flex items-start justify-between group hover:border-primary/50 transition-colors">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-foreground/60 mb-1 truncate">Estado IOT</p>
              <h3 className={`text-base sm:text-2xl font-bold truncate ${
                mqttStatus === 'connected' && gatewayStatus && hasRecentTelemetry ? 'text-green-500' : 
                mqttStatus === 'connected' && gatewayStatus && !hasRecentTelemetry ? 'text-amber-500' : 
                'text-red-500'
              }`}>
                {mqttStatus === 'connected' && gatewayStatus && hasRecentTelemetry ? 'En línea' : 
                 mqttStatus === 'connected' && gatewayStatus && !hasRecentTelemetry ? 'Espera...' : 
                 'Offline'}
              </h3>
              <p className="text-[10px] sm:text-xs text-foreground/60 mt-1 sm:mt-2 truncate">WT32 / NodeMCU</p>
            </div>
            <div className={`p-2 sm:p-3 rounded-lg sm:rounded-xl group-hover:scale-110 transition-transform flex-shrink-0 ml-1 ${
              mqttStatus === 'connected' && gatewayStatus && hasRecentTelemetry ? 'bg-green-500/10' : 
              mqttStatus === 'connected' && gatewayStatus && !hasRecentTelemetry ? 'bg-amber-500/10' : 
              'bg-red-500/10'
            }`}>
              <Zap className={`w-4 h-4 sm:w-6 sm:h-6 ${
                mqttStatus === 'connected' && gatewayStatus && hasRecentTelemetry ? 'text-green-500' : 
                mqttStatus === 'connected' && gatewayStatus && !hasRecentTelemetry ? 'text-amber-500' : 
                'text-red-500'
              }`} />
            </div>
          </div>

          {/* Tarjeta 6: Hora Sistema */}
          <div className="bg-card border border-border rounded-xl sm:rounded-2xl p-3 sm:p-6 shadow-sm flex items-start justify-between group hover:border-primary/50 transition-colors">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-foreground/60 mb-1 truncate">Hora Sistema</p>
              <h3 className="text-base sm:text-2xl font-bold font-mono tabular-nums tracking-tight truncate">
                {now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
              </h3>
              <p className="text-[10px] sm:text-xs text-foreground/50 mt-1 sm:mt-2 truncate">
                {now.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' })}
              </p>
            </div>
            <div className="p-2 sm:p-3 bg-violet-500/10 rounded-lg sm:rounded-xl group-hover:scale-110 transition-transform flex-shrink-0 ml-1">
              <Clock className="w-4 h-4 sm:w-6 sm:h-6 text-violet-400" />
            </div>
          </div>

          {/* Tarjeta 7: Memoria RAM */}
          <div className="bg-card border border-border rounded-xl sm:rounded-2xl p-3 sm:p-6 shadow-sm flex items-start justify-between group hover:border-primary/50 transition-colors">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-foreground/60 mb-1 truncate">Memoria RAM</p>
              <div className="flex items-baseline justify-between sm:block">
                <span className="text-xs sm:text-base font-bold font-mono">M1: {telemetry?.mega1_mem ? `${telemetry.mega1_mem}B` : '---'}</span>
              </div>
              <div className="flex items-baseline justify-between sm:block mt-0.5 sm:mt-1">
                <span className="text-xs sm:text-base font-bold font-mono">M2: {telemetry?.mega2_mem ? `${telemetry.mega2_mem}B` : '---'}</span>
              </div>
              <p className="text-[10px] sm:text-xs text-foreground/50 mt-1 truncate">Libre UI/IO</p>
            </div>
            <div className="p-2 sm:p-3 bg-slate-500/10 rounded-lg sm:rounded-xl group-hover:scale-110 transition-transform flex-shrink-0 ml-1">
              <HardDrive className="w-4 h-4 sm:w-6 sm:h-6 text-slate-400" />
            </div>
          </div>

          {/* Tarjeta 8: Diagnóstico Serial */}
          <div className="bg-card border border-border rounded-xl sm:rounded-2xl p-3 sm:p-6 shadow-sm flex items-start justify-between group hover:border-primary/50 transition-colors">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-foreground/60 mb-1 truncate">Diagnóstico</p>
              <div className="grid grid-cols-3 gap-1 mt-1 text-center">
                <div>
                  <h4 className="text-xs sm:text-base font-bold font-mono">{telemetry?.mega1_latido !== undefined ? `${telemetry.mega1_latido}m` : '-'}</h4>
                  <p className="text-[8px] sm:text-[10px] text-foreground/50">Lat</p>
                </div>
                <div>
                  <h4 className="text-xs sm:text-base font-bold font-mono text-destructive">{telemetry?.mega1_err_json !== undefined ? `${telemetry.mega1_err_json}/${telemetry.mega1_err_ovf}` : '-'}</h4>
                  <p className="text-[8px] sm:text-[10px] text-foreground/50">Err</p>
                </div>
                <div>
                  <h4 className="text-xs sm:text-base font-bold font-mono">{telemetry?.mega2_max_loop !== undefined ? `${telemetry.mega2_max_loop}m` : '-'}</h4>
                  <p className="text-[8px] sm:text-[10px] text-foreground/50">Lp</p>
                </div>
              </div>
              <p className="text-[10px] sm:text-xs text-foreground/50 mt-1 truncate">Serial Bus</p>
            </div>
            <div className="p-2 sm:p-3 bg-rose-500/10 rounded-lg sm:rounded-xl group-hover:scale-110 transition-transform flex-shrink-0 ml-1">
              <Activity className="w-4 h-4 sm:w-6 sm:h-6 text-rose-400" />
            </div>
          </div>

        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
          
          {/* Interactive Terrarium View */}
          <div className="w-full min-h-[500px]">
            <TerrariumView telemetry={telemetry} />
          </div>

        </div>

        {/* Live Streaming Data (1Hz) */}
        <LiveCharts telemetry={telemetry} />

        {/* Histórico Area debajo del Grid Principal */}
        <div className="mt-8 bg-card border border-border rounded-2xl p-6 shadow-sm min-h-[400px] flex flex-col">
          <div className="flex justify-between items-center mb-6">
             <h2 className="text-xl font-bold">Histórico 24h</h2>
             <div className="bg-secondary/50 text-foreground/70 text-xs font-medium rounded-lg px-3 py-1.5 border border-border">
               Mostrando: Valores Medios Globales (Aire y Agua)
             </div>
          </div>
          <div className="flex-1 -mx-4">
            <HistoryChart />
          </div>
        </div>
      </main>
      )}
    </div>
  );
}

export default App;
