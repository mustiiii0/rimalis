CREATE TABLE IF NOT EXISTS site_runtime_controls (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
  maintenance_message TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO site_runtime_controls (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS site_page_controls (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  show_in_nav BOOLEAN NOT NULL DEFAULT TRUE,
  maintenance_message TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO site_page_controls (slug, title, enabled, show_in_nav)
VALUES
  ('home', 'Home', TRUE, TRUE),
  ('properties', 'Properties', TRUE, TRUE),
  ('areas', 'Areas', TRUE, TRUE),
  ('about', 'About', TRUE, TRUE),
  ('contact', 'Contact', TRUE, TRUE),
  ('faq', 'FAQ', TRUE, FALSE),
  ('privacy', 'Privacy policy', TRUE, FALSE),
  ('terms', 'Terms of use', TRUE, FALSE),
  ('cookies', 'Cookies', TRUE, FALSE)
ON CONFLICT (slug) DO NOTHING;
