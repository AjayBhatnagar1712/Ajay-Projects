#!/usr/bin/env python3
import html
import json
import os
import re
import sys
import textwrap
import urllib.request
import urllib.parse
from datetime import date, timedelta
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


DATABASE_URL = (
    "https://guru-vandan-default-rtdb.asia-southeast1.firebasedatabase.app"
    "/quotes.json"
)
SITE_ROOT = os.environ.get("SITE_ROOT", "https://guru-vandan.web.app").rstrip("/")
PLAY_STORE = "https://play.google.com/store/apps/details?id=com.ivar.guruvandan"
APP_STORE = "https://apps.apple.com/app/id6807657972"
LEGACY_START = date(2026, 9, 13)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    windows_name = "arialbd.ttf" if bold else "arial.ttf"
    candidates = [
        Path("/usr/share/fonts/truetype/dejavu") / name,
        Path("C:/Windows/Fonts") / windows_name,
    ]
    for path in candidates:
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default(size=size)


def wrap_for_width(draw: ImageDraw.ImageDraw, value: str, face, width: int):
    words = value.replace("\n", " ").split()
    lines = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if draw.textbbox((0, 0), candidate, font=face)[2] <= width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def make_card(path: Path, quote: str, author: str, scheduled: str, logo_path: Path):
    canvas = Image.new("RGB", (1200, 630), "#FBF6EC")
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((34, 34, 1166, 596), radius=26, fill="#FFFCF7", outline="#D2BDA7", width=3)
    draw.rounded_rectangle((34, 34, 1166, 146), radius=26, fill="#7B171D")
    draw.rectangle((34, 112, 1166, 146), fill="#7B171D")
    draw.text((76, 67), "GURU VANDAN", fill="#F2D193", font=font(39, True))
    if logo_path.exists():
        logo = Image.open(logo_path).convert("RGB")
        logo.thumbnail((94, 94))
        mask = Image.new("L", logo.size, 0)
        ImageDraw.Draw(mask).ellipse((0, 0, logo.width, logo.height), fill=255)
        canvas.paste(logo, (1012, 44), mask)
    draw.text((76, 170), "QUOTE OF THE DAY", fill="#C9963E", font=font(24, True))

    size = 48 if len(quote) < 115 else 40 if len(quote) < 190 else 34
    quote_font = font(size, True)
    lines = wrap_for_width(draw, quote, quote_font, 1030)
    lines = lines[:6]
    y = 226
    line_height = int(size * 1.28)
    for line in lines:
        draw.text((76, y), line, fill="#2B211F", font=quote_font)
        y += line_height

    footer_y = 520
    draw.text((76, footer_y), author, fill="#7B171D", font=font(27, True))
    draw.text((918, footer_y + 4), scheduled, fill="#675A55", font=font(20))
    path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(path, "PNG", optimize=True)


