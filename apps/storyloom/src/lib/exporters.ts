import JSZip from "jszip";
import type { Project, Shot } from "./types";

function safeName(value: string): string {
  return (value || "project").replace(/[\\/:*?"<>|\s]+/g, "-").slice(0, 60);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export function downloadProjectJson(project: Project): void {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
  downloadBlob(blob, `${safeName(project.title)}.storyloom.json`);
}

function csvCell(value: string | number): string {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(project: Project): string {
  const header = ["序号", "场景", "画面", "对白", "时长(秒)", "提示词", "有图"];
  const rows = project.shots.map((shot) =>
    [
      shot.index + 1,
      shot.scene,
      shot.action,
      shot.dialogue.map((d) => `${d.speaker ? d.speaker + "：" : ""}${d.text}`).join(" / "),
      shot.duration,
      shot.prompt,
      shot.image ? "是" : "否",
    ]
      .map(csvCell)
      .join(","),
  );
  return "\ufeff" + [header.map(csvCell).join(","), ...rows].join("\r\n");
}

function srtTime(seconds: number): string {
  const total = Math.max(0, seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const ms = Math.round((total - Math.floor(total)) * 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

export function toSrt(project: Project): string {
  let cursor = 0;
  let index = 1;
  const blocks: string[] = [];
  for (const shot of project.shots) {
    const start = cursor;
    const end = cursor + shot.duration;
    const line = shot.dialogue.map((d) => (d.speaker ? `${d.speaker}：${d.text}` : d.text)).join("\n");
    if (line) {
      blocks.push(
        `${index}\n${srtTime(start + 0.2)} --> ${srtTime(Math.max(start + 0.6, end - 0.2))}\n${line}`,
      );
      index += 1;
    }
    cursor = end;
  }
  return blocks.join("\n\n") + "\n";
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function shotText(project: Project): string {
  const lines: string[] = [`# ${project.title}`, "", project.logline, "", `风格：${project.style}`, ""];
  for (const shot of project.shots) {
    lines.push(`## 镜头 ${String(shot.index + 1).padStart(2, "0")} · ${shot.duration}s`);
    if (shot.scene) lines.push(`场景：${shot.scene}`);
    if (shot.action) lines.push(`画面：${shot.action}`);
    for (const d of shot.dialogue) lines.push(`${d.speaker ? d.speaker + "：" : ""}${d.text}`);
    lines.push(`提示词：${shot.prompt || "（未生成）"}`, "");
  }
  return lines.join("\n");
}

export async function downloadZip(project: Project): Promise<void> {
  const zip = new JSZip();
  const name = safeName(project.title);
  const root = zip.folder(name) ?? zip;

  root.file("project.json", JSON.stringify(project, null, 2));
  root.file("shotlist.csv", toCsv(project));
  root.file("script.txt", project.script);
  root.file("prompts.txt", shotText(project));
  root.file("subtitles.srt", toSrt(project));

  const images = root.folder("shots");
  if (images) {
    project.shots.forEach((shot: Shot) => {
      if (!shot.image) return;
      const ext = shot.image.includes("image/png") ? "png" : "jpg";
      images.file(`shot-${String(shot.index + 1).padStart(2, "0")}.${ext}`, dataUrlToBytes(shot.image));
    });
  }

  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, `${name}-pack.zip`);
}
