# LA County Invertebrate Field Guide

**[labugs.org](https://labugs.org)** · v3.028 · 3,438 species across 15 taxa groups

A self-contained progressive web app (PWA) field guide to the invertebrates of Los Angeles County, California. Works offline after first visit. No login required.

## Species Coverage

| Group | Species |
|---|---|
| Moths | 574 |
| Beetles | 567 |
| True Bugs & Allies | 470 |
| Flies | 403 |
| Wasps & Ants | 298 |
| Arachnids | 281 |
| Snails & Mollusks | 200 |
| Native Bees | 176 |
| Butterflies | 148 + 5 ssp |
| Orthoptera | 144 |
| Dragonflies & Damselflies | 72 |
| Myriapods | 37 |
| Hoverflies | 36 |
| Crustaceans | 18 |
| Bumblebees | 9 |
| **Total** | **3,433 + 5 ssp** |

## Features

- **Offline-capable PWA** — three-tier data persistence: network → IndexedDB → SW cache. Survives iOS Safari's 7-day cache eviction.
- **iNaturalist life list integration** — log in with your iNat username to track observed species with ✓ badges and seen/unseen counts per group
- **Photo cards** — CC-licensed images from iNaturalist for every species
- **Ecological associations (hp)** — species-specific notes on host plants, prey, habitat, and ecological role. 100% coverage, 69% unique, 0 ≥5-share duplicates.
- **Cross-links to host plants** — 969 species (28%) link directly to [la-flora.org](https://la-flora.org) with one-tap deep linking
- **Peak month data** — 833 species (24%) with documented peak activity months
- **Elevation filter** — Coast / Lowland / Foothill / Mid-elev / Mountain toggle chips
- **Rarity filter** — Common / Uncommon / Rare / Vagrant / Endangered, calibrated from published sources
- **Origin filter** — Native / Introduced / Invasive / Endemic
- **Family browser** — expandable family chips with species counts, alphabetic or taxonomic sort
- **Cross-group search** — search across all 15 taxa groups with "Also found in" navigation
- **Deep-link URLs** — `?species=Scientific+name`, `?search=term`, `#species/Scientific_name`
- **Subspecies** — 5 subspecies rendered on parent detail sheets, filtered from photo grid
- **iOS safe-area support** — Dynamic Island / notch-aware sticky navigation
- **Full SEO** — JSON-LD WebApplication schema, Open Graph tags, canonical URL

## Rarity Distribution

| Status | Species | % | Basis |
|---|---|---|---|
| Common | 500 | 14% | "abundant", "most common", "ubiquitous" in published sources |
| Uncommon | 2,815 | 82% | Default — no strong evidence of abundance or scarcity |
| Rare | 68 | 2% | "very rare", "few records", "declining" in description evidence |
| Vagrant | 46 | 1% | Seasonal/accidental visitors |
| Endangered | 7 | <1% | ESA/CESA listed |

## Cross-Guide Ecosystem

Part of the LA County Field Guide Suite:

| Guide | URL | Species |
|---|---|---|
| 🌿 Plants, Mosses & Lichens | [la-flora.org](https://la-flora.org) | 1,476 |
| 🐛 Invertebrates | [labugs.org](https://labugs.org) | 3,438 |
| 🍄 Fungi | [lafungi.org](https://lafungi.org) | 724 |
| 🦎 Wildlife | [la-fauna.org](https://la-fauna.org) | 252 |

969 species → la-flora.org host plants · 46 → lafungi.org fungal associates · 146 → la-fauna.org vertebrate predators

## Architecture

Multi-file PWA: `index.html` (78 KB) + 15 JSON data files in `data/` (~1,880 KB). Service worker (`sw.js`) caches all assets. IndexedDB (`invertOffline`) persists species data beyond SW cache lifetime for iOS resilience. No build step, no framework, no dependencies.

## Data Sources

- **Species**: iNaturalist research-grade observations, LA County (place_id 962)
- **Photos**: CC-licensed via iNaturalist API, cached in IndexedDB
- **Ecology**: Hogue (1993), Powell & Hogue (2020), Emmel & Emmel (1973), Manolis (2003), Michener (2007), Williams et al. (2014), Hatfield et al. (2015), Xerces Society, UC IPM, CA Bumble Bee Atlas, BumbleBeeWatch, socalbutterflies.com, Essig Museum
- **Maps**: ESRI + iNaturalist

## License

GPL v3. See [LICENSE](LICENSE). For informational purposes only — not a substitute for expert identification.
