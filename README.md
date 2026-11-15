# Journey of a Prompt

An interactive 3D simulation of what happens between hitting **Send** in an AI chat and getting the answer back. Made for people with no background in the internet or AI.

You follow one message, shown as a glowing envelope, through six stops. A clock in the corner shows the seconds so far out of 20, the total from Send to answer in this example.

1. **Your phone**: the words become 1s and 0s, then get locked.
2. **Through the air**: radio waves to the cell tower, which turns them into light.
3. **The internet**: find the address, hop from machine to machine, travel as light through glass, cross the ocean floor.
4. **Data center**: the front door, then the GPU chips where the AI lives.
5. **Inside the AI**: split the words, give them meaning, link them, score the next word, repeat.
6. **Trip home**: the whole answer comes back in one piece (a block response, not streaming), then a recap of the whole trip.

The screen shows a title and one short line at a time, so the picture does the explaining.

## Run it

There is no build step. Serve the folder with any static server:

```bash
git clone https://github.com/diegocp01/journey-of-a-prompt.git
cd journey-of-a-prompt
python3 -m http.server 4173
```

Then open <http://localhost:4173>.

An internet connection is needed: the 3D engine, textures and models are loaded at runtime (see Credits).

## Files

- `index.html`: the page and its buttons.
- `css/styles.css`: the look of the clock, captions and buttons.
- `js/copy.js`: all on-screen text, in English and Spanish.
- `js/phone-grip.js`: the photographed grip and interactive phone display.
- `js/hand.js`: the 3D fallback for the phone grip.
- `js/main.js`: the 3D world, the story steps and the controls.

## Controls

- **Main button** (or Enter, Space, right arrow): next step. Nothing advances on its own.
- **‹** (or left arrow): go back one step.
- Progress bar, bottom left: jump to any stop.
- Spanish: add `?lang=es` to the address.

## Simplifications

This is a teaching model, not a network diagram. A few things are simplified on purpose:

- The phone looks up the address before it sends anything; here it is shown at the start of the internet stop.
- At home the first hop is usually Wi-Fi rather than a cell tower.
- The route drawn on the planet (Florida to a data center in Northern Virginia) is an example. A trip like that stays on land; the sea-floor ride is there to show how the internet reaches other continents.
- The web of cables on the planet is a sketch, not the real cable map.
- The numbers, addresses and word scores on screen are illustrative.

## Credits

- [three.js](https://threejs.org) (MIT), loaded from jsDelivr, including the Earth textures from its examples.
- Textures and 3D models from [Poly Haven](https://polyhaven.com) (CC0).
- The main phone and hand image was created with ImageGen.
- Fallback hand model from [Babylon.js Assets](https://github.com/BabylonJS/Assets) (CC BY 4.0), loaded from assets.babylonjs.com, with skin tones, nails and smoothing added here.
- Look and pacing inspired by Charles Zheng's reel about a photo crossing the Pacific in 200 ms.
