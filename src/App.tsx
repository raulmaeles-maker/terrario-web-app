import { useState, useEffect } from 'react';
import { Leaf, Droplets, Thermometer, Waves, Zap, Menu, LogOut, Clock, Settings, HardDrive, AlertTriangle, Activity } from 'lucide-react';
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
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      {/* Navbar */}
      <nav className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <Leaf className="w-6 h-6 text-primary" />
              <span className="text-xl font-bold tracking-tight">Terrarium<span className="text-primary">+</span></span>
            </div>

            {/* Tabs de Navegación */}
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
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsDark(!isDark)}
                className="p-2 hover:bg-secondary rounded-full transition-colors"
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
              <button className="p-2 hover:bg-secondary rounded-full transition-colors md:hidden">
                <Menu className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      {activeTab === 'firmware' ? (
        <FirmwareUpdate />
      ) : activeTab === 'config' ? (
        <ConfigPanel telemetry={telemetry} />
      ) : (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Alerta de Crash Log */}
        {((telemetry?.mega2_crash_mem ?? 0) > 0) && (
          <div className="mb-6 bg-red-500/10 border border-red-500/50 text-red-500 rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 flex-shrink-0" />
            <div>
              <h4 className="font-bold">¡Cuelgue del sistema detectado!</h4>
              <p className="text-sm">El MEGA2 se reinició recientemente. Memoria justo antes del cuelgue: {telemetry?.mega2_crash_mem} bytes.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          
          {/* Quick Stats Cards */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex items-start justify-between group hover:border-primary/50 transition-colors">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-medium text-foreground/60">Temperatura</p>
                <select 
                  value={selectedSensor} 
                  onChange={(e) => setSelectedSensor(e.target.value as any)}
                  className="bg-secondary/50 text-xs rounded px-1 py-0.5 border border-border outline-none focus:ring-1 focus:ring-primary/50"
                >
                  <option value="S1">S1 (Arriba)</option>
                  <option value="S2">S2 (Centro)</option>
                  <option value="S3">S3 (Abajo)</option>
                  <option value="S4">S4 (Casa)</option>
                </select>
              </div>
              <h3 className="text-3xl font-bold">
                {telemetry ? ((telemetry as any)[`${selectedSensor.toLowerCase()}_temp`]?.toFixed(1) ?? '---') + '°C' : '---'}
              </h3>
              <p className="text-xs text-primary mt-2">Selección manual</p>
            </div>
            <div className="p-3 bg-red-500/10 rounded-xl group-hover:scale-110 transition-transform">
              <Thermometer className="w-6 h-6 text-red-500" />
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex items-start justify-between group hover:border-primary/50 transition-colors">
            <div>
              <p className="text-sm font-medium text-foreground/60 mb-1">Humedad ({selectedSensor})</p>
              <h3 className="text-3xl font-bold">
                {telemetry ? ((telemetry as any)[`${selectedSensor.toLowerCase()}_hum`]?.toFixed(0) ?? '---') + '%' : '---'}
              </h3>
              <p className="text-xs text-primary mt-2">{selectedSensor === 'S4' ? 'N/A' : 'Rango óptimo'}</p>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-xl group-hover:scale-110 transition-transform">
              <Droplets className="w-6 h-6 text-blue-500" />
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex items-start justify-between group hover:border-primary/50 transition-colors">
            <div>
              <p className="text-sm font-medium text-foreground/60 mb-1">Temp. Agua</p>
              <h3 className="text-3xl font-bold">{telemetry ? `${telemetry.agua_temp.toFixed(1)}°C` : '---'}</h3>
              <p className="text-xs text-primary mt-2">{telemetry?.agua_temp && telemetry.agua_temp < 25 ? 'Calentando...' : 'Estable'}</p>
            </div>
            <div className="p-3 bg-cyan-500/10 rounded-xl group-hover:scale-110 transition-transform">
              <Waves className="w-6 h-6 text-cyan-500" />
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex items-start justify-between group hover:border-primary/50 transition-colors">
            <div>
              <p className="text-sm font-medium text-foreground/60 mb-1">Nivel Depósito</p>
              <h3 className={`text-3xl font-bold ${telemetry?.nivel_max === false ? 'text-red-500' : 'text-green-500'}`}>
                {telemetry ? (telemetry.nivel_max === false ? 'BAJO' : 'OK') : '---'}
              </h3>
              <p className="text-xs text-primary mt-2">{telemetry?.agua_dist ? `${telemetry.agua_dist.toFixed(1)} cm` : 'Sensor flotador'}</p>
            </div>
            <div className={`p-3 rounded-xl group-hover:scale-110 transition-transform ${telemetry?.nivel_max === false ? 'bg-red-500/10 animate-pulse' : 'bg-green-500/10'}`}>
              <Droplets className={`w-6 h-6 ${telemetry?.nivel_max === false ? 'text-red-500' : 'text-green-500'}`} />
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex items-start justify-between group hover:border-primary/50 transition-colors">
            <div>
              <p className="text-sm font-medium text-foreground/60 mb-1">Estado IOT</p>
              <h3 className={`text-2xl mt-1 font-bold truncate pr-2 ${
                mqttStatus === 'connected' && gatewayStatus && hasRecentTelemetry ? 'text-green-500' : 
                mqttStatus === 'connected' && gatewayStatus && !hasRecentTelemetry ? 'text-amber-500' : 
                'text-red-500'
              }`}>
                {mqttStatus === 'connected' && gatewayStatus && hasRecentTelemetry ? 'En línea' : 
                 mqttStatus === 'connected' && gatewayStatus && !hasRecentTelemetry ? 'Waiting...' : 
                 'Offline'}
              </h3>
              <p className="text-xs text-foreground/60 mt-2">NodeMCU / WT32 Gateway</p>
            </div>
            <div className={`p-3 rounded-xl group-hover:scale-110 transition-transform ${
              mqttStatus === 'connected' && gatewayStatus && hasRecentTelemetry ? 'bg-green-500/10' : 
              mqttStatus === 'connected' && gatewayStatus && !hasRecentTelemetry ? 'bg-amber-500/10' : 
              'bg-red-500/10'
            }`}>
              <Zap className={`w-6 h-6 ${
                mqttStatus === 'connected' && gatewayStatus && hasRecentTelemetry ? 'text-green-500' : 
                mqttStatus === 'connected' && gatewayStatus && !hasRecentTelemetry ? 'text-amber-500' : 
                'text-red-500'
              }`} />
            </div>
          </div>

          {/* Tarjeta Reloj / Hora MEGA1 */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex items-start justify-between group hover:border-primary/50 transition-colors">
            <div>
              <p className="text-sm font-medium text-foreground/60 mb-1">Hora Sistema</p>
              <h3 className="text-2xl font-bold font-mono tabular-nums tracking-tight">
                {now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
              </h3>
              <p className="text-xs text-foreground/50 mt-2">
                {now.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' })}
              </p>
            </div>
            <div className="p-3 bg-violet-500/10 rounded-xl group-hover:scale-110 transition-transform">
              <Clock className="w-6 h-6 text-violet-400" />
            </div>
          </div>

          {/* Tarjeta de Memoria RAM */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex items-start justify-between group hover:border-primary/50 transition-colors">
            <div>
              <p className="text-sm font-medium text-foreground/60 mb-1">Memoria Libre</p>
              <h3 className="text-xl font-bold font-mono tracking-tight mt-1">
                {telemetry?.mega1_mem ? `${telemetry.mega1_mem}B` : '---'}
              </h3>
              <p className="text-xs text-foreground/50 mt-1">MEGA1 (UI)</p>
              
              <h3 className="text-xl font-bold font-mono tracking-tight mt-2">
                {telemetry?.mega2_mem ? `${telemetry.mega2_mem}B` : '---'}
              </h3>
              <p className="text-xs text-foreground/50 mt-1">MEGA2 (I/O)</p>
            </div>
            <div className="p-3 bg-slate-500/10 rounded-xl group-hover:scale-110 transition-transform">
              <HardDrive className="w-6 h-6 text-slate-400" />
            </div>
          </div>

          {/* Tarjeta de Depuración */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex items-start justify-between group hover:border-primary/50 transition-colors">
            <div>
              <p className="text-sm font-medium text-foreground/60 mb-1">Diagnóstico Serial</p>
              <div className="flex gap-4 mt-2">
                <div>
                  <h3 className="text-xl font-bold font-mono tracking-tight">{telemetry?.mega1_latido !== undefined ? `${telemetry.mega1_latido}ms` : '---'}</h3>
                  <p className="text-xs text-foreground/50">Latido M2</p>
                </div>
                <div>
                  <h3 className="text-xl font-bold font-mono tracking-tight text-destructive">{telemetry?.mega1_err_json !== undefined ? `${telemetry.mega1_err_json}/${telemetry.mega1_err_ovf}` : '---'}</h3>
                  <p className="text-xs text-foreground/50">Err/Ovf</p>
                </div>
                <div>
                  <h3 className="text-xl font-bold font-mono tracking-tight">{telemetry?.mega2_max_loop !== undefined ? `${telemetry.mega2_max_loop}ms` : '---'}</h3>
                  <p className="text-xs text-foreground/50">Max Loop M2</p>
                </div>
              </div>
            </div>
            <div className="p-3 bg-rose-500/10 rounded-xl group-hover:scale-110 transition-transform">
              <Activity className="w-6 h-6 text-rose-400" />
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
