export function quotePageShell(homepage, previous) {
  const head = previous.match(/<head>([\s\S]*?)<\/head>/i)?.[1];
  const header = homepage.match(/<header class="site-header quote-only">[\s\S]*?<\/header>/)?.[0];
  const main = homepage.match(/<main id="quote-page"[\s\S]*?<\/main>/)?.[0];
  const footer = homepage.match(/<footer class="quote-only">[\s\S]*?<\/footer>/)?.[0];
  if (!head || !header || !main || !footer) throw new Error('Quote page template incomplete');
  const english = previous.match(/<h1>([\s\S]*?)<\/h1>/)?.[1];
  const content = english ? main.replace('Loading the shared quote…', english) : main;
  return `<!DOCTYPE html>
<html lang="en" class="quote-route">
<head>${head.replace(/<style>[\s\S]*?<\/style>/gi, '')}
<link rel="icon" href="/assets/assets/images/chakra_logo.png" />
<link rel="stylesheet" href="/site.css" />
<link rel="stylesheet" href="/cinema/film.css" />
<link rel="stylesheet" href="/website-language.css" />
<link rel="stylesheet" href="/website-theme.css" />
<script type="module" src="/website-language.mjs"></script>
</head>
<body>
${header}
${content.replace(' hidden>', '>')}
${footer}
<script src="/quote_page.js"></script>
</body>
</html>\n`;
}
