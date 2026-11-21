// Small original flatweave and landscape print for the home office.
import * as THREE from 'three';

function canvasMap(width, height, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  paint(ctx, width, height);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  return map;
}

function grain(ctx, w, h, strength, woven = false) {
  let seed = 3297;
  const image = ctx.getImageData(0, 0, w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const yarn = woven ? 4 * Math.sin(y * 1.54) + ((x + (y & 2)) % 4 === 0 ? -7 : 2) : 0;
      const noise = (seed / 4294967296 - 0.5) * strength + yarn;
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) image.data[i + c] += noise;
    }
  }
  ctx.putImageData(image, 0, 0);
}

export function rugMap() {
  return canvasMap(896, 640, (g, w, h) => {
    const red = '#ad624a',
      ochre = '#c79c66',
      cream = '#e5d1ad',
      blue = '#394e53',
      sage = '#809083';
    g.fillStyle = red;
    g.fillRect(0, 0, w, h);
    const border = (offset, width, color) => {
      g.lineWidth = width;
      g.strokeStyle = color;
      g.strokeRect(offset, offset, w - 2 * offset, h - 2 * offset);
    };
    const diamond = (x, y, a, b, color) => {
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(x, y - b);
      g.lineTo(x + a, y);
      g.lineTo(x, y + b);
      g.lineTo(x - a, y);
      g.closePath();
      g.fill();
    };
    border(8, 16, '#ba8970');
    border(20, 6, blue);
    border(40, 32, cream);
    border(59, 5, blue);
    border(68, 5, ochre);
    border(77, 4, '#733e35');
    for (let x = 41; x < w - 35; x += 24) {
      for (const y of [40, h - 40]) diamond(x, y, 9, 9, blue);
    }
    for (let y = 64; y < h - 55; y += 24) for (const x of [40, w - 40]) diamond(x, y, 9, 9, red);
    // Angular, stepped medallions. Each course follows a row of woven yarn.
    for (const cx of [w * 0.268, w * 0.5, w * 0.732]) {
      for (let j = -12; j <= 12; j++) {
        const width = (13 - Math.abs(j)) * 7.6;
        g.fillStyle = '#754737';
        g.fillRect(cx - width - 4, h / 2 + j * 12, width * 2 + 8, 13);
        g.fillStyle = cream;
        g.fillRect(cx - width, h / 2 + j * 12 + 1, width * 2, 11);
      }
      diamond(cx, h / 2 + 5, 75, 118, blue);
      diamond(cx, h / 2 + 5, 56, 89, sage);
      diamond(cx, h / 2 + 5, 39, 62, cream);
      diamond(cx, h / 2 + 5, 26, 39, red);
      diamond(cx, h / 2 + 5, 10, 15, ochre);
    }
    for (let col = 0; col < 8; col++)
      for (const y of [113, h - 113]) {
        const x = 119 + col * 94;
        diamond(x, y, 13, 14, ochre);
        diamond(x, y, 5, 6, blue);
      }
    grain(g, w, h, 25, true);
  });
}

export function landscapePrint() {
  return canvasMap(640, 460, (g, w, h) => {
    g.fillStyle = '#e9dfbf';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#d7995b';
    g.beginPath();
    g.arc(427, 108, 50, 0, Math.PI * 2);
    g.fill();
    const ridge = (y, color, amp, phase, freq) => {
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(0, h);
      for (let x = 0; x <= w; x += 4) {
        const a = x / w;
        g.lineTo(x, y + amp * (Math.sin(a * freq + phase) + 0.29 * Math.sin(a * 17 + phase)));
      }
      g.lineTo(w, h);
      g.closePath();
      g.fill();
    };
    ridge(215, '#bdab8b', 40, 0.3, 7);
    ridge(256, '#b37f5e', 49, 2.4, 5);
    ridge(299, '#768a7c', 51, -1.3, 7);
    ridge(375, '#34595a', 34, 0.5, 7);
    g.save();
    g.strokeStyle = '#c2c6a6';
    g.globalAlpha = 0.56;
    g.lineWidth = 1.5;
    for (let i = 0; i < 15; i++) {
      g.beginPath();
      g.moveTo(0, 346 + i * 7);
      g.bezierCurveTo(180, 285 + i * 6, 355, 485 + i * 5, 640, 335 + i * 7);
      g.stroke();
    }
    g.restore();
    grain(g, w, h, 14);
  });
}

export function brickMap() {
  return canvasMap(320, 256, (g, w, h) => {
    g.fillStyle = '#ae9f8d';
    g.fillRect(0, 0, w, h);
    const colors = ['#986e58', '#a67a64', '#835f51', '#ac816b', '#906750', '#957260'];
    for (let row = 0; row < 12; row++)
      for (let col = -1; col < 5; col++) {
        g.fillStyle = colors[Math.abs(row * 7 + col * 5 + row * col) % colors.length];
        g.fillRect((col + (row % 2) * 0.5) * 80 + 2, (row * h) / 12 + 1, 77, h / 12 - 2.3);
      }
    grain(g, w, h, 28);
  });
}

export function gardenMask() {
  const map = canvasMap(128, 128, (g, w, h) => {
    const im = g.createImageData(w, h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const u = (x / (w - 1)) * 2 - 1,
          v = (y / (h - 1)) * 2 - 1;
        const edge = (u ** 4 + v ** 4) ** 0.25 + 0.026 * Math.sin(u * 13 + v * 9);
        const t = THREE.MathUtils.smoothstep(edge, 0.68, 1);
        im.data.set([255 * (1 - t), 255 * (1 - t), 255 * (1 - t), 255], (y * w + x) * 4);
      }
    g.putImageData(im, 0, 0);
  });
  map.colorSpace = THREE.NoColorSpace;
  return map;
}

export function contactShadow() {
  return canvasMap(96, 96, (g, w, h) => {
    const fade = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    fade.addColorStop(0, 'rgba(41,28,21,.59)');
    fade.addColorStop(0.44, 'rgba(41,28,21,.36)');
    fade.addColorStop(0.78, 'rgba(41,28,21,.12)');
    fade.addColorStop(1, 'rgba(41,28,21,0)');
    g.fillStyle = fade;
    g.fillRect(0, 0, w, h);
  });
}
