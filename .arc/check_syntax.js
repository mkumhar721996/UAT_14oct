const fs = require('fs');
const html = fs.readFileSync('/opt/bnts-arc/home/sdlc/bounteous/UAT_14oct/worktrees/UAT-14OCT-STORY-012-employee-profile-employment-history/.arc/designs/UAT-14OCT-STORY-012-design.html', 'utf8');
const matches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
console.log('script blocks found:', matches.length);
matches.forEach((m, i) => {
  try {
    new Function(m[1]);
    console.log('block', i, 'OK, length', m[1].length);
  } catch (e) {
    console.log('block', i, 'SYNTAX ERROR:', e.message);
  }
});

const voidTags = new Set(['meta','link','input','br','img','hr']);
const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>/g;
let stack = [];
let m2;
function countLines(upto) {
  let n = 1;
  for (let i = 0; i < upto; i++) if (html[i] === '\n') n++;
  return n;
}
const cleaned = html
  .replace(/<script>[\s\S]*?<\/script>/g, '<script></script>')
  .replace(/<style>[\s\S]*?<\/style>/g, '<style></style>');
while ((m2 = tagRe.exec(cleaned))) {
  const [full, tag, selfClose] = m2;
  const isClosing = full[1] === '/';
  const tl = tag.toLowerCase();
  if (voidTags.has(tl) || selfClose === '/') continue;
  if (!isClosing) {
    stack.push({tag: tl, pos: m2.index});
  } else {
    if (stack.length === 0) {
      console.log('UNMATCHED CLOSE', tl, 'at line', countLines(m2.index));
      continue;
    }
    const top = stack[stack.length - 1];
    if (top.tag !== tl) {
      console.log('MISMATCH: expected close for', top.tag, '(opened at line', countLines(top.pos) + ') but got close for', tl, 'at line', countLines(m2.index));
      let idx = stack.length - 1;
      while (idx >= 0 && stack[idx].tag !== tl) idx--;
      if (idx >= 0) stack.length = idx; else continue;
    } else {
      stack.pop();
    }
  }
}
console.log('Unclosed tags remaining:', stack.map(s => s.tag + '@line' + countLines(s.pos)));
