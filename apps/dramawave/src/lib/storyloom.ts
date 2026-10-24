export interface StoryloomDialogue {
  speaker: string;
  text: string;
}

export interface StoryloomShot {
  index: number;
  action: string;
  dialogue: StoryloomDialogue[];
  duration: number;
  image?: string;
}

export interface StoryloomProject {
  title: string;
  logline: string;
  style: string;
  shots: StoryloomShot[];
}

function normalizeDialogue(value: unknown): StoryloomDialogue[] {
  if (!Array.isArray(value)) return [];
  const lines: StoryloomDialogue[] = [];
  for (const item of value) {
    const line = item as Partial<StoryloomDialogue> | null;
    const text = typeof line?.text === "string" ? line.text.trim() : "";
    if (!text) continue;
    lines.push({
      speaker: typeof line?.speaker === "string" ? line.speaker.trim() : "",
      text,
    });
  }
  return lines;
}

export function parseStoryloomProject(text: string): StoryloomProject {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("文件不是有效的 JSON");
  }
  const data = raw as Partial<StoryloomProject> & { shots?: unknown };
  if (!data || typeof data.title !== "string" || !Array.isArray(data.shots)) {
    throw new Error("不是 StoryLoom 项目文件");
  }
  const shots: StoryloomShot[] = [];
  data.shots.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const shot = item as Partial<StoryloomShot>;
    if (typeof shot.image !== "string" || !shot.image) return;
    shots.push({
      index,
      action: typeof shot.action === "string" ? shot.action : "",
      dialogue: normalizeDialogue(shot.dialogue),
      duration: Math.max(1, Math.min(20, Number(shot.duration) || 4)),
      image: shot.image,
    });
  });

  if (shots.length === 0) throw new Error("项目里没有已生成的画面，先在 StoryLoom 出图");
  const total = shots.reduce((sum, shot) => sum + shot.duration, 0);
  if (total > 180) throw new Error("总时长超过 180 秒，先缩短镜头时长");

  return {
    title: data.title.trim() || "未命名短剧",
    logline: typeof data.logline === "string" ? data.logline : "",
    style: typeof data.style === "string" ? data.style : "",
    shots,
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("有一张分镜图无法读取"));
    image.src = src;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
  scale: number,
): void {
  const base = Math.max(width / image.width, height / image.height) * scale;
  const w = image.width * base;
  const h = image.height * base;
  ctx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const char of text) {
    if (ctx.measureText(current + char).width > maxWidth && current) {
      lines.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * 把 StoryLoom 的静帧 + 时长 + 对白渲染成竖屏 WebM。
 * 用 Canvas 捕获 + MediaRecorder 实时录制，因此耗时约等于成片时长。
 */
export async function renderStoryloomVideo(
  project: StoryloomProject,
  onProgress?: (ratio: number) => void,
): Promise<Blob> {
  if (typeof MediaRecorder === "undefined" || typeof HTMLCanvasElement === "undefined") {
    throw new Error("当前浏览器不支持视频合成，请用 Chrome 或 Edge 打开");
  }
  // 720p 竖屏足够手机播放，同时降低编码压力，减少录制丢帧导致的时长偏短。
  const width = 720;
  const height = 1280;
  const fps = 24;
  const unit = width / 1080;
  const images = await Promise.all(project.shots.map((shot) => loadImage(shot.image ?? "")));
  const total = project.shots.reduce((sum, shot) => sum + shot.duration, 0);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("浏览器不支持 Canvas");
  if (typeof canvas.captureStream !== "function") {
    throw new Error("当前浏览器不支持画布录制，请用 Chrome 或 Edge 打开");
  }

  // 离屏 canvas 在部分环境拿不到帧，挂一个极小的可见画布在角落。
  canvas.style.cssText =
    "position:fixed;left:0;bottom:0;width:36px;height:64px;opacity:0.01;pointer-events:none;z-index:-1";
  document.body.appendChild(canvas);

  const drawFrame = (elapsed: number) => {
    let cursor = 0;
    let index = 0;
    for (let i = 0; i < project.shots.length; i += 1) {
      const shot = project.shots[i]!;
      if (elapsed < cursor + shot.duration) {
        index = i;
        break;
      }
      cursor += shot.duration;
      index = Math.min(project.shots.length - 1, i + 1);
    }
    const shot = project.shots[index]!;
    const local = Math.min(1, Math.max(0, (elapsed - cursor) / shot.duration));

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);
    drawCover(ctx, images[index]!, width, height, 1 + local * 0.06);

    const fade = 0.35;
    if (index + 1 < project.shots.length && local > 1 - fade / shot.duration) {
      const alpha = Math.min(1, (local - (1 - fade / shot.duration)) / (fade / shot.duration));
      ctx.globalAlpha = alpha;
      drawCover(ctx, images[index + 1]!, width, height, 1);
      ctx.globalAlpha = 1;
    }

    const text = shot.dialogue.map((d) => (d.speaker ? `${d.speaker}：${d.text}` : d.text)).join("\n");
    if (text) {
      ctx.font = `600 ${Math.round(54 * unit)}px "PingFang SC", "Hiragino Sans GB", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.lineWidth = Math.max(3, Math.round(8 * unit));
      const lines = text.split("\n").flatMap((line) => wrapLines(ctx, line, width - 160 * unit));
      const lineHeight = Math.round(58 * unit);
      const startY = height - 260 * unit - (lines.length - 1) * lineHeight;
      lines.forEach((line, lineIndex) => {
        const y = startY + lineIndex * lineHeight;
        ctx.strokeText(line, width / 2, y);
        ctx.fillText(line, width / 2, y);
      });
    }
  };

  drawFrame(0);

  const base = canvas.captureStream(0);
  const track = base.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack | undefined;
  const canRequest = typeof track?.requestFrame === "function";
  const stream = canRequest ? base : canvas.captureStream(fps);
  const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((type) =>
    MediaRecorder.isTypeSupported(type),
  );
  if (!mime) throw new Error("当前浏览器不支持 WebM 录制，请用 Chrome 或 Edge 打开");
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 3_000_000 });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  const startedAt = performance.now();
  recorder.start(200);
  if (canRequest) track?.requestFrame?.();

  await new Promise<void>((resolve) => {
    const step = 1000 / fps;
    let lastReport = -1;
    const timer = window.setInterval(() => {
      const elapsed = (performance.now() - startedAt) / 1000;
      drawFrame(Math.min(elapsed, total));
      if (canRequest) track?.requestFrame?.();
      // 进度每 2% 汇报一次，避免每帧重渲染页面拖慢录制。
      const tick = Math.floor(Math.min(1, elapsed / total) * 50);
      if (tick !== lastReport) {
        lastReport = tick;
        onProgress?.(Math.min(1, elapsed / total));
      }
      if (elapsed >= total) {
        window.clearInterval(timer);
        // 给编码器一点时间收尾，否则最后几帧会丢
        window.setTimeout(resolve, 180);
      }
    }, step);
  });

  recorder.stop();
  await stopped;
  stream.getTracks().forEach((item) => item.stop());
  canvas.remove();
  onProgress?.(1);
  const blob = new Blob(chunks, { type: mime });
  if (blob.size < 2000) throw new Error("合成结果异常（视频为空），请重试");
  return blob;
}
