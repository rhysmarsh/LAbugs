# LA County Field Guide Suite — Continuation Prompt

## Context

I'm building a suite of self-contained PWA field guides to the natural history of Los Angeles County. Three guides are live; more are planned. All share the same architecture, branding, and iNat API integration pattern. This prompt provides the context needed to:

1. **Sync features between Plant Guide (la-flora.org v3.012) and Invertebrate Guide (labugs.org v3.023, 3,439 species)**
2. **Create new guides** (next: la-fauna.org vertebrate guide) using the Plant Guide v3.015 as the template
3. **Maintain and expand existing guides** — cross-link ecosystem now spans 4 guide domains + All About Birds
4. **Backport cross-link features** to labugs.org and lafungi.org

---

## Architecture (shared across all guides)

Single-file PWA for most guides. **Plant Guide v3+ uses two-file architecture** with externalized SPECIES_DATA for scale.

- **Photos**: fetched from iNat `/taxa/autocomplete`, cached in IndexedDB (persistent across sessions)
- **Life list**: iNat `species_counts` API with `place_id=962` (LA County)
- **Maps**: ESRI satellite tiles + iNat observation overlay, bounds `[[33.70,-118.95],[34.82,-117.65]]`
- **Fonts**: EB Garamond (serif) + DM Sans (sans-serif) via Google Fonts
- **Branding**: dark forest green `#1A3C35`, muted gold `#BFA46E`, warm cream `#FAF8F4`
- **SW cache**: `{guide-name}-v{version}`
- **Deploy**: Netlify drag-and-drop zip (index.html, sw.js, manifest.json, _headers, _redirects, icons/, and species-data.json for v3+ guides)
- **File size**: Single-file architecture scales to ~600KB before performance concerns. Fungi guide reached 594KB at 567 species. Plant guide exceeded this at 824 species, triggering v3 migration.

### v3 Two-File Architecture (Plant Guide v3.015+)
```
index.html          — 90 KB (CSS + JS code + config objects + filters + cross-links)
species-data.json   — 1,082 KB (all SPECIES_DATA, loaded async)
sw.js               — 1 KB (network-first + cache-fallback)
icons/              — 5 production icons (128, 180, 192, 512, 1024px)
```
**Why v3**: At 824 species (591 KB single-file), the plant guide hit the performance ceiling. Externalizing SPECIES_DATA to a separate JSON file:
- Drops index.html to 68 KB (532 KB headroom for code features)
- Allows species-data.json to grow to 2-5 MB+ (3,000-8,000 species)
- SW caches both files for offline use
- Loading overlay with branded spinner during async data fetch
- Graceful error handling with cache fallback if network fails

**Init chain (v3.015)**:
```
loadState() → register SW → loadSpeciesData() → [hydrateCache() → render() → checkDeepLink()] + fetchLL()
```
SW registers first so its cache is available as fallback for `loadSpeciesData()`.

**Deep-link support (bidirectional with labugs v3.023)**:
- `?species=Scientific+name` — preferred format (used by both guides)
- `#species/Scientific_name` — legacy hash format (labugs also sends this)
- `checkDeepLink()` checks both URLSearchParams and location.hash on init
- `findAndOpenSpecies(query)` handles `+` and `_` as space, case-insensitive

**When to migrate other guides to v3**: When they exceed ~550 KB. Fungi (594 KB) is a candidate. Labugs (537 KB) is approaching. The migration script is reusable.

### CRITICAL BUILD LESSONS (from Plant + Fungi builds)

**1. Never use regex replace on script blocks:**
```python
# WRONG — causes HTML duplication and backtick corruption
html.replace(/<script>[\s\S]*?<\/script>/, ...)

# RIGHT — find largest script block by index
scripts = list(re.finditer(r'<script>([\s\S]*?)</script>', html))
main = max(scripts, key=lambda m: len(m.group(1)))
js = main.group(1)
# ... modify js ...
html_new = html[:main.start()] + '<script>' + js + '</script>' + html[main.end():]
```

**2. activeTaxon initialization:**
Template has `activeTaxon:'wildflowers'`. MUST change to the first taxa group key for each new guide (e.g., `'agarics'` for fungi, `'lizards'` for herps). Failure causes blank first load with no photos — the render chain produces an empty species list when the key doesn't exist in SPECIES_DATA.

**3. Structural validation — backticks only:**
Brace/paren/bracket counting is unreliable because JSON string values contain `()` `{}` `[]` characters (e.g., "(PSK)" in hp text). Only backtick count is a reliable structural test for template literal integrity. Use `json.loads()` / `json.dumps()` for data validation.

**4. Species group placement requires rules:**
The fungi build had 17 species misplaced (stinkhorns in agarics, boletes in agarics, polypores in agarics). Each guide needs explicit group-assignment rules. For herps: snakes vs lizards, frogs vs salamanders, turtles vs tortoises.

**5. Filter slot is guide-specific:**
The plant guide uses an endemic filter. Fungi replaced it with an edibility filter (endemic was useless — 1 species). Each guide should evaluate what filter is most useful for its taxa: venomous (herps), migratory (birds), native/introduced (all).

**6. Scientific name verification is mandatory:**
The fungi build found 3 duplicates from obsolete synonyms (*G. autumnalis* = *G. marginata*, *O. olearius* = *O. olivascens*, *P. mutabilis* = *K. mutabilis*). All scientific names must be verified against iNat current taxonomy before publish.

