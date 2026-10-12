import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { TerrariumData } from '../lib/mqtt';


interface LiveChartsProps {
  telemetry: TerrariumData | null;
}

export function LiveCharts({ telemetry }: LiveChartsProps) {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    if (!telemetry) return;

    setData(prev => {
      const newDataPoint = {
        time: telemetry.timestamp || new Date().toLocaleTimeString('es-ES', { hour12: false }),
        tempS1: telemetry.s1_temp,
        tempS2: telemetry.s2_temp,
        tempS3: telemetry.s3_temp,
        tempS4: telemetry.s4_temp,
        tempAgua: telemetry.agua_temp,
        humS1: telemetry.s1_hum,
        humS2: telemetry.s2_hum,
        humS3: telemetry.s3_hum,
      };
      
      const newArray = [...prev, newDataPoint];
      // Para mostrar 1 hora con lecturas cada 3 seg (3000ms en MEGA2), 
      // necesitamos 60 min * 20 lect/min = 1200 puntos.
      if (newArray.length > 1200) newArray.shift(); 
      return newArray;
    });
  }, [telemetry]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 mt-6 sm:mt-8">
      {/* Subpanel 1: 5 Temperaturas */}
      <div className="bg-card border border-border rounded-xl sm:rounded-2xl p-3 sm:p-6 shadow-sm flex flex-col min-h-[300px] sm:min-h-[350px]">
        <h2 className="text-sm sm:text-lg font-bold mb-2 sm:mb-4 flex items-center gap-2">
           <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
           Streaming Tiempo Real: Temperaturas (5)
        </h2>
        <div className="h-[220px] sm:h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="time" stroke="hsl(var(--foreground)/0.5)" fontSize={10} tickLine={false} interval="preserveStartEnd" minTickGap={40} />
              <YAxis width={32} stroke="hsl(var(--foreground)/0.5)" fontSize={10} tickLine={false} tickFormatter={v => `${v}°`} domain={['dataMin - 1', 'dataMax + 1']} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '0.75rem', fontSize: '11px' }}
                itemStyle={{ padding: 0 }}
              />
              <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }} />
              <Line type="monotone" isAnimationActive={false} dataKey="tempS1" name="T. Arriba" stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line type="monotone" isAnimationActive={false} dataKey="tempS2" name="T. Centro" stroke="#f97316" strokeWidth={2} dot={false} />
              <Line type="monotone" isAnimationActive={false} dataKey="tempS3" name="T. Abajo" stroke="#eab308" strokeWidth={2} dot={false} />
              <Line type="monotone" isAnimationActive={false} dataKey="tempS4" name="T. Casa" stroke="#8b5cf6" strokeWidth={2} dot={false} />
              <Line type="monotone" isAnimationActive={false} dataKey="tempAgua" name="T. Agua" stroke="#06b6d4" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Subpanel 2: 3 Humedades */}
      <div className="bg-card border border-border rounded-xl sm:rounded-2xl p-3 sm:p-6 shadow-sm flex flex-col min-h-[300px] sm:min-h-[350px]">
        <h2 className="text-sm sm:text-lg font-bold mb-2 sm:mb-4 flex items-center gap-2">
           <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
           Streaming Tiempo Real: Humedad (3)
        </h2>
        <div className="h-[220px] sm:h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="time" stroke="hsl(var(--foreground)/0.5)" fontSize={10} tickLine={false} interval="preserveStartEnd" minTickGap={40} />
              <YAxis width={32} stroke="hsl(var(--foreground)/0.5)" fontSize={10} tickLine={false} tickFormatter={v => `${v}%`} domain={['auto', 'auto']} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '0.75rem', fontSize: '11px' }}
                itemStyle={{ padding: 0 }}
              />
              <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }} />
              <Line type="monotone" isAnimationActive={false} dataKey="humS1" name="H. Arriba" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" isAnimationActive={false} dataKey="humS2" name="H. Centro" stroke="#0ea5e9" strokeWidth={2} dot={false} />
              <Line type="monotone" isAnimationActive={false} dataKey="humS3" name="H. Abajo" stroke="#0284c7" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
