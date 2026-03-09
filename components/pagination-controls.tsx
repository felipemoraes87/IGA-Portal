import Link from "next/link";

export const PAGE_SIZE_OPTIONS = [20, 50, 100, 200] as const;

export function parsePageParam(value?: string, fallback = 1) {
  const parsed = Number(value || String(fallback));
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

export function parsePageSizeParam(value?: string) {
  const parsed = Number(value || "20");
  if (PAGE_SIZE_OPTIONS.includes(parsed as (typeof PAGE_SIZE_OPTIONS)[number])) {
    return parsed as (typeof PAGE_SIZE_OPTIONS)[number];
  }
  return 20;
}

type PaginationControlsProps = Readonly<{
  basePath: string;
  page: number;
  pageSize: number;
  totalItems: number;
  query?: Record<string, string | undefined>;
}>;

export function PaginationControls({ basePath, page, pageSize, totalItems, query = {} }: PaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const prevPage = safePage > 1 ? safePage - 1 : null;
  const nextPage = safePage < totalPages ? safePage + 1 : null;
  const start = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, totalItems);

  const buildHref = (targetPage: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value) params.set(key, value);
    }
    params.set("page", String(targetPage));
    params.set("pageSize", String(pageSize));
    return `${basePath}?${params.toString()}`;
  };

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-slate-500">
        Mostrando {start}-{end} de {totalItems}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <form method="get" className="flex items-center gap-2">
          {Object.entries(query).map(([key, value]) => (value ? <input key={key} type="hidden" name={key} value={value} /> : null))}
          <input type="hidden" name="page" value="1" />
          <label className="text-xs text-slate-500">Linhas</label>
          <select
            name="pageSize"
            defaultValue={String(pageSize)}
            className="rounded-lg border border-[#e7d7ac] bg-white px-2 py-1 text-xs text-slate-700"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <button className="rounded-lg border border-[#e7d7ac] px-2 py-1 text-xs font-semibold text-[#800020] hover:bg-[#fff8e8]">Aplicar</button>
        </form>

        {prevPage ? (
          <Link href={buildHref(prevPage)} className="rounded-lg border border-[#e7d7ac] px-3 py-1 text-xs font-semibold text-[#800020] hover:bg-[#fff8e8]">
            Anterior
          </Link>
        ) : (
          <span className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-400">Anterior</span>
        )}
        <span className="text-xs text-slate-500">
          Pagina {safePage} de {totalPages}
        </span>
        {nextPage ? (
          <Link href={buildHref(nextPage)} className="rounded-lg border border-[#e7d7ac] px-3 py-1 text-xs font-semibold text-[#800020] hover:bg-[#fff8e8]">
            Proxima
          </Link>
        ) : (
          <span className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-400">Proxima</span>
        )}
      </div>
    </div>
  );
}

