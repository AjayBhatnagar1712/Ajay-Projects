import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public', 'marketing');
const outputDir = path.join(root, 'outputs', 'marketing');
const backgroundPath = path.join(outputDir, 'dcam-join-poster-background.png');
const logoPath = path.join(root, 'public', 'dcam-logo.jpg');
const pngPath = path.join(publicDir, 'dcam-join-poster.png');
const svgPath = path.join(outputDir, 'dcam-join-poster.svg');

const width = 1080;
const height = 1620;

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function tspanLines(lines, x, y, lineHeight, attrs = '') {
  return lines
    .map((line, index) => {
      const dy = index === 0 ? 0 : lineHeight;
      return `<tspan x="${x}" dy="${dy}" ${attrs}>${escapeXml(line)}</tspan>`;
    })
    .join('');
}

function bulletLines(lines, x, y, lineHeight, color = '#dff7ff', fontSize = 21, dotSize = 4.5) {
  return lines
    .map((line, index) => {
      const cy = y + index * lineHeight;
      return `
        <circle cx="${x}" cy="${cy - 6}" r="${dotSize}" fill="${index % 2 === 0 ? '#67e8f9' : '#fb923c'}" opacity="0.95"/>
        <text x="${x + 22}" y="${cy}" font-family="Segoe UI, Arial, sans-serif" font-size="${fontSize}" font-weight="650" fill="${color}" opacity="0.96">${escapeXml(line)}</text>
      `;
    })
    .join('');
}

function valuePill(label, x, y, width, fill, stroke) {
  return `
    <rect x="${x}" y="${y}" width="${width}" height="54" rx="18" fill="${fill}" opacity="0.72" stroke="${stroke}" stroke-opacity="0.28"/>
    <text x="${x + width / 2}" y="${y + 34}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="850" fill="#eefcff">${escapeXml(label)}</text>
  `;
}

await fs.mkdir(publicDir, { recursive: true });
await fs.mkdir(outputDir, { recursive: true });

const background = await sharp(backgroundPath)
  .resize(width, height, { fit: 'cover', position: 'center' })
  .png()
  .toBuffer();

const logo = await sharp(logoPath)
  .resize(126, 126, { fit: 'cover' })
  .png()
  .toBuffer();