def landing_page(quote_id: str, quote: str, author: str, scheduled: str):
    safe_quote = html.escape(quote, quote=True)
    safe_author = html.escape(author, quote=True)
    safe_date = html.escape(scheduled, quote=True)
    page_url = f"{SITE_ROOT}/quote/{quote_id}/"
    image_url = f"{page_url}card.png"
    deep_link = f"guruvandan://quote/{quote_id}"
    web_link = f"{SITE_ROOT}/?quote={urllib.parse.quote(quote_id)}"
    js_id = json.dumps(quote_id)
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Guru Vandan - Quote of the Day</title>
  <meta name="description" content="{safe_quote}">
  <link rel="canonical" href="{page_url}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Guru Vandan">
  <meta property="og:title" content="Quote of the Day - Guru Vandan">
  <meta property="og:description" content="{safe_quote} - {safe_author}">
  <meta property="og:url" content="{page_url}">
  <meta property="og:image" content="{image_url}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Guru Vandan quote card">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Quote of the Day - Guru Vandan">
  <meta name="twitter:description" content="{safe_quote}">
  <meta name="twitter:image" content="{image_url}">
  <meta name="apple-itunes-app" content="app-id=6807657972, app-argument={deep_link}">
  <style>
    * {{ box-sizing: border-box; }}
    body {{ margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #fbf6ec; color: #2b211f; font-family: Georgia, serif; }}
    main {{ width: min(680px, 100%); }}
    article {{ padding: 34px; border: 1px solid #d2bda7; border-radius: 8px; background: #fffcf7; box-shadow: 0 18px 50px rgba(78,16,20,.12); }}
    .brand {{ color: #7b171d; font: 800 15px system-ui, sans-serif; }}
    h1 {{ margin: 20px 0 8px; font-size: clamp(30px, 6vw, 52px); line-height: 1.12; letter-spacing: 0; }}
    .author {{ color: #7b171d; font: 800 18px system-ui, sans-serif; }}
    .date {{ color: #675a55; font: 600 14px system-ui, sans-serif; }}
    nav {{ display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 18px; }}
    a {{ display: block; padding: 15px 18px; border-radius: 8px; text-align: center; text-decoration: none; font: 800 16px system-ui, sans-serif; }}
    .open {{ color: #fff; background: #7b171d; }}
    .store {{ color: #7b171d; border: 1px solid #7b171d; background: #fff; }}
    .web {{ color: #7b171d; border: 1px solid #d1ad67; background: #fff8e9; }}
    @media (max-width: 560px) {{ nav {{ grid-template-columns: 1fr; }} }}
  </style>
</head>
<body>
  <main>
    <article>
      <div class="brand">GURU VANDAN</div>
      <h1>{safe_quote}</h1>
      <p class="author">{safe_author}</p>
      <p class="date">{safe_date}</p>
    </article>
    <nav>
      <a class="open" id="open-app" href="{deep_link}">Open in Guru Vandan app</a>
      <a class="web" href="{web_link}">Continue on the website</a>
      <a class="store android" href="{PLAY_STORE}">Get it on Google Play</a>
      <a class="store ios" href="{APP_STORE}">Download on the App Store</a>
    </nav>
  </main>
  <script>
    (() => {{
      const id = {js_id};
      const ua = navigator.userAgent || '';
      const android = /Android/i.test(ua);
      const ios = /iPhone|iPad|iPod/i.test(ua);
      document.querySelector('.android').hidden = ios;
      document.querySelector('.ios').hidden = android;
      const openButton = document.querySelector('#open-app');
      openButton.addEventListener('click', (event) => {{
        event.preventDefault();
        openAppOrStore();
      }});
      function openAppOrStore() {{
        sessionStorage.setItem(`guru-vandan-quote-route-${{id}}`, 'yes');
        if (android) {{
          const fallback = encodeURIComponent('{PLAY_STORE}');
          location.href = `intent://quote/${{id}}#Intent;scheme=guruvandan;package=com.ivar.guruvandan;S.browser_fallback_url=${{fallback}};end`;
        }} else {{
          if (ios) setTimeout(() => {{
            if (!document.hidden) location.replace('{APP_STORE}');
          }}, 1600);
          if (ios) {{
            const appFrame = document.createElement('iframe');
            appFrame.style.display = 'none';
            appFrame.src = `guruvandan://quote/${{id}}`;
            document.body.appendChild(appFrame);
          }} else {{
            location.href = `guruvandan://quote/${{id}}`;
          }}
        }}
      }}
      if ((android || ios) && sessionStorage.getItem(`guru-vandan-quote-route-${{id}}`) !== 'yes') {{
        setTimeout(openAppOrStore, 250);
      }}
    }})();
  </script>
</body>
</html>
"""


def main():
    output = Path(sys.argv[1] if len(sys.argv) > 1 else "build/web")
    with urllib.request.urlopen(DATABASE_URL, timeout=20) as response:
        payload = json.load(response) or {}

    quotes = []
    for quote_id, value in payload.items():
        if not isinstance(value, dict) or value.get("active") is False:
            continue
        safe_id = re.sub(r"[^A-Za-z0-9_-]", "", quote_id)
        if not safe_id:
            continue
        quotes.append((safe_id, value))

    quotes.sort(key=lambda item: int(item[1].get("createdAt") or 0), reverse=True)
    legacy_index = 0
    for quote_id, value in quotes:
        scheduled = value.get("scheduledDate")
        if not scheduled:
            scheduled = (LEGACY_START + timedelta(days=legacy_index)).isoformat()
            legacy_index += 1
        quote = str(value.get("textEnglish") or value.get("text") or "").strip()
        author = str(value.get("authorEnglish") or value.get("author") or "Maharshi Mehi Paramhans").strip()
        if author == "Sadguru Maharaj":
            author = "Maharshi Mehi Paramhans"
        if not quote:
            continue

        page_dir = output / "quote" / quote_id
        page_dir.mkdir(parents=True, exist_ok=True)
        make_card(
            page_dir / "card.png",
            quote,
            author,
            scheduled,
            output / "icons" / "Icon-512.png",
        )
        (page_dir / "index.html").write_text(
            landing_page(quote_id, quote, author, scheduled),
            encoding="utf-8",
        )

    print(f"Generated {len(quotes)} quote landing pages")


if __name__ == "__main__":
    main()
