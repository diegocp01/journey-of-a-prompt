// Logical iOS points measured from the reference. The glass, hit test and
// stationary thumb all use this one Send location.
export const phoneLayout = {
  width: 420, height: 912, send: { x: 385, y: 530, radius: 16 },
};
const W = phoneLayout.width, H = phoneLayout.height, send = phoneLayout.send;
const FONT = "-apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI', sans-serif";
const ink = '#19191c', muted = '#73747b', accent = '#98b537';

function pill(g, x, y, w, h, r, fill, stroke) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fillStyle = fill;
  g.fill();
  if (stroke) { g.lineWidth = 0.65; g.strokeStyle = stroke; g.stroke(); }
}
function line(g, points, color = ink, weight = 1.8) {
  g.beginPath();
  for (const [i, [x,y]] of points.entries()) i ? g.lineTo(x,y) : g.moveTo(x,y);
  g.lineWidth = weight; g.strokeStyle = color; g.stroke();
}
function circle(g, x, y, radius, fill) {
  g.beginPath(); g.arc(x, y, radius, 0, Math.PI * 2); g.fillStyle = fill; g.fill();
}
function text(g, value, x, y, size, color = ink, weight = 400, align = 'left') {
  g.font = `${weight} ${size}px ${FONT}`; g.textAlign = align; g.fillStyle = color; g.fillText(value, x, y);
}
function mic(g, x, y, size = 1) {
  g.save(); g.translate(x,y); g.scale(size,size);
  g.strokeStyle = ink; g.lineWidth = 1.65; g.beginPath(); g.roundRect(-3.7,-10,7.4,13.2,3.7); g.stroke();
  g.beginPath(); g.arc(0,0,7.4,0.12,Math.PI-0.12); g.stroke();
  line(g,[[0,7.3],[0,11]],ink,1.65); g.restore();
}
function control(g,x,y,w,h,r) {
  g.save(); g.shadowColor='rgba(30,33,42,.14)'; g.shadowBlur=4; g.shadowOffsetY=1.35;
  pill(g,x,y,w,h,r,'#f5f5f7'); g.restore();
  g.strokeStyle='rgba(110,112,121,.19)'; g.lineWidth=.65;
  g.beginPath(); g.roundRect(x,y,w,h,r); g.stroke();
}
function topBar(g, photo) {
  text(g,'8:11',50.5,38.8,17.7,ink,620);
  g.fillStyle=ink; g.beginPath(); g.moveTo(88.6,36.4);g.lineTo(102,31.3);
  g.lineTo(97.1,44.1);g.lineTo(94.8,38.3);g.closePath();g.fill();
  if (!photo) {
    pill(g,146,17.5,128,33,16.5,'#09090a');
    circle(g,253,34,4.4,'#152237');circle(g,252.3,33,1.1,'#436482');
  }
  for (let i=0;i<4;i++) {
    const h=7.1+i*2.3; pill(g,298.2+i*6.1,45-h,4.1,h,1.4,i<2?ink:'#b6b7bc');
  }
  for (const r of [3.5,7.8,12]) {
    g.strokeStyle=ink; g.lineWidth=2.8;g.beginPath();g.arc(337,44.4,r,-Math.PI*.73,-Math.PI*.27);g.stroke();
  }
  pill(g,354.5,31,27.9,14.5,5.2,'#cacbd0');pill(g,382.8,35.7,2,5.2,1,'#a9aab1');
  g.save();g.beginPath();g.roundRect(354.5,31,27.9,14.5,5.2);g.clip();
  g.fillStyle='#f2c825';g.fillRect(354.5,31,2,14.5);g.restore();
  text(g,'5',368.4,38.6,13.2,ink,650,'center');
  control(g,20,68.2,44,44,22);
  line(g,[[34.1,86.2],[41.1,86.2]],ink,1.9); line(g,[[34.1,94.1],[44,94.1]],ink,1.9);
  circle(g,47.8,85.4,3.9,'#bad843');
  control(g,300,68.2,100,44,22);
  for (const [x,h] of [[315.8,3],[320.8,6.1],[325.9,8.1],[331,3.8]])
    line(g,[[x,90-h],[x,90+h]],ink,1.8);
  line(g,[[367.6,90.4],[369,89],[372,88.2],[374.1,82.8],[381,82.8],[383.2,88.1],[386.1,89],[386.2,90.4]],ink,1.9);
  line(g,[[370.1,88.8],[384.2,88.8]],ink,1.7);
  for (const x of [371.1,379.9]) { g.beginPath();g.arc(x,95.0,3,0,Math.PI*2);g.strokeStyle=ink;g.lineWidth=1.85;g.stroke(); }
  line(g,[[374.2,94.4],[376.8,94.4]],ink,1.5);
}