const bgData = `data:image/png;base64,${background.toString('base64')}`;
const logoData = `data:image/png;base64,${logo.toString('base64')}`;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="pageShade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#020617" stop-opacity="0.30"/>
      <stop offset="0.44" stop-color="#020617" stop-opacity="0.10"/>
      <stop offset="1" stop-color="#020617" stop-opacity="0.50"/>
    </linearGradient>
    <radialGradient id="centerGlow" cx="50%" cy="38%" r="52%">
      <stop offset="0" stop-color="#123e66" stop-opacity="0.72"/>
      <stop offset="0.48" stop-color="#071426" stop-opacity="0.52"/>
      <stop offset="1" stop-color="#020617" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="panelFill" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b2a45" stop-opacity="0.88"/>
      <stop offset="1" stop-color="#06101f" stop-opacity="0.80"/>
    </linearGradient>
    <linearGradient id="teacherPanelFill" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#113d35" stop-opacity="0.84"/>
      <stop offset="1" stop-color="#08111f" stop-opacity="0.82"/>
    </linearGradient>
    <linearGradient id="ctaFill" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#22d3ee"/>
      <stop offset="0.52" stop-color="#38bdf8"/>
      <stop offset="1" stop-color="#fb923c"/>
    </linearGradient>
    <clipPath id="logoClip">
      <rect x="70" y="58" width="92" height="92" rx="24"/>
    </clipPath>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="24" stdDeviation="18" flood-color="#000814" flood-opacity="0.45"/>
    </filter>
  </defs>

  <image href="${bgData}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/>
  <rect width="${width}" height="${height}" fill="url(#pageShade)"/>
  <rect width="${width}" height="${height}" fill="url(#centerGlow)"/>

  <g filter="url(#softShadow)">
    <rect x="54" y="48" width="972" height="1305" rx="44" fill="#020617" opacity="0.24"/>
    <rect x="70" y="175" width="940" height="884" rx="46" fill="#061426" opacity="0.72" stroke="#67e8f9" stroke-opacity="0.18" stroke-width="2"/>
  </g>

  <image href="${logoData}" x="70" y="58" width="92" height="92" clip-path="url(#logoClip)"/>
  <rect x="70" y="58" width="92" height="92" rx="24" fill="none" stroke="#8be9ff" stroke-opacity="0.22" stroke-width="2"/>
  <text x="182" y="92" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="800" fill="#f8fdff">DCAM Classes</text>
  <text x="184" y="127" font-family="Segoe UI, Arial, sans-serif" font-size="19" font-weight="600" fill="#b9e8f5">Online exam preparation and teaching platform</text>

  <rect x="724" y="74" width="286" height="48" rx="24" fill="#041525" opacity="0.82" stroke="#67e8f9" stroke-opacity="0.30"/>
  <text x="867" y="105" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="800" letter-spacing="2" fill="#bdf7ff">STUDENTS + TEACHERS</text>

  <rect x="317" y="215" width="446" height="46" rx="23" fill="#062f4a" opacity="0.84" stroke="#22d3ee" stroke-opacity="0.34"/>
  <text x="540" y="245" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="900" letter-spacing="2.8" fill="#8be9ff">LEARN. TEACH. GROW.</text>

  <text x="540" y="340" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="76" font-weight="950" fill="#ffffff">Join DCAM Classes</text>
  <text x="540" y="398" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="31" font-weight="750" fill="#e7fbff">One platform for students, teachers, and exam success</text>
  <text x="540" y="450" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="23" font-weight="750" fill="#a6eaff">Courses  |  Live batches  |  Mock tests  |  Practice  |  Doubt support</text>

  <g>
    <rect x="84" y="516" width="444" height="505" rx="28" fill="url(#panelFill)" stroke="#38bdf8" stroke-opacity="0.28" stroke-width="2"/>
    <rect x="112" y="544" width="218" height="38" rx="19" fill="#0ea5e9" opacity="0.25"/>
    <text x="132" y="570" font-family="Segoe UI, Arial, sans-serif" font-size="15" font-weight="900" letter-spacing="1.8" fill="#93f1ff">WHY STUDENTS JOIN</text>
    <text x="112" y="632" font-family="Segoe UI, Arial, sans-serif" font-size="31" font-weight="900" fill="#ffffff">
      ${tspanLines(['Prepare with', 'structure and support'], 112, 632, 36)}
    </text>
    <text x="112" y="702" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="650" fill="#cdecf7">
      ${tspanLines(['Find the right teacher, stay consistent,', 'and track your full exam journey.'], 112, 702, 28)}
    </text>
    ${bulletLines([
      'Discover teachers for your exam goal',
      'Join courses and live online batches',
      'Practice daily with question banks',
      'Attempt mock tests and custom mocks',
      'Ask doubts and keep learning moving',
      'Track progress, attempts, and scores',
      'Follow exam bulletins and deadlines',
    ], 118, 784, 34, '#e8fbff', 19)}
  </g>

  <g>
    <rect x="552" y="516" width="444" height="505" rx="28" fill="url(#teacherPanelFill)" stroke="#34d399" stroke-opacity="0.30" stroke-width="2"/>
    <rect x="580" y="544" width="218" height="38" rx="19" fill="#10b981" opacity="0.25"/>
    <text x="600" y="570" font-family="Segoe UI, Arial, sans-serif" font-size="15" font-weight="900" letter-spacing="1.8" fill="#adf7d7">WHY TEACHERS JOIN</text>
    <text x="580" y="632" font-family="Segoe UI, Arial, sans-serif" font-size="31" font-weight="900" fill="#ffffff">
      ${tspanLines(['Launch your', 'teaching online'], 580, 632, 36)}
    </text>
    <text x="580" y="702" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="650" fill="#dbfff1">
      ${tspanLines(['Create, manage, and deliver learning', 'with professional teaching tools.'], 580, 702, 28)}
    </text>
    ${bulletLines([
      'Build courses and study plans',
      'Run live batches and scheduled classes',
      'Publish mock tests and practice sets',
      'Manage students and enrolments',
      'Support doubts and updates in one place',
      'Track learner activity and follow-up',
      'Grow a trusted teaching presence',
    ], 586, 784, 34, '#e8fff5', 19)}
  </g>

  <g>
    ${valuePill('Teacher Discovery', 96, 1077, 198, '#08263c', '#67e8f9')}
    ${valuePill('Live Classes', 314, 1077, 160, '#08263c', '#67e8f9')}
    ${valuePill('Mock Tests', 494, 1077, 154, '#102a23', '#34d399')}
    ${valuePill('Daily Practice', 668, 1077, 172, '#102a23', '#34d399')}
    ${valuePill('Exam Updates', 858, 1077, 126, '#2f1b0d', '#fb923c')}
  </g>

  <g filter="url(#softShadow)">
    <rect x="96" y="1160" width="888" height="196" rx="36" fill="#061426" opacity="0.88" stroke="#67e8f9" stroke-opacity="0.25" stroke-width="2"/>
    <rect x="150" y="1190" width="780" height="68" rx="34" fill="url(#ctaFill)"/>
    <text x="540" y="1235" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="37" font-weight="950" fill="#04111f">Register today at dcamclasses.in</text>
    <text x="540" y="1302" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="24" font-weight="850" fill="#f4fdff">Call / WhatsApp: 9990653416</text>
    <text x="540" y="1334" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="21" font-weight="750" fill="#bff6ff">YouTube: DCAM Classes  |  Instagram: @dcamclasses</text>
  </g>

  <text x="540" y="1454" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="25" font-weight="850" fill="#ecfeff">JEE Main  |  NEET  |  Engineering  |  Medical  |  Competitive Exams</text>
  <text x="540" y="1502" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="21" font-weight="750" fill="#a8ecff">Student Enquiry  |  Teacher Enquiry  |  Courses  |  Batches  |  Tests</text>
</svg>`;

await fs.writeFile(svgPath, svg, 'utf8');
await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(pngPath);

console.log(`Wrote ${pngPath}`);
console.log(`Wrote ${svgPath}`);
