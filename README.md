# Journey of a Prompt

An interactive 3D simulation of what happens between hitting **Send** in an AI chat and getting the answer back. Made for people with no background in the internet or AI.

It opens on a title screen with a small 3D model of the whole trip, then you follow one message, shown as a glowing envelope, through six stops. A clock in the corner shows the seconds so far out of 20, the total from Send to answer in this example.

1. **Your phone**: the words become 1s and 0s, then get locked.
2. **Through the air**: radio waves to the cell tower, which turns them into light.
3. **The internet**: ride inside a glass thread as the message itself, then cross the ocean floor.
4. **Data center**: the front door, then the GPU chips where the AI lives.
5. **Inside the AI**: split the words, give them meaning, link them, score the next word, repeat.
6. **Trip home**: the whole answer comes back in one piece (a block response, not streaming), then a recap of the whole trip.

The screen shows a title and one short line at a time, so the picture does the explaining.

## Run it

There is no build step. Start the local preview with Python 3.9 or newer:

```bash
git clone https://github.com/diegocp01/journey-of-a-prompt.git
cd journey-of-a-prompt
python3 scripts/serve.py 4173
```

Then open <http://localhost:4173>.

An internet connection is needed: the 3D engine, textures and models are loaded at runtime (see Credits).

## Files

- `index.html`: the page and its buttons.
- `css/styles.css`: the look of the clock, captions and buttons.
- `js/copy.js`: all on-screen text, in English and Spanish.
- `js/phone-grip.js` and `js/handset.js`: a photo-textured grip with shaped fingers, a bending thumb, reflective glass and a modeled handset around the interactive display.
- `js/hand.js`: the 3D fallback for the phone grip.
- `js/nature.js`: fir trees built from twig and bark photos, scattered plants and rocks, and the daylight sky. Distant tree stands use views baked from the same trees.
- `js/city.js`: the towns at each end of the trip.
- `js/intro.js`: the opening screen's small 3D model of the whole trip.
- `js/tunnel.js`: the first-person ride inside the cable.
- `js/earth.js`: the globe's land, water, clouds, atmosphere and city lights.
- `js/envelope.js` and `js/byte-stage.js`: the folding message envelope, letter tiles and moving locks.
- `js/home.js` and `js/home-textiles.js`: the garden cottage, furnished office, woven rug and framed print along the return flight.
- `js/writing-desk.js`: the walnut desk, spun-brass lamp, linen-bound book and illuminated sill. The modeled olive shoots and vented router are in `js/desk-olive.js` and `js/desk-router.js`.
- `js/seafloor.js` and `js/ocean-fish.js`: sediment, rock outcrops, bottom-dwelling animals and animated fish along the underwater cables.
- `js/data-center.js` and `js/silicon.js`: the entrance, security gate, server racks and GPU hardware. `js/model-pieces.js` builds the physical teaching pieces inside the AI.
- `js/main.js`: the 3D world, the story steps and the controls.

## Controls

- **Main button** (or Enter, Space, right arrow): next step. Nothing advances on its own.
- **‹** (or left arrow): go back one step.
- Progress bar, bottom left: jump to any stop.
- Spanish: add `?lang=es` to the address.
- A recorded AI guide speaks as each screen opens. If the browser requires a gesture for sound, Start plays the introduction and then opens the phone. Auto-play lets the current recording finish before advancing.

## Recorded narration

The 21 English and 21 Spanish MP3s ship in `assets/narration/`. Playback uses these saved files. The tour and recording tool share the ordered scripts in `js/narration-lines.mjs`. Each lesson has a stable filename in both languages.

To replace a recording, edit its script and remove that clip’s MP3. Run `node --env-file=.env.local scripts/generate-narration.mjs` with Node 22+ and a local `OPENAI_API_KEY`. The generator uses OpenAI text to speech and skips clips that already exist. For hosting, publish `index.html`, `assets/`, `js/`, and `css/`.

## Simplifications

This is a teaching model, not a network diagram. A few things are simplified on purpose:

- Finding the AI's address and the hops from machine to machine are left out, to keep the trip short.
- At home the first hop is usually Wi-Fi rather than a cell tower.
- The route drawn on the planet (Florida to a data center in Northern Virginia) is an example. A trip like that stays on land; the sea-floor ride is there to show how the internet reaches other continents.
- The web of cables on the planet is a sketch, not the real cable map.
- The numbers, addresses and word scores on screen are illustrative.

## Credits

- [three.js](https://threejs.org) (MIT), loaded from jsDelivr.
- Globe imagery by [Solar System Scope](https://www.solarsystemscope.com/textures/) ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)), adapted from the [Three.js r170 Earth example](https://github.com/mrdoob/three.js/blob/r170/examples/webgpu_tsl_earth.html). Daylight, city lights, and packed relief/cloud imagery are resized and bundled as WebP.
- Textures and 3D models from [Poly Haven](https://polyhaven.com) (CC0). The ocean floor bundles the color and normal maps from [Gravelly Sand](https://polyhaven.com/a/gravelly_sand) and the surface texture from [Rock Boulder Cracked](https://polyhaven.com/a/rock_boulder_cracked).
- The daylight sky uses the upper hemisphere of [Kloofendal 48d Partly Cloudy](https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky), a CC0 panorama from Poly Haven.
- Woodland bark, fir boughs and ground use the local [Fir Tree 01](https://polyhaven.com/a/fir_tree_01) and [Forrest Ground 01](https://polyhaven.com/a/forrest_ground_01) maps from Poly Haven (CC0).
- Cottage upholstery and lawn use [Brown Leather](https://polyhaven.com/a/brown_leather), [Fabric Pattern 07](https://polyhaven.com/a/fabric_pattern_07) and [Grass Ground](https://polyhaven.com/a/grass_ground) (CC0), bundled with the scene.
- Desk grain from [Wood Table 001](https://polyhaven.com/a/wood_table_001) (CC0), bundled with the scene.
- The main phone and hand image and the olive leaf, ivory marble and speckled stoneware surface textures were created with ImageGen.
- Fallback hand model from [Babylon.js Assets](https://github.com/BabylonJS/Assets/blob/master/core/HandMeshes/r_hand_rhs.glb) ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)), bundled locally and posed with skin, curved nails, smoothing and a modeled forearm.
- Look and pacing inspired by Charles Zheng's reel about a photo crossing the Pacific in 200 ms.
