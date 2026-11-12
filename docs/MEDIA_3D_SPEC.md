# 3D media specification — original RegaDRIVE images and videos

Status 2026-11-12: specification only. **No image or video has been produced.** Using our own media with licensed
official questions needs the `ownMedia` right in the licence contract (`docs/LICENSING.md`); with RegaDRIVE's own
original questions it needs no licence.

Dimensions marked "approx." are working values for modelling. Before production the 3D artist and the driving
instructor confirm them against the current German guidelines (StVO, VwV-StVO, the official sign catalogue VzKat,
road design guidelines). Nothing here is copied from the official exam media or from another product.

## 1. Principles

1. **The picture must be right before it is beautiful.** Every picture starts from an approved scenario sheet and is
   checked against it by a driving instructor. A picture that contradicts the answer key is rejected.
2. **Everything is self-made or carries a recorded licence.** Each scene, model and texture is in the scene library
   with its source file and the licence of any third-party asset (CC0 preferred). No screenshots, no tracing of
   official or competitor pictures, no brand logos, no readable real number plates, no recognisable real persons.
3. **One visual system.** Same camera, proportions, light and materials across the whole bank, so a learner reads
   every picture the same way.
4. **Readable on a phone.** Signs, signals, mirrors and road markings must be clear at 360 px width.

## 2. Camera rigs (scene library kind `rig`)

| Rig | Use | Settings |
| --- | --- | --- |
| `rig-driver` | default: what the driver sees | eye height approx. 1.20 m, left-hand drive, horizontal field of view approx. 60°, windscreen frame, interior mirror and left exterior mirror visible, dashboard with speedometer when the speed matters |
| `rig-driver-mirror` | questions about traffic behind | as above, mirror content rendered correctly (real reflection, not a pasted picture) |
| `rig-overview` | right-of-way diagrams | elevated view approx. 30° above the junction, own vehicle marked consistently |
| `rig-detail` | signs, markings, vehicle parts | straight-on, neutral background |

Rules: 16:9, horizon level, no lens distortion, no motion blur on anything the learner must read, own vehicle always
the same neutral car interior.

## 3. Roads and environments (kinds `road`, `junction`, `roundabout`, `motorway`, `crossing`, `environment`)

Right-hand traffic everywhere. Build as modular, snapping segments.

- **Urban street:** two lanes (approx. 3.0–3.25 m each), kerbs, pavements, optional cycle lane or protective strip,
  parking bays, bus stop, tram track variant.
- **30 zone / traffic-calmed area:** narrowings, raised crossings, playing children context.
- **Rural road:** two lanes (approx. 3.25–3.5 m), edge lines, delineator posts, avenue of trees, field entrance, bend,
  crest, level crossing with and without barriers.
- **Motorway:** two and three lanes per direction (approx. 3.5–3.75 m), hard shoulder, central barrier, slip road,
  exit with countdown markers, roadworks with narrowed lanes, emergency corridor situation.
- **Junctions:** equal-priority (right before left), priority road with give-way / stop, bent priority road with its
  supplementary sign, traffic lights with and without green arrow sign, turning lanes, tram crossing.
- **Roundabout:** single lane with give-way and roundabout signs, with pedestrian and cycle crossings.
- **Crossings:** zebra crossing, signal-controlled pedestrian crossing, cycle crossing, school route.
- **Markings:** white for permanent markings; yellow for temporary markings at roadworks. Centre line, lane lines,
  solid line, stop line, give-way line, arrows, restricted areas, parking and no-stopping markings.
- **Guidance signs by road type:** blue for motorways, yellow for other main roads, white for local destinations.
- **Conditions (lighting sets):** day clear, day overcast, dusk, night with street lighting, night without, rain with
  wet surface, fog, snow / ice, low sun glare. One set per condition, reused everywhere.

## 4. Traffic signs and signals (kind `sign`)

- Model every sign from the official StVO sign definitions by its sign number (the same numbers the app already
  uses in `src/content/signs.ts`), with correct shape, colours, proportions and reflective look.
- Before production, confirm with the licensor or a lawyer that the official sign designs may be reproduced freely
  (they are published as part of the regulation; RegaDRIVE does not assume this).
- Mounting: post height, distance from the road edge and combinations (main sign plus supplementary sign) as on
  real German roads; signs face the lane they apply to.
- Traffic lights: three-aspect signals, arrow signals, pedestrian and cycle signals, flashing amber, signal off.
- Police officer signals as a posed character set.

## 5. Vehicles and people (kinds `vehicle`, `character`)

- Generic, unbranded models: small car, estate, SUV, van, lorry, articulated lorry, bus, tram, motorcycle, moped,
  bicycle, e-scooter, tractor with trailer, emergency vehicles with blue lights, breakdown vehicle, car with trailer.
- Working indicators, brake lights, reversing lights, headlights (dipped / main), hazard lights, fog lights.
- People: adults, children, elderly people, a person with a white cane, a person in a wheelchair, cyclists of
  different ages, school crossing patrol, road workers. Neutral clothing, no recognisable real persons.
- Animals for rural scenes: deer, horse with rider, farm animals.

## 6. Output formats

| Asset | Format | Size | Notes |
| --- | --- | --- | --- |
| Question image | WebP (JPEG/PNG accepted) | 1600 × 900, ≤ 2 MB | sRGB |
| Thumbnail | WebP | 480 × 270 | variant `thumbnail` |
| Question video | MP4 (H.264) **and** WebM | 1280 × 720, 25 fps, 6–12 s, ≤ 25 MB each | variants `mp4` / `webm`; no sound needed; no autoplay |
| Poster / end frame | WebP | 1280 × 720 | variant `poster`; required for every video — the learner answers on the end frame |

File names: `<scenario-id>[-<variant>].<ext>`, lower case, no spaces. The app stores files under their content hash;
the manifest links file, scenario, scenes, variants, provenance and review.

Video rule from the real exam to mirror later in the player: a clip can be watched up to five times before answering.

## 7. Production workflow

1. **Scenario sheet** (German): who is where, who moves, which sign or rule applies, expected behaviour, legal
   reference, linked question. Approved by the driving instructor **before** modelling.
2. **Build** from library scenes; new blocks go into the library first (`scene_library`), with source file and
   third-party licences.
3. **Render** with the standard rig and lighting set; export the formats above.
4. **Manifest** (`docs/import/media-manifest.template.json`): file hash, origin, author, tool, source file, scenes,
   variants, AI disclosure.
5. **Review:** the instructor compares the final file with the sheet and the answer key and signs for exactly this
   file. A re-render needs a new review.
6. **Import:** the workbench in `/dr` shows the file as approved only when steps 1–5 are complete; the database
   refuses to publish a question whose media is not approved.

## 8. Accessibility

- Every image and video needs German alt text describing the situation without giving the answer away; Sorani alt
  text before approval (for licensed questions only with the translation right).
- Information never depends on colour alone (signal position, sign shape and arrows stay readable in greyscale).
- No flashing faster than three times per second.

## 9. Tooling and cost

Blender (free, open source) is the proposed tool; the manifest records whichever tool was used. Rendering runs on
the artist's own machine. No paid service is part of this specification; any paid asset, plug-in or render farm
needs the owner's approval first.
