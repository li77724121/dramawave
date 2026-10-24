import type { Project } from "./types";
import { createSampleProject, SAMPLE_SCRIPT } from "./sample";

const KEY = "storyloom.projects.v1";

export function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [createSampleProject()];
    const parsed = JSON.parse(raw) as Project[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [createSampleProject()];
    // 早期示例项目用了测试片名，命中示例脚本时顺手修正。
    return parsed.map((project) =>
      project.title === "删除我" && project.script === SAMPLE_SCRIPT
        ? { ...project, title: "第三夜" }
        : project,
    );
  } catch {
    return [createSampleProject()];
  }
}

export function saveProjects(projects: Project[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(projects));
  } catch (error) {
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      throw new Error("浏览器存储已满，请删除旧项目或导出后清理");
    }
    throw error;
  }
}
