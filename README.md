# ⚡ flipr.exe

> **Stop letting `.webp` ruin your life.**  
> Convert literally any image on the web into whatever format you actually want. Right from the context menu. No cap.

---

### 💀 The Problem

You find a god-tier wallpaper on Google or Pinterest. You hit **Save image as…**, ready to bless your desktop setup. 

And then Windows drops this on you:
```
fire-wallpaper-4k.webp
```

Now Windows photo viewer is confused, your graphic design software refuses to open it, Discord is acting weird, and you’re stuck looking up online converters with 47 pop-up ads just to get a regular PNG. You're cooked.

---

### ⚡ Enter `flipr.exe`

A no-nonsense Chrome extension that sits in your right-click menu. 

When you see an image you like:
1. **Right-click it** ➔ **`⚡ Convert Image with flipr.exe...`**
2. A sleek dark modal pops up showing the **real format**, resolution & size.
3. Tap **PNG**, **JPEG**, **SVG**, **WEBP**, **BMP**, or **GIF**.
4. Hit **Flip & Save**. 

Boom. Downloaded in the exact format you wanted. Zero ads, zero sketch cloud uploads, instant conversion.

---

### 🔥 What makes it goated?

- **Any format ➜ Any format:** Whether it's a cursed `.webp`, an obscure `.avif`, a giant `.png`, or a `.jpeg`, flip it to whatever format you need.
- **SVG export included:** Need vector wrappers for Figma or code? It does that too.
- **Zero fake extensions:** Google loves naming a WebP image `image.jpg`. `flipr.exe` sniffs the raw binary bytes so you always know what the file *actually* is.
- **100% client-side:** Everything runs locally inside your browser via Canvas API. No external servers, no API keys, nobody looking at your wallpaper stash.
- **No AI slop aesthetic:** Crisp, matte dark mode with clean high-contrast buttons. 

---

### 🛠️ Supported Formats

| You have (Source) | | You want (Target) |
|---|:---:|---|
| **WebP, AVIF, JPEG, PNG, GIF, BMP, SVG, ICO...** | ➔ | **PNG** *(lossless, wallpaper standard)*<br>**JPEG** *(photos, with quality slider)*<br>**WEBP** *(small file sizes)*<br>**SVG** *(vector container)*<br>**BMP** *(raw bitmap)*<br>**GIF** *(graphics)* |

---

### 🚀 How to Install (30 seconds)

1. Clone or download this repo into a folder (e.g. `flipr.exe`).
2. Open Google Chrome and go to:
   ```
   chrome://extensions
   ```
3. Toggle on **Developer mode** in the top-right corner.
4. Click **Load unpacked** (top-left).
5. Pick the `flipr.exe` folder.
6. That's it. Go right-click any image and test it out.

---

### ⌨️ Tech Stack

- **Manifest V3** (Current Chrome extension standard)
- **HTML5 Canvas & Blob API** (Instant client-side rendering)
- **Binary Magic Bytes Detector** (Real payload format sniffing)
- **Zero dependencies** (Pure vanilla JS, HTML, CSS)

---

### ✌️ License

MIT. Do whatever you want with it, just stop saving `.webp` files manually.