**7. Gray family color defaults (#999) cause multiple cleanup rounds:**
Assign real colors immediately when adding new families. Never use #999 as a placeholder.

**8. INTRO_SET must sync with species `intro` flags:**
Easy to forget. Verify after every species addition round.

**9. README drifts fast:**
README showed 256 species when guide had 497. Either update README with every expansion round or generate stats programmatically.

**10. NEVER use lazy regex to extract/replace SPECIES_DATA:**
The pattern `r'const SPECIES_DATA=(\{.*?\});\s'` with `re.DOTALL` can match a `};` inside a JSON string value (e.g., a description containing `"...};"`), causing the replacement to capture only part of the data and leave an orphaned JSON fragment that breaks the JS. This caused a production-breaking bug in the fungi guide (blank page, no render). Also, `json.dumps()` output can clobber adjacent code if the regex match boundaries are wrong — the `APG_IDX` builder `forEach((f,i)=>APG_IDX[f]=i)` was eaten by a SPECIES_DATA replacement. **Always use brace-depth counting with string awareness:**
```python
# Find the opening brace after 'const SPECIES_DATA='
start = js.find('const SPECIES_DATA=') + len('const SPECIES_DATA=')
depth = 0; in_str = False; esc = False
for i in range(start, len(js)):
    c = js[i]
    if esc: esc = False; continue
    if c == '\\' and in_str: esc = True; continue
    if c == '"' and not esc: in_str = not in_str; continue
    if in_str: continue
    if c == '{': depth += 1
    elif c == '}':
        depth -= 1
        if depth == 0:
            sd_json = js[start:i+1]  # complete JSON object
            break
```

### Species Data Schema (universal)
```javascript
{
  id: 'wil_0001',               // {taxon_prefix}_{number}
  cn: 'California Poppy',       // Common name
  sn: 'Eschscholzia californica', // Scientific name (must match iNat current taxonomy)
  fam: 'Papaveraceae',          // Family — must match familyColors key
  st: 'common',                 // common|uncommon|rare|endangered|vagrant|extirpated|historical
  dur: 'annual',                // Duration/trophic/activity (guide-specific values)
  desc: '...',                  // Description 50-300 chars
  elev: 'low,foot',             // coast|low|foot|mid|high|wide
  mo: [2,3,4,5,6,7],           // Active/bloom/flight/fruiting months
  pk: [3,4,5],                  // Peak months (must be subset of mo)
  fm: {                         // Field marks (key-value, guide-specific)
    vs: '...',                  // Differentiation from similar species
  },
  hp: '...',                    // Ecological associations (target: 100% coverage)
  end: 'CA',                    // Optional endemic tag: CA|SoCal|Channel Islands|CA/Baja
  intro: true,                  // Non-native flag (optional)
  ssp: true,                    // Subspecies — excluded from headline counts (optional)
  // Guide-specific fields:
  ipc: 'High',                  // Cal-IPC rating (plants only)
  edibility: 'toxic',           // edible|edible-caution|inedible|toxic|deadly (fungi only)
  venomous: true,               // Venomous flag (herps only)
}
```

### SEO Template (apply to ALL new guides from the start)
```html
<meta name="description" content="{keyword-rich, species count, key features}">
<meta property="og:url" content="https://{domain}">
<meta property="og:type" content="website">
<meta property="og:title" content="{Guide Name} — {N} Species">
<meta property="og:description" content="{concise feature summary}">
<meta property="og:image" content="https://{domain}/icon-512.png">
<meta property="og:locale" content="en_US">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#1A3C35">
<meta name="robots" content="index, follow">
<meta name="author" content="Rhys Marsh">
<meta name="keywords" content="{guide-specific keywords}">
<link rel="canonical" href="https://{domain}">
<script type="application/ld+json">{ WebApplication schema }</script>
```

### Cross-Reference Verification (pre-publish, ALL guides)
1. **Scientific name currency** — verify all names against iNat current taxonomy. Flag obsolete synonyms.
2. **LA County occurrence** — verify each species has iNat observations in place_id=962. Flag zero-observation species.
3. **Index Fungorum / ITIS / iNat alignment** — verify accepted names match nomenclatural authorities.
4. **Safety classification cross-reference** — for guides with safety implications (fungi edibility, herps venomous), verify against primary references and NAMA/poison control data.
5. **NAME_ALIASES for reclassifications** — add bidirectional aliases for recently reclassified taxa to maintain life list matching.

### Cross-Guide Linking
For taxa that overlap between guides (e.g., lichens in both flora and fungi), add a cross-reference note rather than duplicating. Pattern: brief note in guide body + link to companion guide.

---


## Guide 1: LA County Invertebrate Field Guide (labugs.org)

**Status**: v3.023 — deploy-ready, 3,439 species
**Species**: 3,439 (3,434 main + 5 ssp) across 15 taxa groups
**Architecture**: Multi-file split (index.html 77 KB + 15 data/*.json files ≈ 1,884 KB total)
**IDB name**: `invertGuidePhotos`
**SW cache**: `labugs-v3023`
**GitHub**: https://github.com/rhysmarsh/LA-bugs

### Key Metrics
- **3,439 species** | 100% enriched descriptions (all ≥111 chars, zero templates)
- **hp ecological associations**: avg 89 chars, 2,886 unique (83%), 0 ≥5-share duplicate groups, 45 scholarly citations (primary literature), 146 vertebrate prey refs, 33 fungi cross-refs
- **700 cross-links** to la-flora.org via `xlink` field — all species-level targets (0 spp./family), all verified against description content
- **Deep-link support**: `?species=` (preferred), `?search=` (filtered grid), `#species/` (legacy hash)
- **`findAndOpenSpecies()` with NAME_ALIASES** — handles reclassified taxa (Agraulis→Dione, Speyeria→Argynnis, P. cresphontes→P. rumiko)
- **Origin tracking**: `INTRO_SET` (345) + `INVASIVE_SET` (71) + `ENDEMIC_SET` (59) as separate Sets
- **CONSERVATION** object with 15 rare/endangered species (Quino Checkerspot, Palos Verdes Blue, fairy shrimp, declining bumblebees)
- **Badge layout**: `.badge-col` flex column stacking INV/INTRO pill above status pip on photo cards
- **Search debounce**: 150ms (`clearTimeout/_searchTimer/setTimeout(rSp,150)`)
- **Network-first SW** — fetch-then-cache with cache-fallback (matching flora pattern)
- **Cross-guide footer nav** to la-flora.org + lafungi.org
- **Production icons**: 5 sizes (128, 180, 192, 512, 1024px) from native 1024px butterfly source
- **Full SEO**: JSON-LD WebApplication, OG tags, canonical, keywords, author, robots
- **Multi-file data**: 15 per-group JSON files loaded in parallel via `loadAllData()`
- **Taxa bar order**: moths(574) → beetles(567) → trueBugs(470) → flies(403) → wasps(298) → arachnids(281) → snails(200) → nativeBees(177) → butterflies(153) → orthoptera(144) → dragonflies(72) → myriapods(37) → hoverflies(36) → crustaceans(18) → bumblebees(9)

### Key Architecture Differences from Plant Guide
| Feature | Plant (la-flora.org) | Invertebrate (labugs.org) |
|---|---|---|
| Data files | 1 (species-data.json) | 15 (data/{group}.json) |
| Origin tracking | `est` field per species | 3 separate Set objects |
| Outbound cross-links | Regex maps in `rHP()` (201 entries) | `xlink` field in data + `rXL()` (700 species) |
| Badge layout | `.badge-col` flex column | ✅ `.badge-col` flex column (synced) |
| SW pattern | Network-first | ✅ Network-first (synced) |
| Search debounce | 150ms | ✅ 150ms (synced) |
| NAME_ALIASES | In `isO()` for life list | ✅ Also in `findAndOpenSpecies()` for deep-links |
| Icons | 5 sizes | ✅ 5 sizes (synced) |

### Sync Status
**Fully synced with flora**: `.badge-col`, network-first SW, 150ms debounce, 5 production icon sizes, `findAndOpenSpecies()` with NAME_ALIASES.

**Bugs → Plant patterns to adopt** (when plant guide scales):
1. `xlink` field in data (more maintainable than regex maps — 700 species proving the pattern)
2. `ENDEMIC_SET` as separate Set (cleaner than mixing with est field)
3. Multi-file split (when plant guide exceeds ~3,000 species)

### hp Quality State (v3.023)
- **Coverage**: 100% (3,439/3,439)
- **avg**: 89 chars | **med**: 88 | **min**: 30
- **Unique**: 2,886 (83%) — remaining 553 ≥2-share are legitimate shared ecology (congeners)
- **Scholarly citations**: 45 species with primary literature (Eisner, Cameron, Pellmyr, Rivera et al., Federal Register listings)
- **Vertebrate prey refs**: 146 species reference birds/bats/lizards/fish (seeds for la-fauna.org cross-links)
- **Fungi cross-refs**: 33 species reference lafungi.org
- **Quality checks passed**: 0 lowercase starts, 0 double "eaten by", 0 generic "small mammals", 0 filler, 0 hp/desc plant conflicts, 0 fabricated plant associations
- **Enrichment status**: Diminishing returns reached after ~8 iterative passes. Recommend 0-1 more iterations before shifting to new guide creation.

### Crustaceans Group Note
The `isopods` group (key retained for backward compat) is labeled "Crustaceans" in the UI because it includes 3 non-isopod species: *Megalorchestia californiana* (amphipod, Talitridae), *Streptocephalus woottoni* (FE fairy shrimp), and *Branchinecta lynchi* (FT fairy shrimp).

### Critical Build Lessons (labugs-specific)
- **#22**: `findAndOpenSpecies()` must check `NAME_ALIASES` as fallback — reclassified taxa from flora deep-links silently fail otherwise
- **#23**: `xlink` targets must be species-level (`Quercus agrifolia`, not `Quercus spp.`) — genus-level names don't resolve as deep-links
- **#24**: Cross-link verification must check description content — auto-matching by keyword produces ~25% false positives (976 auto-generated → 700 after three rounds of verification)
- **#25**: Search debounce (150ms) is essential at 3,439 species — `rSp()` on every keystroke causes visible lag
- **#26**: Badge-col flex container replaces inline `top:24px` hacks — never position badges with conditional inline styles
- **#27**: hp deduplication at scale: mine first-sentence keywords, desc ecological content, then CN differentiators. Three passes reduced ≥5-share from 1,965 to 0.
- **#28**: Size measurements belong in `desc`, not `hp` — unless the size IS the ecological claim (cited superlatives like "Largest NA scorpion")


---

## Guide 2: LA County Plant, Moss & Lichen Field Guide (la-flora.org)

**Status**: v3.015 — deploy-ready, all quality + desc consistency checks passed, production icons installed
**Species**: 1,476 across 10 taxa groups (533 wildflowers, 105 trees, 391 shrubs, 162 grasses, 46 ferns, 35 cacti, 16 vines, 34 aquatic, 26 mosses, 128 lichens)
**Architecture**: v3 two-file (index.html 90 KB + species-data.json 1,082 KB)
**IDB name**: `plantGuidePhotos`
**SW cache**: `la-plant-guide-v3.015`
**GitHub**: https://github.com/rhysmarsh/LA-flora
**License**: GPL v3 + disclaimer

This is the **template source** for all new guides. Fork v3.015 and adapt.

### Key Metrics
- **1,476 species** (1,473 main + 3 ssp) | 10 taxa groups | v3 two-file architecture
- **100% hp ecological association coverage** (1,476/1,476) — all species-specific, zero template notes
- **Deep ecological data**: 731 species (50%) with named bee families, 882 (60%) with named bird species, 281 (19%) with named mammals/herps, 221 (15%) with fire ecology, 217 (15%) with butterfly/moth species, 147 (10%) with indigenous ethnobotany, 10 with sourced extraordinary claims
- **29/29 butterfly species** and **11/11 moth species** documented on host/nectar plants
- **86 bird species** linkable to All About Birds (Cornell Lab / Merlin)
- **4 endangered bee species** documented: Bombus crotchii, B. occidentalis, Osmia ribifloris, Habropoda depressa
- **9 oak species** with "Distinguished from" comparative identification notes
- **100% est field coverage** — every species tagged native/introduced/invasive
- **Full SEO** — JSON-LD WebApplication schema, OG tags, canonical, keywords, author, robots
- **Cross-link ecosystem** — 201 entries linking to 3 external resources (labugs.org, allaboutbirds.org, la-fauna.org). All 201 entries verified alive (0 dead). 86 BIRD_LINKS, 44 BUG_LINKS, 42 FAUNA_LINKS, 29 GROUP_LINKS. Generic mycorrhizal links to lafungi.org removed (no specific fungal species available).
- **Deep-link URL support** — `?species=Scientific+name` opens directly to detail sheet
- **Cross-guide footer nav** to labugs.org and lafungi.org
- **Search debounce** (150ms) for performance on large species lists
- **Async data loading** with branded loading overlay and cache fallback
- **Network-first SW** — caches index.html + species-data.json + all 5 icon sizes for offline use
- **CONSERVATION object** with CNPS/ESA/CESA badges for 38+ rare/endangered species
- **INTRO_SET** for 420 introduced species with Cal-IPC ratings where applicable
- **INV/INTRO badges on photo cards** — red `⚠ INV` or orange `INTRO` pill on cards, stacked via `.badge-col` flex column
- **Production app icons** — custom botanical field guide icon at 128, 180, 192, 512, 1024px

### Coverage Analysis (iNat gap audit verified, ≥2 RG obs)
Full audit run 2026-03-25: 908 research-grade species queried, 1,476 in guide.
- **Wildflowers**: 533 — good coverage (Fabaceae, Convolvulaceae, Solanaceae well represented)
- **Trees**: 105 — comprehensive (native + major introduced, 3 rescued from wildflowers)
- **Shrubs**: 391 — comprehensive (includes many Asteraceae species)
- **Grasses**: 163 — good coverage (Poaceae, Cyperaceae, Juncaceae)
- **Ferns**: 46 — comprehensive
- **Cacti**: 35 — comprehensive
- **Lichens**: 128 — good coverage
- **Aquatic**: 34 — moderate (not all queried by gap finder)
- **Mosses**: 26 — moderate (fewer iNat observations for this group)
- **Vines**: 16 — moderate (not all queried by gap finder)

**Establishment breakdown**: 1,056 native / 371 introduced / 50 invasive
**species-data.json**: 1,082 KB — capacity for ~3,000 spp at 2 MB

### Ecological Enrichment Sources (v3.015)
Ecological associations verified against published sources:
- **Pollinator**: Xerces Society CA pollinator lists, Las Pilitas butterfly-plant database, UC Riverside entomology, Art Shapiro butterfly database (UC Davis)
- **Bird**: LA Audubon residential yard study (2022), eBird LA County, California Wildlife Habitat Relationships System (CWHR), California Chaparral Institute
- **Fire ecology**: Keeley & Fotheringham fire ecology database, CA Chaparral Institute
- **Indigenous ethnobotany**: Timbrook *Chumash Ethnobotany* (2007), Bean & Saubel *Temalpakh* (1972), McCawley *First Angelinos* (1996)
- **Conservation**: CNPS Rare Plant Program, USFWS Recovery Plans, CDFW SSC lists
- **Sourced claims**: Jepson eFlora, UC Berkeley, UC Davis, Xerces Society, USFWS, USDA, Guinness

### Ecological Enrichment Stopping Point (v3.015)
Enrichment reached natural diminishing returns after ~12 iterative passes:
- Remaining 213 native species without birds are mostly rare/uncommon small annuals where seed predation is undocumented
- Remaining 100 species with generic "native bees" are mostly wind-pollinated grasses/sedges where bee mention should be removed rather than upgraded
- Further enrichment risks introducing unverifiable associations
- **Recommendation**: ecological enrichment is complete. Next work should focus on guide creation (la-fauna.org), fungi guide backport, and labugs reciprocal links

### Plant Guide-Specific Build Notes
- `activeTaxon:'wildflowers'` — the default first-load group
- `INTRO_SET` — non-native species set (no `INVASIVE_SET` — unlike labugs)
- `CONSERVATION` object — CNPS/ESA/CESA conservation badges
- Badges: `renderDurBadge`, `renderEndemicBadge`, `renderIpcBadge`, `renderEstBadge`
- **Filter layout**: two-row compact design — Row 1: All/Common/Uncommon/Rare/Endangered (+Seen/Unseen when logged in); Row 2: Native/Intro/Invasive/Endemic. Zero-height div forces the line break.
- `NAME_ALIASES` — bidirectional iNat reclassification mapping (Pennisetum↔Cenchrus, Cheilanthes↔Myriopteris, Piperia↔Platanthera + others)
- Cross-taxon search: queries across all 10 groups when no match in active group
- **Establishment filter**: Native / Introduced / Invasive toggle buttons in filter bar
- `est` field on every species: `'native'` | `'introduced'` | `'invasive'`
- `renderEstBadge()` renders orange (intro) or red (invasive) badge on detail sheet
- **INV/INTRO badges on photo cards**: `.badge-col` flex column stacks establishment pill above rarity pip (top-left), observed ✓ stays top-right. CSS: `.inv-pill` (red), `.intro-pill` (orange), `.badge-col` (flex column container)
- **Cross-guide deep links to labugs.org**: `rHP()` replaces 38 butterfly/moth species names and ~15 bee/moth group terms with clickable `<a>` links. Species links use `?species=Scientific+name` deep-link format. Group links use `#groupKey` hash format. 465 plant species (32%) have at least one cross-link.
- **Deep-link URL parser**: `findAndOpenSpecies(query)` searches all taxa groups by SN or CN, switches group, opens detail sheet. Triggered on init via `URLSearchParams`. This is the inbound handler — labugs v3.023 has `findAndOpenSpecies()` with NAME_ALIASES support for reclassified taxa.
- **Taxa bar PWA fix (v3.015 — RESOLVED)**: Uses `top: var(--safe-top)` with NO padding or margin on the sticky taxa bar, plus a fixed `.notch-bg` div that fills the notch area with background color when the bar is stuck. This is the ONLY approach that works on iOS Safari PWA. See Build Lesson #22 for the full history of failed approaches and the working solution.
- **Intro mark / badge font fix**: `.intro-mark`, `.inv-pill`, `.intro-pill` all use `font-family:var(--fb);font-style:normal` to prevent italic serif inheritance from `.csn`

### Taxonomy Scrub (v3.015)
Resolved during pre-publish audit:
- **3 duplicates removed**: Pennisetum setaceum (=Cenchrus setaceus), Cheilanthes newberryi (=Myriopteris newberryi), Piperia cooperi (=Platanthera cooperi)
- **1 duplicate removed**: Cenchrus clandestinus (renamed from Pennisetum clandestinum, collided with existing entry from gap audit)
- **3 trees rescued from wildflowers**: Robinia pseudoacacia, Erythrina afra, Gleditsia triacanthos
- **8 Cal-IPC High species fixed**: Delairea odorata (Cape Ivy), Oxalis pes-caprae, Cynara cardunculus, Lepidium latifolium, Genista monspessulana, Spartium junceum, Centaurea stoebe, Cenchrus setaceus — all upgraded from `est:'introduced'` to `est:'invasive'`
- **15 genus-only common names fixed** (e.g., "Heterotheca sp." → "Erect Goldenaster")
- **1 false ssp flag removed**: Senecio lyonii
- **Q. agrifolia var. oxyadenia**: ssp flag and ID corrected

---

## Guide 3: LA County Fungi Field Guide (la-fungi.org)

**Status**: v2.004 — deploy-ready, 23/23 audit checks passed
**Species**: 567 across 10 taxa groups
**IDB name**: `fungiGuidePhotos`
**SW cache**: `la-fungi-guide-v2.004`
**GitHub**: https://github.com/rhysmarsh/LA-fungi
**License**: GPL v3 + disclaimer
**iNat taxon IDs**: 47170 (Fungi), 47685 (Slime Molds) | place_id: 962

### Taxa Groups (10)
```
🍄 Agarics (245) | 🪵 Polypores (61) | 🌰 Boletes (34) | 🪸 Coral & Club (23)
☁️ Puffballs (29) | 🍽️ Cup Fungi (37) | 🧫 Crust Fungi (27) | 🫧 Jelly Fungi (22)
🦠 Slime Molds (23) | 🔬 Ascomycetes (66)
```

### Key Metrics
- **567 species** | 310 genera | 140 families | 594KB
- **10 deadly** | 53 toxic | 99 caution | 111 edible | 294 inedible
- **0 edible/caution species without vs notes** (318 total vs notes)
- **100% hp ecological association coverage** (567/567)
- **Full SEO** — JSON-LD, OG tags, canonical, keywords, structured data
- **All 23 audit checks passed**
- **Edibility filter** verified functional (was broken in initial template fork — plant guide endemic logic)
- **isO life list matching** enhanced with NAME_ALIASES for reclassified taxa

### Fungi-Specific Schema Adaptations
```javascript
{
  dur: 'saprobic',          // saprobic|mycorrhizal|parasitic|lichenized (replaces plant dur)
  edibility: 'toxic',       // edible|edible-caution|inedible|toxic|deadly (NEW field)
  fm: { Cap, Gills, Stem, Spore_Print, Odor, Habitat, Substrate, vs, Edibility, Ecology }
}
```

### Fungi Build Decisions (precedent for future guides)
- **Lichens excluded** — covered in la-flora.org. Cross-reference note added.
- **Psilocybin species included** as `edibility:"toxic"` with factual legal notes (standard field guide practice per Desjardin/Arora).
- **Endemic filter replaced** with edibility filter (only 1 endemic fungal species in LA County).
- **Stinkhorns, bird's nests, puffball-like fungi** moved from agarics to puffballs (gasteroid fungi).
- **Gomphidiaceae** moved from agarics to boletes.
- **Practical species ceiling**: ~500-600 for photo-identifiable macrofungi. Guide reached 567 at 594KB (approaching ~600KB file size ceiling).
- **Edibility filter required code fix** — plant template had endemic filter logic (`'endemic'`/`'non-endemic'`) that never matched edibility chip values (`'edible'`/`'toxic'`/`'inedible'`). Chips highlighted but species never filtered. Must verify filter logic matches chip data-attributes when adapting template.
- **isO life list matching** needed NAME_ALIASES integration — iNat reclassifications caused silent match failures.

### Fungi Backport Priority (from Plant Guide v3.015)
Features to backport from the plant guide to the fungi guide, in priority order:
1. **v3 architecture migration** — fungi at 594KB is at single-file ceiling. Migrate to species-data.json + index.html for expansion headroom. Reuse plant guide migration script.
2. **Establishment filter** — add `est` field (native/introduced) and filter UI. Most fungi are native but some (e.g., Agaricus bisporus, Coprinopsis atramentaria) are introduced. Tag all 567 species.
3. **renderEstBadge()** — port the badge function and wire into detail sheet alongside edibility badge.
4. **iNat gap audit** — build fungi-specific gap-finder tool querying taxon_id 47170 (Fungi) + 47685 (Slime Molds). Run full audit for species expansion.
5. **Search debounce** — if not already present, add 150ms debounce on search input.
6. **Network-first SW** — upgrade from cache-first to network-first + cache-fallback (v3 pattern).
7. **hp quality audit** — verify all 567 hp notes are species-specific. Re-run the enhancement methodology used for plant guide.

### Fungi Sources
Desjardin/Wood/Stevens *California Mushrooms* (2015), Arora *Mushrooms Demystified* (2nd ed.), Siegel/Schwarz *Mushrooms of the Redwood Coast* (2016), MykoWeb/CAF (mykoweb.com — 862 CA species), MushroomExpert.com (Michael Kuo), NAMA Poison Case Registry, LAMS (lamushrooms.org), iNaturalist, Index Fungorum, GBIF, Catalogue of Life

---

## Guide 4: LA County Non-Avian Vertebrates Field Guide (NEW — to create)

**Planned URL**: lawildlife.org
**Template**: Fork from Plant Guide v3.015
**IDB name**: `vertGuidePhotos`
**GitHub**: https://github.com/rhysmarsh/LA-vertebrates
**iNat taxon IDs**: 26036 (Reptilia) + 20978 (Amphibia) + 40151 (Mammalia) + 47178 (Actinopterygii, freshwater only) | place_id: 962
**Primary references**: CaliforniaHerps.com (Gary Nafis), Jameson & Peeters *Mammals of California* (2004), Moyle *Inland Fishes of California* (2002)
**Local authority**: RASCals (NHMLAC herps), LA Urban Coyote Project, Santa Monica Mountains NRA wildlife surveys

### Proposed Taxa Groups (11)
🦎 Lizards — ~20 species (Western Fence Lizard, Side-blotched, Alligator Lizards, Geckos, Skinks, Whiptails, Horned Lizards, Legless Lizards, Chuckwalla)
🐍 Snakes — ~20 species (Gopher Snake, Kingsnake, Racers, Rattlesnakes, Ring-necked, Night Snake, Rosy Boa)
🐢 Turtles & Tortoises — ~5 species (Western Pond Turtle + introduced sliders/softshells, Desert Tortoise at range edge)
🐸 Frogs & Toads — ~10 species (Pacific Treefrog, California Treefrog, Western Toad, Bullfrogs, African Clawed Frog)
🦎 Salamanders & Newts — ~5 species (Arboreal Salamander, Black-bellied Slender, Garden Slender, CA Newt, Ensatina)
🦁 Large Mammals — ~15 species (Mountain Lion, Coyote, Bobcat, Black Bear, Mule Deer, Gray Fox, Raccoon, Striped Skunk, Opossum, Ringtail)
🐿️ Small Mammals — ~25 species (CA Ground Squirrel, Woodrats, Pocket Gophers, Rabbits, Shrews, Moles, Mice, Voles)
🦇 Bats — ~15 species (Big-eared Bats, Free-tailed, Myotis, Pallid Bat, Western Red Bat — nocturnal, conservation-heavy)
🦭 Marine Mammals — ~10 species (CA Sea Lion, Harbor Seal, Gray Whale, Bottlenose Dolphin, Common Dolphin, Sea Otter — seen from shore)
🐟 Freshwater Fish — ~30 species (Santa Ana Sucker, Arroyo Chub, Unarmored Threespine Stickleback + introduced bass, carp, mosquitofish, tilapia)
🐊 Introduced Herps — ~10 species (Mediterranean Gecko, Brown Anole, Red-eared Slider, African Clawed Frog, various pet trade escapees)

### Estimated species count: ~165
Medium-sized guide — between herps-only (~70) and fungi (~567). Enough for deep per-species content: behavior, conservation, human-wildlife interaction, urban ecology.

### Schema Adaptations for Non-Avian Vertebrates
```javascript
{
  dur: 'diurnal',              // diurnal|nocturnal|crepuscular|cathemeral (replaces plant dur)
  venomous: true,              // Venomous flag (optional — rattlesnakes only)
  conservation: 'SSC',         // SSC|FE|FT|SE|ST (Species of Special Concern, ESA, CESA)
  fm: {
    Size: '...',               // Total length or weight range
    Color: '...',              // Pattern/pelage/scale description
    Habitat: '...',
    Behavior: '...',           // Basking, burrowing, arboreal, aquatic, migratory
    Diet: '...',               // Carnivore, herbivore, omnivore, insectivore
    vs: '...',                 // Confusable species — CRITICAL for rattlesnake vs gopher snake
    Venom: '...',              // Only for venomous species
    Conservation: '...',       // Threats, status, protection, recovery plans
    Urban: '...',              // Urban adaptation notes (major LA theme)
  }
}
```

### Guide-Specific Considerations
- **Venomous badges CRITICAL** — Southern Pacific Rattlesnake is the primary safety concern. Clear venomous/non-venomous distinction.
- **Activity period** (`dur`) — diurnal/nocturnal/crepuscular/cathemeral. Bats are entirely nocturnal; many mammals are crepuscular.
- **Urban wildlife is a major LA story** — Coyotes, Mountain Lions (P-22 legacy), Bobcats, Raccoons, Opossums are deeply woven into LA culture. The guide should reflect this.
- **Wildlife corridors** — Wallis Annenberg Wildlife Crossing (Liberty Canyon), 101 Freeway barrier, genetic isolation of Santa Monica Mountains mountain lion population. Major conservation theme.
- **Introduced species** — Brown Anoles, Mediterranean Geckos, Red-eared Sliders, African Clawed Frogs, American Bullfrogs (predators of native species), introduced fish displacing native Santa Ana Sucker and Arroyo Chub.
- **Conservation is the heaviest theme** across all guides — Unarmored Threespine Stickleback (FE), Desert Tortoise (FT/ST), CA Red-legged Frog (FE, extirpated from LA), Santa Ana Sucker (FT), Two-striped Garter Snake (SSC), Western Pond Turtle (SSC), Pallid Bat (SSC).
- **Marine mammals visible from shore** — Gray Whale migration (Dec-Apr), CA Sea Lions at harbors, Harbor Seals at Leo Carrillo/Point Dume, Bottlenose Dolphins in Santa Monica Bay. These are shore-observable species, not requiring a boat. Marine invertebrates/fish are a separate Marine Guide.
- **Freshwater fish** — LA's rivers and creeks (LA River, San Gabriel River, Malibu Creek, Big Tujunga) host native fish in decline and abundant introduced species. The native fish conservation story is urgent.
- **Seasonality**: reptiles year-round but peak spring-fall; amphibians rain-dependent Nov-Mar; bats year-round but most active Apr-Oct; marine mammal migrations seasonal; freshwater fish year-round.
- **Filter slot**: replace endemic/edibility with venomous filter (⚠ Venomous | 🟢 Non-venomous | All). For mammals/fish this filter shows "All" by default.

### Sources
- CaliforniaHerps.com (Gary Nafis) — definitive CA herps resource with range maps, photos, sounds
- Stebbins & McGinnis, *Field Guide to Western Reptiles and Amphibians* (4th ed., 2018)
- Jameson & Peeters, *Mammals of California* (revised ed., 2004)
- Moyle, *Inland Fishes of California* (revised ed., 2002)
- CDFW Species of Special Concern lists (amphibians, reptiles, mammals, fish)
- RASCals / NHMLAC community science project (iNaturalist)
- San Diego Natural History Museum Amphibian and Reptile Atlas (herpatlas.sdnhm.org)
- NPS Santa Monica Mountains NRA wildlife monitoring data
- LA Urban Coyote Project
- USFWS Critical Habitat designations
- iNaturalist (inaturalist.org)

---

## Future Guides (lower priority)

### LA County Bird Guide
- URL: labirds.org | iNat: 3 (Aves) | ~450+ species
- Unique: seasonal abundance bars, eBird hotspot integration, song playback links
- Schema: `migration: 'resident|winter|summer|passage|vagrant'`
- Filter slot: migratory status
- Massive species count — will push file size limits of single-file architecture

### LA County Marine Guide
- URL: lamarine.org | iNat: various
- Unique: tidal zone indicator, depth range
- Schema: `zone: 'intertidal|subtidal|pelagic|deep'`

## Guide 5: LA County Marine Life Field Guide (NEW — to create)

**Planned URL**: lamarine.org
**Template**: Fork from Plant Guide v3.015 (v3 two-file architecture — marine species count will exceed 500)
**IDB name**: `marineGuidePhotos`
**GitHub**: https://github.com/rhysmarsh/LA-marine
**iNat taxon IDs**: Multiple — 47115 (Mollusca), 47549 (Arthropoda marine subset), 47548 (Cnidaria), 47706 (Echinodermata), 47533 (Annelida), 47153 (Chordata marine fish), 48222 (Algae) | place_id: 962
**Primary references**: Hinton *Seashore Life of Southern California* (1987), Gotshall *Guide to Marine Invertebrates* (2005), Love *Certainly More Than You Want to Know About the Fishes of the Pacific Coast* (2011), Miller & Lea *Guide to the Coastal Marine Fishes of California* (1972)
**Local authority**: Cabrillo Marine Aquarium, Heal the Bay, NHMLAC Malacology, Reef Check California, SCUBA community surveys

### Proposed Taxa Groups (12)
🐚 Gastropods (Snails) — ~60 species (limpets, abalones, top shells, turbans, whelks, nudibranchs, sea hares)
🦪 Bivalves (Clams, Mussels) — ~25 species (mussels, oysters, clams, scallops, piddocks)
🦀 Crustaceans — ~40 species (shore crabs, hermit crabs, barnacles, isopods, amphipods, lobster, shrimp)
🪸 Cnidarians — ~25 species (sea anemones, hydroids, corals, jellyfish, Portuguese man-of-war)
⭐ Echinoderms — ~15 species (sea stars, urchins, sand dollars, sea cucumbers, brittle stars)
🪱 Marine Worms — ~10 species (polychaetes visible at low tide — feather dusters, sandcastle worms, tube worms)
🧽 Sponges & Tunicates — ~10 species (encrusting and upright sponges, sea squirts)
🐟 Intertidal Fish — ~20 species (gobies, blennies, sculpins, opaleye, garibaldi visible from shore)
🐙 Cephalopods — ~5 species (two-spot octopus, market squid, California brown sea hare)
🌊 Marine Algae — ~40 species (kelps, rockweeds, corallines, sea lettuce, feather boas)
🏖️ Beach & Drift — ~15 species (sand crabs, beach hoppers, by-the-wind sailors, pelagic goose barnacles, sea beans)
🐚 Chitons & Others — ~10 species (chitons, peanut worms, bryozoans)

### Estimated species count: ~275
Medium-large guide. Focus on shore-observable and low-tide-accessible species only — no SCUBA-required species. The guide is for tidepoolers, beachcombers, and pier fishers.

### Schema Adaptations for Marine Life
```javascript
{
  dur: 'year-round',          // year-round|seasonal|migratory (replaces plant dur)
  zone: 'intertidal',         // intertidal|subtidal|pelagic|beach|pier (NEW field — tidal zone)
  edibility: 'inedible',      // edible|inedible|protected|toxic (for marine species)
  fm: {
    Size: '...',               // Maximum size range
    Color: '...',              // Pattern/texture description
    Habitat: '...',            // Rock, sand, mud, kelp, pier piling
    Zone: '...',               // High/mid/low intertidal, subtidal
    Behavior: '...',           // Feeding, defensive, locomotion
    Diet: '...',               // Filter feeder, predator, herbivore, scavenger
    vs: '...',                 // Look-alikes — important for edible vs toxic species
    Conservation: '...',       // MPA status, fishing regulations
    Tide: '...',               // Best observed at which tide conditions
  }
}
```

### Marine Guide-Specific Considerations
- **Tidal zone badge CRITICAL** — species organized by intertidal zone (splash/high/mid/low/subtidal). Filter slot replaces endemic filter with zone filter.
- **Marine Protected Areas** — several LA County MPAs (Point Dume, Palos Verdes, Catalina). Conservation context for every relevant species.
- **Shore-observable only** — no SCUBA-required species. Focus: tidepools, rocky shores, sandy beaches, piers, harbors, kelp forest edge.
- **Garibaldi** — California state marine fish. Protected. Bright orange. Most iconic LA tidepool fish.
- **Best tidepool sites**: Point Fermin, White Point, Abalone Cove, Cabrillo Beach, Leo Carrillo, El Matador, Dana Point tidepools.
- **Kelp forest** — bull kelp and giant kelp visible from shore. Foundation species for marine ecosystem. Declining due to warming.
- **Marine algae** as separate group — seaweeds are major component of intertidal ecology. Red, green, brown algae + corallines.
- **Beach wrack ecology** — kelp wrack on beach supports entire ecosystem of invertebrates (beach hoppers, kelp flies, rove beetles). Conservation story: beach grooming destroys this habitat.
- **iNat taxon complexity** — marine species span multiple kingdoms (Animalia, Chromista, Plantae for algae). Multiple taxon_id queries needed. Gap-finder tool will need adaptation.
- **Cal-IPC has no marine equivalent** — use CDFW fishing regulations and MPA status instead for conservation context.

### Marine Sources
Hinton *Seashore Life of Southern California* (1987), Gotshall *Guide to Marine Invertebrates: Alaska to Baja* (2005), Love *Certainly More Than You Want to Know About the Fishes of the Pacific Coast* (2011), Ricketts/Calvin/Hedgpeth *Between Pacific Tides* (5th ed.), Heal the Bay Aquarium species lists, Cabrillo Marine Aquarium field guides, Reef Check California surveys, CalCOFI data, MPA Watch monitoring, CDFW Marine Region species lists, iNaturalist LA County marine observations

---

## Build Workflow (for any guide)

### Creating a New Guide from Template
1. Copy Plant Guide v3.015 `index.html` as starting point (for small guides, re-inline SPECIES_DATA if <500 species expected; for large guides, keep v3 two-file architecture)
2. **CRITICAL: Change `activeTaxon:'wildflowers'`** to first taxa group key (e.g., `'lizards'`)
3. Find/replace: guide name, IDB name, SW cache name, canonical URL, OG tags, GitHub URL
4. Replace SPECIES_DATA with new taxa
5. Replace TAXA object with new taxa groups (emoji, label, iNatTaxonId, familyColors)
6. Replace TAXA_ORDER array
7. Update APG_ORDER for the relevant taxonomic scope
8. Adjust idMap for iNat life list taxon ID deduplication
9. Update manifest.json, sw.js, _headers, icons (and species-data.json for v3 guides)
10. Adjust badge rendering (dur/end/edibility/venomous) for guide-specific badge types
11. Evaluate which filter slot is most useful (endemic/edibility/venomous/migratory)
12. Set up footer: byline → disclaimer with license link → credits → Fork GitHub link
13. Add full SEO block (JSON-LD, OG tags, canonical, keywords, author, robots, theme-color)
14. **Add deep-link URL parser**: `findAndOpenSpecies()` + `URLSearchParams` in init chain
15. **Add cross-guide links in `rHP()`**: map species/group names to other guide URLs
16. Run pre-publish audit
17. Run cross-reference verification (scientific names, occurrence, safety classifications)

### Pre-Publish Audit Checklist (23 items — target: all [x])
- [ ] 0 duplicate IDs
- [ ] 0 duplicate scientific names
- [ ] 0 duplicate common names
- [ ] 0 missing required fields (id, cn, sn, fam, st, desc, mo, pk, dur)
- [ ] 0 missing family colors (no gray #999 defaults)
- [ ] Peak months (pk) are subset of active months (mo)
- [ ] All guide-specific field values valid (edibility, venomous, etc.)
- [ ] All trophic/activity mode values valid
- [ ] No species misplaced in wrong taxa group
- [ ] INTRO_SET consistent with species `intro` flags
- [ ] Even backtick count in JS
- [ ] Version synced across header, SW cache, JSON-LD, **and sw.js file**
- [ ] Header species count matches actual data
- [ ] Disclaimers present (header banner, footer, meta description)
- [ ] Safety warnings render for all dangerous species (toxic/deadly/venomous)
- [ ] **0 safety-relevant species without vs look-alike notes** (edible fungi, venomous herps)
- [ ] **100% ecological association (hp) coverage**
- [ ] **SEO complete** — JSON-LD, OG tags, canonical, keywords
- [ ] **README updated** — species count, ecological coverage stats, regional adaptation guide
- [ ] **Cross-guide links present** where taxa overlap
- [ ] **Filter logic matches chip data-attributes** (edibility/venomous/endemic values must match rSp filter code)
- [ ] **isO life list function uses NAME_ALIASES** for reclassified taxa
- [ ] **Node.js syntax validation passes** (`node -c` on extracted JS)
- [ ] **Cross-reference verification complete** — names verified against iNat/ITIS
- [ ] **0 redundant CN in desc** — desc must not restate the common name (it's already the card title)
- [ ] **0 genus in CN parens** — "(Genus)" in CN is redundant with scientific name; only qualifier parens like "(Coast)" are valid
- [ ] **0 "(Genus) (Family)" double-parens in desc** — only "(Family)" belongs in desc prefix
- [ ] **0 desc-duplicating sentences in hp** — morphological descriptions belong in desc, not Ecological Associations
- [ ] **0 lowercase desc starts** — sentences after "Non-native X (Family)." prefix must start uppercase
- [ ] **0 dead cross-link entries** — every BUG_LINKS/BIRD_LINKS/FAUNA_LINKS/GROUP_LINKS key must match hp text
- [ ] **Cross-group search preserves searchQuery** — "Also found in" buttons must NOT call saveT() (see Build Lesson #23)

### hp Ecological Associations — Proven 100% Coverage Methodology
The plant guide achieved 100% species-specific hp coverage across 1,476 species using this multi-pass approach (reuse for all guides):

1. **Template generation** — generate initial notes from species attributes (trophic mode, habitat, family, establishment status). Gets to 100% coverage but generic quality.
2. **Source-verified enhancement (top tier)** — research top ~200 species (highest iNat observation count) against authoritative sources: Xerces Society pollinator lists, Las Pilitas butterfly-plant database, Cal-IPC invasive rankings, Calscape wildlife associations, fire ecology literature (Keeley, California Chaparral Institute).
3. **Systematic sweep (middle tier)** — enhance all species ≥20 RG observations. Covers the species users will actually encounter. Focus on: pollinator associations, fire ecology, Cal-IPC status, indigenous uses, wildlife dependencies, conservation concern.
4. **Final sweep (lower tier)** — enhance all remaining species. Even low-observation species get a unique note covering at minimum: establishment context, habitat specialization, one ecological relationship.
5. **Zero-template verification** — run template indicator check confirming 0 generic notes remain.

**Key: write hp notes in batches of 100-200 species per pass using a Python dict mapped by scientific name, applied via JSON update. Never edit species-data.json manually.**

### Version Convention
- Format: `vN.NNN` (e.g., v2.004)
- Increment +.001 on each build
- Sync across: `<title>`, header `<span>`, SW cache name, JSON-LD softwareVersion
- **sw.js is a separate file** — must be updated manually. See Build Lesson #16.

### Build Lesson #16: sw.js Cache Name Must Sync with Version
The service worker file (`sw.js`) contains a cache name string like `la-plant-guide-v3.015`. This lives **outside** `index.html` and is NOT updated by the standard version bump find/replace on the HTML. Failure to update sw.js causes the old service worker to serve stale cached content after deploy.

**v3 sw.js also caches species-data.json** — the ASSETS array must include it.

**Cache name conventions per guide:**
- Plant guide: `la-plant-guide-v{version}`
- Invertebrate guide: `la-bugs-guide-v{version}`
- Fungi guide: `la-fungi-guide-v{version}`
- Future guides: `la-{name}-guide-v{version}`

### Build Lesson #17: v3 Two-File Build Workflow (Plant Guide)
In v3, SPECIES_DATA lives in `species-data.json`, not inline in `index.html`. Build workflow changes:

1. **To modify species data**: Load `species-data.json` → parse → modify → `json.dumps()` → write back
2. **To modify code/CSS**: Edit `index.html` directly (standard str_replace)
3. **On every build**: Increment version in index.html (title, header, JSON-LD) AND sw.js cache name
4. **Deploy zip must include**: index.html, species-data.json, sw.js, manifest.json, icons/

**v3 species data extraction pattern:**
```python
import json
with open('species-data.json', 'r') as f:
    data = json.load(f)
# ... modify data dict ...
with open('species-data.json', 'w') as f:
    json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
```

**No more brace-depth counting needed** for species data — it's clean JSON in its own file. Build Lesson #10 still applies for any remaining inline JS objects (TAXA, CONSERVATION, etc.).

### Known Gotcha: Template Literal Injection
When injecting HTML into template literals in rTI, the family group count uses conditional pluralization: `group${fams.length===1?'':'s'}</span>`. The literal string `groups</span>` does NOT exist in the source. The correct injection point is after `s'}</span>`.

### Build Lesson #18: Cross-Guide Deep Links
The plant guide implements bidirectional cross-linking with labugs.org using two mechanisms:

**Outbound (plant → bug)**: `rHP()` contains two maps:
- `BUG_LINKS` — 38 specific butterfly/moth species → `labugs.org?species=Scientific+name`
- `GROUP_LINKS` — ~15 pollinator group terms (bumble bee, carpenter bee, etc.) → `labugs.org#groupKey`

Both use regex replacement on the hp text string. Species links get `font-weight:600` (bold), group links are normal weight. Link style: forest green text with gold underline (`text-decoration-color:var(--gold)`).

**Inbound (bug → plant)**: `findAndOpenSpecies(query)` searches all taxa groups by SN or CN match, switches to the correct group, and opens the detail sheet after a 300ms render delay. Triggered on page load via `URLSearchParams('species')`. URL format: `?species=Asclepias+fascicularis` (works with scientific or common name, case-insensitive).

**Three URL parameter formats (bidirectional)**:
- `?species=Scientific+name` — opens single species detail sheet (both guides)
- `?search=search+term` — pre-fills search box, filters species grid (both guides)
- `#species/Scientific_name` — legacy hash format for species deep-link

**Four cross-link maps in `rHP()` (v3.015)**:
- `BUG_LINKS`: 44 butterfly/moth species → `labugs.org?species=Danaus+plexippus` (species deep-link)
- `GROUP_LINKS`: 29 pollinator group terms → `labugs.org?search=bumble+bee` (filtered search). All lowercase to match hp text.
- `BIRD_LINKS`: 86 bird species → `allaboutbirds.org/guide/Species_Name/overview` (Cornell Lab / Merlin)
- `FAUNA_LINKS`: 42 mammal/herp terms → `la-fauna.org?search=coyote` (vertebrate guide). All properly capitalized to match hp text.
- `FUNGI_LINKS`: removed (generic "mycorrhiz" match produced meaningless links — no specific fungal species available)

**Cross-link map maintenance (Build Lesson #20)**:
- All link map entries must match EXACT text in hp notes (case-sensitive)
- Run `count_alive()` audit before every deploy — dead entries waste rendering cycles and confuse maintenance
- The v3.011→v3.015 cross-link audit found 39 dead entries from case mismatches (e.g., FAUNA_LINKS had lowercase "ground squirrel" but hp text used "California Ground Squirrel"). All fixed in v3.015.
- GROUP_LINKS entries must use lowercase (hp text says "bumble bees" not "Bumble bees")
- FAUNA_LINKS entries must use proper capitalization (hp text says "Bobcat" not "bobcat")

**Link styling by destination** (visual distinction):
- labugs.org: forest green text, gold underline (`color:var(--forest)`)
- allaboutbirds.org: warm brown text (`color:#5D4037`, underline `#8D6E63`)
- la-fauna.org: green text (`color:#2E7D32`, underline `#66BB6A`)
- lafungi.org: earth brown text (`color:#795548`, underline `#A1887F`)

**Inbound handler** (`checkDeepLink()`):
- Checks `?species=`, then `?search=`, then `#species/` on init
- `?search=` sets `state.searchQuery` and triggers `render()` — shows filtered grid
- Used by labugs to link to e.g. `la-flora.org?search=milkweed` (shows all milkweeds)

**Labugs cross-link architecture** (different from plant guide):
- Labugs stores cross-links as `xlink` field in species JSON data, rendered by `rXL()`
- Plant guide stores cross-links as regex maps (`BUG_LINKS`/`GROUP_LINKS`) in `rHP()` code
- Both patterns work; `xlink` is more maintainable at scale (labugs has 700 xlink species)

**To complete bidirectional linking for a new guide pair**: add `findAndOpenSpecies()` + `checkDeepLink()` to the receiving guide's init chain, and add outbound link map via either `xlink` field in data or regex map in `rHP()`.

### Build Lesson #20: Cross-Link Map Maintenance
Cross-link maps (BUG_LINKS, BIRD_LINKS, FAUNA_LINKS, GROUP_LINKS) must be audited for dead entries before every deploy. A "dead" entry is a map key that doesn't match any text in any species hp note — it will never render but wastes processing time.

**Audit script pattern:**
```python
def count_alive(html, map_name, all_hp):
    # Extract map entries, check each key against all_hp text
    entries = re.findall(r'"([^"]+)"\s*:\s*"([^"]+)"', map_section)
    dead = [(n,u) for n,u in entries if n not in all_hp]
    return len(entries), len(entries) - len(dead), dead
```

**Common causes of dead entries:**
1. Case mismatch — map has "ground squirrel" but hp says "California Ground Squirrel"
2. Renamed species — map has "Hawk Moth" but hp says "White-lined Sphinx Moth"
3. Speculative additions — species added to map before any plant hp mentions it
4. Dedup removed the only hp sentence containing the linked term

**v3.015 lesson**: Generic FUNGI_LINKS matching "mycorrhiz" were removed entirely because "Ectomycorrhizal with native fungi" is too generic for a useful link. Only add links when the target page would provide meaningful information.

### Build Lesson #21: Ecological Enrichment Methodology (v3.015)
The plant guide achieved deep ecological coverage through ~12 iterative passes:

**Pass sequence (proven workflow):**
1. Template generation → 100% coverage but generic
2. fm field mark upgrade → Jepson-grade diagnostics
3. hp ecological content audit → strip morphology, add ecology
4. Fire ecology (Keeley) → obligate seeders, resprouters, fire followers
5. Indigenous ethnobotany (Timbrook, Bean & Saubel) → Tongva, Chumash, Cahuilla uses
6. Specialist bees (Xerces, UC Riverside) → Andrena, Diadasia, Colletes, Osmia
7. Endangered bees → Bombus crotchii, B. occidentalis
8. Bird associations (LA Audubon, eBird) → 86 species spread across plants
9. Moth associations (Las Pilitas, UC Davis Shapiro) → 11 species on host plants
10. Inverted wildlife audit → start from expected wildlife, work back to plants
11. Family-level seed predation patterns (CWHR) → Lesser Goldfinch on Asteraceae, etc.
12. Bee family upgrades by plant family (Xerces) → generic "native bees" → named families

**Key principle**: Each pass adds one ecological dimension across many species, then dedup removes sentence accumulation. Never try to add all dimensions at once.

**Stopping criteria**: When common native species are covered and remaining targets are rare/uncommon species where documented associations don't exist in published sources.

**Quality checks after every pass:**
- 0 duplicate hp
- 0 sentence overlap >45%
- 0 duplicate species names within cards
- 0 dead cross-link entries
- 0 desc/est mismatches
- 0 lowercase hp starts
- 0 double "eaten by"
- 0 generic "small mammals" (must be named species)

### Build Lesson #23: Cross-Group Search Must Preserve searchQuery (RESOLVED v3.014)
When a user searches and results span multiple taxa groups, the "Also found in: [group]" buttons allow navigation to other groups. Prior to v3.014, these buttons called `saveT()` which cleared `state.searchQuery`, losing the search filter when switching groups.

**Root cause**: `saveT()` resets ALL state including `searchQuery=''`. The "Also found in" button called `saveT()` then `render()`, which cleared the search.

**Fix (v3.014)**: Replace `saveT()` call in the "Also found in" onclick with direct state mutation:
```javascript
// OLD — clears search:
onclick="saveT('${m.taxon}');render()"

// NEW — preserves search:
onclick="state.activeTaxon='${m.taxon}';try{location.hash='${m.taxon}'}catch(e){};render()"
```

**Backport required**: This same bug exists in **labugs.org** and **lafungi.org** — any guide using `saveT()` in cross-group navigation buttons needs this fix.

### Build Lesson #24: Species Card Desc Quality Standards (v3.015)
The `desc` field appears directly below the `cn` (common name) on the species card. Quality standards established after finding systematic issues across 300+ cards:

1. **Never restate the CN** — it's already the card title. `"Black Sage (Lamiaceae). Black sage — aromatic..."` → strip "Black sage —"
2. **Never include genus in parens in CN** — `"Red Firedot Lichen (Polycauliona)"` → remove "(Polycauliona)". The genus is in the scientific name. Only qualifier parens like "(Coast)" are valid.
3. **No "(Genus) (Family)" double-parens in desc** — remove "(Genus)", keep "(Family)"
4. **Sentences after prefix must start uppercase** — "Non-native X (Family). lowercase..." → capitalize
5. **Morphological descriptions belong in desc, not hp** — if an hp sentence is >60% word overlap with desc, remove it from hp
6. **"Also found in" buttons must preserve searchQuery** — see Build Lesson #23

**Audit script** (run before every deploy):
```python
# CN repeated in desc
m = re.match(r'^(?:Non-native|Invasive)?\s*[^.]+\([^)]+\)\.\s*(.*)', desc)
if m and m.group(1).lower().startswith(cn.lower()): # fix needed

# Genus in CN
if re.search(r'\(([A-Z][a-z]+)\)$', cn) and sp['sn'].startswith(match): # fix needed

# Desc-duplicating hp sentences (>60% word overlap)
s_words = set(re.findall(r'\w{4,}', sentence.lower()))
d_words = set(re.findall(r'\w{4,}', desc.lower()))
if len(s_words & d_words) / len(s_words) > 0.6: # remove from hp
```

### Build Lesson #22: iOS Safari Sticky Elements + Safe Area (RESOLVED v3.015)
On iOS Safari PWA (`viewport-fit: cover`), sticky elements that need to account for the Dynamic Island / notch safe area require a specific pattern. **Multiple approaches were tried and failed before finding the working solution.**

**FAILED approaches (do NOT use):**
```css
/* ❌ Negative margin trick — margin doesn't collapse padding on iOS Safari */
.tbar { top: 0; padding-top: env(safe-area-inset-top); margin-top: calc(-1 * env(safe-area-inset-top)); }

/* ❌ Same trick with CSS variable — same result */
.tbar { top: 0; padding-top: var(--safe-top); margin-top: calc(-1 * var(--safe-top)); }

/* ❌ Negative top offset — creates gap in normal flow on some devices */
.tbar { top: calc(-1 * env(safe-area-inset-top)); padding-top: env(safe-area-inset-top); }
```
All of these create a visible cream-colored gap between the header and taxa bar on initial page load (before scrolling). The gap matches the safe-area-inset-top height (~59px on Dynamic Island iPhones). The negative margin/top is supposed to pull the element back up to compensate for the padding, but iOS Safari doesn't honor this on sticky elements.

**WORKING solution (v3.015):**
```css
/* ✅ No padding, no margin — just top offset for sticky positioning */
.tbar { position: sticky; top: var(--safe-top); z-index: 50; }

/* ✅ Fixed background fills notch area when bar is stuck */
.notch-bg { position: fixed; top: 0; left: 0; right: 0;
            height: var(--safe-top); background: var(--cream); z-index: 49;
            pointer-events: none; }
```
```html
<!-- Add before the sticky nav element -->
<div class="notch-bg"></div>
<nav class="tbar" id="tBar"></nav>
```

**Why this works:**
1. `top: var(--safe-top)` on a sticky element only takes effect when the element is **stuck** (scrolled to the threshold). In normal document flow, `top` has zero effect — the taxa bar sits flush against the header with no gap.
2. When the user scrolls past the header, the taxa bar sticks at `top: var(--safe-top)` — positioned below the notch/Dynamic Island.
3. The `.notch-bg` fixed div is always present but invisible on non-notch devices (height = 0). On notch devices, it fills the gap above the stuck taxa bar with the page background color.
4. z-index layering: `.notch-bg` at 49, `.tbar` at 50 — the bar sits on top of the background fill.

**Key insight for future guides:** Never add safe-area padding to a sticky element's own box model. Handle safe area entirely through the `top` property (for sticky positioning) and a separate fixed background element (for visual coverage).

### Build Lesson #19: Badge Layout on Photo Cards
The `.badge-col` pattern prevents badge overlap on species photo cards. All top-left badges (establishment pill + rarity pip) are wrapped in a single flex column container:

```html
<div class="badge-col">
  <div class="inv-pill">⚠ INV</div>    <!-- only if invasive -->
  <div class="st-pip">● Uncommon</div>  <!-- only if non-common -->
</div>
```

CSS: `.badge-col { position:absolute; top:5px; left:5px; z-index:3; display:flex; flex-direction:column; gap:3px; align-items:flex-start }`

The observed ✓ checkmark stays `position:absolute; top:6px; right:6px` independently — it's NOT inside the badge-col.

**Font fix**: `.inv-pill` and `.intro-pill` must declare `font-family:var(--fb); font-style:normal` to prevent italic serif inheritance from the `.csn` (scientific name) context.

---



## Guide 5: LA County Vertebrate Field Guide (la-fauna.org)

**Status**: Planned — domain reserved, not yet built
**Template**: Fork from Plant Guide v3.015 (v3 two-file architecture)
**Estimated species**: ~350 (mammals ~90, reptiles ~60, amphibians ~20, freshwater fish ~40, marine shore fish ~20, marine mammals ~20)
**IDB name**: `faunaGuidePhotos`
**GitHub**: https://github.com/rhysmarsh/LA-fauna

### Cross-link integration (already seeded)
The plant guide (v3.015) already contains `FAUNA_LINKS` map with 42 terms linking to `la-fauna.org?search=term`. When la-fauna.org launches with `findAndOpenSpecies()` and `?search=` handler, these links will work immediately.

Plant guide hp notes reference 281 species (19%) with named mammals/herps including: Mule Deer, Western Gray Squirrel, California Ground Squirrel, Botta's Pocket Gopher, Desert Cottontail, Brush Rabbit, American Black Bear, Mountain Lion, Bobcat, Gray Fox, Dusky-footed Woodrat, Desert Woodrat, Merriam's Chipmunk, California Vole, Ringtail, Striped Skunk, Desert Bighorn Sheep, Western Yellow Bat, Mexican Free-tailed Bat, Pallid Bat, Southern Pacific Rattlesnake, California Kingsnake, Coast Horned Lizard, Western Fence Lizard, Pacific Tree Frog, California Newt, Arroyo Toad, Coastal Rosy Boa, and more — all linking to la-fauna.org.

### Reciprocal links needed
When building la-fauna.org, add outbound cross-links:
- Plant associations via `xlink` field or `PLANT_LINKS` map → `la-flora.org?species=Scientific+name`
- Invertebrate prey via `BUG_LINKS` → `labugs.org?species=` or `?search=`
- Bird links already go to All About Birds (allaboutbirds.org)

## Source References (shared across guides)

### Vascular Plants
Muns & Chester SMM Checklist (1999/2002), Chester/Fisher/Strong Lower Eaton Canyon (2003), Cooper Flora of Griffith Park (2015), Raven/Thompson/Prigge Flora of SMM (1986), Jepson eFlora, Calflora, CNPS, Theodore Payne, Las Pilitas, CalPhotos, Calscape, Xerces Society

### Invertebrates
Powell & Hogue Insects of the Los Angeles Basin (1979), Emmel & Emmel Butterflies of SoCal (1973), Hogue Insects of the Los Angeles Basin (1993), BugGuide, iNat LA County checklists

### Fungi
Desjardin/Wood/Stevens California Mushrooms (2015), Arora Mushrooms Demystified (2nd ed.), Siegel/Schwarz Mushrooms of the Redwood Coast (2016), MykoWeb/CAF, MushroomExpert.com, NAMA Poison Case Registry, LAMS, iNat, Index Fungorum, GBIF, Catalogue of Life

### Non-Avian Vertebrates
CaliforniaHerps.com (Gary Nafis), Stebbins & McGinnis Western Reptiles and Amphibians (4th ed.), Jameson & Peeters Mammals of California (revised ed.), Moyle Inland Fishes of California (revised ed.), CDFW SSC lists, RASCals (NHMLAC), SD Herp Atlas, NPS SMMNRA surveys, LA Urban Coyote Project, iNat

### Lichens
Tucker & Ryan Revised Catalog of CA Lichens (2006/2013), CALS SoCal Mini Guide, Sharnoff California Lichens

### Mosses
Malcolm/Shevock/Norris California Mosses (2009), CA Moss eFlora

### Marine Life
Hinton Seashore Life of Southern California (1987), Gotshall Guide to Marine Invertebrates (2005), Love Certainly More Than You Want to Know About the Fishes of the Pacific Coast (2011), Ricketts/Calvin/Hedgpeth Between Pacific Tides (5th ed.), Heal the Bay, Cabrillo Marine Aquarium, Reef Check California, CalCOFI, MPA Watch, iNat

---

## Instructions for Claude

When continuing this project:
1. **User will upload the current guide file(s)** — do not assume files persist from previous sessions
2. **Read the file first** before making changes — extract SPECIES_DATA, TAXA, and key functions
3. **Use the safe rebuild pattern** (see CRITICAL BUILD LESSONS above)
4. **Validate structure** via backtick count (not brace/paren/bracket count) and JSON.parse for data
5. **Always run the pre-publish audit** (20 items) after species data changes
6. **Increment version** on every build (+.001), sync title/header/SW/JSON-LD. **Also write updated sw.js** with matching cache name — see Build Lesson #16. For v3 guides, update sw.js ASSETS array if files change.
7. **Match the user's working style**: proceed on assumptions, peer-level depth, institutional-quality output, clear positions, proactive risk flags
8. **Watch for the template literal injection gotcha** — see "Known Gotcha" above
9. **Change activeTaxon** immediately when forking template for a new guide
10. **Assign real family colors** immediately — never use #999 placeholder
11. **Update README** with every major expansion — track stats drift
12. **Run cross-reference verification** before publish — scientific names against iNat, occurrence against place_id=962
13. **Target 100% hp coverage** and 0 safety-relevant species without vs notes
14. **For v3 guides**: species data is in `species-data.json` — load, modify, and write that file directly. No brace-depth counting needed. For v2 (single-file) guides, use brace-depth counting — see Build Lesson #10
15. **Verify filter logic matches chip values** after template fork — the fungi build shipped with broken edibility filter because rSp still had the plant guide's endemic filter code (`'endemic'`/`'non-endemic'`) while chips sent `'edible'`/`'toxic'`/`'inedible'`
16. **Add cross-guide deep links** when ecological connections exist between guides — see Build Lesson #18. Add `findAndOpenSpecies()` for inbound links + species/group maps in `rHP()` for outbound links
17. **Production icons**: deploy zip must include all 5 icon sizes (128, 180, 192, 512, 1024px). SW ASSETS array must list all icon paths. Manifest must declare all sizes. Never ship placeholder icons.
18. **Taxonomy scrub**: before publish, check for reclassified taxa (Pennisetum→Cenchrus, Cheilanthes→Myriopteris, Piperia→Platanthera patterns), verify Cal-IPC High species are tagged `est:'invasive'`, check for trees misplaced in wildflowers
