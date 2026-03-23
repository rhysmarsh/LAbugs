# LA County Field Guide Suite — Continuation Prompt

## Context

I'm building a suite of self-contained PWA field guides to the natural history of Los Angeles County. Two guides are live; more are planned. All share the same architecture, branding, and iNat API integration pattern. This prompt provides the context needed to:

1. **Backport new features from the Plant Guide (v2.020) to the Invertebrate Guide (labugs.org)**
2. **Create new guides** (Fungi first, then Birds, Herps, Marine) using the Plant Guide as the template

---

## Architecture (shared across all guides)

Single-file PWA. All species data, CSS, JS inlined in one `index.html`. No build step, no framework, no dependencies.

- **Photos**: fetched from iNat `/taxa/autocomplete`, cached in IndexedDB (persistent across sessions)
- **Life list**: iNat `species_counts` API with `place_id=962` (LA County)
- **Maps**: ESRI satellite tiles + iNat observation overlay, bounds `[[33.70,-118.95],[34.82,-117.65]]`
- **Fonts**: EB Garamond (serif) + DM Sans (sans-serif) via Google Fonts
- **Branding**: dark forest green `#1A3C35`, muted gold `#BFA46E`, warm cream `#FAF8F4`
- **SW cache**: `{guide-name}-v{version}`
- **Deploy**: Netlify drag-and-drop zip (index.html, sw.js, manifest.json, _headers, _redirects, icons/)

### CRITICAL BUILD LESSON
**Never** use `html.replace(/<script>[\s\S]*?<\/script>/, ...)` — causes HTML duplication and backtick corruption. Always:
```javascript
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
const mainMatch = scripts.reduce((a,b) => a[1].length > b[1].length ? a : b);
let script = mainMatch[1];
// ... modify script ...
html = html.substring(0, mainMatch.index) + '<script>' + script + '</script>' + html.substring(mainMatch.index + mainMatch[0].length);
```

### Species Data Schema (universal)
```javascript
{
  id: 'wil_0001',               // {taxon_prefix}_{number}
  cn: 'California Poppy',       // Common name
  sn: 'Eschscholzia californica', // Scientific name (must match iNat)
  fam: 'Papaveraceae',          // Family — must match familyColors key
  st: 'common',                 // common|uncommon|rare|endangered|vagrant|extirpated|historical
  dur: 'annual',                // Duration/growth form (guide-specific values)
  end: 'CA',                    // Optional endemic tag: CA|SoCal|Channel Islands|CA/Baja
  ipc: 'High',                  // Optional: Cal-IPC rating (plants only)
  desc: '...',                  // Description 50-300 chars
  elev: 'low,foot',             // coast|low|foot|mid|high|wide
  mo: [2,3,4,5,6,7],           // Active/bloom/flight months
  pk: [3,4,5],                  // Peak months (must be subset of mo)
  fm: {                         // Field marks (key-value, guide-specific)
    Height: '...', Color: '...', Habitat: '...',
    vs: '...',                  // Differentiation from similar species (bidirectional)
    Fire: '...',                // Fire ecology (optional)
  },
  hp: '...',                    // Ecological associations / host plants
  intro: true,                  // Non-native flag
  ssp: true,                    // Subspecies (excluded from headline counts)
}
```

---

## Guide 1: LA County Invertebrate Field Guide (labugs.org)

**Status**: Live at labugs.org, v2.01+
**Source**: Was in `/home/claude/v2/index.html` (file system resets between sessions — user will re-upload)
**Species**: ~1,016 across 15 taxa groups
**IDB name**: `invGuidePhotos`
**GitHub**: https://github.com/rhysmarsh/LA-bugs

### Taxa Groups (15)
🦋 Butterflies, 🦗 Moths, 🪲 Beetles, 🐝 Bees & Wasps, 🪰 Flies, 🐛 True Bugs, 🦟 Dragonflies & Damselflies, 🦎 Grasshoppers & Crickets, 🕷️ Spiders, 🦂 Scorpions & Relatives, 🐌 Snails & Slugs, 🦐 Crustaceans, 🪱 Worms, 🦠 Millipedes & Centipedes, 🪸 Other Invertebrates

