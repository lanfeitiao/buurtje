# Buurtje

Know your neighborhood before you move.

Buurtje helps expats and newcomers to the Netherlands explore neighborhoods by postcode, address, or area name. Search any location and instantly see what it's really like to live there.

**Try it:** [postcode-explorer.lovepooh1990.workers.dev](https://postcode-explorer.lovepooh1990.workers.dev/)

## What you get

- **Quick stats** — income levels, population density, and demographics at a glance
- **Housing types** — breakdown of apartments, row houses, detached homes, and more
- **Amenities** — nearby schools, shops, transit, and green spaces
- **Migration data** — how diverse and international the neighborhood is
- **Election results** — local voting patterns so you understand the political landscape
- **Interactive map** — see the area on a map with neighborhood boundaries

## Tech stack

- [Next.js](https://nextjs.org) 16 with App Router
- [Cloudflare Workers](https://workers.cloudflare.com) via OpenNext
- [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite) for data storage
- [Leaflet](https://leafletjs.com) for maps
- [PDOK Locatieserver](https://www.pdok.nl/) for Dutch geocoding
- [AlleCijfers.nl](https://allecijfers.nl/) as neighborhood data source