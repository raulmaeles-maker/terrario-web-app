import mqtt from 'mqtt';

const MQTT_URL = 'wss://broker.hivemq.com:8884/mqtt'; // Usamos WebSockets con SSL para la web
const TOPIC_STREAM_OUT = 'terrario/stream/datos';
const TOPIC_COMMAND_IN = 'terrario/stream/comandos';
const TOPIC_PRESENCE   = 'terrario/stream/presencia';
const TOPIC_HIST_3D    = 'terrario/stream/hist_3d';
const TOPIC_GW_STATUS  = 'terrario/stream/gateway_status';

export interface TerrariumData {
  s1_temp: number;
  s1_hum: number;
  s2_temp: number;
  s2_hum: number;
  s3_temp: number;
  s3_hum: number;
  s4_temp: number;
  agua_temp: number;
  agua_dist: number;
  nivel_max: boolean;
  suelo_hum: number;
  // Estado real de cada actuador (sobrescrito por lógica de seguridad)
  luz_led: boolean;
  vaporizacion: boolean;
  fuente: boolean;
  calefaccion: boolean;
  luz_acuario: boolean;
  luz_calor: boolean;
  atomizacion: boolean;
  manta_termica: boolean;
  bomba_llenado: boolean;
  auxiliar: boolean;
  // Configuración global sincronizada
  conf_h_on: number;
  conf_h_off: number;
  conf_dist_llenado: number;
  timestamp: string;
  // Memoria y Depuracin
  mega1_mem?: number;
  mega2_mem?: number;
  mega2_crash_mem?: number;
  mega2_max_loop?: number;
  mega1_err_json?: number;
  mega1_err_ovf?: number;
  mega1_latido?: number;
}

class MqttService {
  private client: mqtt.MqttClient | null = null;
  private onDataCallback: ((data: TerrariumData) => void) | null = null;
  private onProgramDataCallback: ((data: string) => void) | null = null;
  private onHistDataCallback: ((data: any[]) => void) | null = null;
  private onStatusCallback: ((status: 'connected' | 'disconnected' | 'connecting') => void) | null = null;
  private onGwStatusCallback: ((isOnline: boolean) => void) | null = null;

  connect() {
    if (this.client) return;

    this.onStatusCallback?.('connecting');
    this.client = mqtt.connect(MQTT_URL, {
      clientId: `web_client_${Math.random().toString(16).slice(2, 10)}`,
      keepalive: 60,
    });

    this.client.on('connect', () => {
      console.log('MQTT: Conectado al broker');
      this.onStatusCallback?.('connected');
      this.client?.subscribe([TOPIC_STREAM_OUT, TOPIC_HIST_3D, TOPIC_GW_STATUS], (err) => {
        if (!err) console.log(`MQTT: Suscrito a streams`);
      });
      
      // Iniciar Presence Ping
      this.startPresencePing();
    });

    this.client.on('message', (topic, message) => {
      if (topic === TOPIC_STREAM_OUT) {
        try {
          const raw = message.toString();
          if (raw.startsWith('P,')) {
            this.onProgramDataCallback?.(raw);
          } else {
            const parsed = this.parseTrama(raw);
            if (parsed) this.onDataCallback?.(parsed);
          }
        } catch (e) {
          console.error('MQTT: Error parseando trama', e);
        }
      } else if (topic === TOPIC_HIST_3D) {
        try {
          const parsed = JSON.parse(message.toString());
          this.onHistDataCallback?.(parsed);
        } catch (e) {
          console.error('MQTT: Error parseando histórico JSON', e);
        }
      } else if (topic === TOPIC_GW_STATUS) {
        const msg = message.toString();
        this.onGwStatusCallback?.(msg === 'online');
      }
    });

    this.client.on('error', (err) => {
      console.error('MQTT: Error de conexión', err);
      this.onStatusCallback?.('disconnected');
    });

    this.client.on('close', () => {
      this.onStatusCallback?.('disconnected');
    });
  }

  private startPresencePing() {
    const ping = () => {
      if (this.client?.connected) {
        this.client.publish(TOPIC_PRESENCE, 'PING');
      }
    };
    ping();
    setInterval(ping, 5000); // Ping cada 5s para avisar al NodeMCU que estamos activos
  }

  sendCommand(command: string) {
    if (this.client?.connected) {
      this.client.publish(TOPIC_COMMAND_IN, command);
      console.log(`MQTT: Enviado comando: ${command}`);
    }
  }

  sendConfig(hOn: number, hOff: number, distLlenado: number) {
    if (this.client?.connected) {
      const payload = `C,${hOn},${hOff},${distLlenado}`;
      this.client.publish(TOPIC_COMMAND_IN, payload);
      console.log(`MQTT: Enviada config: ${payload}`);
    }
  }

