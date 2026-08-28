const fs = require('fs');
const path = 'pages/resources.html';
let c = fs.readFileSync(path, 'utf8');
if (c.charCodeAt(0) === 0xFEFF) c = c.slice(1);
let n = 0;

const uniq = [
  ['class="res-hero-quick">', 'class="res-hero-quick" data-reveal>'],
  ['class="res-section-title">Emergency Hotlines</h2>', 'class="res-section-title" data-reveal>Emergency Hotlines</h2>'],
  ['class="res-section-title">Official Agencies & Websites</h2>', 'class="res-section-title" data-reveal>Official Agencies & Websites</h2>'],
  ['class="res-section-title">Local Government & Community</h2>', 'class="res-section-title" data-reveal>Local Government & Community</h2>'],
  ['class="res-section-title">External Resources</h2>', 'class="res-section-title" data-reveal>External Resources</h2>'],
];
for (const [o, r] of uniq) {
  let i = c.indexOf(o);
  if (i !== -1) { c = c.substring(0, i) + r + c.substring(i + o.length); n++; }
}

const subs = ['Save these numbers','Bookmark these sites','Your barangay','Trusted international'];
for (const text of subs) {
  let o = 'class="res-section-sub">\r\n        ' + text;
  let r = 'class="res-section-sub" data-reveal style="--reveal-delay: 0.06s">\r\n        ' + text;
  let i = c.indexOf(o);
  if (i !== -1) { c = c.substring(0, i) + r + c.substring(i + o.length); n++; }
}

const hs = 'class="res-hotline">';
const hd = ['0.12s','0.18s','0.24s','0.30s','0.36s','0.42s'];
let sp = 0;
for (const d of hd) {
  let v = 0, idx = sp - 1;
  while (true) {
    idx = c.indexOf(hs, idx + 1);
    if (idx === -1) break;
    let b = c.substring(Math.max(0,idx-100), idx);
    if (!b.includes('data-reveal')) { v++; if (v===1) {
      let r = 'class="res-hotline" data-reveal style="--reveal-delay: ' + d + '">';
      c = c.substring(0, idx) + r + c.substring(idx + hs.length);
      sp = idx + r.length; n++; break;
    }}
  }
}

const cs = 'class="res-card">';
const cd = ['0.10s','0.15s','0.10s','0.15s'];
sp = 0;
for (const d of cd) {
  while (true) {
    let idx = c.indexOf(cs, sp);
    if (idx === -1) break;
    let b = c.substring(Math.max(0,idx-100), idx);
    if (b.includes('data-reveal')) { sp = idx + 1; continue; }
    let a = c.substring(idx + cs.length, idx + 600);
    if (a.includes('res-card-header')) {
      let r = 'class="res-card" data-reveal style="--reveal-delay: ' + d + '">';
      c = c.substring(0, idx) + r + c.substring(idx + cs.length);
      sp = idx + r.length; n++; break;
    }
    sp = idx + 1;
  }
}

const ls = 'class="res-link-row"';
const ld = ['0.10s','0.15s','0.20s','0.25s'];
sp = 0;
for (const d of ld) {
  let idx = c.indexOf(ls, sp);
  if (idx !== -1) {
    let b = c.substring(Math.max(0,idx-100), idx);
    if (b.includes('data-reveal')) idx = c.indexOf(ls, idx + 1);
    if (idx !== -1) {
      let r = 'class="res-link-row" data-reveal style="--reveal-delay: ' + d + '">';
      c = c.substring(0, idx) + r + c.substring(idx + ls.length);
      sp = idx + r.length; n++;
    }
  }
}

fs.writeFileSync(path, c, 'utf8');
console.log('Changes: ' + n);
console.log('data-reveal count: ' + (c.match(/data-reveal/g) || []).length);
