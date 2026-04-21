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
