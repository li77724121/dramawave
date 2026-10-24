import type { Project, Shot } from "./types";

const ASPECT_HINT: Record<Project["aspect"], string> = {
  "9:16": "vertical 9:16 composition",
  "16:9": "horizontal 16:9 composition",
  "1:1": "square 1:1 composition",
};

/** 把风格、场景、角色设定和动作拼成一条可直接出图的提示词。 */
export function composePrompt(project: Project, shot: Shot): string {
  const cast = project.characters
    .filter((character) => {
      if (!character.name) return false;
      const haystack = `${shot.action} ${shot.dialogue.map((d) => d.speaker).join(" ")}`;
      return haystack.includes(character.name);
    })
    .map((character) => `${character.name}: ${character.promptFragment || character.look}`)
    .filter(Boolean);

  const parts = [
    project.style.trim(),
    shot.scene,
    cast.join("; "),
    shot.action,
    ASPECT_HINT[project.aspect],
    "cinematic film still, consistent character design, film grain, no text overlay",
  ].filter((part) => part && part.trim().length > 0);

  return parts.join(", ");
}
