CREATE TABLE IF NOT EXISTS postcode_data (
  code TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  scraped_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS election_data (
  postcode TEXT NOT NULL,
  party TEXT NOT NULL,
  votes INTEGER NOT NULL,
  PRIMARY KEY (postcode, party)
);

CREATE TABLE IF NOT EXISTS schools (
  brin TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  street TEXT,
  huisnummer TEXT,
  postcode TEXT NOT NULL,
  city TEXT,
  denominatie TEXT,
  lat REAL NOT NULL,
  lon REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_schools_lat_lon ON schools (lat, lon);
