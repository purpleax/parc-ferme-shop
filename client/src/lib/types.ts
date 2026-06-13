export interface Product {
  id: number;
  sku: string;
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  compareAtCents: number | null;
  category?: { slug: string; name: string };
  stock: number;
  rating: number;
  ratingCount: number;
  badge: string | null;
  image: string;
  featured: boolean;
  active: boolean;
  createdAt: string;
}

export interface Category {
  id: number;
  slug: string;
  name: string;
  description: string;
  image: string;
  productCount: number;
}

export interface CartItem {
  id: number;
  productId: number;
  name: string;
  slug: string;
  image: string;
  priceCents: number;
  qty: number;
  lineTotalCents: number;
  stock: number;
}

export interface Cart {
  id: string;
  items: CartItem[];
  itemCount: number;
  subtotalCents: number;
}

export interface User {
  id: number;
  email: string;
  name: string;
  role: 'customer' | 'admin';
  createdAt?: string;
}

export interface OrderItem {
  id: number;
  productId: number;
  name: string;
  image: string | null;
  priceCents: number;
  qty: number;
  lineTotalCents: number;
}

export type OrderStatus = 'pending_payment' | 'paid' | 'shipped' | 'delivered' | 'cancelled';

export interface Order {
  id: string;
  status: OrderStatus;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  shipping: {
    name: string;
    line1: string;
    line2: string | null;
    city: string;
    postalCode: string;
    country: string;
  };
  items?: OrderItem[];
  payment?: { id: string; cardBrand: string | null; cardLast4: string | null } | null;
  customer?: { name: string; email: string };
  createdAt: string;
}

export interface ProductListResponse {
  items: Product[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AdminStats {
  revenueCents: number;
  orderCount: number;
  customerCount: number;
  productCount: number;
  lowStock: { id: number; name: string; sku: string; stock: number }[];
  recentOrders: { id: string; status: OrderStatus; totalCents: number; createdAt: string; customerName: string }[];
  topProducts: { productId: number; name: string; units: number; revenueCents: number }[];
}

export interface AdminCustomer {
  id: number;
  email: string;
  name: string;
  createdAt: string;
  orderCount: number;
  totalSpentCents: number;
}