### iNat Taxon IDs (invertebrates)
- butterflies: 47224 | moths: 47157 | beetles: 47208 | bees_wasps: 47201
- flies: 47822 | true_bugs: 47744 | dragonflies: 47792 | grasshoppers: 47651
- spiders: 47118 | scorpions: 47209 | snails: 47114 | crustaceans: 47743
- worms: 47491 | myriapods: 47207 | other: 1 (Animalia, filtered)

### Features PRESENT in LAbugs
- iNat photo fetch with IndexedDB persistent cache
- Life list via iNat species_counts
- NAME_ALIASES for reclassified taxa
- Alias-aware isObserved (isO) including trinomial → binomial fallback
- Phenology bars (ds-phen-bar)
- Elevation display (ds-elev)
- Host plant cross-references (ds-hp)
- IUCN/ESA/CESA conservation badges
- Cross-taxon search with "Also found in" links
- Status/Observed/Endemic filter chips
- Family color dots + family filter

### Features MISSING from LAbugs (backport from Plant Guide v2.020)
1. **Collapsible family chips** — families currently always visible, pushing content below fold. Plant Guide collapses by default with `▸ N groups` toggle (`famExpanded` state, auto-expand when filter active).
2. **Family count in chips** — Plant Guide shows `Asteraceae (82)` etc.
3. **Zero-count family filter** — `.filter(({cnt})=>cnt>0)` removes families with 0 species in current taxon.
4. **Taxonomic sort toggle** — `A→Z` / `APG IV` button (`famSortBtn`) for family chip + group header ordering. For invertebrates, adapt APG_ORDER to Linnaean/phylogenetic order.
5. **Family group headers sorted** — `.sort()` on `Object.entries(groups)` in rSp to match chip order.
6. **`vs` field marks for confusable species pairs** — bidirectional, 58 species have vs fields in plant guide. Many invertebrate look-alikes lack differentiation notes.
7. **Disclaimer footer** — LAbugs has no informational-purposes-only disclaimer or license link. Plant Guide uses compact footer: "Field guide by Rhys Marsh" → disclaimer with link → credits → Fork on GitHub.
8. **GPL v3 LICENSE + README** — LAbugs deployed without full GPL v3 text or repo documentation.
9. **Auto-version increment** — format `vN.NNN`, increment +.001 per build, sync title/header/SW.
10. **Header subtitle disclaimer** — brief "For informational purposes only" below species count.

### Backport Priority Order
1. Disclaimer + LICENSE (legal exposure)
2. Collapsible family chips (biggest UX win — content above fold)
3. Family count + zero-count filter + sorted headers
4. Taxonomic sort toggle (adapted for invertebrate taxonomy)
5. `vs` field marks for top confusable pairs
6. README + GPL v3

---

## Guide 2: LA County Plant, Moss & Lichen Field Guide (laplants.org)

**Status**: Ready for deploy, v2.020
**Source**: `/home/claude/plants/index.html` (or user will re-upload latest)
**Species**: 750 (749 non-ssp) across 10 taxa groups
**IDB name**: `plantGuidePhotos`
**SW cache**: `la-plant-guide-v2.020`
**GitHub**: https://github.com/rhysmarsh/LA-flora
**License**: GNU General Public License Version 3, 29 June 2007 (full text + disclaimer addendum)

### Taxa Groups (10)
🌸 Wildflowers (354), 🌿 Shrubs (102), 🌳 Trees (66), 🍃 Lichens (74), 🌾 Grasses (48), 🪨 Mosses (26), 🌵 Cacti (24), 🌱 Ferns (22), 🌊 Aquatic (18), 🪴 Vines (16)

