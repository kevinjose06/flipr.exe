// flipr.exe - Content Script
// Clean, native, high-performance image converter with real format detection & SVG support

(function () {
  const FLIPR_KEY = Symbol.for("__flipr_injected__");
  if (window[FLIPR_KEY]) return;
  window[FLIPR_KEY] = true;

  // ─── Detect Actual Image Format from Magic Bytes & MIME ───────────────────

  function identifyBytesFormat(uint8) {
    if (!uint8 || uint8.length < 4) return null;

    // JPEG: FF D8 FF
    if (uint8[0] === 0xFF && uint8[1] === 0xD8 && uint8[2] === 0xFF) {
      return { format: "JPEG", mime: "image/jpeg", ext: "jpg" };
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (uint8[0] === 0x89 && uint8[1] === 0x50 && uint8[2] === 0x4E && uint8[3] === 0x47) {
      return { format: "PNG", mime: "image/png", ext: "png" };
    }

    // WebP: RIFF .... WEBP
    if (uint8[0] === 0x52 && uint8[1] === 0x49 && uint8[2] === 0x46 && uint8[3] === 0x46 && uint8.length >= 12) {
      const tag = String.fromCharCode(uint8[8], uint8[9], uint8[10], uint8[11]);
      if (tag === "WEBP") {
        return { format: "WEBP", mime: "image/webp", ext: "webp" };
      }
    }

    // GIF: GIF87a or GIF89a
    if (uint8[0] === 0x47 && uint8[1] === 0x49 && uint8[2] === 0x46 && uint8[3] === 0x38) {
      return { format: "GIF", mime: "image/gif", ext: "gif" };
    }

    // BMP: BM (42 4D)
    if (uint8[0] === 0x42 && uint8[1] === 0x4D) {
      return { format: "BMP", mime: "image/bmp", ext: "bmp" };
    }

    // AVIF / HEIF: ftypavif or ftypheic in first 16 bytes
    if (uint8.length >= 12) {
      const box = String.fromCharCode(uint8[4], uint8[5], uint8[6], uint8[7]);
      const brand = String.fromCharCode(uint8[8], uint8[9], uint8[10], uint8[11]);
      if (box === "ftyp" && (brand === "avif" || brand === "avis")) {
        return { format: "AVIF", mime: "image/avif", ext: "avif" };
      }
    }

    // SVG: check text snippet
    try {
      const text = new TextDecoder().decode(uint8.subarray(0, 100)).trim().toLowerCase();
      if (text.startsWith("<svg") || text.startsWith("<?xml")) {
        return { format: "SVG", mime: "image/svg+xml", ext: "svg" };
      }
    } catch {}

    return null;
  }

  // ─── Inject Clean, Minimalist Styles (No AI gradients) ─────────────────────

  function injectStyles() {
    if (document.getElementById("flipr-styles")) return;
    const style = document.createElement("style");
    style.id = "flipr-styles";
    style.textContent = `
      #flipr-overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.78);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: #f4f4f5;
        padding: 16px;
        box-sizing: border-box;
      }

      #flipr-modal {
        background: #18181b;
        border: 1px solid #27272a;
        border-radius: 14px;
        box-shadow: 0 24px 48px rgba(0, 0, 0, 0.6), 0 1px 2px rgba(0, 0, 0, 0.3);
        width: 460px;
        max-width: 100%;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      #flipr-header {
        padding: 16px 20px;
        display: flex;
        align-items: center;
        gap: 12px;
        border-bottom: 1px solid #27272a;
        background: #18181b;
      }

      #flipr-header-icon {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        border: 1px solid #3f3f46;
        background: #27272a;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        flex-shrink: 0;
      }

      #flipr-header-icon img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      #flipr-header-title {
        flex: 1;
        min-width: 0;
      }

      #flipr-header-title h2 {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
        color: #fafafa;
        letter-spacing: -0.2px;
      }

      #flipr-header-title p {
        margin: 2px 0 0;
        font-size: 12px;
        color: #a1a1aa;
      }

      #flipr-close {
        width: 28px;
        height: 28px;
        border-radius: 6px;
        border: 1px solid transparent;
        background: transparent;
        color: #a1a1aa;
        font-size: 14px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s ease;
      }

      #flipr-close:hover {
        background: #27272a;
        color: #fafafa;
      }

      #flipr-body {
        padding: 18px 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      /* Preview container */
      #flipr-preview-box {
        background: #09090b;
        border: 1px solid #27272a;
        border-radius: 10px;
        overflow: hidden;
        position: relative;
        display: flex;
        flex-direction: column;
      }

      #flipr-preview-img-wrap {
        height: 150px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 10px;
        position: relative;
      }

      #flipr-preview {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        display: block;
        border-radius: 6px;
      }

      #flipr-preview-loading {
        font-size: 12px;
        color: #71717a;
      }

      /* Detected actual format & metadata strip */
      #flipr-meta-strip {
        border-top: 1px solid #27272a;
        background: #121214;
        padding: 8px 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 11px;
      }

      .flipr-meta-item {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .flipr-meta-label {
        color: #71717a;
        text-transform: uppercase;
        font-weight: 600;
        letter-spacing: 0.5px;
      }

      .flipr-format-tag {
        font-weight: 700;
        padding: 2px 7px;
        border-radius: 4px;
        background: #27272a;
        border: 1px solid #3f3f46;
        color: #38bdf8;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      }

      .flipr-meta-val {
        color: #d4d4d8;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      }

      /* Section label */
      .flipr-label {
        font-size: 11px;
        font-weight: 600;
        color: #a1a1aa;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        margin-bottom: 8px;
      }

      /* Target format grid */
      #flipr-formats {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 6px;
      }

      .flipr-fmt-btn {
        background: #202023;
        border: 1px solid #27272a;
        border-radius: 8px;
        padding: 9px 4px;
        color: #d4d4d8;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
        text-align: center;
        font-family: inherit;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
      }

      .flipr-fmt-btn:hover {
        background: #27272a;
        border-color: #3f3f46;
        color: #fafafa;
      }

      .flipr-fmt-btn.active {
        background: #fafafa;
        border-color: #fafafa;
        color: #09090b;
        font-weight: 700;
      }

      .flipr-fmt-sub {
        font-size: 9px;
        font-weight: 500;
        opacity: 0.7;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }

      /* Quality slider */
      #flipr-quality-wrap {
        display: none;
        background: #121214;
        border: 1px solid #27272a;
        border-radius: 8px;
        padding: 10px 14px;
      }

      #flipr-quality-wrap.visible {
        display: block;
      }

      #flipr-quality-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
        font-size: 11px;
      }

      #flipr-quality-val {
        color: #fafafa;
        font-weight: 600;
        font-family: ui-monospace, SFMono-Regular, monospace;
      }

      #flipr-quality {
        -webkit-appearance: none;
        appearance: none;
        width: 100%;
        height: 4px;
        border-radius: 2px;
        background: #3f3f46;
        outline: none;
        cursor: pointer;
      }

      #flipr-quality::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #fafafa;
        cursor: pointer;
        border: none;
      }

      /* Filename input */
      #flipr-filename-wrap {
        display: flex;
        flex-direction: column;
      }

      #flipr-filename {
        background: #09090b;
        border: 1px solid #27272a;
        border-radius: 8px;
        padding: 9px 12px;
        color: #fafafa;
        font-size: 13px;
        font-family: inherit;
        outline: none;
        transition: border-color 0.15s ease;
        box-sizing: border-box;
        width: 100%;
      }

      #flipr-filename:focus {
        border-color: #52525b;
      }

      /* Status message */
      #flipr-status {
        font-size: 12px;
        padding: 8px 12px;
        border-radius: 6px;
        display: none;
      }

      #flipr-status.loading {
        display: block;
        background: #1e1e24;
        border: 1px solid #2e2e38;
        color: #93c5fd;
      }

      #flipr-status.error {
        display: block;
        background: #271415;
        border: 1px solid #4c1d24;
        color: #fca5a5;
      }

      #flipr-status.success {
        display: block;
        background: #0d2818;
        border: 1px solid #164e28;
        color: #86efac;
      }

      /* Footer buttons */
      #flipr-footer {
        padding: 0 20px 18px;
        display: flex;
        gap: 10px;
      }

      #flipr-cancel-btn {
        flex: 1;
        padding: 10px 14px;
        border-radius: 8px;
        border: 1px solid #27272a;
        background: #202023;
        color: #d4d4d8;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        font-family: inherit;
        transition: all 0.15s ease;
      }

      #flipr-cancel-btn:hover {
        background: #27272a;
        color: #fafafa;
      }

      #flipr-save-btn {
        flex: 2;
        padding: 10px 16px;
        border-radius: 8px;
        border: 1px solid #fafafa;
        background: #fafafa;
        color: #09090b;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
        transition: all 0.15s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }

      #flipr-save-btn:hover:not(:disabled) {
        background: #e4e4e7;
        border-color: #e4e4e7;
      }

      #flipr-save-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `;
    document.head.appendChild(style);
  }

  // ─── Modal HTML Template ───────────────────────────────────────────────────

  function createModal() {
    const iconUrl = (chrome && chrome.runtime && chrome.runtime.getURL)
      ? chrome.runtime.getURL("icons/icon48.png")
      : "";

    const overlay = document.createElement("div");
    overlay.id = "flipr-overlay";
    overlay.innerHTML = `
      <div id="flipr-modal" role="dialog" aria-modal="true" aria-label="flipr.exe">
        <div id="flipr-header">
          <div id="flipr-header-icon">
            <img alt="icon"/>
          </div>
          <div id="flipr-header-title">
            <h2>flipr.exe</h2>
            <p>Save &amp; convert image to any format</p>
          </div>
          <button id="flipr-close" title="Close" aria-label="Close">✕</button>
        </div>

        <div id="flipr-body">
          <!-- Image preview & actual format detection -->
          <div id="flipr-preview-box">
            <div id="flipr-preview-img-wrap">
              <span id="flipr-preview-loading">Loading image…</span>
              <img id="flipr-preview" style="display:none" alt="Preview" crossorigin="anonymous" />
            </div>
            <div id="flipr-meta-strip">
              <div class="flipr-meta-item">
                <span class="flipr-meta-label">Actual Format:</span>
                <span class="flipr-format-tag" id="flipr-actual-format">Detecting…</span>
              </div>
              <div class="flipr-meta-item">
                <span class="flipr-meta-label">Dimensions:</span>
                <span class="flipr-meta-val" id="flipr-dimensions">—</span>
              </div>
              <div class="flipr-meta-item">
                <span class="flipr-meta-label">Size:</span>
                <span class="flipr-meta-val" id="flipr-filesize">—</span>
              </div>
            </div>
          </div>

          <!-- Format selector with SVG included -->
          <div>
            <div class="flipr-label">Target Format</div>
            <div id="flipr-formats">
              <button class="flipr-fmt-btn active" data-format="png">
                <span>PNG</span>
                <span class="flipr-fmt-sub">Lossless</span>
              </button>
              <button class="flipr-fmt-btn" data-format="jpeg">
                <span>JPEG</span>
                <span class="flipr-fmt-sub">Photo</span>
              </button>
              <button class="flipr-fmt-btn" data-format="webp">
                <span>WEBP</span>
                <span class="flipr-fmt-sub">Modern</span>
              </button>
              <button class="flipr-fmt-btn" data-format="svg" title="Embeds raster image inside an SVG container — not true vector tracing">
                <span>SVG</span>
                <span class="flipr-fmt-sub">Raster Wrap</span>
              </button>
              <button class="flipr-fmt-btn" data-format="bmp">
                <span>BMP</span>
                <span class="flipr-fmt-sub">Bitmap</span>
              </button>
              <button class="flipr-fmt-btn" data-format="gif">
                <span>GIF</span>
                <span class="flipr-fmt-sub">Graphic</span>
              </button>
            </div>
          </div>

          <!-- Quality slider (JPEG / WebP only) -->
          <div id="flipr-quality-wrap">
            <div id="flipr-quality-header">
              <span class="flipr-label" style="margin:0">Quality</span>
              <span id="flipr-quality-val">95%</span>
            </div>
            <input type="range" id="flipr-quality" min="10" max="100" value="95" step="1"/>
          </div>

          <!-- Filename -->
          <div id="flipr-filename-wrap">
            <div class="flipr-label">File Name</div>
            <input type="text" id="flipr-filename" placeholder="image-name" spellcheck="false" />
          </div>

          <!-- Status indicator -->
          <div id="flipr-status"></div>
        </div>

        <div id="flipr-footer">
          <button id="flipr-cancel-btn">Cancel</button>
          <button id="flipr-save-btn" disabled>
            <span id="flipr-save-btn-text">Flip &amp; Save</span>
          </button>
        </div>
      </div>
    `;

    // Set icon src via DOM to avoid interpolated values in HTML template
    const iconImg = overlay.querySelector("#flipr-header-icon img");
    if (iconImg) {
      if (iconUrl) {
        iconImg.src = iconUrl;
        iconImg.addEventListener("error", function () {
          this.parentElement.textContent = "⚡";
        });
      } else {
        iconImg.parentElement.textContent = "⚡";
      }
    }

    return overlay;
  }

  // ─── Show Converter ─────────────────────────────────────────────────────────

  function showConverter(imageUrl) {
    const existing = document.getElementById("flipr-overlay");
    if (existing) existing.remove();

    injectStyles();
    const overlay = createModal();
    document.body.appendChild(overlay);

    const preview       = document.getElementById("flipr-preview");
    const previewLoading= document.getElementById("flipr-preview-loading");
    const actualFmtTag  = document.getElementById("flipr-actual-format");
    const dimensionsEl  = document.getElementById("flipr-dimensions");
    const filesizeEl    = document.getElementById("flipr-filesize");
    const formatBtns    = document.querySelectorAll(".flipr-fmt-btn");
    const qualityWrap   = document.getElementById("flipr-quality-wrap");
    const qualitySlider = document.getElementById("flipr-quality");
    const qualityVal    = document.getElementById("flipr-quality-val");
    const filenameInput = document.getElementById("flipr-filename");
    const saveBtn       = document.getElementById("flipr-save-btn");
    const saveBtnText   = document.getElementById("flipr-save-btn-text");
    const cancelBtn     = document.getElementById("flipr-cancel-btn");
    const closeBtn      = document.getElementById("flipr-close");
    const status        = document.getElementById("flipr-status");

    let selectedFormat = "png";
    let imgElement = null;
    let fetchedBlob = null;
    let detectedSource = null;
    let createdObjectUrl = null;

    // Helper: format bytes nicely
    function formatBytes(bytes) {
      if (!bytes || bytes === 0) return "—";
      const k = 1024;
      const sizes = ["B", "KB", "MB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
    }

    // ── Sanitize filename for safe download ──
    function sanitizeFilename(name) {
      return name
        .replace(/\.\./g, "_")
        .replace(/[\/\\:*?"<>|]/g, "_")
        .replace(/^\.+/, "_")
        .replace(/\s+/g, "_")
        .substring(0, 100) || "image";
    }

    // ── Generate clean default filename ──
    try {
      const urlObj = new URL(imageUrl);
      const parts = urlObj.pathname.split("/");
      let rawName = parts[parts.length - 1] || "image";
      rawName = rawName.replace(/\.[^.]+$/, "");
      rawName = rawName.replace(/[^a-zA-Z0-9_\-]/g, "_").substring(0, 50);
      filenameInput.value = rawName || "wallpaper";
    } catch {
      filenameInput.value = "wallpaper";
    }

    // ── Set Status ──
    function setStatus(msg, type) {
      status.className = "";
      status.textContent = msg;
      if (type) status.classList.add(type);
    }

    const onKey = (e) => {
      if (e.key === "Escape") {
        closeModal();
      }
    };
    document.addEventListener("keydown", onKey);

    function closeModal() {
      document.removeEventListener("keydown", onKey);
      if (createdObjectUrl) {
        URL.revokeObjectURL(createdObjectUrl);
        createdObjectUrl = null;
      }
      overlay.remove();
    }

    // Fetch actual payload bytes — try direct CORS, fallback to background fetch
    async function fetchImageBytes(url) {
      try {
        const resp = await fetch(url, { mode: "cors" });
        if (resp.ok) return await resp.blob();
      } catch {}
      // Fallback: route through background service worker (bypasses CORS)
      try {
        const result = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ action: "fetchImageData", url }, resolve);
        });
        if (result && result.success && result.dataUrl) {
          const resp = await fetch(result.dataUrl);
          return await resp.blob();
        }
      } catch {}
      return null;
    }

    // ── Fetch image to detect ACTUAL FORMAT & prepare conversion ──
    async function inspectAndLoadImage() {
      // 1. Direct Image element for immediate visual display
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        imgElement = img;
        preview.src = img.src;
        preview.style.display = "block";
        previewLoading.style.display = "none";
        dimensionsEl.textContent = `${img.naturalWidth} × ${img.naturalHeight}`;
        saveBtn.disabled = false;
      };
      img.onerror = () => {
        // Still can display once blob is fetched
      };
      img.src = imageUrl;

      fetchedBlob = await fetchImageBytes(imageUrl);

      if (fetchedBlob) {
        if (fetchedBlob.size) {
          filesizeEl.textContent = formatBytes(fetchedBlob.size);
        }

        // Read first 32 bytes for magic byte detection
        const headSlice = fetchedBlob.slice(0, 32);
        const buffer = await headSlice.arrayBuffer();
        const uint8 = new Uint8Array(buffer);
        const detected = identifyBytesFormat(uint8);

        if (detected) {
          detectedSource = detected;
          actualFmtTag.textContent = detected.format;
        } else if (fetchedBlob.type) {
          const mimeShort = fetchedBlob.type.replace("image/", "").toUpperCase();
          actualFmtTag.textContent = mimeShort || "UNKNOWN";
        } else {
          fallbackUrlDetection();
        }

        // If Image element errored due to CORS, use blob URL for preview
        if (!imgElement) {
          createdObjectUrl = URL.createObjectURL(fetchedBlob);
          const fallbackImg = new Image();
          fallbackImg.onload = () => {
            imgElement = fallbackImg;
            preview.src = createdObjectUrl;
            preview.style.display = "block";
            previewLoading.style.display = "none";
            dimensionsEl.textContent = `${fallbackImg.naturalWidth} × ${fallbackImg.naturalHeight}`;
            saveBtn.disabled = false;
          };
          fallbackImg.src = createdObjectUrl;
        }
      } else {
        fallbackUrlDetection();
      }
    }

    function fallbackUrlDetection() {
      const urlLower = imageUrl.toLowerCase().split("?")[0];
      const exts = ["webp", "jpg", "jpeg", "png", "gif", "bmp", "avif", "svg"];
      for (const ext of exts) {
        if (urlLower.endsWith("." + ext)) {
          actualFmtTag.textContent = ext.toUpperCase();
          return;
        }
      }
      if (urlLower.includes("webp")) actualFmtTag.textContent = "WEBP";
      else actualFmtTag.textContent = "IMAGE";
    }

    inspectAndLoadImage();

    // ── Quality slider event ──
    qualitySlider.addEventListener("input", () => {
      qualityVal.textContent = qualitySlider.value + "%";
    });

    // ── Format selection buttons ──
    formatBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        formatBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        selectedFormat = btn.dataset.format;

        if (selectedFormat === "jpeg" || selectedFormat === "webp") {
          qualityWrap.classList.add("visible");
        } else {
          qualityWrap.classList.remove("visible");
        }
      });
    });

    // ── Convert & Download Execution ──
    async function doConvertAndSave() {
      saveBtn.disabled = true;
      saveBtnText.textContent = "Converting…";
      setStatus("Processing image conversion…", "loading");

      const quality = parseInt(qualitySlider.value, 10) / 100;
      const rawName = sanitizeFilename(filenameInput.value.trim() || "image");
      const ext = selectedFormat === "jpeg" ? "jpg" : selectedFormat;
      const filename = rawName.replace(/\.[^.]+$/, "") + "." + ext;

      try {
        let dataUrl;

        // Ensure we have image dimensions & bitmap
        let width = imgElement ? (imgElement.naturalWidth || imgElement.width) : 0;
        let height = imgElement ? (imgElement.naturalHeight || imgElement.height) : 0;

        // Guard against extremely large images that could crash the tab
        const megapixels = (width * height) / 1_000_000;
        if (megapixels > 100) {
          throw new Error(`Image too large (${Math.round(megapixels)}MP). Max supported: 100MP.`);
        }

        let canvas = document.createElement("canvas");
        let ctx = null;

        if (imgElement && imgElement.complete && width > 0) {
          canvas.width = width;
          canvas.height = height;
          ctx = canvas.getContext("2d");
          if (selectedFormat === "jpeg" || selectedFormat === "bmp") {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, width, height);
          }
          ctx.drawImage(imgElement, 0, 0);
        } else {
          // Fetch blob fallback
          if (!fetchedBlob) {
            fetchedBlob = await fetchImageBytes(imageUrl);
            if (!fetchedBlob) throw new Error("Could not fetch image data");
          }
          const bitmap = await createImageBitmap(fetchedBlob);
          width = bitmap.width;
          height = bitmap.height;

          const bmpMegapixels = (width * height) / 1_000_000;
          if (bmpMegapixels > 100) {
            throw new Error(`Image too large (${Math.round(bmpMegapixels)}MP). Max supported: 100MP.`);
          }

          canvas.width = width;
          canvas.height = height;
          ctx = canvas.getContext("2d");
          if (selectedFormat === "jpeg" || selectedFormat === "bmp") {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, width, height);
          }
          ctx.drawImage(bitmap, 0, 0);
        }

        // ── Handle SVG Format (raster wrapper, not true vectorization) ──
        if (selectedFormat === "svg") {
          const pngBlob = await new Promise((resolve, reject) => {
            canvas.toBlob(b => b ? resolve(b) : reject(new Error("PNG conversion failed for SVG wrapper")), "image/png");
          });
          const pngDataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error("Failed to encode PNG for SVG"));
            reader.readAsDataURL(pngBlob);
          });
          const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <image width="${width}" height="${height}" xlink:href="${pngDataUrl}" href="${pngDataUrl}"/>
