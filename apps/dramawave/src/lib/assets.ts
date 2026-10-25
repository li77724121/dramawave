/** 演示素材路径，兼容本地根路径和 GitHub Pages 子路径部署。 */
export function demoAsset(file: string): string {
  return `${import.meta.env.BASE_URL}demo/${file}`;
}
