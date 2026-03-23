# LA County Invertebrate Field Guide

> **⚠️ FOR INFORMATIONAL PURPOSES ONLY.** Do not handle, provoke, or otherwise interact with any invertebrate based solely on information in this guide. Misidentification of venomous or medically significant species can cause serious injury. Any action taken or not taken is solely at the user's own risk. See [LICENSE](LICENSE) for full disclaimer.

A comprehensive self-contained PWA field guide to the invertebrates of Los Angeles County, California — from coastal tide pools to 10,000 ft alpine, Mojave Desert edge to Channel Islands.

**[Live site →](https://labugs.org)**

## Stats

| Taxa | Count |
|---|---|
| 🦋 Butterflies | 146 (+5 ssp) |
| 🐝 Bumblebees | 9 |
| 🪁 Dragonflies & Damselflies | 72 |
| 🪰 Hoverflies | 25 |
| 🪻 Native Bees | 89 |
| 🕷️ Arachnids | 106 |
| 🦇 Moths | 139 |
| 🐝 Wasps & Ants | 80 |
| 🪲 Beetles | 131 |
| 🪲 True Bugs | 74 |
| 🦗 Grasshoppers & Orthoptera | 40 |
| 🪰 Flies | 52 |
| 🐌 Snails & Slugs | 24 |
| 🐛 Myriapods | 14 |
| 🦀 Isopods & Crustaceans | 15 |
| **Total** | **1,016 + 5 ssp** |

- **~880 native** · 136 introduced (non-native)
- **39 invasive species** flagged (ecological/economic harm)
- **15 taxa groups** across ~188 families
- **14 conservation-listed species** (IUCN, ESA, CESA, CA SSC)
- **3 federally Endangered** (Palos Verdes Blue, El Segundo Blue, Quino Checkerspot)
- **9 bumblebee species** including 3 CESA/IUCN-listed
- **2 fairy shrimp** (federally Endangered/Threatened vernal pool specialists)
- **106 arachnids** — spiders, scorpions, ticks, tarantulas, pseudoscorpions, solifuges, vinegaroons
- **Bidirectional NAME_ALIASES** for 30+ iNat reclassifications (Plebejus → Icaricia, Speyeria → Argynnis, Lycaena → Tharsalea, etc.)

## Features

- **Single-file PWA** — works offline after first load; installable on iOS/Android
- **iNaturalist integration** — photos via taxa/autocomplete API, cached in IndexedDB; life list via species_counts API
- **Satellite observation maps** — iNat occurrence data on ESRI basemap with LA County bounds
- **Introduced (✦) and Invasive (⚠ INV) badges** — non-native species flagged; invasive species causing ecological/economic harm highlighted in red
- **Conservation badges** — IUCN Red List, ESA, CESA, and CA SSC listings with detailed notes
- **Life list tracking** — enter your iNat username to see which LA County species you've observed, with per-taxon progress bars
- **Collapsible family chips** — family filter with species counts, zero-count auto-hide, A→Z sort toggle synced to photo grid order
- **Status/Observed filter chips** — filter by conservation status or life list observation status
- **Cross-taxon search** — search any species name from any tab, with "Also found in" links
- **Phenology bars** — monthly activity/flight period with peak months highlighted
- **Elevation display** — coast/lowland/foothill/mid-elevation/mountain range for each species
- **Host plant cross-references** — larval food plants and ecological associations
- **Alias-aware life list** — handles iNat reclassifications with bidirectional NAME_ALIASES
- **iOS edge-to-edge** — respects safe area insets on notched devices

## Architecture

Self-contained single HTML file (~540 KB). All species data, CSS, and JS inlined. No build step, no dependencies, no framework.

- Photos: fetched from iNat `/taxa/autocomplete`, cached in IndexedDB (`invertGuidePhotos`)
- Life list: iNat `species_counts` API with place_id=962 (LA County)
- Maps: ESRI satellite tiles + iNat observation overlay, bounds [[33.70,-118.95],[34.82,-117.65]]
- Fonts: EB Garamond (serif) + DM Sans (sans-serif) via Google Fonts
- Branding: dark forest green `#1A3C35`, muted gold `#BFA46E`, warm cream `#FAF8F4`

## Sources

This guide was compiled from the following authoritative references:

**Butterflies**
- Emmel & Emmel, *Butterflies of Southern California* (1973)
- Garth & Tilden, *California Butterflies* (1986)
- socalbutterflies.com

**General Entomology**
- Powell & Hogue, *California Insects* (1979)
- Hogue, *Insects of the Los Angeles Basin* (1993)

**Bees & Pollinators**
- California Bumble Bee Atlas (cabumblebeeatlas.org)
- BumbleBeeWatch.org
- Xerces Society for Invertebrate Conservation

**General Reference**
- BugGuide (bugguide.net)
- iNaturalist LA County checklists and observation data (inaturalist.org)
- Arroyos & Foothills Conservancy invertebrate surveys
- Essig Museum of Entomology, UC Berkeley
- UC Integrated Pest Management Program (ipm.ucanr.edu)

## Deployment

The deploy zip contains everything needed for Netlify drag-and-drop deployment:

```
index.html          # Complete self-contained PWA
sw.js               # Service worker for offline caching
manifest.json       # PWA manifest
_headers            # Cache control + security headers
_redirects          # Netlify redirect rules
icons/              # App icons (192px, 512px)
LICENSE             # GPL v3 + disclaimer
README.md           # This file
```

Canonical URL: `https://labugs.org`

## Species Data Schema

```javascript
{
  id: 'bp1',                    // Unique identifier
  cn: 'Pipevine Swallowtail',   // Common name
  sn: 'Battus philenor',        // Scientific name (iNat-compatible)
  fam: 'Papilionidae',          // Family — must match familyColors key
  st: 'rare',                   // Status: common|uncommon|rare|endangered|vagrant|extirpated|historical
  desc: '...',                  // Description (50–300 chars)
  elev: 'low,foot',             // Elevation: coast|low|foot|mid|high|wide
  mo: [3,4,5,6,7,8,9],          // Active/flight months (1–12)
  pk: [4,5],                    // Peak months (subset of mo)
  fm: {                         // Field marks (key-value pairs)
    Wingspan: '3–3.5 in',
    Upperside: '...',
    Habitat: '...',
    vs: '...',                  // Differentiation from similar species
  },
  hp: 'Aristolochia californica', // Host plants / ecological associations
  intro: true,                  // Non-native flag (optional)
  ssp: true,                    // Subspecies flag — excluded from headline counts (optional)
}
```

Species in `INTRO_SET` are displayed with a ✦ marker. Species in `INVASIVE_SET` receive an additional red ⚠ INV badge.

### Conservation Data

Species with formal conservation listings have entries in the `CONSERVATION` object:

```javascript
CONSERVATION['Danaus plexippus'] = {
  iucn: 'VU',                   // IUCN Red List category
  iucnFull: 'Vulnerable',       // Full IUCN label
  esa: 'Proposed Threatened',   // US Endangered Species Act
  cesa: 'Candidate',            // California ESA
  state: 'CA SSC',              // State listing (optional)
  note: '...',                  // Detailed conservation notes
};
```

## Contributing

Species additions, corrections, and field mark improvements are welcome. Priority areas for community contribution:

- **vs field marks** — many invertebrate look-alikes lack differentiation notes; top confusable pairs need `vs` entries
- **Ecological associations** — expand `hp` (host plant) data across all taxa, connecting to the companion [LA County Plant Guide](https://la-flora.org)
- **Native bee coverage** — LA County has 500+ native bee species; current 89 could expand significantly
- **Photo fetch accuracy** — large genera (Andrena, Lasioglossum, Habronattus, Neoscona) need manual verification of iNat photo results
- **Moth coverage** — many micro-moth families underrepresented
- **Conservation data** — verify IUCN/ESA/CESA listings are current

### Pre-Publish Audit Checklist

- [ ] 0 duplicate scientific names
- [ ] 0 missing required fields (id, cn, sn, fam, st, desc, mo, elev)
- [ ] 0 missing family colors for any family in species data
- [ ] Peak months (pk) are subset of active months (mo)
- [ ] INTRO_SET consistent with species `intro` flags
- [ ] Even backtick count in JS
- [ ] JS validates via `new Function(script)`
- [ ] Version synced across `<title>`, header `<span>`, and SW cache name
- [ ] Disclaimer present in footer and meta description

## License

GNU General Public License v3.0 — see [LICENSE](LICENSE) for full text and additional disclaimer.

Species data compiled from public sources. Photos loaded dynamically from iNaturalist (CC-licensed by individual photographers). This guide does not store or redistribute photographs.
