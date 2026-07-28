/** Prefixa caminhos com o base do Vite (/multigesti/) para não perder o subpath/porta. */
export function appUrl(path: string = "/"): string {
  const base = String(import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  if (!path || path === "/") {
    return `${base}/`;
  }
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
