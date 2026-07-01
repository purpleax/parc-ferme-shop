// Hand-maintained OpenAPI 3.0 spec served at /api/docs and /api/openapi.json.

const errorResponse = (description: string) => ({
  description,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' },
    },
  },
});

const json = (schema: object) => ({ content: { 'application/json': { schema } } });

// Origin-set header the Fastly NGWAF ATO templated rules key off (login /
// registration / password-reset attempt|success|failure).
const authEventHeader = {
  'X-Auth-Event': {
    description: 'Auth outcome signal consumed by Fastly NGWAF templated rules',
    schema: {
      type: 'string',
      enum: [
        'login-success',
        'login-failure',
        'register-success',
        'register-failure',
        'password-reset-attempt',
        'password-reset-success',
        'password-reset-failure',
      ],
    },
  },
};

const productSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    sku: { type: 'string', example: 'PF-HE-001' },
    slug: { type: 'string', example: '1992-monza-podium-replica-helmet' },
    name: { type: 'string' },
    description: { type: 'string' },
    priceCents: { type: 'integer', example: 28900 },
    compareAtCents: { type: 'integer', nullable: true },
    category: { type: 'object', properties: { slug: { type: 'string' }, name: { type: 'string' } } },
    stock: { type: 'integer' },
    rating: { type: 'number' },
    ratingCount: { type: 'integer' },
    badge: { type: 'string', nullable: true },
    image: { type: 'string', example: '/api/images/products/1992-monza-podium-replica-helmet.svg' },
    featured: { type: 'boolean' },
    active: { type: 'boolean' },
  },
};

const orderSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', example: 'PF-1A7F2K' },
    status: { type: 'string', enum: ['pending_payment', 'paid', 'shipped', 'delivered', 'cancelled'] },
    subtotalCents: { type: 'integer' },
    shippingCents: { type: 'integer' },
    taxCents: { type: 'integer' },
    totalCents: { type: 'integer' },
    shipping: { type: 'object' },
    items: { type: 'array', items: { type: 'object' } },
    createdAt: { type: 'string' },
  },
};

