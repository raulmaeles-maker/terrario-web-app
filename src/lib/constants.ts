// Mapeo de IDs de la web al número de relé lógico (R1..R10) que usa el MEGA
// Estos IDs coinciden con el protocolo "Rn:v" que el MEGA1 entiende
export const PIN_MAP: Record<string, number> = {
  'C_LuzLED':       1,
  'C_Vaporizacion': 2,
  'C_Fuente':       3,
  'C_Calefaccion':  4,
  'C_LuzAcuario':   5,
  'C_LuzCalor':     6,
  'C_Atomizacion':  7,
  'C_Manta':        8,
  'C_BombaLlenado': 9,
  'C_Auxiliar':     10,
};

