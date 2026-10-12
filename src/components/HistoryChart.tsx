import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { mqttService } from '../lib/mqtt';
import { RefreshCw, Database } from 'lucide-react';

export function HistoryChart() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Al recibir histórico, actualizar estado
    mqttService.onHistData((hist) => {
      setData(hist);
      setLoading(false);
    });
    
    // Al montar, si ya hay conexión, pedir historial.
    // Si no la hay (ej: se acaba de abrir la página), 
    // MqttService conecta asíncronamente. Damos 1s de margen.
    setLoading(true);
    setTimeout(() => {
      mqttService.requestHistory();
    }, 1500);
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    mqttService.requestHistory();
  };

  return (
    <div className="w-full h-[300px] sm:h-[400px] pt-4 relative">
      <div className="absolute top-0 right-2 sm:right-4 flex items-center gap-2 sm:gap-4 z-20">
        <span className="text-xs text-foreground/50 font-medium hidden md:flex items-center gap-1 bg-secondary/50 px-2 py-1 rounded-md">
          <Database className="w-3 h-3" /> LittleFS Cache (ESP32)
        </span>
        <button 
          onClick={handleRefresh}
          className="p-1.5 sm:p-2 bg-secondary/80 hover:bg-secondary rounded-lg transition-colors border border-border shadow-sm"
          title="Actualizar Histórico desde el Gateway"
        >
          <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && data.length === 0 && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/50 backdrop-blur-sm rounded-xl border border-border">
           <RefreshCw className="w-8 h-8 text-primary animate-spin mb-4" />
           <p className="text-sm font-medium animate-pulse">Consultando memoria Flash del Gateway...</p>
        </div>
      )}

      {data.length === 0 && !loading ? (
        <div className="w-full h-full flex flex-col items-center justify-center text-foreground/50 border-2 border-dashed border-border rounded-xl">
           <Database className="w-12 h-12 mb-4 opacity-20" />
           <p className="font-medium text-lg">No hay datos históricos aún.</p>
           <p className="text-sm mt-1">El Gateway guardará automáticamente 1 registro cada hora.</p>
        </div>
      ) : (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 15, right: 10, bottom: 15, left: -15 }}>
          <XAxis 
            dataKey="time" 
            stroke="hsl(var(--foreground) / 0.5)" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false} 
            dy={10}
            minTickGap={20}
          />
          <YAxis 
            yAxisId="temp" 
            stroke="hsl(var(--foreground) / 0.5)" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false} 
            dx={-10}
            tickFormatter={(value) => `${value}°C`}
            domain={['dataMin - 2', 'dataMax + 2']}
          />
          <YAxis 
            yAxisId="hum" 
            orientation="right" 
            stroke="hsl(var(--foreground) / 0.5)" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false} 
            dx={10}
            tickFormatter={(value) => `${value}%`}
            domain={['dataMin - 5', 'dataMax + 5']}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--card))', 
              borderColor: 'hsl(var(--border))',
              borderRadius: '0.75rem',
              color: 'hsl(var(--foreground))',
              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
            }}
            itemStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
            labelStyle={{ color: 'hsl(var(--foreground) / 0.6)', marginBottom: '4px' }}
          />
          <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ paddingBottom: '20px' }} />
          
          <Line 
            yAxisId="temp"
            type="monotone" 
            name="Temp. Aire (Media)"
            dataKey="tempAire" 
            stroke="#fb923c" 
            strokeWidth={3} 
            dot={false}
            activeDot={{ r: 6, strokeWidth: 0 }}
            connectNulls
          />
          <Line 
            yAxisId="temp"
            type="monotone" 
            name="Temp. Agua"
            dataKey="tempAgua" 
            stroke="#60a5fa" 
            strokeWidth={3} 
            dot={false}
            activeDot={{ r: 6, strokeWidth: 0 }}
            connectNulls
          />
          <Line 
            yAxisId="hum"
            type="monotone" 
            name="Humedad Aire (Media)"
            dataKey="humedad" 
            stroke="#34d399" 
            strokeWidth={3} 
            dot={false}
            activeDot={{ r: 6, strokeWidth: 0 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
      )}
    </div>
  );
}
