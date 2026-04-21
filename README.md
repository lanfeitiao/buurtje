# Buurtje

Know your neighborhood before you move.

Buurtje helps expats and newcomers to the Netherlands explore neighborhoods by postcode, address, or area name. Search any location and instantly see what it's really like to live there.

## What you get

- **Quick stats** — income levels, population density, and demographics at a glance
- **Housing types** — breakdown of apartments, row houses, detached homes, and more
- **Amenities** — nearby schools, shops, transit, and green spaces
- **Migration data** — how diverse and international the neighborhood is
- **Election results** — local voting patterns so you understand the political landscape
- **Interactive map** — see the area on a map with neighborhood boundaries

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and search for a postcode (e.g. `1012`), address, or neighborhood name.

### Database setup

Buurtje uses Cloudflare D1 for caching scraped neighborhood data. To seed your local database:

```bash
npm run seed-local
```

## Tech stack

- [Next.js](https://nextjs.org) 16 with App Router
- [Cloudflare Workers](https://workers.cloudflare.com) via OpenNext
- [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite) for data storage
- [Leaflet](https://leafletjs.com) for maps
- [PDOK Locatieserver](https://www.pdok.nl/) for Dutch geocoding
- [AlleCijfers.nl](https://allecijfers.nl/) as neighborhood data source

## Deployment

```bash
npm run deploy
```

Deploys to Cloudflare Workers using the OpenNext adapter.
