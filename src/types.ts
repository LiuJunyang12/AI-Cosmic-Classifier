export type Wavelength = 'optical' | 'infrared' | 'xray';

export type TargetType =
  | 'spiral_galaxy'
  | 'elliptical_galaxy'
  | 'supernova'
  | 'black_hole'
  | 'noise_artifact';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface CelestialTarget {
  id: string;
  type: TargetType;
  name: string;
  x: number;
  y: number;
  size: number;
  speed: number;
  hasDust: boolean;
  pulse: number;
  ra: string;
  dec: string;
}

export interface Archetype {
  type: TargetType;
  name: string;
  dustProb: number;
}

export interface Upgrades {
  scoreEnhancer: number; // 0 - 5
  quantumScanner: number; // 0 or 1
  redundancyBuffer: number; // 0 - 3
}
