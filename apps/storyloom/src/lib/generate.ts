import { ASPECT_DIMS, type Aspect } from "./types";

const ENDPOINT = "https://image.pollinations.ai/prompt/";
const TIMEOUT_MS = 120_000;

export class GenerationError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "GenerationError";
    this.status = status;
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(blob);
  });
}

/**
 * 免费出图端点，无需 API Key。额度紧张时会返回 402/429/503，
 * 这里转成可读错误，由 UI 提示重试或改用本地上传。
 */
export async function generateImage(
  prompt: string,
  aspect: Aspect,
  seed: number,
): Promise<string> {
  const { w, h } = ASPECT_DIMS[aspect];
  const url =
    ENDPOINT +
    encodeURIComponent(prompt) +
    `?width=${w}&height=${h}&nologo=true&seed=${seed}`;

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      if (response.status === 402 || response.status === 429) {
        throw new GenerationError("免费额度暂时用尽，稍后再试，或直接上传本地图片", response.status);
      }
      if (response.status === 503) {
        throw new GenerationError("生成服务繁忙，请稍后重试", response.status);
      }
      throw new GenerationError(`生成失败（HTTP ${response.status}）`, response.status);
    }
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) {
      throw new GenerationError("生成服务返回的不是图片，请稍后重试");
    }
    return await blobToDataUrl(blob);
  } catch (error) {
    if (error instanceof GenerationError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new GenerationError("生成超时（120 秒），请重试");
    }
    throw new GenerationError("网络异常，无法连接生成服务");
  } finally {
    window.clearTimeout(timer);
  }
}

export function fileToDataUrl(file: File): Promise<string> {
  return blobToDataUrl(file);
}
