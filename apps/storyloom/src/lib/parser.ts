import type { Dialogue } from "./types";

export interface ShotDraft {
  scene: string;
  action: string;
  dialogue: Dialogue[];
}

const SCENE_RE = /^(INT\.?|EXT\.?|内景|外景|场景|第[一二三四五六七八九十百\d]+[场集])/i;
const DIALOGUE_RE = /^([\u4e00-\u9fa5A-Za-z0-9·_ ]{1,12})\s*[：:]\s*(.+)$/;

function clean(line: string): string {
  return line.replace(/\s+$/g, "").trim();
}

function isDialogue(line: string): Dialogue | null {
  const quoted = line.match(/^[「“"](.+?)[」”"]$/);
  if (quoted?.[1]) return { speaker: "", text: quoted[1] };
  const match = line.match(DIALOGUE_RE);
  if (!match?.[1] || !match[2]) return null;
  const speaker = match[1].trim();
  if (speaker.length > 8 && !/^[A-Z]{2,}$/.test(speaker)) return null;
  return { speaker, text: match[2].trim() };
}

/**
 * 把自由剧本拆成「镜头草稿」：场景标题单独成行，空行分段，
 * 段落里的「角色：台词」抽取为对白，其余作为动作描述。
 */
export function parseScript(script: string): ShotDraft[] {
  const lines = script.split(/\r?\n/);
  const shots: ShotDraft[] = [];
  let scene = "";
  let block: string[] = [];

  const flush = () => {
    if (!block.length) return;
    const dialogue: Dialogue[] = [];
    const actionParts: string[] = [];
    for (const raw of block) {
      const line = clean(raw);
      if (!line) continue;
      const said = isDialogue(line);
      if (said) dialogue.push(said);
      else actionParts.push(line);
    }
    const action = actionParts.join(" ").trim();
    if (!action && !dialogue.length) {
      block = [];
      return;
    }
    shots.push({ scene, action: action || (dialogue.map((d) => d.text).join(" ")), dialogue });
    block = [];
  };

  for (const raw of lines) {
    const line = clean(raw);
    if (!line) {
      flush();
      continue;
    }
    if (SCENE_RE.test(line) && line.length <= 40) {
      flush();
      scene = line;
      continue;
    }
    block.push(line);
  }
  flush();

  if (!shots.length && script.trim()) {
    shots.push({ scene: "", action: script.trim(), dialogue: [] });
  }
  return shots;
}