function drawKey(g, x, y, w, label, special = false) {
  pill(g,x,y+0.9,w,44.8,6.2,special?'#9397a1':'#9ea2ae');
  pill(g,x,y,w,44.6,6.2,special?'#b4b8c3':'#fff');
  const cx=x+w/2, cy=y+22.3;
  if (label==='shift') {
    line(g,[[cx-5.4,cy+8.8],[cx-5.4,cy+1.2],[cx-9.6,cy+1.2],[cx,cy-9.7],[cx+9.6,cy+1.2],[cx+5.4,cy+1.2],[cx+5.4,cy+8.8],[cx-5.4,cy+8.8]],ink,1.6);
  } else if (label==='delete') {
    line(g,[[cx-10,cy],[cx-4.4,cy-6.7],[cx+8.5,cy-6.7],[cx+8.5,cy+6.7],[cx-4.4,cy+6.7],[cx-10,cy]],ink,1.55);
    line(g,[[cx-1.4,cy-2.8],[cx+4,cy+2.8]],ink,1.5);line(g,[[cx+4,cy-2.8],[cx-1.4,cy+2.8]],ink,1.5);
  } else if (label==='return') {
    line(g,[[cx+8.1,cy-5.5],[cx+8.1,cy-1],[cx+7,cy+1.7],[cx+4.2,cy+2.8],[cx-8,cy+2.8],[cx-3.7,cy-1.4]],ink,1.8);
    line(g,[[cx-8,cy+2.8],[cx-3.7,cy+7]],ink,1.8);
  } else if (label==='emoji') {
    g.beginPath();g.arc(cx,cy,8.6,0,Math.PI*2);g.strokeStyle=ink;g.lineWidth=1.5;g.stroke();
    circle(g,cx-2.9,cy-2,1.15,ink);circle(g,cx+2.9,cy-2,1.15,ink);
    g.beginPath();g.arc(cx,cy+0.2,4.2,.16*Math.PI,.84*Math.PI);g.stroke();
  } else if (label) {
    text(g,label,cx,cy+(label==='123'?0.1:-0.2),label==='123'?16.6:22.4,ink,400,'center');
  }
}
// The keyboard is a static part of each language's draft. Reuse its texture
// throughout the short thumb animation.
const keyboards = new Map();
function keyboard(copy) {
  if (keyboards.has(copy)) return keyboards.get(copy);
  const canvas=document.createElement('canvas');canvas.width=W*2;canvas.height=348*2;
  const g=canvas.getContext('2d');g.scale(2,2);g.translate(0,-564);
  g.lineJoin=g.lineCap='round';g.textBaseline='middle';
  const coat=g.createLinearGradient(0,565,0,912);
  coat.addColorStop(0,'#d9dbe1');coat.addColorStop(1,'#cdd0d9');
  pill(g,.2,565.4,419.6,347.2,26,coat,'#c5c7cd');
  copy.suggestions.forEach((s,i)=>text(g,s,70+i*140,590,16.7,muted,400,'center'));
  for (const x of [139.5,279.5]) line(g,[[x,579.7],[x,601.7]],'#b4b6be',.75);
  function row(letters,x,y,width) {
    const gap=7.1, key=(width-gap*(letters.length-1))/letters.length;
    [...letters].forEach((c,i)=>drawKey(g,x+i*(key+gap),y,key,c));
  }
  row('qwertyuiop',6.7,617.1,406.6);
  const wide=copy.middle.length===10;
  row(copy.middle,wide?6.7:26.7,673.1,wide?406.6:366.6);
  drawKey(g,6.7,729.1,48.3,'shift',true);
  row('zxcvbnm',66.6,729.1,286.9);
  drawKey(g,365.6,729.1,48,'delete',true);
  drawKey(g,6.7,785.1,45,'123',true);drawKey(g,57.8,785.1,46.4,'emoji',true);
  drawKey(g,110.1,785.1,200.2,'');text(g,copy.locale,305.5,819.3,10.9,'#84858c',430,'right');
  drawKey(g,316.6,785.1,97, 'return',true);
  const gx=42.6, gy=873;
  for (const rx of [12.3,6.0]) {g.beginPath();g.ellipse(gx,gy,rx,12.3,0,0,Math.PI*2);g.lineWidth=1.65;g.strokeStyle=ink;g.stroke();}
  line(g,[[gx,gy-12],[gx,gy+12]],ink,1.5);line(g,[[gx-12,gy],[gx+12,gy]],ink,1.5);
  for(const side of [-1,1]) {g.beginPath();g.moveTo(gx-10,gy+side*7.2);g.quadraticCurveTo(gx,gy+side*11,gx+10,gy+side*7.2);g.stroke();}
  mic(g,377.5,873,1.25);
  keyboards.set(copy,canvas);return canvas;
}
function toolsRow(g, y, labels) {
  line(g,[[26.8,y],[42.9,y]],ink,1.9);line(g,[[34.85,y-8],[34.85,y+8]],ink,1.9);
  text(g,labels.model,67,y+.6,14.7,ink,520);
  const width=g.measureText(labels.model).width;
  text(g,labels.effort,67+width+4.3,y+.6,14.5,muted);
}
function draft(g, ui, press, ripple) {
  control(g,12.3,463.1,395.2,89.5,22);
  const x=28.5, y=491.2;
  text(g,ui.prompt,x,y,17.0);
  const end=x+g.measureText(ui.prompt).width, marked=ui.prompt.indexOf(ui.keyboard.underline);
  if (marked>=0) {
    const start=x+g.measureText(ui.prompt.slice(0,marked)).width;
    line(g,[[start,y+7.1],[start+g.measureText(ui.keyboard.underline).width,y+7.1]],accent,1.65);
  }
  line(g,[[end+1.1,y-11.1],[end+1.1,y+11.1]],accent,1.6);
  toolsRow(g,send.y,ui.labels);mic(g,338.7,send.y,1);
  if (ripple>0 && ripple<1) {
    const q=1-(1-ripple)**2;
    g.beginPath();g.arc(send.x,send.y,send.radius+30*q,0,Math.PI*2);g.strokeStyle=`rgba(10,132,255,${.52*(1-q)})`;g.lineWidth=1.7;g.stroke();
  }
  g.save();g.translate(send.x,send.y);
  const contact=Math.min(1,Math.max(0,(press-.68)/.32)), scale=1-.10*contact;
  g.scale(scale,scale);circle(g,0,0,send.radius,contact>.5?'#006cd8':'#0a84ff');
  line(g,[[0,6.6],[0,-6.4],[-5.9,-.6]],'#fff',1.95);line(g,[[0,-6.4],[5.9,-.6]],'#fff',1.95);
  g.restore();g.drawImage(keyboard(ui.keyboard),0,564,W,348);
}

