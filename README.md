# Journey of a Prompt

An interactive 3D simulation of what happens between hitting **Send** in an AI chat and getting the answer back. Made for people with no background in the internet or AI.

You follow one prompt, shown as a sealed envelope, through six stops:

1. **Your phone**: the words become numbers, then get locked.
2. **Through the air**: radio waves to the cell tower.
3. **The internet**: find the address, travel as light through glass cables, cross the ocean floor.
4. **Data center**: the front door, then the GPU chips where the AI lives.
5. **Inside the AI**: split the words, give them meaning, link them, score the next word, repeat.
6. **Trip home**: the answer streams back word by word, then a replay at real speed (about one second).

## Run it

It is a single `index.html` with no build step. Serve the folder with any static server:

```bash
git clone https://github.com/diegocp01/journey-of-a-prompt.git
cd journey-of-a-prompt
python3 -m http.server 4173
```

Then open <http://localhost:4173>.

An internet connection is needed: the 3D engine, sky, textures and models are loaded at runtime (see Credits).

## Controls

- **Continue** (or Enter, Space, right arrow): next step. Nothing advances on its own.
- **Auto**: moves on by itself, timed to how long each step takes to read.
- **‹** (or left arrow): go back one step.
- **🐢 / 🐇**: slow or fast animations.
- **EN / ES**: English or Spanish.
- Progress bar, bottom left: jump to any stop.

## Simplifications

This is a teaching model, not a network diagram. A few things are simplified on purpose:

- The phone looks up the address before it sends anything; here it is shown at the start of the internet stop.
- At home the first hop is usually Wi-Fi rather than a cell tower.
- Not every message crosses an ocean; the data center may be nearby.
- The numbers, addresses and word scores on screen are illustrative.

## Credits

- [three.js](https://threejs.org) (MIT), loaded from jsDelivr.
- Sky, textures and 3D models from [Poly Haven](https://polyhaven.com) (CC0).
