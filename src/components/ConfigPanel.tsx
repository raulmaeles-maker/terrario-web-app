import React, { useState, useEffect } from 'react';
import { Save, Settings2, Clock, Power, Timer, Cpu, AlertCircle } from 'lucide-react';
import { mqttService, type TerrariumData } from '../lib/mqtt';

interface ConfigPanelProps {
  telemetry: TerrariumData | null;
}

interface Program {
  id: number;
  tipo: number;        // 1=Horario, 2=Condicion, 3=Temporizador
  actuador: number;
  activo: boolean;
  // Tipo 1 & 3
  hInicio: number;
  mInicio: number;
  estadoInicio: number; // 0=OFF, 1=ON
  // Tipo 1 solo
  hFin: number;
  mFin: number;
  estadoFin: number;   // 0=OFF, 1=ON
  // Tipo 2
  sensor: number;
  op: number;          // 1=<, 2==, 3=>
  umbral: number;
  // Tipo 3
  duracion: number;    // segundos
}

const defaultPrograms: Program[] = Array.from({ length: 10 }, (_, i) => ({
  id: i,
  tipo: 1,
  actuador: 1,
  activo: false,
  hInicio: 8, mInicio: 0, estadoInicio: 1,
  hFin: 20,  mFin: 0,  estadoFin: 0,
  sensor: 0, op: 1, umbral: 25.0,
  duracion: 15,
}));

const actuadores = [
  { id: 1, name: 'Luz LED' },
  { id: 2, name: 'Vaporizador' },
  { id: 3, name: 'Bomba Llenado' },
  { id: 4, name: 'Calefacción' },
  { id: 5, name: 'Luz Acuario' },
  { id: 6, name: 'Manta Térmica' },
  { id: 7, name: 'Atomizador' },
  { id: 8, name: 'Luz Calor' },
];

const sensores = [
  { id: 0,  name: 'Ninguno' },
  { id: 1,  name: 'Temp S1 (Arriba)' },
  { id: 2,  name: 'Hum S1 (Arriba)' },
  { id: 3,  name: 'Temp S2 (Centro)' },
  { id: 4,  name: 'Hum S2 (Centro)' },
  { id: 5,  name: 'Temp S3 (Abajo)' },
  { id: 6,  name: 'Hum S3 (Abajo)' },
  { id: 7,  name: 'Temp Casa' },
  { id: 8,  name: 'Temp Agua' },
  { id: 9,  name: 'Dist. Agua (cm)' },
  { id: 10, name: 'Hum. Suelo %' },
];

const TIPO_CONFIG: Record<number, { icon: React.ReactNode; label: string; color: string }> = {
  1: { icon: <Clock className="w-4 h-4" />,  label: 'Horario',      color: 'bg-amber-500/15 border-amber-500/30 text-amber-400' },
  2: { icon: <Cpu className="w-4 h-4" />,    label: 'Condición',    color: 'bg-blue-500/15 border-blue-500/30 text-blue-400' },
  3: { icon: <Timer className="w-4 h-4" />,  label: 'Temporizador', color: 'bg-green-500/15 border-green-500/30 text-green-400' },
};

function TimeInput({ h, m, onH, onM }: { h: number; m: number; onH: (v: number) => void; onM: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      <input type="number" min={0} max={23} value={h} onChange={e => onH(+e.target.value)}
        className="w-14 bg-secondary rounded-lg px-2 py-1.5 outline-none text-center font-mono font-bold text-sm border border-border/50 focus:ring-1 focus:ring-primary/50" />
      <span className="font-bold text-foreground/40">:</span>
      <input type="number" min={0} max={59} value={m} onChange={e => onM(+e.target.value)}
        className="w-14 bg-secondary rounded-lg px-2 py-1.5 outline-none text-center font-mono font-bold text-sm border border-border/50 focus:ring-1 focus:ring-primary/50" />
    </div>
  );
}

