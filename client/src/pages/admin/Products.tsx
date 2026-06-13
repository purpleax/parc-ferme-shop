import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../lib/api';
import type { Category, Product } from '../../lib/types';
import { formatPrice } from '../../lib/format';
import { Badge, ErrorState, Field, Modal, SelectField, Spinner } from '../../components/ui';
import { useToast } from '../../context/ToastContext';

interface ProductForm {
  name: string;
  description: string;
  price: string; // dollars
  compareAt: string;
  categoryId: string;
  stock: string;
  badge: string;
  featured: boolean;
  active: boolean;
}

const emptyForm: ProductForm = {
  name: '', description: '', price: '', compareAt: '', categoryId: '', stock: '0',
  badge: '', featured: false, active: true,
};

export function AdminProducts() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const load = () => {
    setError(null);
    api<{ items: Product[] }>('/admin/products')
      .then((res) => setProducts(res.items))
      .catch((err) => setError(err.message));
    api<{ categories: Category[] }>('/categories')
      .then((res) => setCategories(res.categories))
      .catch(() => {});
  };
  useEffect(load, []);

  const open = (target: Product | 'new') => {
    setFormError(null);
    setEditing(target);
    if (target === 'new') {
      setForm({ ...emptyForm, categoryId: categories[0] ? String(categories[0].id) : '' });
    } else {
      const cat = categories.find((c) => c.slug === target.category?.slug);
      setForm({
        name: target.name,
        description: target.description,
        price: (target.priceCents / 100).toFixed(2),
        compareAt: target.compareAtCents ? (target.compareAtCents / 100).toFixed(2) : '',
        categoryId: cat ? String(cat.id) : '',
        stock: String(target.stock),
        badge: target.badge ?? '',
        featured: target.featured,
        active: target.active,
      });
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setBusy(true);
    const body = {
      name: form.name,
      description: form.description,
      priceCents: Math.round(Number(form.price) * 100),
      compareAtCents: form.compareAt ? Math.round(Number(form.compareAt) * 100) : null,
      categoryId: Number(form.categoryId),
      stock: Number(form.stock),
      badge: form.badge || null,
      featured: form.featured,
      active: form.active,
    };
    try {
      if (editing === 'new') {
        await api('/admin/products', { method: 'POST', body });
        toast('Product created');
      } else if (editing) {
        await api(`/admin/products/${editing.id}`, { method: 'PUT', body });
        toast('Product updated');
      }
      setEditing(null);
      load();
    } catch (err) {
      if (err instanceof ApiError && Array.isArray(err.details) && err.details[0]) {
        setFormError(`${err.details[0].field}: ${err.details[0].message}`);
      } else {
        setFormError(err instanceof ApiError ? err.message : 'Save failed');
      }
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async (product: Product) => {
    if (!window.confirm(`Deactivate "${product.name}"? It will disappear from the storefront.`)) return;
    try {
      await api(`/admin/products/${product.id}`, { method: 'DELETE' });
      toast('Product deactivated');
      load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Delete failed', 'error');
    }
  };

  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="animate-fade-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Products</h1>
          <p className="mt-1 text-sm text-muted">{products?.length ?? '…'} products in the catalogue.</p>
        </div>
        <button
          onClick={() => open('new')}
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-carbon transition hover:bg-accent-light"
        >
          + Add product
        </button>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl bg-panel shadow-sm">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-line/60 text-xs tracking-wide text-muted uppercase">
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-graphite/70">
            {products === null ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <Spinner className="mx-auto h-6 w-6 text-accent" />
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.id} className={p.active ? '' : 'opacity-50'}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img src={p.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{p.name}</p>
                        <p className="text-xs text-muted">{p.sku}</p>
                      </div>
                      {p.badge && <Badge>{p.badge}</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{p.category?.name}</td>
                  <td className="px-4 py-3 font-medium">{formatPrice(p.priceCents)}</td>
                  <td className="px-4 py-3">
                    <span className={p.stock <= 8 ? 'font-semibold text-terracotta' : ''}>{p.stock}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.active ? 'bg-accent/10 text-accent' : 'bg-graphite text-muted'}`}>
                      {p.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => open(p)} className="text-sm font-medium text-accent hover:underline">
                      Edit
                    </button>
                    {p.active && (
                      <button onClick={() => void deactivate(p)} className="ml-4 text-sm text-terracotta hover:underline">
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal title={editing === 'new' ? 'Add product' : `Edit — ${editing.name}`} onClose={() => setEditing(null)}>
          {formError && (
            <div role="alert" className="mb-4 rounded-xl border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta">
              {formError}
            </div>
          )}
          <form onSubmit={submit} className="space-y-4" noValidate>
            <Field label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <div>
              <label htmlFor="prod-desc" className="mb-1.5 block text-sm font-medium">Description</label>
              <textarea
                id="prod-desc"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-lg border border-line bg-panel px-3.5 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Price ($)" type="number" min="0.5" step="0.01" value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })} required />
              <Field label="Compare at ($, optional)" type="number" min="0.5" step="0.01" value={form.compareAt}
                onChange={(e) => setForm({ ...form, compareAt: e.target.value })} />
              <SelectField label="Category" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </SelectField>
              <Field label="Stock" type="number" min="0" value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })} required />
              <SelectField label="Badge" value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })}>
                <option value="">None</option>
                <option>New</option>
                <option>Bestseller</option>
                <option>Limited</option>
                <option>Sale</option>
              </SelectField>
              <div className="flex flex-col justify-end gap-2 pb-1">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />
                  Featured on homepage
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                  Active
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setEditing(null)} className="rounded-full px-5 py-2.5 text-sm font-medium text-muted transition hover:bg-graphite">
                Cancel
              </button>
              <button
                disabled={busy}
                className="flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-carbon transition hover:bg-accent-light disabled:opacity-60"
              >
                {busy && <Spinner className="h-4 w-4" />}
                {editing === 'new' ? 'Create product' : 'Save changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