### iNat Taxon IDs (plants)
- wildflowers/trees/shrubs/cacti/vines/aquatic: 47125 (Plantae, shared via idMap)
- grasses: 47162 | ferns: 121943 | mosses: 311295 | lichens: 54743

### Key Stats
- **749 species** (non-ssp) | 667 native | 82 introduced | 153 families
- **74 lichens** across 24 families (Parmeliaceae 20, Teloschistaceae 8, Physciaceae 7, Cladoniaceae 4, Lecanoraceae 4, Caliciaceae 4, Acarosporaceae 2, Verrucariaceae 2, etc.)
- **50 endemic** | **131 fire ecology** | **78 ecological associations**
- **44 Cal-IPC rated invasives** (15 High, 22 Moderate, 7 Limited)
- **58 species with `vs` confusable-pair field marks**

### Plant Guide — ALL features (reference for new guides)
- Everything in LAbugs PLUS:
- **Collapsible family chips** — `famExpanded` state, collapsed by default, toggle on header/`▸ N groups` tap, auto-expand when `familyFilter` active
- **Family count in chips** — `Asteraceae (82)` at 9px/50% opacity
- **Zero-count family filter** — `.filter(({cnt})=>cnt>0)` after sort
- **APG IV taxonomic sort toggle** — `famSort` state (`"alpha"` default), `famSortBtn` button renders `A→Z` or `APG IV`, sorts both chips and rSp group headers consistently via `APG_ORDER` const (153 families) + `APG_IDX` lookup. Button injected after conditional `groups</span>` in template — see Known Gotcha below.
- **Cal-IPC invasive badges** (`ipc` field: High/Moderate/Limited) — red/orange/gray DOM-injected
- **Duration badges** (`dur` field: annual/biennial/perennial) — orange/amber/green DOM-injected
- **Endemic badges** (`end` field: CA/SoCal/Channel Islands/CA/Baja) — navy/purple/teal DOM-injected
- **`vs` confusable species cross-references** — bidirectional field marks in `fm.vs`
- **153-family APG_ORDER array** for phylogenetic sorting (lichens → mosses → lycophytes → ferns → gymnosperms → basal angiosperms → monocots → core eudicots → rosids → asterids)
- **Compact disclaimer footer** — order: "Field guide by Rhys Marsh" → disclaimer (ftc class) with gold "terms & license" link → credits → "Fork this on GitHub →"
- **Header subtitle disclaimer** — "For informational purposes only — not a substitute for expert identification" at 9px below species count
- **Meta description disclaimer**
- **GPL v3 LICENSE** — full 674-line GNU General Public License Version 3, 29 June 2007 text + project disclaimer addendum + photo/data attribution (761 lines total)
- **README.md** — species stats, schema, sources, contributing guide
- **Auto-version tracking** — v2.020, format `vN.NNN`, sync title/header/SW

### Footer Structure (exact order)
```html
<footer class="ft">
  Field guide by Rhys Marsh
  <div class="ftc">For informational purposes only — not a substitute for expert identification.
    By using this app you agree to the <a href="...LA-flora/blob/main/LICENSE">terms & license</a>.</div>
  <div class="ftc">Data: iNaturalist · Photos: CC-licensed · Maps: ESRI + iNat · Ref: ...</div>
  <a href="...LA-flora">Fork this on GitHub →</a>
</footer>
```

---

## Guide 3: LA County Fungi Field Guide (NEW — to create)

**Planned URL**: lafungi.org
**Template**: Fork from Plant Guide v2.020 (closest taxonomic analog)
**IDB name**: `fungiGuidePhotos`
**iNat taxon ID**: 47170 (Fungi) | place_id: 962
**GitHub**: https://github.com/rhysmarsh/LA-fungi

