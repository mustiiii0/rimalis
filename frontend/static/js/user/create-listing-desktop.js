(function () {
  const DRAFT_KEY = 'rimalis_listing_draft';
  const LEGACY_DRAFT_KEY = 'revalo_listing_draft';
  let initialized = false;

  function referenceFromId(id) {
    const source = String(id || '');
    if (!source) return '-';
    let hash = 0;
    for (let i = 0; i < source.length; i += 1) {
      hash = ((hash * 31) + source.charCodeAt(i)) >>> 0;
    }
    return `RG8-${String(hash % 10000).padStart(4, '0')}`;
  }

  const CATEGORY_FIELDS = {
    'Lägenhet': [
      { key: 'area', label: 'Area (kvm)', type: 'number', min: 1, placeholder: '85', required: true },
      { key: 'buildYear', label: 'Byggår', type: 'number', min: 1700, max: 2100, placeholder: '2018', required: false },
      { key: 'floor', label: 'Våning', type: 'number', min: 0, placeholder: '4', required: false },
      { key: 'rooms', label: 'Antal rum', type: 'number', min: 0, placeholder: '3', required: true },
      { key: 'balconies', label: 'Antal balkong', type: 'number', min: 0, placeholder: '1', required: false },
      { key: 'bathrooms', label: 'Antal badrum', type: 'number', min: 0, placeholder: '1', required: false },
      { key: 'toilets', label: 'Antal toalett', type: 'number', min: 0, placeholder: '1', required: false },
    ],
    'Villa/Hus': [
      { key: 'area', label: 'Area (kvm)', type: 'number', min: 1, placeholder: '180', required: true },
      { key: 'buildArea', label: 'Byggarea (kvm)', type: 'number', min: 0, placeholder: '220', required: false },
      { key: 'lotArea', label: 'Tomtarea (kvm)', type: 'number', min: 0, placeholder: '950', required: false },
      { key: 'buildYear', label: 'Byggår', type: 'number', min: 1700, max: 2100, placeholder: '2012', required: false },
      { key: 'rooms', label: 'Antal rum', type: 'number', min: 0, placeholder: '6', required: true },
      { key: 'floors', label: 'Antal våningar', type: 'number', min: 1, placeholder: '2', required: false },
      { key: 'bathrooms', label: 'Antal badrum', type: 'number', min: 0, placeholder: '2', required: false },
      { key: 'toilets', label: 'Antal toalett', type: 'number', min: 0, placeholder: '2', required: false },
      { key: 'balconies', label: 'Antal balkong', type: 'number', min: 0, placeholder: '1', required: false },
    ],
    Odlingsmark: [
      { key: 'area', label: 'Area (kvm)', type: 'number', min: 1, placeholder: '12000', required: true },
      { key: 'length', label: 'Längd (m)', type: 'number', min: 0, placeholder: '120', required: false },
      { key: 'width', label: 'Bredd (m)', type: 'number', min: 0, placeholder: '80', required: false },
    ],
    Byggmark: [
      { key: 'area', label: 'Area (kvm)', type: 'number', min: 1, placeholder: '950', required: true },
      { key: 'length', label: 'Längd (m)', type: 'number', min: 0, placeholder: '40', required: false },
      { key: 'width', label: 'Bredd (m)', type: 'number', min: 0, placeholder: '24', required: false },
    ],
  };

  function migrateLegacyDraftKey() {
    const legacyValue = sessionStorage.getItem(LEGACY_DRAFT_KEY);
    if (legacyValue && !sessionStorage.getItem(DRAFT_KEY)) {
      sessionStorage.setItem(DRAFT_KEY, legacyValue);
    }
    if (legacyValue) sessionStorage.removeItem(LEGACY_DRAFT_KEY);
  }

  function getDraft() {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_err) {
      return {};
    }
  }

  function saveDraft(next) {
    const current = getDraft();
    const merged = { ...current, ...next };
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(merged));
    return merged;
  }

  function clearDraft() {
    sessionStorage.removeItem(DRAFT_KEY);
  }

  function safeAvatar(url) {
    if (typeof url !== 'string') return '/static/image/avatar-placeholder.svg';
    const trimmed = url.trim();
    if (!trimmed) return '/static/image/avatar-placeholder.svg';
    if (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('/static/uploads/') ||
      trimmed.startsWith('/uploads/') ||
      trimmed.startsWith('data:image/')
    ) {
      return trimmed;
    }
    return '/static/image/avatar-placeholder.svg';
  }

  async function hydrateSidebarProfile() {
    if (!window.RimalisAPI?.request) return;
    try {
      const body = await window.RimalisAPI.request('/users/me', { auth: true });
      const user = body?.user || {};
      const avatarEl = document.getElementById('userSidebarAvatar');
      const nameEl = document.getElementById('userSidebarName');
      const emailEl = document.getElementById('userSidebarEmail');
      if (avatarEl) avatarEl.src = safeAvatar(user.avatarUrl);
      if (nameEl) nameEl.textContent = user.name || 'Laddar...';
      if (emailEl) emailEl.textContent = user.email || '';
    } catch (_err) {
      // ignore sidebar hydration failures
    }
  }

  function createDraftListingId() {
    const cryptoId = globalThis.crypto?.randomUUID?.();
    if (cryptoId) return cryptoId;
    return `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function ensureDraftUploadIdentity() {
    const draft = getDraft();
    if (draft.uploadListingId && draft.uploadListingReference) {
      return {
        uploadListingId: draft.uploadListingId,
        uploadListingReference: draft.uploadListingReference,
      };
    }
    const uploadListingId = draft.uploadListingId || createDraftListingId();
    const uploadListingReference = draft.uploadListingReference || referenceFromId(uploadListingId);
    saveDraft({ uploadListingId, uploadListingReference });
    return { uploadListingId, uploadListingReference };
  }

  function mkr(price) {
    return new Intl.NumberFormat('sv-SE').format(Number(price || 0)) + ' kr';
  }

  async function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Kunde inte läsa bildfil'));
      };
      img.src = url;
    });
  }

  async function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Kunde inte komprimera bild'));
          return;
        }
        resolve(blob);
      }, type, quality);
    });
  }

  async function compressImageFile(file) {
    if (!(file instanceof File) || !file.type.startsWith('image/')) return file;

    const MAX_DIMENSION = 1920;
    const TARGET_BYTES = 1_600_000; // ~1.6MB
    if (file.size <= TARGET_BYTES) return file;

    const img = await loadImageFromFile(file);
    const ratio = Math.min(1, MAX_DIMENSION / img.width, MAX_DIMENSION / img.height);
    const width = Math.max(1, Math.round(img.width * ratio));
    const height = Math.max(1, Math.round(img.height * ratio));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);

    const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    let quality = outputType === 'image/png' ? undefined : 0.86;
    let blob = await canvasToBlob(canvas, outputType, quality);

    while (blob.size > TARGET_BYTES && typeof quality === 'number' && quality > 0.55) {
      quality -= 0.08;
      blob = await canvasToBlob(canvas, outputType, quality);
    }

    if (blob.size >= file.size) return file;

    const nextName = file.name.replace(/\.[a-z0-9]+$/i, outputType === 'image/png' ? '.png' : '.jpg');
    return new File([blob], nextName, { type: outputType, lastModified: Date.now() });
  }

  async function uploadListingImage(file, options = {}) {
    if (!window.RimalisAPI) {
      throw new Error('API saknas. Ladda om sidan.');
    }

    const preparedFile = await compressImageFile(file);
    const formData = new FormData();
    formData.append('image', preparedFile);
    if (options.listingId) formData.append('listingId', String(options.listingId));
    if (options.listingReference) formData.append('listingReference', String(options.listingReference));
    if (options.imageIndex != null) formData.append('imageIndex', String(options.imageIndex));

    const result = await window.RimalisAPI.request('/uploads/image', {
      method: 'POST',
      auth: true,
      body: formData,
    });

    if (!result?.imageUrl) {
      throw new Error('Kunde inte spara bilden');
    }
    return result.imageUrl;
  }

  function initStep1() {
    const form = document.getElementById('createListingStep1Form');
    if (!form) return;

    const draft = getDraft();
    const dynamicContainer = document.getElementById('listingCategoryFields');
    const setIf = (id, value) => {
      const el = document.getElementById(id);
      if (el && value != null) el.value = value;
    };

    setIf('listingTitle', draft.title);
    setIf('listingPropertyType', draft.propertyType);
    setIf('listingPrice', draft.price);
    setIf('listingLocation', draft.city);
    setIf('listingAddress', draft.address);
    setIf('listingDescription', draft.description);

    const titleInput = document.getElementById('listingTitle');
    const priceInput = document.getElementById('listingPrice');
    const propertyTypeInput = document.getElementById('listingPropertyType');
    const addressInput = document.getElementById('listingAddress');
    const addressSuggestions = document.getElementById('listingAddressSuggestions');
    const descriptionInput = document.getElementById('listingDescription');
    const locationInput = document.getElementById('listingLocation');
    const descriptionCount = document.getElementById('listingDescriptionCount');
    const pricePreview = document.getElementById('listingPricePreview');
    let dynamicInputs = [];

    function renderAddressSuggestions(rows) {
      if (!addressSuggestions) return;
      addressSuggestions.textContent = '';
      rows.slice(0, 6).forEach((row) => {
        const option = document.createElement('option');
        option.value = String(row?.display_name || '');
        addressSuggestions.appendChild(option);
      });
    }

    function getDynamicValues() {
      const out = {};
      dynamicInputs.forEach((meta) => {
        const value = meta.input.value;
        if (meta.type === 'number') {
          if (value === '') return;
          out[meta.key] = Number(value);
        } else if (value && value.trim()) {
          out[meta.key] = value.trim();
        }
      });
      return out;
    }

    function renderDynamicFields(type) {
      if (!dynamicContainer) return;
      const defs = CATEGORY_FIELDS[type] || [];
      dynamicInputs = [];
      dynamicContainer.innerHTML = defs
        .map((f) => `
          <div>
            <label class="text-white/60 text-sm font-bold mb-2 block">${f.label}</label>
            <input class="input-field" type="${f.type}" ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''} placeholder="${f.placeholder || ''}" id="listingField_${f.key}" ${f.required ? 'required' : ''}>
          </div>
        `)
        .join('');

      const currentDetails = draft.listingDetails || {};
      defs.forEach((f) => {
        const input = document.getElementById(`listingField_${f.key}`);
        if (!input) return;
        if (currentDetails[f.key] != null) input.value = String(currentDetails[f.key]);
        input.addEventListener('input', repaintChecks);
        dynamicInputs.push({ ...f, input });
      });
    }

    const checks = [
      ['step1CheckTitle', () => (titleInput?.value || '').trim().length >= 4],
      ['step1CheckPrice', () => Number(priceInput?.value || 0) > 0],
      ['step1CheckAddress', () => (addressInput?.value || '').trim().length >= 4],
      ['step1CheckDescription', () => (descriptionInput?.value || '').trim().length >= 20],
    ];

    function paintCheck(baseId, ok) {
      const row = document.getElementById(`${baseId}Row`);
      const icon = document.getElementById(`${baseId}Icon`);
      if (row) row.className = ok ? 'text-[#e2ff31]' : 'text-white/70';
      if (icon) icon.className = `fas ${ok ? 'fa-check-circle text-[#e2ff31]' : 'fa-circle text-white/30'} mr-2`;
    }

    function repaintChecks() {
      checks.forEach(([id, fn]) => paintCheck(id, !!fn()));
      if (descriptionCount) descriptionCount.textContent = String((descriptionInput?.value || '').length);
      if (pricePreview) {
        const p = Number(priceInput?.value || 0);
        pricePreview.textContent = `Prisformat: ${p > 0 ? mkr(p) : '-'}`;
      }
    }

    [titleInput, priceInput, addressInput, descriptionInput, locationInput].forEach((el) => {
      if (!el) return;
      el.addEventListener('input', repaintChecks);
    });

    function renderAddressSuggestions(rows) {
      if (!addressSuggestions) return;
      addressSuggestions.textContent = '';
      rows.slice(0, 6).forEach((row) => {
        const option = document.createElement('option');
        option.value = String(row?.display_name || '');
        addressSuggestions.appendChild(option);
      });
    }

    let addressFetchSeq = 0;
    let addressDebounce = null;
    if (addressInput && addressSuggestions) {
      addressInput.addEventListener('input', function () {
        const query = addressInput.value.trim();
        if (addressDebounce) clearTimeout(addressDebounce);
        if (query.length < 4) {
          addressSuggestions.textContent = '';
          return;
        }

        addressDebounce = setTimeout(async () => {
          const currentSeq = ++addressFetchSeq;
          try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=se&limit=6&q=${encodeURIComponent(query)}`;
            const res = await fetch(url, {
              headers: { Accept: 'application/json' },
            });
            if (!res.ok) return;
            const rows = await res.json();
            if (currentSeq !== addressFetchSeq) return;
            if (!Array.isArray(rows)) return;
            renderAddressSuggestions(rows);
          } catch (_err) {
            // ignore autocomplete network errors
          }
        }, 250);
      });

      addressInput.addEventListener('change', async function () {
        const query = addressInput.value.trim();
        if (!query || (locationInput?.value || '').trim()) return;
        try {
          const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=se&limit=1&q=${encodeURIComponent(query)}`;
          const res = await fetch(url, { headers: { Accept: 'application/json' } });
          if (!res.ok) return;
          const rows = await res.json();
          const first = Array.isArray(rows) ? rows[0] : null;
          const addr = first?.address || {};
          const inferredCity =
            addr.city ||
            addr.town ||
            addr.village ||
            addr.municipality ||
            addr.county ||
            '';
          if (locationInput && inferredCity) locationInput.value = inferredCity;
        } catch (_err) {
          // ignore
        }
      });
    }
    propertyTypeInput?.addEventListener('change', () => {
      renderDynamicFields(propertyTypeInput.value);
      repaintChecks();
    });
    renderDynamicFields(propertyTypeInput?.value || draft.propertyType || '');
    repaintChecks();

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const listingDetails = getDynamicValues();
      const selectedType = document.getElementById('listingPropertyType')?.value || '';

      const payload = {
        title: document.getElementById('listingTitle')?.value?.trim() || '',
        propertyType: selectedType,
        price: Number(document.getElementById('listingPrice')?.value || 0),
        livingArea: Number(listingDetails.area || 0),
        rooms: Number(listingDetails.rooms || 0),
        city: document.getElementById('listingLocation')?.value?.trim() || '',
        address: document.getElementById('listingAddress')?.value?.trim() || '',
        description: document.getElementById('listingDescription')?.value?.trim() || '',
        listingDetails,
      };

      const requiredByType = (CATEGORY_FIELDS[selectedType] || []).filter((x) => x.required);
      const missingRequiredTypeField = requiredByType.some((x) => {
        const v = listingDetails[x.key];
        return v === undefined || v === null || v === '';
      });

      if (!payload.title || !payload.city || payload.price <= 0 || payload.description.length < 20 || !selectedType || missingRequiredTypeField) {
        const err = document.getElementById('createListingStep1Error');
        if (err) {
          err.textContent = 'Fyll i alla obligatoriska fält för vald bostadskategori. Beskrivning måste vara minst 20 tecken.';
          err.classList.remove('hidden');
        }
        return;
      }

      const err = document.getElementById('createListingStep1Error');
      if (err) err.classList.add('hidden');
      saveDraft(payload);
      window.location.href = 'step2_media.html';
    });
  }

  function initStep2() {
    const form = document.getElementById('createListingStep2Form');
    if (!form) return;

    // Some pages don't load the global modal.js helper that wires up these attributes.
    // Ensure the "Välj bilder" and floor plan upload buttons work everywhere.
    function bindClickTargets(root) {
      const scope = root || document;
      scope.querySelectorAll('[data-click-target]').forEach((el) => {
        if (el.dataset.clickTargetBound === '1') return;
        el.dataset.clickTargetBound = '1';
        el.addEventListener('click', (event) => {
          event.preventDefault();
          const targetId = el.getAttribute('data-click-target') || '';
          if (!targetId) return;
          const target = document.getElementById(targetId);
          if (!target) return;
          if (typeof target.click === 'function') target.click();
          else target.focus?.();
        });
      });
    }

    const imagesInput = document.getElementById('listingImages');
    const selectedFilesText = document.getElementById('selectedFilesText');
    const videoInput = document.getElementById('listingVideoUrl');
    const imageUrlInput = document.getElementById('listingImageUrl');
    const floorPlanInput = document.getElementById('listingFloorPlanUrl');
    const floorPlanFileInput = document.getElementById('listingFloorPlanFile');
    const selectedFloorPlanFileText = document.getElementById('selectedFloorPlanFileText');
    const watermarkInput = document.getElementById('listingWatermarkEnabled');
    const imagePreviewCard = document.getElementById('imagePreviewCard');
    const imagePreviewThumb = document.getElementById('imagePreviewThumb');
    const imageGridWrap = document.getElementById('listingImageGridWrap');
    const imageGrid = document.getElementById('listingImageGrid');
    const imageGridCount = document.getElementById('listingImageGridCount');
    const uploadProgressWrap = document.getElementById('listingUploadProgressWrap');
    const uploadProgressList = document.getElementById('listingUploadProgressList');
    const uploadOverallBar = document.getElementById('listingUploadOverallBar');
    const uploadOverallText = document.getElementById('listingUploadOverallText');
    const draft = getDraft();
    let selectedImageFiles = imagesInput?.files ? Array.from(imagesInput.files) : [];
    let draftImageUrlsState = Array.isArray(draft.imageUrls)
      ? draft.imageUrls.filter((x) => typeof x === 'string' && x.trim())
      : (draft.imageUrl ? [draft.imageUrl] : []);

    if (draft.imageUrl && !draftImageUrlsState.includes(draft.imageUrl)) {
      draftImageUrlsState.unshift(draft.imageUrl);
    }

    if (videoInput && draft.videoUrl) videoInput.value = draft.videoUrl;
    if (imageUrlInput && draft.imageUrl) imageUrlInput.value = draft.imageUrl;
    if (floorPlanInput && draft.floorPlanUrl) floorPlanInput.value = draft.floorPlanUrl;
    if (watermarkInput) watermarkInput.checked = Boolean(draft.watermarkEnabled);

    bindClickTargets(form);

    function updatePrimaryPreview(url) {
      if (!imagePreviewThumb || !imagePreviewCard) return;
      if (!url) {
        imagePreviewCard.classList.add('hidden');
        imagePreviewThumb.src = '';
        return;
      }
      imagePreviewThumb.src = url;
      imagePreviewCard.classList.remove('hidden');
    }

    function persistDraftImageOrder() {
      saveDraft({
        imageUrls: draftImageUrlsState.slice(),
        imageUrl: draftImageUrlsState[0] || '',
        imageCount: draftImageUrlsState.length,
      });
    }

    function renderUploadProgress(items) {
      if (!uploadProgressWrap || !uploadProgressList || !uploadOverallBar || !uploadOverallText) return;
      if (!items.length) {
        uploadProgressWrap.classList.add('hidden');
        uploadProgressList.textContent = '';
        uploadOverallBar.style.width = '0%';
        uploadOverallText.textContent = '';
        return;
      }
      uploadProgressWrap.classList.remove('hidden');
      uploadProgressList.textContent = '';
      const completed = items.filter((item) => item.status === 'done').length;
      const failed = items.filter((item) => item.status === 'error').length;
      const percent = Math.round(((completed + failed) / items.length) * 100);
      uploadOverallBar.style.width = `${percent}%`;
      uploadOverallText.textContent = `${completed}/${items.length} klara`;
      items.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm';
        const title = document.createElement('div');
        title.className = 'font-semibold text-white';
        title.textContent = item.name;
        const meta = document.createElement('div');
        meta.className = 'mt-1 text-xs text-white/60';
        meta.textContent =
          item.status === 'done'
            ? 'Uppladdad'
            : item.status === 'error'
              ? `Misslyckades: ${item.message || 'Okänt fel'}`
              : 'Laddar upp...';
        row.appendChild(title);
        row.appendChild(meta);
        uploadProgressList.appendChild(row);
      });
    }

    function renderSelectedImageGrid(urls, mode) {
      if (!imageGridWrap || !imageGrid || !imageGridCount) return;
      if (!urls.length) {
        imageGridWrap.classList.add('hidden');
        imageGrid.textContent = '';
        imageGridCount.textContent = '0';
        updatePrimaryPreview('');
        return;
      }
      imageGridWrap.classList.remove('hidden');
      imageGrid.textContent = '';
      imageGridCount.textContent = `${urls.length} bilder`;
      urls.forEach((url, index) => {
        const tile = document.createElement('div');
        tile.className = 'relative rounded-2xl overflow-hidden border border-white/10 bg-black/40 aspect-square';
        const img = document.createElement('img');
        img.src = url;
        img.alt = `Bild ${index + 1}`;
        img.className = 'w-full h-full object-cover';
        const badge = document.createElement('span');
        badge.className = 'absolute left-2 bottom-2 text-[10px] px-2 py-1 rounded-full bg-black/70 border border-white/10 text-white/90';
        badge.textContent = index === 0 ? 'Omslag' : `Bild ${index + 1}`;
        tile.appendChild(img);
        tile.appendChild(badge);
        if (mode === 'files') {
          const removeBtn = document.createElement('button');
          removeBtn.type = 'button';
          removeBtn.className = 'absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500/90 text-white';
          removeBtn.textContent = '×';
          removeBtn.addEventListener('click', function () {
            selectedImageFiles.splice(index, 1);
            if (typeof DataTransfer !== 'undefined' && imagesInput) {
              const dt = new DataTransfer();
              selectedImageFiles.forEach((file) => dt.items.add(file));
              imagesInput.files = dt.files;
            }
            const nextUrls = selectedImageFiles.map((file) => URL.createObjectURL(file));
            if (selectedFilesText) {
              selectedFilesText.textContent = selectedImageFiles.length ? `${selectedImageFiles.length} fil(er) valda` : 'Inga filer valda';
            }
            renderSelectedImageGrid(nextUrls, 'files');
            repaintStep2Checks();
          });
          tile.appendChild(removeBtn);
        }
        imageGrid.appendChild(tile);
      });
      updatePrimaryPreview(urls[0] || '');
    }

    if (draftImageUrlsState.length) {
      if (selectedFilesText) selectedFilesText.textContent = `${draftImageUrlsState.length} bild(er) sparade i utkast`;
      renderSelectedImageGrid(draftImageUrlsState, 'uploaded');
    }

    function repaintStep2Checks() {
      const hasImage = selectedImageFiles.length > 0 || draftImageUrlsState.length > 0 || !!(imageUrlInput?.value || '').trim();
      const hasVideo = !!(videoInput?.value || '').trim();
      const hasFloor = !!(floorPlanInput?.value || '').trim() || !!floorPlanFileInput?.files?.[0];
      paintStep2Check('Image', hasImage);
      paintStep2Check('Video', hasVideo);
      paintStep2Check('FloorPlan', hasFloor);
    }

    function paintStep2Check(name, ok) {
      const row = document.getElementById(`step2Check${name}Row`);
      const icon = document.getElementById(`step2Check${name}Icon`);
      if (row) row.className = ok ? 'text-[#e2ff31]' : 'text-white/70';
      if (icon) icon.className = `fas ${ok ? 'fa-check-circle text-[#e2ff31]' : 'fa-circle text-white/30'} mr-2`;
    }

    if (imagesInput && selectedFilesText) {
      imagesInput.addEventListener('change', function () {
        selectedImageFiles = imagesInput.files ? Array.from(imagesInput.files) : [];
        if (selectedImageFiles.length === 0) {
          selectedFilesText.textContent = 'Inga filer valda';
          renderSelectedImageGrid(draftImageUrlsState, 'uploaded');
          repaintStep2Checks();
          return;
        }
        selectedFilesText.textContent = `${selectedImageFiles.length} fil(er) valda`;
        renderSelectedImageGrid(selectedImageFiles.map((file) => URL.createObjectURL(file)), 'files');
        repaintStep2Checks();
      });
    }

    if (floorPlanFileInput && selectedFloorPlanFileText) {
      floorPlanFileInput.addEventListener('change', function () {
        const picked = floorPlanFileInput.files?.[0];
        selectedFloorPlanFileText.textContent = picked ? picked.name : 'Ingen fil vald';
        repaintStep2Checks();
      });
    }

    [imageUrlInput, videoInput, floorPlanInput].forEach((el) => {
      if (!el) return;
      el.addEventListener('input', repaintStep2Checks);
    });
    repaintStep2Checks();

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const { uploadListingId, uploadListingReference } = ensureDraftUploadIdentity();
      let imageUrl = imageUrlInput?.value?.trim() || draft.imageUrl || '';
      let imageUrls = Array.isArray(draft.imageUrls)
        ? draft.imageUrls.filter((x) => typeof x === 'string' && x.trim())
        : [];
      let floorPlanUrl = floorPlanInput?.value?.trim() || draft.floorPlanUrl || '';
      const imageFiles = selectedImageFiles.slice();
      const firstFloorPlanImage = floorPlanFileInput?.files?.[0];
      const submitButton = form.querySelector('button[type="submit"]');
      if (imageUrl) imageUrls = [imageUrl, ...imageUrls.filter((x) => x !== imageUrl)];

      if (imageFiles.length > 0) {
        try {
          const uploadItems = imageFiles.map((file) => ({ name: file.name, status: 'pending', message: '' }));
          renderUploadProgress(uploadItems);
          const uploaded = [];
          for (let i = 0; i < imageFiles.length; i += 1) {
            if (submitButton) {
              submitButton.disabled = true;
              submitButton.textContent = `Laddar upp bild ${i + 1}/${imageFiles.length}...`;
            }
            uploadItems[i].status = 'uploading';
            renderUploadProgress(uploadItems);
            const nextUrl = await uploadListingImage(imageFiles[i], {
              listingId: uploadListingId,
              listingReference: uploadListingReference,
              imageIndex: i + 1,
            });
            uploaded.push(nextUrl);
            uploadItems[i].status = 'done';
            renderUploadProgress(uploadItems);
          }
          imageUrls = [...uploaded, ...imageUrls.filter((x) => !uploaded.includes(x))];
          imageUrl = imageUrls[0] || '';
          draftImageUrlsState = imageUrls.slice();
          persistDraftImageOrder();
          renderSelectedImageGrid(draftImageUrlsState, 'uploaded');
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Förhandsgranska';
          }
        } catch (err) {
          const errEl = document.getElementById('createListingStep2Error');
          if (errEl) {
            errEl.textContent = err.message || 'Kunde inte läsa bildfil';
            errEl.classList.remove('hidden');
          }
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Förhandsgranska';
          }
          return;
        }
      }

      if (firstFloorPlanImage) {
        try {
          if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'Laddar upp planritning...';
          }
          floorPlanUrl = await uploadListingImage(firstFloorPlanImage, {
            listingId: uploadListingId,
            listingReference: uploadListingReference,
            imageIndex: Math.max(draftImageUrlsState.length + 1, 1),
          });
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Förhandsgranska';
          }
        } catch (err) {
          const errEl = document.getElementById('createListingStep2Error');
          if (errEl) {
            errEl.textContent = err.message || 'Kunde inte läsa planritningsfil';
            errEl.classList.remove('hidden');
          }
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Förhandsgranska';
          }
          return;
        }
      }

      const media = {
        videoUrl: videoInput?.value?.trim() || '',
        imageCount: imageUrls.length,
        imageUrl,
        imageUrls,
        imageDataUrl: '',
        floorPlanUrl,
        watermarkEnabled: Boolean(watermarkInput?.checked),
        uploadListingId,
        uploadListingReference,
      };
      const hasImage = media.imageCount > 0 || !!media.imageUrl;
      if (!hasImage) {
        const err = document.getElementById('createListingStep2Error');
        if (err) {
          err.textContent = 'Lägg till minst en bild (fil eller URL).';
          err.classList.remove('hidden');
        }
        return;
      }
      const err = document.getElementById('createListingStep2Error');
      if (err) err.classList.add('hidden');
      saveDraft(media);
      window.location.href = 'step3_preview_submit.html';
    });
  }

  function initStep3() {
    const submitBtn = document.getElementById('submitListingBtn');
    if (!submitBtn) return;

    const draft = getDraft();
    if (!draft.title || !draft.city || !draft.price) {
      window.location.href = 'step1_listing_info.html';
      return;
    }

    const titleEl = document.getElementById('previewTitle');
    const locationEl = document.getElementById('previewLocation');
    const addressEl = document.getElementById('previewAddress');
    const priceEl = document.getElementById('previewPrice');
    const descriptionEl = document.getElementById('previewDescription');
    const typeEl = document.getElementById('previewPropertyType');
    const areaEl = document.getElementById('previewLivingArea');
    const roomsEl = document.getElementById('previewRooms');
    const imageEl = document.getElementById('previewImage');
    const hasVideoEl = document.getElementById('previewHasVideo');
    const hasFloorPlanEl = document.getElementById('previewHasFloorPlan');
    const extraDetailsEl = document.getElementById('previewExtraDetails');

    if (titleEl) titleEl.textContent = draft.title;
    if (locationEl) locationEl.textContent = draft.city;
    if (addressEl) addressEl.textContent = draft.address || '-';
    if (priceEl) priceEl.textContent = mkr(draft.price);
    if (typeEl) typeEl.textContent = draft.propertyType || '-';
    if (areaEl) areaEl.textContent = String(draft.listingDetails?.area || draft.livingArea || '-');
    if (roomsEl) roomsEl.textContent = String(draft.listingDetails?.rooms || draft.rooms || '-');
    if (descriptionEl) descriptionEl.textContent = draft.description || 'Ingen beskrivning angiven.';
    const previewImage = (Array.isArray(draft.imageUrls) && draft.imageUrls[0]) || draft.imageUrl || '';
    if (imageEl && previewImage) imageEl.src = previewImage;
    if (hasVideoEl && draft.videoUrl) hasVideoEl.classList.remove('hidden');
    if (hasFloorPlanEl && draft.floorPlanUrl) hasFloorPlanEl.classList.remove('hidden');
    if (extraDetailsEl) {
      const labels = {
        buildYear: 'Byggår',
        floor: 'Våning',
        balconies: 'Antal balkong',
        bathrooms: 'Antal badrum',
        toilets: 'Antal toalett',
        buildArea: 'Byggarea',
        lotArea: 'Tomtarea',
        floors: 'Antal våningar',
        length: 'Längd',
        width: 'Bredd',
      };
      const details = draft.listingDetails || {};
      extraDetailsEl.textContent = '';
      Object.entries(labels)
        .filter(([key]) => details[key] !== undefined && details[key] !== null && details[key] !== '')
        .forEach(([key, label]) => {
          const card = document.createElement('div');
          card.className = 'bg-white/5 border border-white/10 rounded-2xl p-4';
          const title = document.createElement('p');
          title.className = 'text-white/40 mb-1';
          title.textContent = label;
          const value = document.createElement('p');
          value.className = 'font-bold text-white';
          value.textContent = String(details[key]);
          card.append(title, value);
          extraDetailsEl.appendChild(card);
        });
    }

    const checklist = [
      ['Title', (draft.title || '').length >= 3],
      ['Description', (draft.description || '').length >= 20],
      ['Image', (draft.imageCount || 0) > 0 || !!draft.imageUrl],
      ['Address', (draft.address || '').length >= 4],
    ];
    checklist.forEach(([name, ok]) => {
      const row = document.getElementById(`check${name}Row`);
      const icon = document.getElementById(`check${name}Icon`);
      if (row) row.className = ok ? 'text-[#e2ff31]' : 'text-white/70';
      if (icon) icon.className = `fas ${ok ? 'fa-check-circle text-[#e2ff31]' : 'fa-circle text-white/30'} mr-2`;
    });

    submitBtn.addEventListener('click', async function (e) {
      e.preventDefault();
      if (!window.RimalisAPI) return;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Skickar...';

      try {
        const body = await window.RimalisAPI.request('/users/me/listings', {
          method: 'POST',
          auth: true,
          body: JSON.stringify({
            title: draft.title,
            location: draft.city,
            price: draft.price,
            propertyType: draft.propertyType || '',
            livingArea: draft.livingArea || 0,
            rooms: draft.rooms || Number(draft.listingDetails?.rooms || 0),
            address: draft.address || '',
            description: draft.description || '',
            listingDetails: draft.listingDetails || {},
            imageUrl: ((Array.isArray(draft.imageUrls) && draft.imageUrls[0]) || draft.imageUrl || ''),
            imageUrls: Array.isArray(draft.imageUrls)
              ? draft.imageUrls.filter((x) => typeof x === 'string' && x.trim())
              : (draft.imageUrl ? [draft.imageUrl] : []),
            videoUrl: draft.videoUrl || '',
            floorPlanUrl: draft.floorPlanUrl || '',
          }),
        });

        clearDraft();
        const createdId = body?.listing?.id || '';
        const createdRef = body?.listing?.referenceCode || '';
        const params = new URLSearchParams();
        if (createdId) params.set('id', createdId);
        if (createdRef) params.set('ref', createdRef);
        window.location.href = `submitted_success.html?${params.toString()}`;
      } catch (err) {
        const msg = document.getElementById('createListingError');
        if (msg) {
          msg.textContent = err.message || 'Kunde inte skapa annons';
          msg.classList.remove('hidden');
        } else {
          alert(err.message || 'Kunde inte skapa annons');
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Skicka till granskning';
      }
    });
  }

  async function initSuccess() {
    const listingMetaEl = document.getElementById('submittedListingMeta');
    if (!listingMetaEl) return;
    const params = new URLSearchParams(window.location.search);
    const listingId = (params.get('id') || '').trim();
    const refFromUrl = (params.get('ref') || '').trim();

    if (refFromUrl) {
      listingMetaEl.textContent = `Annonsreferens: ${refFromUrl}`;
      return;
    }

    if (!listingId || !window.RimalisAPI?.request) {
      listingMetaEl.textContent = listingId ? `Annonsreferens: ${referenceFromId(listingId)}` : 'Annonsreferens: -';
      return;
    }

    try {
      const body = await window.RimalisAPI.request('/users/me/listings', { auth: true });
      const listings = body.listings || [];
      const listing = listings.find((x) => x.id === listingId);
      if (listing?.referenceCode) {
        listingMetaEl.textContent = `Annonsreferens: ${listing.referenceCode}`;
        return;
      }
    } catch (_err) {
      // Fall through to legacy id text
    }

    listingMetaEl.textContent = `Annonsreferens: ${referenceFromId(listingId)}`;
  }

  function boot() {
    if (initialized) return;
    initialized = true;
    migrateLegacyDraftKey();
    hydrateSidebarProfile();
    initStep1();
    initStep2();
    initStep3();
    initSuccess();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // Safari/Chrome kan återställa sida från bfcache.
  window.addEventListener('pageshow', function () {
    if (!initialized) boot();
  });
})();
