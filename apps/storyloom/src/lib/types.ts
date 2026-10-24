export type Aspect = "9:16" | "16:9" | "1:1";

export interface Character {
  id: string;
  name: string;
  look: string;
  promptFragment: string;
}

export interface Dialogue {
  speaker: string;
  text: string;
}

export type ShotStatus = "idle" | "generating" | "ready" | "error";

export interface Shot {
  id: string;
  index: number;
  scene: string;
  action: string;
  dialogue: Dialogue[];
  prompt: string;
  duration: number;
  seed: number;
  image?: string;
  status: ShotStatus;
  error?: string;
}

export interface Project {
  id: string;
  title: string;
  logline: string;
  style: string;
  aspect: Aspect;
  script: string;
  characters: Character[];
  shots: Shot[];
  updatedAt: number;
}

export type TabId = "script" | "cast" | "board" | "preview" | "export";

export const ASPECT_LABEL: Record<Aspect, string> = {
  "9:16": "竖屏 9:16",
  "16:9": "横屏 16:9",
  "1:1": "方形 1:1",
};

export const ASPECT_DIMS: Record<Aspect, { w: number; h: number }> = {
  "9:16": { w: 576, h: 1024 },
  "16:9": { w: 1024, h: 576 },
  "1:1": { w: 768, h: 768 },
};

export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
}