</svg>`;
          dataUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgContent);
        } else {
          // Standard raster formats: PNG, JPEG, WebP, BMP, GIF
          const mimeMap = {
            png: "image/png",
            jpeg: "image/jpeg",
            webp: "image/webp",
            bmp: "image/bmp",
            gif: "image/gif"
          };
          const mime = mimeMap[selectedFormat] || "image/png";

          // Use toBlob for better memory handling than toDataURL
          const blob = await new Promise((resolve, reject) => {
            canvas.toBlob(
              b => b ? resolve(b) : reject(new Error("Image conversion failed — canvas may be too large")),
              mime,
              quality
            );
          });

          // Validate output size before encoding
          if (blob.size > 200 * 1024 * 1024) {
            throw new Error("Output file too large (" + formatBytes(blob.size) + "). Try reducing quality or using a smaller image.");
          }

          dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error("Failed to encode converted image"));
            reader.readAsDataURL(blob);
          });
        }

        setStatus("Opening Chrome save dialog…", "loading");

        chrome.runtime.sendMessage(
          { action: "downloadImage", dataUrl, filename },
          (response) => {
            if (chrome.runtime.lastError || (response && !response.success)) {
              setStatus("Save cancelled or failed.", "error");
              saveBtn.disabled = false;
              saveBtnText.textContent = "Flip & Save";
            } else {
              setStatus("Saved successfully!", "success");
              saveBtnText.textContent = "Saved!";
              setTimeout(() => closeModal(), 1400);
            }
          }
        );
      } catch (err) {
        setStatus("Error: " + err.message, "error");
        saveBtn.disabled = false;
        saveBtnText.textContent = "Flip & Save";
      }
    }

    saveBtn.addEventListener("click", doConvertAndSave);
    cancelBtn.addEventListener("click", closeModal);
    closeBtn.addEventListener("click", closeModal);

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });
  }

  // ─── Listen for Background Messages ───────────────────────────────────────
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "showConverter") {
      showConverter(message.imageUrl);
      if (sendResponse) sendResponse({ ok: true });
    }
  });
})();