### Proposed Taxa Groups
🍄 Agarics (gilled mushrooms) — Agaricales, Russulales
🪵 Polypores & Brackets — Polyporales, Hymenochaetales
🌰 Boletes — Boletales
🪸 Coral & Club Fungi — Clavariaceae, Ramariaceae
☁️ Puffballs & Earthstars — Lycoperdales, Geastrales
🍽️ Cup & Disc Fungi — Pezizales
🧫 Crust Fungi — Corticiaceae etc.
🫧 Jelly Fungi — Tremellales, Dacrymycetales, Auriculariales
🦠 Slime Molds — Myxomycetes (not true fungi but traditionally included)
🔬 Ascomycetes (misc) — morels, truffles, Xylaria, Cordyceps

### Schema Adaptations for Fungi
```javascript
{
  // Standard fields: id, cn, sn, fam, st, desc, elev, mo, pk, fm, hp, intro
  dur: 'saprobic',          // saprobic|mycorrhizal|parasitic|lichenized
  // dur badge colors: brown=saprobic, green=mycorrhizal, red=parasitic
  edibility: 'toxic',       // edible|edible-caution|inedible|toxic|deadly
  // edibility badge: green=edible, yellow=caution, gray=inedible, orange=toxic, red=deadly
  substrate: 'wood',        // wood|soil|dung|litter|other fungi|living plants
  fm: {
    Cap: '...', Gills: '...', Stem: '...', Spore_Print: '...',
    Odor: '...', Habitat: '...', Substrate: '...',
    vs: '...',              // Confusable species — CRITICAL for toxic look-alikes
    Edibility: '...',       // Detailed edibility notes with warnings
    Ecology: '...',         // Mycorrhizal associations, decomposition role
  }
}
```

### Key Fungi Species to Start (LA County iNat top 100+)
**Priority 1 — Common + Distinctive**:
Amanita phalloides (Death Cap), Amanita ocreata (Destroying Angel), Agaricus campestris, Coprinus comatus (Shaggy Mane), Chlorophyllum molybdites (Green-spored Parasol), Armillaria mellea (Honey Fungus), Pleurotus ostreatus (Oyster), Trametes versicolor (Turkey Tail), Ganoderma applanatum, Stereum hirsutum, Schizophyllum commune, Pisolithus arhizus, Lycoperdon perlatum, Helvella lacunosa, Morchella snyderi, Amanita muscaria, Russula brevipes, Lactarius alnicola, Suillus pungens, Boletus edulis s.l., Laccaria laccata, Marasmius oreades (Fairy Ring), Lepista nuda (Blewit), Cantharellus californicus, Tremella mesenterica (Witch's Butter), Auricularia auricula-judae, Xylaria hypoxylon (Candlesnuff), Xylaria polymorpha (Dead Man's Fingers), Aleuria aurantia (Orange Peel), Fuligo septica (Dog Vomit Slime)

