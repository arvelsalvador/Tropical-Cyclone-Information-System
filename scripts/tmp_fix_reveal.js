const fs = require('fs');
const path = 'pages/resources.html';
let content = fs.readFileSync(path, 'utf8');
if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);

let changes = 0;

// Fix missing section titles (literal & not &amp;)
const titles = [
  ['class="res-section-title">Official Agencies & Websites</h2>', 'class="res-section-title" data-reveal>Official Agencies & Websites</h2>'],
  ['class="res-section-title">Local Government & Community</h2>', 'class="res-section-title" data-reveal>Local Government & Community</h2>'],
];
for (const [old, neu] of titles) {
  let idx = content.indexOf(old);
  if (idx !== -1) {
    content = content.substring(0, idx) + neu + content.substring(idx + old.length);
    changes++;
    console.log('Fixed: ' + old.substring(25, 50));
  } else console.log('NOT FOUND: ' + old.substring(0, 50));
}

// Fix missing section subs (CRLF line endings)
const subs = [
  ['class="res-section-sub">\r\n        Save these numbers', 'class="res-section-sub" data-reveal style="--reveal-delay: 0.06s">\r\n        Save these numbers'],
  ['class="res-section-sub">\r\n        Bookmark these sites', 'class="res-section-sub" data-reveal style="--reveal-delay: 0.06s">\r\n        Bookmark these sites'],
  ['class="res-section-sub">\r\n        Your barangay', 'class="res-section-sub" data-reveal style="--reveal-delay: 0.06s">\r\n        Your barangay'],
  ['class="res-section-sub">\r\n        Trusted international', 'class="res-section-sub" data-reveal style="--reveal-delay: 0.06s">\r\n        Trusted international'],
];
for (const [old, neu] of subs) {
  let idx = content.indexOf(old);
  if (idx !== -1) {
    content = content.substring(0, idx) + neu + content.substring(idx + old.length);
    changes++;
    console.log('Fixed sub: ' + neu.substring(60, 90));
  } else console.log('NOT FOUND: ' + old.substring(0, 50));
}

fs.writeFileSync(path, content, 'utf8');
console.log('Total fix changes: ' + changes);