  sendProgram(
    id: number, tipo: number, actuador: number, activo: boolean,
    hInicio: number, mInicio: number, _estadoInicio: number,
    hFin: number, mFin: number, estadoFin: number,
    sensor: number, op: number, umbral: number, duracion: number
  ) {
    if (this.client?.connected) {
      let p1 = 0, p2 = 0, p3 = 0, p4 = 0, p5 = 0;
      if (tipo === 1) {
        p1 = hInicio; p2 = mInicio; p3 = hFin; p4 = mFin;
      } else if (tipo === 2) {
        p1 = sensor; p2 = op; p3 = umbral; p4 = estadoFin;
      } else if (tipo === 3) {
        p1 = hInicio; p2 = mInicio; p3 = duracion;
      }
      const payload = `P,${id},${tipo},${actuador},${activo ? 1 : 0},${p1},${p2},${p3},${p4},${p5}`;
      this.client.publish(TOPIC_COMMAND_IN, payload);
      console.log(`MQTT: Enviado programa: ${payload}`);
    }
  }

  requestHistory() {
    if (this.client?.connected) {
      this.client.publish(TOPIC_COMMAND_IN, 'GET_HIST_3D');
      console.log('MQTT: Solicitando histórico...');
    }
  }

  requestPrograms() {
    if (this.client?.connected) {
      this.client.publish(TOPIC_COMMAND_IN, 'GET_PRG');
      console.log('MQTT: Solicitando programas...');
    }
  }

  onData(callback: (data: TerrariumData) => void) {
    this.onDataCallback = callback;
  }

  onProgramData(callback: (data: string) => void) {
    this.onProgramDataCallback = callback;
  }

  onHistData(callback: (data: any[]) => void) {
    this.onHistDataCallback = callback;
  }

  onStatus(callback: (status: 'connected' | 'disconnected' | 'connecting') => void) {
    this.onStatusCallback = callback;
  }

  onGwStatus(callback: (isOnline: boolean) => void) {
    this.onGwStatusCallback = callback;
  }

  private parseTrama(trama: string): TerrariumData | null {
    try {
      const parts = trama.split('|');
      const data: any = { timestamp: new Date().toLocaleTimeString() };
      
      parts.forEach(part => {
        const [key, value] = part.split(':');
        switch (key) {
          case 'S1':
            const [t1, h1] = value.split(',');
            data.s1_temp = parseFloat(t1);
            data.s1_hum = parseFloat(h1);
            break;
          case 'S2':
            const [t2, h2] = value.split(',');
            data.s2_temp = parseFloat(t2);
            data.s2_hum = parseFloat(h2);
            break;
          case 'S3':
            const [t3, h3] = value.split(',');
            data.s3_temp = parseFloat(t3);
            data.s3_hum = parseFloat(h3);
            break;
          case 'S4':
            data.s4_temp = parseFloat(value);
            break;
          case 'AGU':
            data.agua_temp = parseFloat(value);
            break;
          case 'DIST':
            data.agua_dist = parseFloat(value);
            break;
          case 'NIV':
            data.nivel_max = value === '0'; // En el código MEGA2, 0=Alerta/Lleno, 1=OK
            break;
          case 'HSU':
            data.suelo_hum = parseInt(value);
            break;
          case 'REL':
            const rels = value.split(',');
            if (rels.length >= 10) {
              data.luz_led = rels[0] === '1';
              data.vaporizacion = rels[1] === '1';
              data.fuente = rels[2] === '1';
              data.calefaccion = rels[3] === '1';
              data.luz_acuario = rels[4] === '1';
              data.luz_calor = rels[5] === '1';
              data.atomizacion = rels[6] === '1';
              data.manta_termica = rels[7] === '1';
              data.bomba_llenado = rels[8] === '1';
              data.auxiliar = rels[9] === '1';
            }
            break;
          case 'CFG':
            const cfgs = value.split(',');
            if (cfgs.length >= 3) {
              data.conf_h_on = parseInt(cfgs[0]);
              data.conf_h_off = parseInt(cfgs[1]);
              data.conf_dist_llenado = parseInt(cfgs[2]);
            }
            break;
          case 'DBG':
            const dbg = value.split(',');
            if (dbg.length >= 3) {
              data.mega1_mem = parseInt(dbg[0]);
              data.mega2_mem = parseInt(dbg[1]);
              data.mega2_crash_mem = parseInt(dbg[2]);
            }
            if (dbg.length >= 7) {
              data.mega2_max_loop = parseInt(dbg[3]);
              data.mega1_err_json = parseInt(dbg[4]);
              data.mega1_err_ovf = parseInt(dbg[5]);
              data.mega1_latido = parseInt(dbg[6]);
            }
            break;
        }
      });
      return data as TerrariumData;
    } catch (e) {
      return null;
    }
  }
}

export const mqttService = new MqttService();
