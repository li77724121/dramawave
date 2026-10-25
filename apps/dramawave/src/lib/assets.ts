/** 演示素材路径，兼容本地根路径和 GitHub Pages 子路径部署。 */
export function demoAsset(file: string): string {
  return `${import.meta.env.BASE_URL}demo/${file}`;
}

/** 本机或局域网访问时，用同主机名的兄弟端口串联两个应用。 */
export function isLocalDevHost(): boolean {
  const host = window.location.hostname;
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".local") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}
