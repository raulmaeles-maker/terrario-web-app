import { useState, useRef, useEffect } from 'react';
import { Edit2, Save, Image, Sliders, Power, Cpu } from 'lucide-react';
import { mqttService } from '../lib/mqtt';
import type { TerrariumData } from '../lib/mqtt';
import { PIN_MAP } from '../lib/constants'; 


type NodeType = 'sensor' | 'control';

interface TerrariumNode {
  id: string;
  type: NodeType;
  name: string;
  x: number;
  y: number;
  // Para sensores
  temp?: number;
  hum?: number;
  waterDist?: number;    // Para distancia ultrasónica
  isLevelMax?: boolean;  // Para boya de nivel máximo
  // Para controles
  isActive?: boolean;
  isDisabled?: boolean;
  activeColor?: string;
  subLabel?: string;
}

interface TerrariumViewProps {
  telemetry: TerrariumData | null;
}

const initialNodes: TerrariumNode[] = [
  // Sensores (Inician sin valores para no falsear)
  { id: 'S4',     type: 'sensor',  name: 'Sensor Casa',   x: 10, y: 10,  displayMode: 'temp' } as any,
  { id: 'S1',     type: 'sensor',  name: 'Sensor Arriba', x: 50, y: 20,  displayMode: 'both' } as any,
  { id: 'S2',     type: 'sensor',  name: 'Sensor Centro', x: 50, y: 50,  displayMode: 'both' } as any,
  { id: 'S3',     type: 'sensor',  name: 'Sensor Abajo',  x: 50, y: 75,  displayMode: 'both' } as any,
  { id: 'SAgua',  type: 'sensor',  name: 'Temp Agua',     x: 80, y: 80,  displayMode: 'temp' } as any,
  { id: 'SUltra', type: 'sensor',  name: 'Dist. Agua',    x: 80, y: 70,  displayMode: 'dist' } as any,
  { id: 'SNivel', type: 'sensor',  name: 'Nivel Depósito', x: 90, y: 80, displayMode: 'waterlevel' } as any,
  { id: 'SSuelo', type: 'sensor',  name: 'Hum. Suelo',    x: 30, y: 85,  displayMode: 'hum' } as any,

  // Controles / Reles
  { id: 'C_LuzCalor',    type: 'control', name: 'Luz Calor',     subLabel: 'Calor radiante terrario',     x: 30, y: 15, isActive: false, activeColor: 'bg-orange-500' },
  { id: 'C_LuzAcuario',  type: 'control', name: 'Luz Acuario',   subLabel: 'Iluminación zona agua',        x: 70, y: 15, isActive: false, activeColor: 'bg-primary' },
  { id: 'C_LuzLED',      type: 'control', name: 'Luz LED',       subLabel: 'Luz ambiental nocturna',      x: 50, y: 10, isActive: false, activeColor: 'bg-cyan-500' },
  { id: 'C_Manta',       type: 'control', name: 'Manta Térmica', subLabel: 'Calor suelo (frío)',           x: 30, y: 75, isActive: false, activeColor: 'bg-orange-600' },
  { id: 'C_Calefaccion', type: 'control', name: 'Calefacción',   subLabel: 'Termostato agua',             x: 80, y: 90, isActive: false, activeColor: 'bg-red-500' },
  { id: 'C_Vaporizacion',type: 'control', name: 'Vaporización',  subLabel: 'Humidificador ambiente',      x: 20, y: 40, isActive: false, activeColor: 'bg-blue-300' },
  { id: 'C_Atomizacion', type: 'control', name: 'Atomización',   subLabel: 'Nebulizador fino',            x: 80, y: 40, isActive: false, activeColor: 'bg-blue-400' },
  { id: 'C_BombaLlenado',type: 'control', name: 'Bomba Llenado', subLabel: 'Relleno depósito (boya)',     x: 90, y: 95, isActive: false, activeColor: 'bg-cyan-600' },
  { id: 'C_Fuente',      type: 'control', name: 'Fuente',        subLabel: 'Bomba de agua/cascada',       x: 60, y: 90, isActive: false, activeColor: 'bg-teal-500' },
  { id: 'C_Auxiliar',    type: 'control', name: 'Auxiliar',      subLabel: 'Salida de reserva (R10)',     x: 10, y: 90, isActive: false, activeColor: 'bg-purple-500' },
];