**Priority 2 — Toxic look-alikes requiring vs field marks**:
- Amanita phalloides vs Agaricus campestris (#1 deadly confusion in California)
- Amanita ocreata vs Leucoagaricus leucothites
- Chlorophyllum molybdites vs C. rhacodes vs Agaricus
- Galerina marginata vs Pholiota/Kuehneromyces
- Omphalotus olivascens (Jack O'Lantern) vs Cantharellus (Chanterelle)

### Fungi-Specific Considerations
- **Edibility badges are CRITICAL** — #1 liability area. Disclaimer must be even more prominent than for plants.
- **Spore print color** is a key field mark — include in fm
- **Seasonality** in LA: primarily Nov–Mar (rain-dependent), some year-round (wood decomposers)
- **Substrate** matters more than habitat for fungi
- **Mycorrhizal associations** are the fungi equivalent of host plants (hp field)

---

## Future Guides (lower priority)

### LA County Bird Guide
- URL: labirds.org | iNat: 3 (Aves)
- Unique: seasonal abundance bars, eBird hotspot integration, song playback links
- Schema: `migration: 'resident|winter|summer|passage'`

### LA County Herps Guide
- URL: laherps.org | iNat: 26036 (Reptilia) + 20978 (Amphibia)
- Unique: venomous badge, nocturnal/diurnal indicator
- Small species count (~80 total) — deep per-species content

### LA County Marine Guide
- URL: lamarine.org | iNat: various
- Unique: tidal zone indicator, depth range

---

## Build Workflow (for any guide)

### Creating a New Guide from Template
1. Copy Plant Guide `index.html` as starting point
2. Find/replace: guide name, IDB name, SW cache name, canonical URL, OG tags, GitHub URL
3. Replace SPECIES_DATA with new taxa
4. Replace TAXA object with new taxa groups (emoji, label, iNatTaxonId, familyColors)
5. Replace TAXA_ORDER array
6. Update APG_ORDER for the relevant taxonomic scope (or replace with appropriate phylogenetic order)
7. Adjust idMap for iNat life list taxon ID deduplication
8. Update manifest.json, sw.js, _headers, icons
9. Adjust badge rendering (dur/end/ipc) for guide-specific badge types
10. Set up footer: byline → disclaimer with license link → credits → Fork GitHub link
11. Run pre-publish audit

### Pre-Publish Audit Checklist
- 0 duplicates (exact sn match)
- 0 near-duplicates (typo sn variants)
- 0 same-name collisions within taxon
- 0 missing required fields (id, cn, sn, fam, st, desc, mo, elev)
- 0 missing family colors
- 0 bloom/flight period inconsistencies (pk ⊂ mo)
- 0 invalid status/elev/endemic/ipc values
- 0 INTRO_SET inconsistencies
- 0 cross-categorization errors
- Even backtick count
- JS validates via `new Function(script)`
- Version consistency (title = header = SW cache)
- Disclaimer present (header + footer + meta)
- All families in APG_ORDER / sort order array

### Version Convention
- Format: `vN.NNN` (e.g., v2.020)
- Increment +.001 on each build
- Sync across: `<title>`, header `<span>`, SW cache name

### Known Gotcha: Template Literal Injection
When injecting HTML into template literals in rTI, the family group count uses conditional pluralization: `group${fams.length===1?'':'s'}</span>`. The literal string `groups</span>` does NOT exist in the source. The correct injection point is after `s'}</span>`. The sort button was originally lost because of this mismatch.

---

## Source References (shared across guides)

### Vascular Plants
Muns & Chester SMM Checklist (1999/2002), Chester/Fisher/Strong Lower Eaton Canyon (2003), Cooper Flora of Griffith Park (2015), Raven/Thompson/Prigge Flora of SMM (1986), Jepson eFlora, Calflora, CNPS, Theodore Payne, Las Pilitas, CalPhotos, Calscape, Xerces Society

### Invertebrates
Powell & Hogue Insects of the Los Angeles Basin (1979), Emmel & Emmel Butterflies of SoCal (1973), Hogue Insects of the Los Angeles Basin (1993), BugGuide, iNat LA County checklists

### Fungi (for new guide)
Desjardin/Wood/Stevens California Mushrooms (2015), Arora Mushrooms Demystified (2nd ed.), Siegel/Schwarz Mushrooms of the Redwood Coast (2016), MycoPortal, Mushroom Observer, iNat Fungi of Southern California project

### Lichens
Tucker & Ryan Revised Catalog of CA Lichens (2006/2013), CALS SoCal Mini Guide, Sharnoff California Lichens

### Mosses
Malcolm/Shevock/Norris California Mosses (2009), CA Moss eFlora

---

## Instructions for Claude

When continuing this project:
1. **User will upload the current guide file(s)** — do not assume files persist from previous sessions
2. **Read the file first** before making changes — extract SPECIES_DATA, TAXA, and key functions
3. **Use the safe rebuild pattern** (see CRITICAL BUILD LESSON above)
4. **Always validate JS** via `new Function(script)` before saving
5. **Always run the pre-publish audit** after species data changes
6. **Increment version** on every build (+.001), sync title/header/SW
7. **Match the user's working style**: proceed on assumptions, peer-level depth, institutional-quality output, clear positions, proactive risk flags
8. **Watch for the template literal injection gotcha** — see "Known Gotcha" above
