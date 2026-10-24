import type { Project } from "./types";
import { parseScript } from "./parser";
import { uid } from "./types";

export const SAMPLE_SCRIPT = `内景 卧室 夜

手机在床头亮起。陈默被光惊醒，眯着眼看向屏幕。

手机：相册新增 1 张照片。

他拿起手机。照片里，他侧躺熟睡，拍摄角度来自床边。

陈默：这是谁拍的？

他猛地坐起，看向门口。走廊一片漆黑，什么都没有。

第二夜。他把手机反扣在床头，蒙头躲进被子。

手机在枕边震动，蓝光从被缝里透出来。

他掀开被子。手机亮着前置相机，画面里的他正对着镜头微笑。

陈默：你到底是谁！

快门声。屏幕白闪。

相册刷新。新照片是他此刻惊恐的脸——拍摄角度，来自他手里的手机。`;

export function createSampleProject(): Project {
  const characters = [
    {
      id: uid("char"),
      name: "陈默",
      look: "29 岁中国男性，短黑发，瘦，黑色 T 恤，眼下疲惫",
      promptFragment:
        "Chen Mo, a 29-year-old Chinese man, short black hair, thin face, tired eyes, plain black t-shirt",
    },
  ];
  const style =
    "dark minimalist bedroom at night, cold blue phone light, deep teal shadows, 35mm lens, shallow depth of field, photorealistic, moody thriller";
  const drafts = parseScript(SAMPLE_SCRIPT);

  return {
    id: uid("proj"),
    title: "第三夜",
    logline: "他每天在相册里多一张自己睡觉的照片，最后一张的拍摄角度来自他手里的手机。",
    style,
    aspect: "9:16",
    script: SAMPLE_SCRIPT,
    characters,
    shots: drafts.map((draft, index) => ({
      id: uid("shot"),
      index,
      scene: draft.scene,
      action: draft.action,
      dialogue: draft.dialogue,
      prompt: "",
      duration: 4,
      seed: 1000 + index,
      status: "idle" as const,
    })),
    updatedAt: Date.now(),
  };
}