export function TerrariumView({ telemetry }: TerrariumViewProps) {
  const [nodes, setNodes] = useState<TerrariumNode[]>(initialNodes);
  const [viewMode, setViewMode] = useState<'photo' | 'panel'>('photo');
  const [photoFilter, setPhotoFilter] = useState<'sensors_only' | 'sensors_lights' | 'all'>(() => {
    return (localStorage.getItem('terrarium-photo-filter') as any) || 'sensors_only';
  });
  const [isEditing, setIsEditing] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleFilterChange = (filter: 'sensors_only' | 'sensors_lights' | 'all') => {
    setPhotoFilter(filter);
    localStorage.setItem('terrarium-photo-filter', filter);
  };

  const isNodeVisibleOnPhoto = (node: TerrariumNode) => {
    if (isEditing) return true; // En modo edición mostrar todos para poder moverlos
    if (photoFilter === 'all') return true;
    if (photoFilter === 'sensors_only') return node.type === 'sensor';
    if (photoFilter === 'sensors_lights') {
      return node.type === 'sensor' || node.id === 'C_LuzLED' || node.id === 'C_LuzCalor' || node.id === 'C_LuzAcuario';
    }
    return true;
  };

  useEffect(() => {
    const saved = localStorage.getItem('terrarium-nodes-positions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as TerrariumNode[];
        setNodes(initialNodes.map(initialNode => {
          // Buscamos si este nodo ya tenía una posición guardada
          const savedNode = parsed.find(p => p.id === initialNode.id);
          if (savedNode) {
            // Si existe en caché, mantenemos sus datos dinámicos actuales (initialNode)
            // pero le aplicamos las coordenadas (x, y) que guardó el usuario.
            return {
              ...initialNode,
              x: savedNode.x,
              y: savedNode.y
            };
          }
          // Si no existe (es un nodo nuevo insertado en código), lo renderizamos en su posición por defecto
          return initialNode;
        }));
      } catch(e) {
        console.error("Error parsing saved nodes", e);
      }
    }
  }, []);

  const handlePointerDown = (id: string, e: React.PointerEvent) => {
    if (!isEditing) return;
    e.preventDefault();
    setDraggingId(id);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isEditing || !draggingId || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * 100;
    let y = ((e.clientY - rect.top) / rect.height) * 100;
    
    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));

    setNodes(prev => prev.map(n => n.id === draggingId ? { ...n, x, y } : n));
  };

  const handlePointerUp = () => {
    if (draggingId) {
      setDraggingId(null);
    }
  };

  const toggleEdit = () => {
    if (isEditing) {
      localStorage.setItem('terrarium-nodes-positions', JSON.stringify(nodes));
    }
    setIsEditing(!isEditing);
  };

  // Sincronizar telemetría con los nodos (sensores Y actuadores)
  useEffect(() => {
    if (!telemetry) return;

    setNodes(prev => prev.map(n => {
      switch (n.id) {
        // --- Sensores ---
        case 'S1': return { ...n, temp: telemetry.s1_temp, hum: telemetry.s1_hum };
        case 'S2': return { ...n, temp: telemetry.s2_temp, hum: telemetry.s2_hum };
        case 'S3': return { ...n, temp: telemetry.s3_temp, hum: telemetry.s3_hum };
        case 'S4': return { ...n, temp: telemetry.s4_temp };
        case 'SAgua': return { ...n, temp: telemetry.agua_temp };
        case 'SUltra': return { ...n, waterDist: telemetry.agua_dist };
        case 'SSuelo': return { ...n, hum: telemetry.suelo_hum };
        case 'SNivel': return { ...n, isLevelMax: telemetry.nivel_max, waterDist: telemetry.agua_dist };
        // --- Actuadores (sincronizar estado real del hardware) ---
        case 'C_LuzLED':       return (telemetry as any).luz_led       !== undefined ? { ...n, isActive: (telemetry as any).luz_led }       : n;
        case 'C_Vaporizacion': return (telemetry as any).vaporizacion  !== undefined ? { ...n, isActive: (telemetry as any).vaporizacion }  : n;
        case 'C_Fuente':       return (telemetry as any).fuente        !== undefined ? { ...n, isActive: (telemetry as any).fuente }        : n;
        case 'C_Calefaccion':  return (telemetry as any).calefaccion   !== undefined ? { ...n, isActive: (telemetry as any).calefaccion }   : n;
        case 'C_LuzAcuario':   return (telemetry as any).luz_acuario   !== undefined ? { ...n, isActive: (telemetry as any).luz_acuario }   : n;
        case 'C_LuzCalor':     return (telemetry as any).luz_calor     !== undefined ? { ...n, isActive: (telemetry as any).luz_calor }     : n;
        case 'C_Atomizacion':  return (telemetry as any).atomizacion   !== undefined ? { ...n, isActive: (telemetry as any).atomizacion }   : n;
        case 'C_Manta':        return (telemetry as any).manta_termica !== undefined ? { ...n, isActive: (telemetry as any).manta_termica } : n;
        case 'C_BombaLlenado': return (telemetry as any).bomba_llenado !== undefined ? { ...n, isActive: (telemetry as any).bomba_llenado } : n;
        case 'C_Auxiliar':     return (telemetry as any).auxiliar      !== undefined ? { ...n, isActive: (telemetry as any).auxiliar }      : n;
        default: return n;
      }
    }));
  }, [telemetry]);


  const toggleControl = (id: string) => {
    if (isEditing) return;
    
    setNodes(prev => prev.map(n => {
      if (n.id === id && !n.isDisabled && n.type === 'control') {
        const newState = !n.isActive;
        
        // Enviar comando MQTT al NodeMCU
        // Formato esperado: "R<PIN>:<0|1>"
        const pin = PIN_MAP[id];
        if (pin) {
          mqttService.sendCommand(`R${pin}:${newState ? 1 : 0}`);
        }
        
        return { ...n, isActive: newState };
      }
      return n;
    }));
  };

  return (
    <div className="bg-card border border-border rounded-xl sm:rounded-2xl p-3 sm:p-6 shadow-sm flex flex-col relative w-full h-full">
      {/* Header con Título, Selector de Vista (Foto / Mandos), Filtro y Botón Editar */}
      <div className="flex flex-wrap justify-between items-center gap-2 mb-3 sm:mb-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <h2 className="text-base sm:text-xl font-bold">Vista del Terrario</h2>
          
          {/* Switch de Modo Vista */}
          <div className="flex bg-secondary/60 p-0.5 rounded-lg border border-border text-xs font-semibold">
            <button
              onClick={() => setViewMode('photo')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
                viewMode === 'photo' ? 'bg-card text-foreground shadow-sm font-bold' : 'text-foreground/60 hover:text-foreground'
              }`}
            >
              <Image className="w-3.5 h-3.5" /> <span className="hidden xs:inline">Foto</span>
            </button>
            <button
              onClick={() => setViewMode('panel')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
                viewMode === 'panel' ? 'bg-card text-foreground shadow-sm font-bold' : 'text-foreground/60 hover:text-foreground'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" /> <span className="hidden xs:inline">Mandos</span>
            </button>
          </div>

          {/* Filtro de elementos en foto (solo cuando viewMode === 'photo') */}
          {viewMode === 'photo' && (
            <div className="flex items-center bg-secondary/50 p-0.5 rounded-lg border border-border text-[11px] font-medium">
              <button
                onClick={() => handleFilterChange('sensors_only')}
                className={`px-2 py-0.5 rounded-md transition-colors ${
                  photoFilter === 'sensors_only' ? 'bg-card text-foreground font-bold shadow-sm' : 'text-foreground/60 hover:text-foreground'
                }`}
                title="Mostrar solo los sensores sobre la foto (los mandos quedan en el panel de abajo)"
              >
                Sensores
              </button>
              <button
                onClick={() => handleFilterChange('sensors_lights')}
                className={`px-2 py-0.5 rounded-md transition-colors ${
                  photoFilter === 'sensors_lights' ? 'bg-card text-foreground font-bold shadow-sm' : 'text-foreground/60 hover:text-foreground'
                }`}
                title="Sensores + Luces principales sobre la foto"
              >
                + Luces
              </button>
              <button
                onClick={() => handleFilterChange('all')}
                className={`px-2 py-0.5 rounded-md transition-colors ${
                  photoFilter === 'all' ? 'bg-card text-foreground font-bold shadow-sm' : 'text-foreground/60 hover:text-foreground'
                }`}
                title="Mostrar los 18 elementos sobre la foto"
              >
                Todos
              </button>
            </div>
          )}
        </div>

        {viewMode === 'photo' && (
          <button 
            onClick={toggleEdit}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              isEditing 
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' 
                : 'bg-secondary/50 text-foreground hover:bg-secondary'
            }`}
          >
            {isEditing ? <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            {isEditing ? 'Guardar' : 'Editar Posiciones'}
          </button>
        )}
      </div>

      {viewMode === 'photo' ? (
        /* ================= VISTA FOTO INTERACTIVA ================= */
        <div className="flex flex-col gap-4">
          {/* Contenedor de la foto: alargado en móvil (h-[440px] con object-cover) para repartir los botones holgadamente */}
          <div 
            ref={containerRef}
            className={`relative w-full rounded-xl overflow-hidden bg-black/60 touch-none select-none border-2 transition-colors flex items-center justify-center min-h-[440px] sm:min-h-0 ${
              isEditing ? 'border-primary/50 border-dashed' : 'border-border/50'
            }`}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            <img 
              src="/TerrarioPhoto.jpg.jpeg" 
              onError={(e) => {
                e.currentTarget.src = "/TerrarioPhoto1.jpg.jpeg";
              }}
              alt="Terrario" 
              className={`w-full h-[440px] sm:h-auto max-h-[85vh] object-cover sm:object-contain transition-opacity duration-300 ${isEditing ? 'opacity-50' : 'opacity-90'}`}
              draggable={false}
            />
            
            {nodes.map(node => {
              if (!isNodeVisibleOnPhoto(node)) return null;

              const isControl = node.type === 'control';

              return (
                <div
                  key={node.id}
                  onPointerDown={(e) => handlePointerDown(node.id, e)}
                  style={{ 
                    left: `${node.x}%`, 
                    top: `${node.y}%`,
                    transform: 'translate(-50%, -50%)',
                    zIndex: draggingId === node.id ? 50 : 10
                  }}
                  className={`absolute flex flex-col items-center justify-center px-1.5 py-1 sm:px-3 sm:py-2 rounded-lg sm:rounded-xl backdrop-blur-md border 
                    ${isEditing ? 'cursor-grab border-primary border-dashed bg-card/85 shadow-primary/20 hover:scale-105' : 'border-border/40 bg-card/75'}
                    ${draggingId === node.id ? 'cursor-grabbing scale-110 shadow-2xl bg-card border-solid' : 'shadow-md hover:shadow-xl hover:bg-card'}
                    transition-[transform,shadow,background-color,border-color] duration-200 whitespace-nowrap min-w-[70px] sm:min-w-[120px] max-w-[95px] sm:max-w-[160px]
                  `}
                  onClick={() => isControl && toggleControl(node.id)}
                >
                  {/* Header Label */}
                  <div className="flex items-center gap-1 mb-0.5 sm:mb-1 w-full justify-center">
                    {isEditing && <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-primary animate-pulse shrink-0"></span>}
                    <p className={`text-[9px] sm:text-[11px] font-bold uppercase tracking-tight sm:tracking-wider text-foreground/90 truncate ${isControl && !isEditing && !node.isDisabled ? 'cursor-pointer' : ''}`}>
                      {node.name}
                    </p>
                  </div>

                  {/* Contenido (Valores Sensor o Switch Control) */}
                  {isControl ? (
                    <div className={`flex flex-col items-center w-full gap-0.5 sm:gap-1.5 ${!isEditing && !node.isDisabled ? 'cursor-pointer' : ''}`}>
                      {/* Switch adaptativo */}
                      <div className={`w-8 h-4 sm:w-12 sm:h-6 rounded-full relative transition-colors border shadow-inner ${node.isDisabled ? 'bg-background border-border opacity-50 cursor-not-allowed' : (node.isActive ? node.activeColor : 'bg-background border-border')}`}>
                        <div className={`absolute top-0.5 sm:top-1 w-2.5 h-2.5 sm:w-4 sm:h-4 rounded-full shadow-sm transition-all duration-300 ${node.isActive && !node.isDisabled ? 'right-0.5 sm:right-1 bg-white' : 'left-0.5 sm:left-1 bg-foreground/30'}`}></div>
                      </div>
                      {/* Subtitle solo en pantallas sm hacia arriba */}
                      <p className="hidden sm:block text-[10px] text-foreground/60 leading-tight">
                        {node.subLabel}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 text-[9px] sm:text-xs font-bold bg-background/50 px-1 sm:px-2 py-0.5 rounded sm:rounded-lg w-full">
                      {/* Mostrar según displayMode del nodo */}
                      {(node as any).displayMode === 'both' && (
                        <>
                          {node.temp !== undefined ? <span className="text-red-400 drop-shadow-sm">{node.temp.toFixed(1)}°</span> : <span className="text-foreground/30">--°</span>}
                          {node.hum  !== undefined ? <span className="text-blue-400 drop-shadow-sm">{node.hum.toFixed(0)}%</span>  : <span className="text-foreground/30">--%</span>}
                        </>
                      )}
                      {(node as any).displayMode === 'temp' && (
                        node.temp !== undefined ? <span className="text-red-400 drop-shadow-sm">{node.temp.toFixed(1)}°C</span> : <span className="text-foreground/30">--°C</span>
                      )}
                      {(node as any).displayMode === 'hum' && (
                        node.hum !== undefined ? <span className="text-blue-400 drop-shadow-sm">{node.hum.toFixed(0)}%</span> : <span className="text-foreground/30">--%</span>
                      )}
                      {(node as any).displayMode === 'dist' && (
                        node.waterDist !== undefined
                          ? <span className="text-cyan-400 drop-shadow-sm text-[10px] sm:text-sm">{node.waterDist.toFixed(1)}cm</span>
                          : <span className="text-foreground/30">--cm</span>
                      )}
                      {(node as any).displayMode === 'waterlevel' && (() => {
                        const DIST_LLENO = 26;
                        const DIST_VACIO = 30;
                        const dist = node.waterDist;
                        const pct = dist !== undefined
                          ? Math.max(0, Math.min(100, Math.round((1 - (dist - DIST_LLENO) / (DIST_VACIO - DIST_LLENO)) * 100)))
                          : null;
                        const color = pct === null ? 'bg-foreground/20' : pct > 60 ? 'bg-cyan-400' : pct > 25 ? 'bg-yellow-400' : 'bg-red-500';
                        return (
                          <div className="flex flex-col items-center w-full gap-0.5">
                            <span className="text-cyan-400 text-[9px] sm:text-xs font-bold">
                              {pct !== null ? `${pct}%` : '--'}
                            </span>
                            <div className="w-full h-1.5 sm:h-2 bg-background/60 rounded-full overflow-hidden border border-border/40">
                              <div
                                className={`h-full rounded-full transition-all duration-700 ${color}`}
                                style={{ width: pct !== null ? `${pct}%` : '0%' }}
                              />
                            </div>
                          </div>
                        );
                      })()}
                      {(node as any).displayMode === 'level' && node.isLevelMax !== undefined && (
                        <span className={node.isLevelMax ? 'text-red-500 font-bold' : 'text-green-500'}>
                          {node.isLevelMax ? '⚠ LLENO' : '✓ OK'}
                        </span>
                      )}
                      {!(node as any).displayMode && (
                        <>
                          {node.temp !== undefined && <span className="text-red-400">{node.temp.toFixed(1)}°</span>}
                          {node.hum  !== undefined && <span className="text-blue-400">{node.hum.toFixed(0)}%</span>}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ===== BANDEJA DE MANDOS DEBAJO DE LA FOTO ===== */}
          <div className="pt-3 border-t border-border/60">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <Power className="w-4 h-4 text-primary" />
                <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-foreground/80">
                  Panel de Actuadores y Relés (10)
                </h3>
              </div>
              <span className="text-[10px] text-foreground/50">Toca para encender / apagar</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-2.5">
              {nodes.filter(n => n.type === 'control').map(ctrl => {
                const pinNum = PIN_MAP[ctrl.id];
                return (
                  <button
                    key={ctrl.id}
                    onClick={() => toggleControl(ctrl.id)}
                    className={`px-3 py-2 sm:py-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 ${
                      ctrl.isActive
                        ? 'bg-card border-primary shadow-sm shadow-primary/20 ring-1 ring-primary/40'
                        : 'bg-card/50 border-border hover:bg-card'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${ctrl.isActive ? (ctrl.activeColor || 'bg-primary animate-pulse') : 'bg-foreground/20'}`} />
                        <p className="text-xs font-bold truncate text-foreground">{ctrl.name}</p>
                      </div>
                      <p className="text-[10px] text-foreground/50 truncate mt-0.5">R{pinNum} · {ctrl.subLabel}</p>
                    </div>

                    {/* Switch táctil rápido */}
                    <div className={`w-8 h-4 sm:w-9 sm:h-5 rounded-full relative transition-colors border shadow-inner flex-shrink-0 ${
                      ctrl.isActive ? (ctrl.activeColor || 'bg-primary') : 'bg-secondary border-border'
                    }`}>
                      <div className={`absolute top-0.5 w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-white shadow-sm transition-all duration-200 ${
                        ctrl.isActive ? 'right-0.5' : 'left-0.5'
                      }`} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* ================= VISTA PANEL TÁCTIL (MÓVIL / ESCRITORIO) ================= */
        <div className="space-y-6">
          {/* Sección Actuadores / Relés */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground/70 mb-3 flex items-center gap-2">
              <Power className="w-4 h-4 text-primary" /> Actuadores y Relés (10)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2.5 sm:gap-3">
              {nodes.filter(n => n.type === 'control').map(ctrl => {
                const pinNum = PIN_MAP[ctrl.id];
                return (
                  <div
                    key={ctrl.id}
                    onClick={() => toggleControl(ctrl.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none flex items-center justify-between ${
                      ctrl.isActive 
                        ? 'bg-card border-primary shadow-md shadow-primary/10' 
                        : 'bg-card/60 border-border hover:bg-card'
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${ctrl.isActive ? (ctrl.activeColor || 'bg-primary animate-pulse') : 'bg-foreground/20'}`} />
                        <h4 className="text-sm font-bold truncate">{ctrl.name}</h4>
                        <span className="text-[10px] text-foreground/40 font-mono">R{pinNum}</span>
                      </div>
                      <p className="text-xs text-foreground/50 truncate mt-0.5">{ctrl.subLabel}</p>
                    </div>

                    {/* Interruptor Táctil */}
                    <div className={`w-12 h-6 rounded-full relative transition-colors border shadow-inner flex-shrink-0 ${
                      ctrl.isActive ? (ctrl.activeColor || 'bg-primary') : 'bg-secondary border-border'
                    }`}>
                      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-200 ${
                        ctrl.isActive ? 'right-0.5' : 'left-0.5'
                      }`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sección Sensores Detallados */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground/70 mb-3 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-primary" /> Sensores del Sistema
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
              {nodes.filter(n => n.type === 'sensor').map(sensor => {
                return (
                  <div key={sensor.id} className="bg-card/70 border border-border rounded-xl p-3 shadow-sm flex flex-col justify-between">
                    <p className="text-xs font-semibold text-foreground/60 truncate mb-1">{sensor.name}</p>
                    <div className="flex items-baseline gap-2">
                      {sensor.temp !== undefined && (
                        <span className="text-lg font-bold text-red-400 font-mono">{sensor.temp.toFixed(1)}°C</span>
                      )}
                      {sensor.hum !== undefined && (
                        <span className="text-lg font-bold text-blue-400 font-mono">{sensor.hum.toFixed(0)}%</span>
                      )}
                      {sensor.waterDist !== undefined && (
                        <span className="text-lg font-bold text-cyan-400 font-mono">{sensor.waterDist.toFixed(1)} cm</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      
      {isEditing && viewMode === 'photo' && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-background/90 backdrop-blur-md px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-primary/30 shadow-xl z-50 animate-bounce">
          <p className="text-[11px] sm:text-xs text-primary font-medium text-center">
            Arrastra las tarjetas sobre la foto y pulsa Guardar
          </p>
        </div>
      )}
    </div>
  );
}
