import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import type { Category, ProductListResponse } from '../lib/types';
import { ProductCard } from '../components/ProductCard';
import { EmptyState, ErrorState, ProductCardSkeleton, SelectField } from '../components/ui';

const SORTS = [
  ['featured', 'Featured'],
  ['newest', 'Newest'],
  ['price_asc', 'Price: low to high'],
  ['price_desc', 'Price: high to low'],
  ['rating', 'Top rated'],
] as const;

export function Shop() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<ProductListResponse | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [minPrice, setMinPrice] = useState(params.get('minPrice') ?? '');
  const [maxPrice, setMaxPrice] = useState(params.get('maxPrice') ?? '');

  const search = params.get('search') ?? '';
  const category = params.get('category') ?? '';
  const sort = params.get('sort') ?? 'featured';
  const page = Number(params.get('page') ?? '1');

  useEffect(() => {
    api<{ categories: Category[] }>('/categories')
      .then((res) => setCategories(res.categories))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const query = new URLSearchParams();
    if (search) query.set('search', search);
    if (category) query.set('category', category);
    if (params.get('minPrice')) query.set('minPrice', params.get('minPrice')!);
    if (params.get('maxPrice')) query.set('maxPrice', params.get('maxPrice')!);
    query.set('sort', sort);
    query.set('page', String(page));
    api<ProductListResponse>(`/products?${query}`)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load products'))
      .finally(() => setLoading(false));
  }, [params, search, category, sort, page]);

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!('page' in patch)) next.delete('page');
    setParams(next);
  };

  const applyPrice = () => update({ minPrice: minPrice || null, maxPrice: maxPrice || null });

  const filterPanel = (
    <div className="space-y-7">
      <div>
        <p className="mb-3 text-xs font-semibold tracking-widest text-muted uppercase">Category</p>
        <div className="space-y-1.5">
          <button
            onClick={() => update({ category: null })}
            className={`block text-sm transition hover:text-accent ${!category ? 'font-semibold text-accent' : 'text-muted'}`}
          >
            All products
          </button>
          {categories.map((c) => (
            <button
              key={c.slug}
              onClick={() => update({ category: c.slug })}
              className={`block text-sm transition hover:text-accent ${category === c.slug ? 'font-semibold text-accent' : 'text-muted'}`}
            >
              {c.name} <span className="text-xs">({c.productCount})</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-3 text-xs font-semibold tracking-widest text-muted uppercase">Price</p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            placeholder="Min"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            aria-label="Minimum price"
            className="w-20 rounded-lg border border-line bg-panel px-2.5 py-2 text-sm outline-none focus:border-accent"
          />
          <span className="text-muted">–</span>
          <input
            type="number"
            min={0}
            placeholder="Max"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            aria-label="Maximum price"
            className="w-20 rounded-lg border border-line bg-panel px-2.5 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <button
          onClick={applyPrice}
          className="mt-3 rounded-full bg-snow px-4 py-1.5 text-xs font-medium text-carbon transition hover:bg-accent"
        >
          Apply
        </button>
      </div>
      {(search || category || params.get('minPrice') || params.get('maxPrice')) && (
        <button
          onClick={() => {
            setMinPrice('');
            setMaxPrice('');
            setParams(new URLSearchParams());
          }}
          className="text-sm text-terracotta hover:underline"
        >
          Clear all filters
        </button>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="font-display text-3xl">{search ? `Results for “${search}”` : 'Shop'}</h1>
        {data && (
          <p className="mt-1 text-sm text-muted">
            {data.total} {data.total === 1 ? 'piece' : 'pieces'}
            {category && categories.find((c) => c.slug === category)
              ? ` in ${categories.find((c) => c.slug === category)!.name}`
              : ''}
          </p>
        )}
      </div>

      <div className="flex gap-10">
        <aside className="hidden w-52 shrink-0 lg:block" aria-label="Filters">
          {filterPanel}
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-6 flex items-center justify-between gap-3">
            <button
              onClick={() => setFiltersOpen((v) => !v)}
              className="rounded-full border border-line px-4 py-2 text-sm font-medium lg:hidden"
            >
              Filters {filtersOpen ? '−' : '+'}
            </button>
            <div className="ml-auto w-48">
              <SelectField label="" aria-label="Sort by" value={sort} onChange={(e) => update({ sort: e.target.value })}>
                {SORTS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
            </div>
          </div>

          {filtersOpen && (
            <div className="animate-fade-up mb-6 rounded-2xl border border-line/60 bg-panel p-5 lg:hidden">
              {filterPanel}
            </div>
          )}

          {error ? (
            <ErrorState message={error} onRetry={() => setParams(new URLSearchParams(params))} />
          ) : loading ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:gap-6">
              {Array.from({ length: 9 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : data && data.items.length === 0 ? (
            <EmptyState
              title="Nothing here yet"
              body={search ? `We couldn't find anything matching “${search}”. Try a different search.` : 'No products match these filters.'}
              action={
                <button
                  onClick={() => setParams(new URLSearchParams())}
                  className="rounded-full bg-snow px-6 py-2.5 text-sm font-medium text-carbon transition hover:bg-accent"
                >
                  Clear filters
                </button>
              }
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:gap-6">
                {data!.items.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
              {data!.totalPages > 1 && (
                <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Pagination">
                  {Array.from({ length: data!.totalPages }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => update({ page: String(i + 1) })}
                      aria-current={page === i + 1 ? 'page' : undefined}
                      className={`h-9 w-9 rounded-full text-sm font-medium transition ${
                        page === i + 1 ? 'bg-accent text-carbon' : 'bg-graphite hover:bg-line'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