function StateToggle({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <button onClick={() => onChange(value ? 0 : 1)}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${value ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'bg-red-500/20 border-red-500/50 text-red-400'}`}>
      {value ? 'ON' : 'OFF'}
    </button>
  );
}

export function ConfigPanel({ telemetry }: ConfigPanelProps) {
  const [hOn, setHOn]                 = useState<number>(9);
  const [hOff, setHOff]               = useState<number>(20);
  const [distLlenado, setDistLlenado] = useState<number>(28);
  const [programs, setPrograms]       = useState<Program[]>(defaultPrograms);

  useEffect(() => {
    mqttService.requestPrograms(); // Request real programming from Arduino
    mqttService.onProgramData((data: string) => {
      // Formato MEGA1/MEGA2: P,id,tipo,act,activo,p1,p2,p3,p4
      const parts = data.split(',');
      if (parts.length >= 9 && parts[0] === 'P') {
        const id = parseInt(parts[1]);
        if (id >= 0 && id < 10) {
          const tipo = parseInt(parts[2]);
          let hInicio = 0, mInicio = 0, hFin = 0, mFin = 0;
          let sensor = 0, op = 1, umbral = 25.0, estadoFin = 0;
          let duracion = 0;
          
          if (tipo === 1) {
            hInicio = parseInt(parts[5]); mInicio = parseInt(parts[6]);
            hFin = parseInt(parts[7]);    mFin = parseInt(parts[8]);
          } else if (tipo === 2) {
            sensor = parseInt(parts[5]);  op = parseInt(parts[6]);
            umbral = parseFloat(parts[7]); estadoFin = parseInt(parts[8]);
          } else if (tipo === 3) {
            hInicio = parseInt(parts[5]); mInicio = parseInt(parts[6]);
            duracion = parseInt(parts[7]);
          }
          
          setPrograms(prev => prev.map(p => p.id === id ? {
            id,
            tipo,
            actuador: parseInt(parts[3]),
            activo: parseInt(parts[4]) === 1,
            hInicio, mInicio, estadoInicio: 1, // Default ON for start
            hFin, mFin, estadoFin,
            sensor, op, umbral, duracion,
          } : p));
        }
      }
    });
  }, []);

  // Sincronizar ajustes globales desde la telemetría (solo si cambian en el dispositivo)
  useEffect(() => {
    if (telemetry) {
      if (telemetry.conf_h_on !== undefined)         setHOn(telemetry.conf_h_on);
      if (telemetry.conf_h_off !== undefined)        setHOff(telemetry.conf_h_off);
      if (telemetry.conf_dist_llenado !== undefined) setDistLlenado(telemetry.conf_dist_llenado);
    }
  }, [telemetry?.conf_h_on, telemetry?.conf_h_off, telemetry?.conf_dist_llenado]);

  const handleSaveConfig = () => {
    mqttService.sendConfig(hOn, hOff, distLlenado);
    alert('Configuración global enviada al dispositivo.');
  };

  const handleSaveProgram = (prog: Program) => {
    mqttService.sendProgram(
      prog.id, prog.tipo, prog.actuador, prog.activo,
      prog.hInicio, prog.mInicio, prog.estadoInicio,
      prog.hFin, prog.mFin, prog.estadoFin,
      prog.sensor, prog.op, prog.umbral, prog.duracion
    );
    alert(`Programa ${prog.id + 1} enviado al dispositivo.`);
  };

  const upd = (id: number, field: keyof Program, value: any) =>
    setPrograms(programs.map(p => p.id === id ? { ...p, [field]: value } : p));

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* ===== AJUSTES GLOBALES ===== */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold flex items-center gap-2 mb-1">
          <Settings2 className="w-6 h-6 text-primary" /> Ajustes Globales
        </h2>
        <p className="text-foreground/50 text-sm">Parámetros almacenados en la memoria interna del microcontrolador.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Hora de Encendido', icon: <Clock className="w-4 h-4 text-amber-400" />, value: hOn, set: setHOn, unit: 'h', step: 1 },
          { label: 'Hora de Apagado',  icon: <Clock className="w-4 h-4 text-indigo-400" />,  value: hOff, set: setHOff, unit: 'h', step: 1 },
          { label: 'Dist. Llenado (Boya)', icon: <Settings2 className="w-4 h-4 text-blue-400" />, value: distLlenado, set: setDistLlenado, unit: 'cm', step: 1 },
        ].map(({ label, icon, value, set, unit, step }) => (
          <div key={label} className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-medium text-foreground/50">{label}</span>
              {icon}
            </div>
            <div className="flex items-center gap-2">
              <input type="number" step={step} value={value} onChange={e => (set as any)(parseFloat(e.target.value))}
                className="w-full bg-secondary text-xl font-bold rounded-lg px-3 py-2 border-none outline-none focus:ring-2 focus:ring-primary/50" />
              <span className="text-sm text-foreground/50">{unit}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-12 flex justify-end">
        <button onClick={handleSaveConfig}
          className="bg-primary text-primary-foreground font-bold rounded-xl px-6 py-3 flex items-center gap-2 hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
          <Save className="w-5 h-5" /> Sincronizar con Terrario
        </button>
      </div>

      {/* ===== PROGRAMAS ===== */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2 mb-1">
          <Power className="w-6 h-6 text-primary" /> Programación de Tareas
        </h2>
        <p className="text-foreground/50 text-sm">10 reglas independientes. Selecciona el tipo para ver los campos específicos.</p>
      </div>

      <div className="space-y-4">
        {programs.map((prog) => {
          const tc = TIPO_CONFIG[prog.tipo] ?? TIPO_CONFIG[1];
          return (
            <div key={prog.id}
              className={`bg-card border rounded-2xl p-5 shadow-sm transition-all ${prog.activo ? 'border-primary/40 shadow-primary/5' : 'border-border'}`}>

              {/* ==== CABECERA ==== */}
              <div className="flex flex-wrap gap-3 items-center justify-between mb-4 pb-4 border-b border-border/50">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-black text-foreground/15 w-8">#{prog.id + 1}</span>

                  {/* Toggle activo */}
                  <button
                    onClick={() => upd(prog.id, 'activo', !prog.activo)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${prog.activo ? 'bg-primary/20 border-primary/50 text-primary' : 'bg-secondary border-border text-foreground/40'}`}>
                    {prog.activo ? 'ACTIVO' : 'INACTIVO'}
                  </button>

                  {/* Selector tipo */}
                  <div className="flex gap-1">
                    {[1, 2, 3].map(t => (
                      <button key={t} onClick={() => upd(prog.id, 'tipo', t)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border transition-all ${prog.tipo === t ? tc.color : 'bg-secondary border-border text-foreground/40 hover:text-foreground'}`}>
                        {TIPO_CONFIG[t].icon} {TIPO_CONFIG[t].label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Actuador + Enviar */}
                <div className="flex items-center gap-2">
                  <select value={prog.actuador} onChange={e => upd(prog.id, 'actuador', +e.target.value)}
                    className="bg-secondary border border-border rounded-lg px-3 py-1.5 outline-none text-sm font-medium">
                    {actuadores.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  <button onClick={() => handleSaveProgram(prog)}
                    className="bg-secondary hover:bg-primary hover:text-primary-foreground text-sm font-semibold rounded-lg px-4 py-1.5 flex items-center gap-2 transition-colors border border-border">
                    <Save className="w-4 h-4" /> Enviar
                  </button>
                </div>
              </div>

              {/* ==== CAMPOS TIPO 1: HORARIO ==== */}
              {prog.tipo === 1 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 bg-secondary/40 rounded-xl p-3">
                    <span className="text-xs text-foreground/50 w-20 shrink-0">Inicio</span>
                    <TimeInput h={prog.hInicio} m={prog.mInicio}
                      onH={v => upd(prog.id, 'hInicio', v)} onM={v => upd(prog.id, 'mInicio', v)} />
                    <span className="text-xs text-foreground/50">→ Relé</span>
                    <StateToggle value={prog.estadoInicio} onChange={v => upd(prog.id, 'estadoInicio', v)} />
                  </div>
                  <div className="flex items-center gap-3 bg-secondary/40 rounded-xl p-3">
                    <span className="text-xs text-foreground/50 w-20 shrink-0">Fin</span>
                    <TimeInput h={prog.hFin} m={prog.mFin}
                      onH={v => upd(prog.id, 'hFin', v)} onM={v => upd(prog.id, 'mFin', v)} />
                    <span className="text-xs text-foreground/50">→ Relé</span>
                    <StateToggle value={prog.estadoFin} onChange={v => upd(prog.id, 'estadoFin', v)} />
                  </div>
                </div>
              )}

              {/* ==== CAMPOS TIPO 2: CONDICIÓN ==== */}
              {prog.tipo === 2 && (
                <div className="flex flex-wrap items-center gap-3 bg-secondary/40 rounded-xl p-3">
                  <AlertCircle className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="text-xs text-foreground/50">Si</span>
                  <select value={prog.sensor} onChange={e => upd(prog.id, 'sensor', +e.target.value)}
                    className="bg-secondary border border-border rounded-lg px-3 py-1.5 outline-none text-sm">
                    {sensores.filter(s => s.id > 0).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <select value={prog.op} onChange={e => upd(prog.id, 'op', +e.target.value)}
                    className="bg-secondary border border-border rounded-lg px-3 py-1.5 outline-none text-sm w-20 font-mono text-center">
                    <option value={1}>{'<'}</option>
                    <option value={2}>{'='}</option>
                    <option value={3}>{'>'}</option>
                  </select>
                  <input type="number" step={0.1} value={prog.umbral}
                    onChange={e => upd(prog.id, 'umbral', parseFloat(e.target.value))}
                    className="w-24 bg-secondary rounded-lg px-3 py-1.5 outline-none text-center font-bold text-sm border border-border/50 focus:ring-1 focus:ring-primary/50" />
                  <span className="text-xs text-foreground/50">→ activar Relé ON</span>
                </div>
              )}

              {/* ==== CAMPOS TIPO 3: TEMPORIZADOR ==== */}
              {prog.tipo === 3 && (
                <div className="flex flex-wrap items-center gap-4 bg-secondary/40 rounded-xl p-3">
                  <Timer className="w-4 h-4 text-green-400 shrink-0" />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-foreground/50 shrink-0">Hora disparo</span>
                    <TimeInput h={prog.hInicio} m={prog.mInicio}
                      onH={v => upd(prog.id, 'hInicio', v)} onM={v => upd(prog.id, 'mInicio', v)} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-foreground/50 shrink-0">Duración</span>
                    <input type="number" min={1} max={3600} value={prog.duracion}
                      onChange={e => upd(prog.id, 'duracion', +e.target.value)}
                      className="w-20 bg-secondary rounded-lg px-3 py-1.5 outline-none text-center font-bold text-sm border border-border/50 focus:ring-1 focus:ring-primary/50" />
                    <span className="text-xs text-foreground/50">seg</span>
                  </div>
                </div>
              )}

            </div>
          );
        })}
      </div>
    </main>
  );
}