function conversation(g, ui, state) {
  const lines=state.cipher||state.bits||ui.promptLines;
  pill(g,108,153,291,98,30,state.cipher?'#1c2540':'#0a84ff');
  if(state.cipher) text(g,'🔒',83,200,27,ink,500,'center');
  lines.forEach((value,i)=>text(g,value,253,183+i*36,25,state.cipher?'#afc9ff':'#fff',600,'center'));
  control(g,12,744,396,95,26);text(g,ui.labels.ask,33,772,21,muted);
  toolsRow(g,813,ui.labels);mic(g,380,813);
  pill(g,145,888,130,5,2.5,'#18181a');
  if (state.mode!=='answer') return;
  g.font=`500 28px ${FONT}`;
  const answer=[''];
  for (const word of state.words) {
    const i=answer.length-1, next=answer[i]?answer[i]+' '+word:word;
    if(answer[i] && g.measureText(next).width>336) answer.push(word); else answer[i]=next;
  }
  if (!state.words.length) answer[0]='…';
  answer.forEach((value,i)=>text(g,value,31,306+i*41,28,ink,500));
}

export function paintPhone(g, w, h, ui, state, photo, press, ripple) {
  g.save();g.scale(w/W,h/H);g.lineJoin=g.lineCap='round';g.textBaseline='middle';
  if (!photo) {g.fillStyle='#fcfcfd';g.fillRect(0,0,W,H);}
  topBar(g,photo);
  if(state.mode==='draft') draft(g,ui,press,ripple); else conversation(g,ui,state);
  g.restore();
}
