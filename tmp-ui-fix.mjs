import fs from 'node:fs';
let b = fs.readFileSync('src/styles/base.css','utf8');
// Add consistent focus-visible for interactive elements after existing focus rule
b = b.replace(
'button:focus-visible,\na:focus-visible,\ninput:focus-visible {\n  outline: 2px solid var(--accent);\n  outline-offset: 3px;\n}',
'button:focus-visible,\na:focus-visible,\ninput:focus-visible,\n[role="button"]:focus-visible,\n[role="tab"]:focus-visible {\n  outline: 2px solid var(--accent);\n  outline-offset: 3px;\n}\n\n@media (prefers-reduced-motion: reduce) {\n  *, *::before, *::after {\n    animation-duration: 0.01ms !important;\n    animation-iteration-count: 1 !important;\n    transition-duration: 0.01ms !important;\n    scroll-behavior: auto !important;\n  }\n}'
);
fs.writeFileSync('src/styles/base.css',b);
console.log('done');
