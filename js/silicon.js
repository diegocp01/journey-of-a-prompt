// A schematic die photograph shared by the GPU cutaway and the chip lesson.
// Repeated compute clusters flank a central routing channel and memory banks.
export function dieSurface() {
  const canvas = document.createElement('canvas');
  canvas.width = 544;
  canvas.height = 384;
  const g = canvas.getContext('2d');
  const fill = (x, y, w, h, color) => {
    g.fillStyle = color;
    g.fillRect(x, y, w, h);
  };
  fill(0, 0, 544, 384, '#493b34');
  for (let edge = 0; edge < 4; edge++) {
    g.strokeStyle = edge % 2 ? '#b89166' : '#3a413f';
    g.strokeRect(2 + edge * 2, 2 + edge * 2, 540 - edge * 4, 380 - edge * 4);
  }
  for (let i = 0; i < 64; i++) {
    fill(15 + i * 8, 4, 4, 5, '#f0cf93');
    fill(15 + i * 8, 375, 4, 5, '#dbba88');
  }
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 6; col++) {
      const x = 16 + col * 85 + (col > 2 ? 8 : 0);
      const y = 17 + row * 88;
      fill(x, y, 80, 80, '#3d463d');
      fill(x + 2, y + 2, 76, 76, (col + row) % 2 ? '#b38b59' : '#b9986c');
      for (let block = 0; block < 3; block++) {
        const bx = x + 5 + block * 24;
        for (let bank = 0; bank < 2; bank++) {
          const by = y + 5 + bank * 34;
          fill(bx, by, 21, 31, '#e5c281');
          for (let j = 0; j < 6; j++) {
            fill(bx + 2, by + 2 + j * 5, 17, 2, j % 2 ? '#766b55' : '#a68a56');
            fill(bx + 7 + (j % 3) * 3, by + 2 + j * 5, 2, 2, '#efce96');
          }
        }
      }
      for (let j = 0; j < 18; j++) fill(x + 5 + j * 4, y + 73, 2, 3, '#e3be77');
    }
  }
  for (let j = 0; j < 4; j++) fill(268 + j * 2, 12, 1, 358, j % 2 ? '#b1aca1' : '#6c8890');
  for (let j = 0; j < 3; j++) fill(15, 99 + j * 88, 512, 1, '#d8ad92');
  const sheen = g.createLinearGradient(0, 0, canvas.width, canvas.height);
  sheen.addColorStop(0, 'rgba(236,245,255,.15)');
  sheen.addColorStop(.38, 'rgba(214,158,186,.06)');
  sheen.addColorStop(1, 'rgba(70,103,135,.23)');
  g.fillStyle = sheen;
  g.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}