export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Parc Fermé Store API',
    version: '1.0.0',
    description:
      'REST API for the Parc Fermé demo motorsport-memorabilia store. All responses include an `X-Request-Id` header for tracing. ' +
      'Errors use a consistent envelope: `{ "error": { "code", "message", "details?", "requestId" } }`. ' +
      '**Demo accounts** — admin: `admin@parcferme.dev` / `Admin123!`, customer: `ava@demo.dev` / `Customer123!`. ' +
      '**Test cards** — `4242424242424242` succeeds, `4000000000000002` declines, `4000000000009995` insufficient funds.',
  },
  servers: [{ url: '/', description: 'This host' }],
  tags: [
    { name: 'Health' },
    { name: 'Auth' },
    { name: 'Catalog' },
    { name: 'Cart' },
    { name: 'Orders' },
    { name: 'Payments' },
    { name: 'Admin' },
    { name: 'Marketing' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string' },
              details: {},
              requestId: { type: 'string', format: 'uuid' },
            },
          },
        },
      },
      Product: productSchema,
      Order: orderSchema,
      AuthResponse: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          user: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              email: { type: 'string' },
              name: { type: 'string' },
              role: { type: 'string', enum: ['customer', 'admin'] },
            },
          },
        },
      },
      Cart: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          items: { type: 'array', items: { type: 'object' } },
          itemCount: { type: 'integer' },
          subtotalCents: { type: 'integer' },
        },
      },
    },
  },
  paths: {
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Service health check',
        responses: { '200': { description: 'Service status', ...json({ type: 'object' }) } },
      },
    },
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a customer account',
        requestBody: {
          required: true,
          ...json({
            type: 'object',
            required: ['name', 'email', 'password'],
            properties: {
              name: { type: 'string', example: 'Ava Chen' },
              email: { type: 'string', example: 'new@demo.dev' },
              password: { type: 'string', example: 'Password123!' },
            },
          }),
        },
        responses: {
          '201': { description: 'Account created (X-Auth-Event: register-success)', headers: authEventHeader, ...json({ $ref: '#/components/schemas/AuthResponse' }) },
          '400': errorResponse('Validation error (X-Auth-Event: register-failure)'),
          '409': errorResponse('Email already registered (X-Auth-Event: register-failure)'),
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in and receive a JWT',
        requestBody: {
          required: true,
          ...json({
            type: 'object',
            required: ['email', 'password'],
            properties: {
              email: { type: 'string', example: 'ava@demo.dev' },
              password: { type: 'string', example: 'Customer123!' },
            },
          }),
        },
        responses: {
          '200': { description: 'Authenticated (X-Auth-Event: login-success)', headers: authEventHeader, ...json({ $ref: '#/components/schemas/AuthResponse' }) },
          '401': errorResponse('Invalid credentials (X-Auth-Event: login-failure)'),
        },
      },
    },
    '/api/auth/forgot-password': {
      post: {
        tags: ['Auth'],
        summary: 'Request a password reset link',
        description:
          'Always returns 200 with an identical body (anti-enumeration). Sets response header `X-Auth-Event: password-reset-attempt`. No email is sent in this demo; the reset link is logged server-side.',
        requestBody: {
          required: true,
          ...json({
            type: 'object',
            required: ['email'],
            properties: { email: { type: 'string', example: 'ava@demo.dev' } },
          }),
        },
        responses: {
          '200': {
            description: 'Reset requested (X-Auth-Event: password-reset-attempt)',
            headers: authEventHeader,
            ...json({ type: 'object', properties: { message: { type: 'string' } } }),
          },
          '400': errorResponse('Validation error (X-Auth-Event: password-reset-failure)'),
        },
      },
    },
    '/api/auth/reset-password': {
      post: {
        tags: ['Auth'],
        summary: 'Reset a password using a reset token',
        description:
          'Sets `X-Auth-Event: password-reset-success` on success, or `password-reset-failure` on any bad/expired/used token or invalid new password.',
        requestBody: {
          required: true,
          ...json({
            type: 'object',
            required: ['token', 'password'],
            properties: {
              token: { type: 'string', example: 'a1b2c3…' },
              password: { type: 'string', example: 'NewPassword123!' },
            },
          }),
        },
        responses: {
          '200': {
            description: 'Password reset (X-Auth-Event: password-reset-success)',
            headers: authEventHeader,
            ...json({ type: 'object', properties: { message: { type: 'string' } } }),
          },
          '400': errorResponse('Invalid/expired token or weak password (X-Auth-Event: password-reset-failure)'),
        },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get the current user',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Current user' }, '401': errorResponse('Missing/invalid token') },
      },
    },
    '/api/categories': {
      get: { tags: ['Catalog'], summary: 'List categories with product counts', responses: { '200': { description: 'Categories' } } },
    },
    '/api/products': {
      get: {
        tags: ['Catalog'],
        summary: 'List/search products (paginated)',
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'category', in: 'query', schema: { type: 'string', example: 'helmets' } },
          { name: 'minPrice', in: 'query', schema: { type: 'number', description: 'Dollars' } },
          { name: 'maxPrice', in: 'query', schema: { type: 'number', description: 'Dollars' } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['featured', 'price_asc', 'price_desc', 'newest', 'rating'] } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 12, maximum: 48 } },
        ],
        responses: {
          '200': { description: 'Paginated products', ...json({ type: 'object', properties: { items: { type: 'array', items: { $ref: '#/components/schemas/Product' } }, total: { type: 'integer' }, page: { type: 'integer' }, totalPages: { type: 'integer' } } }) },
          '400': errorResponse('Invalid query parameters'),
        },
      },
    },
    '/api/products/featured': {
      get: { tags: ['Catalog'], summary: 'Featured products', responses: { '200': { description: 'Featured products' } } },
    },
    '/api/products/{slug}': {
      get: {
        tags: ['Catalog'],
        summary: 'Product detail with related products',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Product detail' }, '404': errorResponse('Product not found') },
      },
    },
    '/api/images/products/{seed}.svg': {
      get: {
        tags: ['Catalog'],
        summary: 'Deterministic product artwork (cacheable, max-age=86400)',
        parameters: [{ name: 'seed', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'SVG image' } },
      },
    },
    '/api/cart': {
      post: { tags: ['Cart'], summary: 'Create an anonymous cart', responses: { '201': { description: 'New cart', ...json({ type: 'object', properties: { cart: { $ref: '#/components/schemas/Cart' } } }) } } },
    },
    '/api/cart/{cartId}': {
      get: {
        tags: ['Cart'], summary: 'Get cart contents',
        parameters: [{ name: 'cartId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Cart' }, '404': errorResponse('Cart not found') },
      },
      delete: {
        tags: ['Cart'], summary: 'Empty the cart',
        parameters: [{ name: 'cartId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Emptied cart' }, '404': errorResponse('Cart not found') },
      },
    },
    '/api/cart/{cartId}/items': {
      post: {
        tags: ['Cart'], summary: 'Add a product to the cart',
        parameters: [{ name: 'cartId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, ...json({ type: 'object', required: ['productId', 'qty'], properties: { productId: { type: 'integer' }, qty: { type: 'integer', minimum: 1, maximum: 10 } } }) },
        responses: { '201': { description: 'Updated cart' }, '400': errorResponse('Insufficient stock / validation'), '404': errorResponse('Cart or product not found') },
      },
    },
    '/api/cart/{cartId}/items/{itemId}': {
      patch: {
        tags: ['Cart'], summary: 'Change item quantity',
        parameters: [
          { name: 'cartId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'itemId', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        requestBody: { required: true, ...json({ type: 'object', required: ['qty'], properties: { qty: { type: 'integer', minimum: 1, maximum: 10 } } }) },
        responses: { '200': { description: 'Updated cart' }, '404': errorResponse('Item not found') },
      },
      delete: {
        tags: ['Cart'], summary: 'Remove an item',
        parameters: [
          { name: 'cartId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'itemId', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        responses: { '200': { description: 'Updated cart' }, '404': errorResponse('Item not found') },
      },
    },
    '/api/orders': {
      post: {
        tags: ['Orders'], summary: 'Create an order from a cart (requires auth)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          ...json({
            type: 'object',
            required: ['cartId', 'shipping'],
            properties: {
              cartId: { type: 'string', format: 'uuid' },
              shipping: {
                type: 'object',
                required: ['name', 'line1', 'city', 'postalCode', 'country'],
                properties: {
                  name: { type: 'string' }, line1: { type: 'string' }, line2: { type: 'string' },
                  city: { type: 'string' }, postalCode: { type: 'string' }, country: { type: 'string' },
                },
              },
            },
          }),
        },
        responses: { '201': { description: 'Order created (pending_payment)', ...json({ type: 'object', properties: { order: { $ref: '#/components/schemas/Order' } } }) }, '400': errorResponse('Empty cart / stock issue'), '401': errorResponse('Auth required') },
      },
      get: {
        tags: ['Orders'], summary: 'List my orders', security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Order history' }, '401': errorResponse('Auth required') },
      },
    },
    '/api/orders/{id}': {
      get: {
        tags: ['Orders'], summary: 'Get one of my orders', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Order' }, '403': errorResponse('Not your order'), '404': errorResponse('Not found') },
      },
    },
    '/api/payments/intent': {
      post: {
        tags: ['Payments'], summary: 'Create a mock payment intent for an order', security: [{ bearerAuth: [] }],
        requestBody: { required: true, ...json({ type: 'object', required: ['orderId'], properties: { orderId: { type: 'string', example: 'PF-1A7F2K' } } }) },
        responses: { '201': { description: 'Payment intent' }, '400': errorResponse('Order not payable'), '404': errorResponse('Order not found') },
      },
    },
    '/api/payments/{paymentId}/confirm': {
      post: {
        tags: ['Payments'],
        summary: 'Confirm payment with mock card (card data discarded)',
        description: 'Test cards: 4242424242424242 succeeds; 4000000000000002 declines; 4000000000009995 insufficient funds.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'paymentId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          ...json({
            type: 'object',
            required: ['card'],
            properties: {
              card: {
                type: 'object',
                required: ['number', 'expMonth', 'expYear', 'cvc', 'name'],
                properties: {
                  number: { type: 'string', example: '4242424242424242' },
                  expMonth: { type: 'integer', example: 12 },
                  expYear: { type: 'integer', example: 2030 },
                  cvc: { type: 'string', example: '123' },
                  name: { type: 'string', example: 'Ava Chen' },
                },
              },
            },
          }),
        },
        responses: { '200': { description: 'Payment succeeded' }, '402': errorResponse('Payment declined'), '400': errorResponse('Invalid card') },
      },
    },
    '/api/newsletter': {
      post: {
        tags: ['Marketing'],
        summary: 'Subscribe to the newsletter (bot demo target — rate limiting enforced at the edge)',
        requestBody: { required: true, ...json({ type: 'object', required: ['email'], properties: { email: { type: 'string' } } }) },
        responses: { '201': { description: 'Subscribed' }, '409': errorResponse('Already subscribed') },
      },
    },
    '/api/admin/stats': {
      get: { tags: ['Admin'], summary: 'Dashboard stats', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Stats' }, '403': errorResponse('Admin only') } },
    },
    '/api/admin/products': {
      get: { tags: ['Admin'], summary: 'List all products (incl. inactive)', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Products' } } },
      post: {
        tags: ['Admin'], summary: 'Create a product', security: [{ bearerAuth: [] }],
        requestBody: { required: true, ...json({ type: 'object', required: ['name', 'priceCents', 'categoryId', 'stock'], properties: { name: { type: 'string' }, description: { type: 'string' }, priceCents: { type: 'integer' }, compareAtCents: { type: 'integer', nullable: true }, categoryId: { type: 'integer' }, stock: { type: 'integer' }, badge: { type: 'string', nullable: true }, featured: { type: 'boolean' }, active: { type: 'boolean' } } }) },
        responses: { '201': { description: 'Created' }, '400': errorResponse('Validation error') },
      },
    },
    '/api/admin/products/{id}': {
      put: {
        tags: ['Admin'], summary: 'Update a product', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'Updated' }, '404': errorResponse('Not found') },
      },
      delete: {
        tags: ['Admin'], summary: 'Deactivate a product (soft delete)', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'Deactivated' }, '404': errorResponse('Not found') },
      },
    },
    '/api/admin/orders': {
      get: {
        tags: ['Admin'], summary: 'List orders', security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending_payment', 'paid', 'shipped', 'delivered', 'cancelled'] } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        ],
        responses: { '200': { description: 'Orders' } },
      },
    },
    '/api/admin/orders/{id}': {
      get: {
        tags: ['Admin'], summary: 'Order detail', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Order' }, '404': errorResponse('Not found') },
      },
      patch: {
        tags: ['Admin'], summary: 'Update order status', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, ...json({ type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['pending_payment', 'paid', 'shipped', 'delivered', 'cancelled'] } } }) },
        responses: { '200': { description: 'Updated' }, '409': errorResponse('Invalid transition') },
      },
    },
    '/api/admin/customers': {
      get: { tags: ['Admin'], summary: 'List customers with order totals', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Customers' } } },
    },
    '/api/admin/customers/{id}': {
      get: {
        tags: ['Admin'], summary: 'Customer detail with orders', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'Customer' }, '404': errorResponse('Not found') },
      },
    },
  },
} as const;
