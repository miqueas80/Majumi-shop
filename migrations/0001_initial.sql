PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS suppliers (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 120),
 phone TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS products (
 id TEXT PRIMARY KEY,
 sku TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 180),
 description TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT 'General',
 price_cents INTEGER NOT NULL CHECK(price_cents > 0 AND price_cents < 1000000000),
 stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
 supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS orders (
 id TEXT PRIMARY KEY,
 code TEXT UNIQUE NOT NULL,
 customer_name TEXT NOT NULL,
 customer_email TEXT NOT NULL DEFAULT '', customer_phone TEXT NOT NULL,
 delivery_method TEXT NOT NULL CHECK(delivery_method IN ('delivery','pickup')),
 delivery_address TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
 subtotal_cents INTEGER NOT NULL CHECK(subtotal_cents >= 0),
 total_cents INTEGER NOT NULL CHECK(total_cents >= 0),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','preparing','ready','completed','rejected','cancelled')),
 payment_method TEXT NOT NULL CHECK(payment_method IN ('manual','mercadopago')),
 payment_status TEXT NOT NULL DEFAULT 'pending' CHECK(payment_status IN ('pending','paid','failed','refunded')),
 payment_source TEXT NOT NULL DEFAULT 'none' CHECK(payment_source IN ('none','manual','mercadopago')),
 payment_ref TEXT UNIQUE,
 payment_preference_id TEXT,
 payment_link TEXT,
 payment_updated_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS ix_orders_status ON orders(status, payment_status);
CREATE TABLE IF NOT EXISTS order_items (
 id TEXT PRIMARY KEY,
 order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
 product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
 sku TEXT NOT NULL, name TEXT NOT NULL,
 quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 20),
 unit_price_cents INTEGER NOT NULL CHECK(unit_price_cents > 0),
 supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ix_order_items_order ON order_items(order_id);
CREATE TABLE IF NOT EXISTS purchase_orders (
 id TEXT PRIMARY KEY,
 order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
 supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sent','cancelled')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 sent_at TEXT,
 UNIQUE(order_id,supplier_id)
);
CREATE TABLE IF NOT EXISTS purchase_order_items (
 po_id TEXT NOT NULL REFERENCES purchase_orders(id),
 order_item_id TEXT NOT NULL REFERENCES order_items(id),
 quantity INTEGER NOT NULL CHECK(quantity > 0),
 PRIMARY KEY(po_id,order_item_id)
);
CREATE TABLE IF NOT EXISTS audit_events (
 id TEXT PRIMARY KEY,
 order_id TEXT REFERENCES orders(id) ON DELETE RESTRICT,
 actor TEXT NOT NULL,
 action TEXT NOT NULL,
 detail TEXT NOT NULL DEFAULT '{}',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_audit_order ON audit_events(order_id, created_at);
CREATE TABLE IF NOT EXISTS admin_sessions (
 hash TEXT PRIMARY KEY,
 expires_at INTEGER NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS request_limits (
 id TEXT PRIMARY KEY,
 window_start INTEGER NOT NULL,
 attempts INTEGER NOT NULL
);
CREATE TRIGGER IF NOT EXISTS approve_guard BEFORE UPDATE OF status ON orders
WHEN NEW.status='approved' AND (OLD.status <> 'pending' OR OLD.payment_status <> 'paid')
BEGIN SELECT RAISE(ABORT,'approval_requires_pending_paid_order'); END;
CREATE TRIGGER IF NOT EXISTS status_transition_guard BEFORE UPDATE OF status ON orders
WHEN NOT (
 NEW.status=OLD.status OR
 (OLD.status='pending' AND NEW.status IN ('approved','rejected','cancelled')) OR
 (OLD.status='approved' AND NEW.status IN ('preparing','cancelled')) OR
 (OLD.status='preparing' AND NEW.status IN ('ready','cancelled')) OR
 (OLD.status='ready' AND NEW.status IN ('completed','cancelled'))
)
BEGIN SELECT RAISE(ABORT,'invalid_order_transition'); END;
-- Atomic inventory reservations occur only when a status update actually commits.
CREATE TRIGGER IF NOT EXISTS reserve_stock_on_approval AFTER UPDATE OF status ON orders
WHEN OLD.status='pending' AND NEW.status='approved'
BEGIN
 UPDATE products SET stock = stock - (SELECT SUM(quantity) FROM order_items WHERE order_id=NEW.id AND product_id=products.id), updated_at=CURRENT_TIMESTAMP
 WHERE id IN (SELECT product_id FROM order_items WHERE order_id=NEW.id);
END;
CREATE TRIGGER IF NOT EXISTS return_stock_on_cancel AFTER UPDATE OF status ON orders
WHEN NEW.status='cancelled' AND OLD.status IN ('approved','preparing','ready')
BEGIN
 UPDATE products SET stock = stock + (SELECT SUM(quantity) FROM order_items WHERE order_id=NEW.id AND product_id=products.id), updated_at=CURRENT_TIMESTAMP
 WHERE id IN (SELECT product_id FROM order_items WHERE order_id=NEW.id);
END;
