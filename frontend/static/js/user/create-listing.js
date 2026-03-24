(function () {
  const DRAFT_KEY = 'rimalis_listing_draft';
  const LEGACY_DRAFT_KEY = 'rimalis_listing_draft';
  const MAX_IMAGES_PER_LISTING = 30;
  let initialized = false;

  function i18n(key) {
    return window.RimalisI18n?.t?.(key, key) || key;
  }

  async function ensureI18nReady() {
    if (window.RimalisI18n?.refresh) {
      await window.RimalisI18n.refresh(window.RimalisI18n.getLang?.());
    }
  }

  function referenceFromId(id) {
    const source = String(id || '');
    if (!source) return '-';
    let hash = 0;
    for (let i = 0; i < source.length; i += 1) {
      hash = ((hash * 31) + source.charCodeAt(i)) >>> 0;
    }
    return `RG8-${String(hash % 10000).padStart(4, '0')}`;
  }

  const PROPERTY_TYPE_CANONICAL = {
    APARTMENT: 'Lägenhet',
    HOUSE: 'Villa/Hus',
    FARMLAND: 'Odlingsmark',
    BUILDING_LAND: 'Byggmark',
  };

  function normalizePropertyType(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const normalized = raw.toLowerCase();
    if (normalized === 'lägenhet' || normalized === 'apartment') return PROPERTY_TYPE_CANONICAL.APARTMENT;
    if (
      normalized === 'villa/hus' ||
      normalized === 'villa' ||
      normalized === 'house'
    ) return PROPERTY_TYPE_CANONICAL.HOUSE;
    if (normalized === 'odlingsmark' || normalized === 'farmland') return PROPERTY_TYPE_CANONICAL.FARMLAND;
    if (normalized === 'byggmark' || normalized === 'building land' || normalized === 'building_land') {
      return PROPERTY_TYPE_CANONICAL.BUILDING_LAND;
    }
    return raw;
  }

  const CATEGORY_FIELDS = () => ({
    [PROPERTY_TYPE_CANONICAL.APARTMENT]: [
      { key: 'area', labelKey: 'listing_field_area', type: 'number', min: 1, placeholder: '85', required: true },
      { key: 'buildYear', labelKey: 'listing_field_build_year', type: 'number', min: 1700, max: 2100, placeholder: '2018', required: false },
      { key: 'floor', labelKey: 'listing_field_floor', type: 'number', min: 0, placeholder: '4', required: false },
      { key: 'rooms', labelKey: 'listing_field_rooms', type: 'number', min: 0, placeholder: '3', required: true },
      { key: 'balconies', labelKey: 'listing_field_balconies', type: 'number', min: 0, placeholder: '1', required: false },
      { key: 'bathrooms', labelKey: 'listing_field_bathrooms', type: 'number', min: 0, placeholder: '1', required: false },
      { key: 'toilets', labelKey: 'listing_field_toilets', type: 'number', min: 0, placeholder: '1', required: false },
    ],
    [PROPERTY_TYPE_CANONICAL.HOUSE]: [
      { key: 'area', labelKey: 'listing_field_area', type: 'number', min: 1, placeholder: '180', required: true },
      { key: 'buildArea', labelKey: 'listing_field_build_area', type: 'number', min: 0, placeholder: '220', required: false },
      { key: 'lotArea', labelKey: 'listing_field_lot_area', type: 'number', min: 0, placeholder: '950', required: false },
      { key: 'buildYear', labelKey: 'listing_field_build_year', type: 'number', min: 1700, max: 2100, placeholder: '2012', required: false },
      { key: 'rooms', labelKey: 'listing_field_rooms', type: 'number', min: 0, placeholder: '6', required: true },
      { key: 'floors', labelKey: 'listing_field_floors', type: 'number', min: 1, placeholder: '2', required: false },
      { key: 'bathrooms', labelKey: 'listing_field_bathrooms', type: 'number', min: 0, placeholder: '2', required: false },
      { key: 'toilets', labelKey: 'listing_field_toilets', type: 'number', min: 0, placeholder: '2', required: false },
      { key: 'balconies', labelKey: 'listing_field_balconies', type: 'number', min: 0, placeholder: '1', required: false },
    ],
    [PROPERTY_TYPE_CANONICAL.FARMLAND]: [
      { key: 'area', labelKey: 'listing_field_area', type: 'number', min: 1, placeholder: '12000', required: true },
      { key: 'length', labelKey: 'listing_field_length', type: 'number', min: 0, placeholder: '120', required: false },
      { key: 'width', labelKey: 'listing_field_width', type: 'number', min: 0, placeholder: '80', required: false },
    ],
    [PROPERTY_TYPE_CANONICAL.BUILDING_LAND]: [
      { key: 'area', labelKey: 'listing_field_area', type: 'number', min: 1, placeholder: '950', required: true },
      { key: 'length', labelKey: 'listing_field_length', type: 'number', min: 0, placeholder: '40', required: false },
      { key: 'width', labelKey: 'listing_field_width', type: 'number', min: 0, placeholder: '24', required: false },
    ],
  });

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

  function mkr(price) {
    return window.RimalisI18n?.formatCurrencySEK?.(price, { compact: false }) || '-';
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
        reject(new Error(i18n('listing_read_image_failed')));
      };
      img.src = url;
    });
  }

  async function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error(i18n('listing_compress_image_failed')));
          return;
        }
        resolve(blob);
      }, type, quality);
    });
  }

  async function compressImageFile(file) {
    if (!(file instanceof File) || !file.type.startsWith('image/')) return file;

    const MAX_DIMENSION = 1920;
    const TARGET_BYTES = 220_000; // ~220KB
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

  async function uploadListingImage(file, metadata = {}) {
    if (!window.RimalisAPI) {
      throw new Error(i18n('listing_api_missing'));
    }

    const preparedFile = await compressImageFile(file);
    const formData = new FormData();
    formData.append('image', preparedFile);
    if (metadata.listingId) formData.append('listingId', String(metadata.listingId));
    if (metadata.listingReference) formData.append('listingReference', String(metadata.listingReference));
    if (metadata.imageIndex != null) formData.append('imageIndex', String(metadata.imageIndex));
    const onProgress = typeof metadata.onProgress === 'function' ? metadata.onProgress : null;

    const result = await new Promise((resolve, reject) => {
      const send = async (canRetry) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${window.RimalisAPI.API_BASE}/uploads/image`, true);
        xhr.withCredentials = true;
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

        const token = window.RimalisAPI.getAccessToken?.();
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

        xhr.upload.onprogress = (event) => {
          if (!onProgress || !event.lengthComputable) return;
          const pct = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)));
          onProgress(pct);
        };

        xhr.onerror = () => {
          reject(new Error(i18n('listing_upload_network_error')));
        };

        xhr.onload = async () => {
          let body = {};
          try {
            body = xhr.responseText ? JSON.parse(xhr.responseText) : {};
          } catch (_err) {
            body = {};
          }

          if (xhr.status === 401 && canRetry && window.RimalisAPI.refreshAccessToken) {
            try {
              await window.RimalisAPI.refreshAccessToken();
              send(false);
              return;
            } catch (_err) {
              reject(new Error(i18n('listing_upload_auth_expired')));
              return;
            }
          }

          if (xhr.status < 200 || xhr.status >= 300 || body?.success === false) {
            reject(new Error(body?.message || i18n('listing_save_image_failed')));
            return;
          }

          resolve(body);
        };

        xhr.send(formData);
      };

      send(true);
    });

    if (!result?.imageUrl) {
      throw new Error(i18n('listing_save_image_failed'));
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
    setIf('listingPropertyType', normalizePropertyType(draft.propertyType));
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
    const citySuggestions = document.getElementById('listingCitySuggestions');
    const googleMapPreview = document.getElementById('listingGoogleMapPreview');
    const googleMapLink = document.getElementById('listingGoogleMapLink');
    let dynamicInputs = [];
    let selectedGeoLat = Number(draft?.listingDetails?.geoLat || 0) || 0;
    let selectedGeoLng = Number(draft?.listingDetails?.geoLng || 0) || 0;

    function mapQuery() {
      const address = (addressInput?.value || '').trim();
      const city = (locationInput?.value || '').trim();
      return [address, city].filter(Boolean).join(', ') || city || address || 'Stockholm';
    }

    function updateGoogleMapPreview() {
      const query = mapQuery();
      const encoded = encodeURIComponent(query);
      if (googleMapPreview) {
        googleMapPreview.src = `https://www.google.com/maps?q=${encoded}&output=embed`;
      }
      if (googleMapLink) {
        googleMapLink.href = `https://www.google.com/maps/search/?api=1&query=${encoded}`;
      }
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
      const safeType = normalizePropertyType(type);
      const defs = CATEGORY_FIELDS()[safeType] || [];
      dynamicInputs = [];
      dynamicContainer.textContent = '';
      defs.forEach((f) => {
        const wrap = document.createElement('div');
        const label = document.createElement('label');
        label.className = 'text-white/60 text-sm font-bold mb-2 block';
        label.textContent = i18n(f.labelKey);
        const input = document.createElement('input');
        input.className = 'input-field';
        input.type = f.type;
        if (f.min != null) input.min = String(f.min);
        if (f.max != null) input.max = String(f.max);
        input.placeholder = f.placeholder || '';
        input.id = `listingField_${f.key}`;
        if (f.required) input.required = true;
        wrap.appendChild(label);
        wrap.appendChild(input);
        dynamicContainer.appendChild(wrap);
      });

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
        pricePreview.textContent = `${i18n('listing_price_format')}: ${p > 0 ? mkr(p) : '-'}`;
      }
    }

    [titleInput, priceInput, addressInput, descriptionInput, locationInput].forEach((el) => {
      if (!el) return;
      el.addEventListener('input', repaintChecks);
      if (el === addressInput || el === locationInput) {
        el.addEventListener('input', updateGoogleMapPreview);
        el.addEventListener('change', updateGoogleMapPreview);
      }
    });

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

            addressSuggestions.textContent = '';
            const inferredCities = new Set();
            rows.slice(0, 6).forEach((row) => {
              const option = document.createElement('option');
              option.value = row.display_name || '';
              addressSuggestions.appendChild(option);
              const addr = row?.address || {};
              const city =
                addr.city ||
                addr.town ||
                addr.village ||
                addr.municipality ||
                addr.county ||
                '';
              if (city) inferredCities.add(city);
            });
            if (citySuggestions) {
              citySuggestions.textContent = '';
              [...inferredCities].slice(0, 8).forEach((city) => {
                const cityOption = document.createElement('option');
                cityOption.value = city;
                citySuggestions.appendChild(cityOption);
              });
            }
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
          selectedGeoLat = Number(first?.lat || 0) || 0;
          selectedGeoLng = Number(first?.lon || 0) || 0;
          updateGoogleMapPreview();
        } catch (_err) {
          // ignore
        }
      });
    }
    propertyTypeInput?.addEventListener('change', () => {
      renderDynamicFields(normalizePropertyType(propertyTypeInput.value));
      repaintChecks();
    });
    renderDynamicFields(normalizePropertyType(propertyTypeInput?.value || draft.propertyType || ''));
    repaintChecks();
    updateGoogleMapPreview();

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (typeof form.reportValidity === 'function' && !form.reportValidity()) {
        return;
      }

      const listingDetails = getDynamicValues();
      if (selectedGeoLat && selectedGeoLng) {
        listingDetails.geoLat = selectedGeoLat;
        listingDetails.geoLng = selectedGeoLng;
      }
      listingDetails.mapQuery = mapQuery();
      const selectedType = normalizePropertyType(document.getElementById('listingPropertyType')?.value || '');
      const addressValue = document.getElementById('listingAddress')?.value?.trim() || '';
      const cityValue = document.getElementById('listingLocation')?.value?.trim() || '';
      const inferredCityFromAddress = addressValue
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .slice(-1)[0] || '';
      const resolvedCity = cityValue || inferredCityFromAddress;

      const payload = {
        title: document.getElementById('listingTitle')?.value?.trim() || '',
        propertyType: selectedType,
        price: Number(document.getElementById('listingPrice')?.value || 0),
        livingArea: Number(listingDetails.area || 0),
        rooms: Number(listingDetails.rooms || 0),
        city: resolvedCity,
        address: addressValue,
        description: document.getElementById('listingDescription')?.value?.trim() || '',
        listingDetails,
      };

      const requiredByType = (CATEGORY_FIELDS()[selectedType] || []).filter((x) => x.required);
      const missingRequiredTypeField = requiredByType.some((x) => {
        const v = listingDetails[x.key];
        return v === undefined || v === null || v === '';
      });

      const missingPieces = [];
      if (!payload.title) missingPieces.push(i18n('listing_field_title'));
      if (!selectedType) missingPieces.push(i18n('listing_field_property_type'));
      if (!payload.address) missingPieces.push(i18n('listing_field_address'));
      if (!payload.city) missingPieces.push(i18n('listing_field_city'));
      if (payload.price <= 0) missingPieces.push(i18n('listing_field_price'));
      if (payload.description.length < 20) missingPieces.push(i18n('listing_field_description'));
      if (missingRequiredTypeField) {
        requiredByType.forEach((field) => {
          const v = listingDetails[field.key];
          if (v === undefined || v === null || v === '') {
            missingPieces.push(i18n(field.labelKey));
          }
        });
      }

      if (missingPieces.length > 0) {
        const err = document.getElementById('createListingStep1Error');
        if (err) {
          err.textContent = `${i18n('listing_step1_required_error')}: ${[...new Set(missingPieces)].join(', ')}`;
          err.classList.remove('hidden');
          err.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        if (typeof showNotification === 'function') {
          showNotification(i18n('listing_step1_required_error'), 'error');
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
    let currentGridMode = 'draft';
    let draggingGridIndex = null;
    let previewObjectUrls = [];

    if (videoInput && draft.videoUrl) videoInput.value = draft.videoUrl;
    if (imageUrlInput && draft.imageUrl) imageUrlInput.value = draft.imageUrl;
    if (floorPlanInput && draft.floorPlanUrl) floorPlanInput.value = draft.floorPlanUrl;
    if (watermarkInput) watermarkInput.checked = Boolean(draft.watermarkEnabled);
    function revokePreviewUrls() {
      previewObjectUrls.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch (_err) {
          // noop
        }
      });
      previewObjectUrls = [];
    }

    function syncFilesInput() {
      if (!imagesInput) return;
      if (typeof DataTransfer === 'undefined') return;
      const dt = new DataTransfer();
      selectedImageFiles.forEach((file) => dt.items.add(file));
      imagesInput.files = dt.files;
    }

    function moveItem(array, fromIndex, toIndex) {
      if (!Array.isArray(array)) return array;
      if (fromIndex === toIndex) return array;
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= array.length || toIndex >= array.length) return array;
      const next = array.slice();
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    }

    function persistDraftImageOrder() {
      draft.imageUrls = draftImageUrlsState.slice();
      draft.imageUrl = draftImageUrlsState[0] || '';
      saveDraft({
        imageUrls: draftImageUrlsState.slice(),
        imageUrl: draftImageUrlsState[0] || '',
        imageCount: draftImageUrlsState.length,
      });
    }

    function renderSelectedImageGrid(urls, mode) {
      if (!imageGridWrap || !imageGrid || !imageGridCount) return;
      currentGridMode = mode;
      if (!urls.length) {
        imageGridWrap.classList.add('hidden');
        imageGrid.textContent = '';
        imageGridCount.textContent = '0';
        return;
      }

      imageGridWrap.classList.remove('hidden');
      imageGridCount.textContent = i18n('listing_files_selected').replace('{count}', String(urls.length));
      imageGrid.textContent = '';
      urls.forEach((url, index) => {
        const tile = document.createElement('div');
        tile.className = 'relative group rounded-2xl overflow-hidden border border-white/10 bg-black/40';
        tile.draggable = true;
        tile.dataset.gridImageIndex = String(index);
        const order = document.createElement('button');
        order.type = 'button';
        order.className = 'absolute top-2 left-2 z-10 text-[10px] px-2 py-1 rounded-full bg-black/70 border border-white/20';
        order.textContent = String(index + 1);
        tile.appendChild(order);
        if (index === 0) {
          const cover = document.createElement('span');
          cover.className = 'absolute bottom-2 left-2 z-10 text-[10px] px-2 py-1 rounded-full bg-[#e2ff31]/90 text-black font-bold';
          cover.textContent = `${i18n('listing_field_image')} 1`;
          tile.appendChild(cover);
        }
        if (mode === 'files') {
          const removeBtn = document.createElement('button');
          removeBtn.type = 'button';
          removeBtn.className = 'absolute top-2 right-2 z-10 text-[11px] w-7 h-7 rounded-full bg-red-500/85 hover:bg-red-500 text-white border border-red-300/40';
          removeBtn.dataset.removeImageIndex = String(index);
          removeBtn.title = 'Ta bort bild';
          removeBtn.textContent = '×';
          tile.appendChild(removeBtn);
        }
        if (index > 0) {
          const makeCover = document.createElement('button');
          makeCover.type = 'button';
          makeCover.className = 'absolute bottom-2 right-2 z-10 text-[10px] px-2 py-1 rounded-full bg-black/70 border border-white/20 text-white/90 hover:border-[#e2ff31]/70';
          makeCover.dataset.makeCoverIndex = String(index);
          makeCover.title = i18n('listing_set_cover');
          makeCover.textContent = i18n('listing_set_cover');
          tile.appendChild(makeCover);
        }
        const previewBtn = document.createElement('button');
        previewBtn.type = 'button';
        previewBtn.className = 'block w-full h-full';
        previewBtn.dataset.previewImageIndex = String(index);
        previewBtn.title = 'Visa som huvudbild';
        const img = document.createElement('img');
        img.src = url;
        img.alt = `Bild ${index + 1}`;
        img.className = 'w-full h-28 object-cover group-hover:scale-105 transition-transform duration-200';
        previewBtn.appendChild(img);
        tile.appendChild(previewBtn);
        imageGrid.appendChild(tile);
      });
    }

    function renderImageSelection() {
      const hasFiles = selectedImageFiles.length > 0;
      if (!hasFiles) {
        revokePreviewUrls();
        const draftUrls = draftImageUrlsState.slice();
        if (draftUrls.length && imagePreviewThumb && imagePreviewCard) {
          imagePreviewThumb.src = draftUrls[0];
          imagePreviewCard.classList.remove('hidden');
          renderSelectedImageGrid(draftUrls, 'draft');
          if (selectedFilesText) selectedFilesText.textContent = i18n('listing_image_saved_draft');
        } else {
          if (imagePreviewCard) imagePreviewCard.classList.add('hidden');
          renderSelectedImageGrid([], 'draft');
          if (selectedFilesText) selectedFilesText.textContent = i18n('listing_no_files_selected');
        }
        repaintStep2Checks();
        return;
      }

      revokePreviewUrls();
      const urls = selectedImageFiles.map((file) => {
        const url = URL.createObjectURL(file);
        previewObjectUrls.push(url);
        return url;
      });

      if (imagePreviewThumb && imagePreviewCard) {
        imagePreviewThumb.src = urls[0];
        imagePreviewCard.classList.remove('hidden');
      }
      renderSelectedImageGrid(urls, 'files');
      if (selectedFilesText) {
        selectedFilesText.textContent = i18n('listing_files_selected').replace('{count}', String(selectedImageFiles.length));
      }
      repaintStep2Checks();
    }

    if (imagePreviewThumb && draft.imageUrl) {
      renderImageSelection();
    }

    function showStep2Error(message) {
      const errEl = document.getElementById('createListingStep2Error');
      if (!errEl) return;
      errEl.textContent = message;
      errEl.classList.remove('hidden');
    }

    function repaintStep2Checks() {
      const hasImage = (imagesInput?.files?.length || 0) > 0 || !!(imageUrlInput?.value || '').trim();
      const hasVideo = !!(videoInput?.value || '').trim();
      const hasFloor = !!(floorPlanInput?.value || '').trim() || (floorPlanFileInput?.files?.length || 0) > 0;
      paintStep2Check('Image', hasImage);
      paintStep2Check('Video', hasVideo);
      paintStep2Check('FloorPlan', hasFloor);
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
      items.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'rounded-xl border border-white/10 bg-white/5 p-3';
        const top = document.createElement('div');
        top.className = 'flex items-center justify-between gap-2 mb-2';
        const name = document.createElement('p');
        name.className = 'text-sm font-semibold text-white/90 truncate';
        name.textContent = item.name;
        const percent = document.createElement('p');
        percent.className = 'text-xs text-white/60';
        percent.textContent = `${item.percent}%`;
        top.appendChild(name);
        top.appendChild(percent);
        const barWrap = document.createElement('div');
        barWrap.className = 'h-2 rounded-full bg-white/10 overflow-hidden';
        const bar = document.createElement('div');
        bar.className = `h-full ${item.status === 'failed' ? 'bg-red-400' : (item.status === 'done' ? 'bg-[#e2ff31]' : 'bg-blue-400')}`;
        bar.style.width = `${item.percent}%`;
        barWrap.appendChild(bar);
        const status = document.createElement('p');
        status.className = 'text-xs mt-2 text-white/60';
        status.textContent = item.status === 'done'
          ? i18n('listing_upload_status_done')
          : item.status === 'failed'
            ? i18n('listing_upload_status_failed')
            : i18n('listing_upload_status_uploading');
        row.appendChild(top);
        row.appendChild(barWrap);
        row.appendChild(status);
        uploadProgressList.appendChild(row);
      });

      const totalPercent = Math.round(items.reduce((sum, item) => sum + Number(item.percent || 0), 0) / items.length);
      uploadOverallBar.style.width = `${totalPercent}%`;
      uploadOverallText.textContent = i18n('listing_upload_overall').replace('{percent}', String(totalPercent));
    }

    function paintStep2Check(name, ok) {
      const row = document.getElementById(`step2Check${name}Row`);
      const icon = document.getElementById(`step2Check${name}Icon`);
      if (row) row.className = ok ? 'text-[#e2ff31]' : 'text-white/70';
      if (icon) icon.className = `fas ${ok ? 'fa-check-circle text-[#e2ff31]' : 'fa-circle text-white/30'} mr-2`;
    }

    if (imagesInput && selectedFilesText) {
      imagesInput.addEventListener('change', function () {
        const incomingFiles = imagesInput.files ? Array.from(imagesInput.files) : [];
        if (!incomingFiles.length) {
          selectedImageFiles = [];
          renderImageSelection();
          return;
        }
        if (incomingFiles.length > MAX_IMAGES_PER_LISTING) {
          imagesInput.value = '';
          selectedImageFiles = [];
          renderImageSelection();
          showStep2Error(
            i18n('listing_max_images_error').replace('{max}', String(MAX_IMAGES_PER_LISTING))
          );
          return;
        }
        selectedImageFiles = incomingFiles;
        renderImageSelection();
      });
    }

    imageGrid?.addEventListener('click', function (event) {
      const makeCoverBtn = event.target.closest('[data-make-cover-index]');
      if (makeCoverBtn) {
        const index = Number(makeCoverBtn.getAttribute('data-make-cover-index'));
        if (!Number.isInteger(index) || index <= 0) return;
        if (currentGridMode === 'files') {
          selectedImageFiles = moveItem(selectedImageFiles, index, 0);
          syncFilesInput();
        } else {
          draftImageUrlsState = moveItem(draftImageUrlsState, index, 0);
          persistDraftImageOrder();
        }
        renderImageSelection();
        return;
      }

      const previewBtn = event.target.closest('[data-preview-image-index]');
      if (previewBtn && imagePreviewThumb) {
        const index = Number(previewBtn.getAttribute('data-preview-image-index'));
        if (Number.isInteger(index) && index >= 0) {
          const source = previewBtn.querySelector('img')?.src;
          if (source) imagePreviewThumb.src = source;
        }
      }

      const removeBtn = event.target.closest('[data-remove-image-index]');
      if (!removeBtn) return;
      const index = Number(removeBtn.getAttribute('data-remove-image-index'));
      if (!Number.isInteger(index) || index < 0 || index >= selectedImageFiles.length) return;
      selectedImageFiles.splice(index, 1);
      syncFilesInput();
      renderImageSelection();
    });

    imageGrid?.addEventListener('dragstart', function (event) {
      const tile = event.target.closest('[data-grid-image-index]');
      if (!tile) return;
      const index = Number(tile.getAttribute('data-grid-image-index'));
      if (!Number.isInteger(index) || index < 0) return;
      draggingGridIndex = index;
      tile.classList.add('opacity-50');
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(index));
      }
    });

    imageGrid?.addEventListener('dragover', function (event) {
      const tile = event.target.closest('[data-grid-image-index]');
      if (!tile || draggingGridIndex === null) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      tile.classList.add('ring-2', 'ring-[#e2ff31]/60');
    });

    imageGrid?.addEventListener('dragleave', function (event) {
      const tile = event.target.closest('[data-grid-image-index]');
      if (!tile) return;
      tile.classList.remove('ring-2', 'ring-[#e2ff31]/60');
    });

    imageGrid?.addEventListener('drop', function (event) {
      event.preventDefault();
      const tile = event.target.closest('[data-grid-image-index]');
      if (!tile || draggingGridIndex === null) return;
      tile.classList.remove('ring-2', 'ring-[#e2ff31]/60');
      const dropIndex = Number(tile.getAttribute('data-grid-image-index'));
      if (!Number.isInteger(dropIndex) || dropIndex < 0 || dropIndex === draggingGridIndex) {
        draggingGridIndex = null;
        return;
      }

      if (currentGridMode === 'files') {
        selectedImageFiles = moveItem(selectedImageFiles, draggingGridIndex, dropIndex);
        syncFilesInput();
      } else {
        draftImageUrlsState = moveItem(draftImageUrlsState, draggingGridIndex, dropIndex);
        persistDraftImageOrder();
      }

      draggingGridIndex = null;
      renderImageSelection();
    });

    imageGrid?.addEventListener('dragend', function () {
      draggingGridIndex = null;
      const tiles = imageGrid.querySelectorAll('[data-grid-image-index]');
      tiles.forEach((tile) => {
        tile.classList.remove('opacity-50', 'ring-2', 'ring-[#e2ff31]/60');
      });
    });

    if (floorPlanFileInput && selectedFloorPlanFileText) {
      floorPlanFileInput.addEventListener('change', function () {
        const picked = floorPlanFileInput.files?.[0];
        selectedFloorPlanFileText.textContent = picked ? picked.name : i18n('listing_no_file_selected');
        repaintStep2Checks();
      });
    }

    [imageUrlInput, videoInput, floorPlanInput].forEach((el) => {
      if (!el) return;
      el.addEventListener('input', repaintStep2Checks);
    });
    renderImageSelection();

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      let imageUrl = imageUrlInput?.value?.trim() || draft.imageUrl || '';
      let imageUrls = draftImageUrlsState.slice();
      let floorPlanUrl = floorPlanInput?.value?.trim() || draft.floorPlanUrl || '';
      const imageFiles = selectedImageFiles.slice();
      const firstFloorPlanImage = floorPlanFileInput?.files?.[0];
      const submitButton = form.querySelector('button[type="submit"]');
      const uploadListingId = draft.uploadListingId || `annons-${Date.now()}`;
      const uploadListingReference = draft.uploadListingReference || draft.referenceCode || referenceFromId(uploadListingId);
      saveDraft({ uploadListingId, uploadListingReference });
      if (imageUrl) imageUrls = [imageUrl, ...imageUrls.filter((x) => x !== imageUrl)];

      const existingDraftImages = Array.isArray(imageUrls)
        ? imageUrls.filter((x) => typeof x === 'string' && x.trim())
        : [];
      if ((existingDraftImages.length + imageFiles.length) > MAX_IMAGES_PER_LISTING) {
        showStep2Error(
          i18n('listing_max_images_error').replace('{max}', String(MAX_IMAGES_PER_LISTING))
        );
        return;
      }

      const progressItems = [];
      const registerProgressItem = (name) => {
        progressItems.push({ name, percent: 0, status: 'uploading' });
        renderUploadProgress(progressItems);
        return progressItems.length - 1;
      };
      const updateProgressItem = (index, patch) => {
        if (index < 0 || index >= progressItems.length) return;
        progressItems[index] = { ...progressItems[index], ...patch };
        renderUploadProgress(progressItems);
      };
      renderUploadProgress(progressItems);

      if (imageFiles.length > 0) {
        try {
          const uploaded = [];
          for (let i = 0; i < imageFiles.length; i += 1) {
            if (submitButton) {
              submitButton.disabled = true;
              submitButton.textContent = i18n('listing_upload_image_progress')
                .replace('{current}', String(i + 1))
                .replace('{total}', String(imageFiles.length));
            }
            const progressIndex = registerProgressItem(`${i18n('listing_field_image')} ${i + 1}`);
            // Upload all selected images, keep same order as user selected.
            uploaded.push(await uploadListingImage(imageFiles[i], {
              listingId: uploadListingId,
              listingReference: uploadListingReference,
              imageIndex: i + 1,
              onProgress(percent) {
                updateProgressItem(progressIndex, { percent, status: 'uploading' });
              },
            }));
            updateProgressItem(progressIndex, { percent: 100, status: 'done' });
          }
          imageUrls = [...uploaded, ...imageUrls.filter((x) => !uploaded.includes(x))];
          imageUrl = imageUrls[0] || '';
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = i18n('listing_preview');
          }
        } catch (err) {
          if (progressItems.length) {
            const lastIndex = progressItems.length - 1;
            updateProgressItem(lastIndex, { status: 'failed' });
          }
          showStep2Error(err.message || i18n('listing_read_image_failed'));
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = i18n('listing_preview');
          }
          return;
        }
      }

      if (firstFloorPlanImage) {
        try {
          if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = i18n('listing_upload_floorplan');
          }
          const progressIndex = registerProgressItem(i18n('listing_upload_floorplan'));
          floorPlanUrl = await uploadListingImage(firstFloorPlanImage, {
            listingId: uploadListingId,
            listingReference: uploadListingReference,
            imageIndex: imageFiles.length + 1,
            onProgress(percent) {
              updateProgressItem(progressIndex, { percent, status: 'uploading' });
            },
          });
          updateProgressItem(progressIndex, { percent: 100, status: 'done' });
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = i18n('listing_preview');
          }
        } catch (err) {
          if (progressItems.length) {
            const lastIndex = progressItems.length - 1;
            updateProgressItem(lastIndex, { status: 'failed' });
          }
          showStep2Error(err.message || i18n('listing_read_floorplan_failed'));
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = i18n('listing_preview');
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
      };
      const hasImage = media.imageCount > 0 || !!media.imageUrl;
      if (!hasImage) {
        showStep2Error(i18n('listing_need_one_image'));
        return;
      }
      const err = document.getElementById('createListingStep2Error');
      if (err) err.classList.add('hidden');
      saveDraft(media);
      window.location.href = 'step3_preview_submit.html';
    });

    window.addEventListener('beforeunload', revokePreviewUrls);
  }

  function initStep3() {
    const submitBtn = document.getElementById('submitListingBtn');
    if (!submitBtn) return;

    const draft = getDraft();
    const draftAddress = String(draft.address || '').trim();
    const inferredCityFromAddress = draftAddress
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(-1)[0] || '';
    const resolvedCity = String(draft.city || inferredCityFromAddress).trim();

    if (resolvedCity && resolvedCity !== draft.city) {
      draft.city = resolvedCity;
      saveDraft({ city: resolvedCity });
    }

    if (!draft.title || !resolvedCity || !draft.price) {
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
    const galleryWrapEl = document.getElementById('previewGalleryWrap');
    const galleryEl = document.getElementById('previewGallery');
    const galleryCountEl = document.getElementById('previewGalleryCount');
    const hasVideoEl = document.getElementById('previewHasVideo');
    const hasFloorPlanEl = document.getElementById('previewHasFloorPlan');
    const extraDetailsEl = document.getElementById('previewExtraDetails');

    if (titleEl) titleEl.textContent = draft.title;
    if (locationEl) locationEl.textContent = resolvedCity;
    if (addressEl) addressEl.textContent = draftAddress || '-';
    if (priceEl) priceEl.textContent = mkr(draft.price);
    if (typeEl) typeEl.textContent = draft.propertyType || '-';
    if (areaEl) areaEl.textContent = String(draft.listingDetails?.area || draft.livingArea || '-');
    if (roomsEl) roomsEl.textContent = String(draft.listingDetails?.rooms || draft.rooms || '-');
    if (descriptionEl) descriptionEl.textContent = draft.description || i18n('listing_no_description');
    let previewImages = [];
    let draggingPreviewIndex = null;
    let activePreviewIndex = 0;
    if (Array.isArray(draft.imageUrls)) {
      draft.imageUrls.forEach((url) => {
        if (typeof url === 'string' && url.trim() && !previewImages.includes(url)) {
          previewImages.push(url);
        }
      });
    }
    if (draft.imageUrl && typeof draft.imageUrl === 'string' && draft.imageUrl.trim() && !previewImages.includes(draft.imageUrl)) {
      previewImages.unshift(draft.imageUrl);
    }
    const persistPreviewOrder = () => {
      draft.imageUrls = previewImages.slice();
      draft.imageUrl = previewImages[0] || '';
      saveDraft({
        imageUrls: previewImages.slice(),
        imageUrl: previewImages[0] || '',
        imageCount: previewImages.length,
      });
    };
    const moveItem = (array, fromIndex, toIndex) => {
      if (!Array.isArray(array)) return array;
      if (fromIndex === toIndex) return array;
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= array.length || toIndex >= array.length) return array;
      const next = array.slice();
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    };
    const previewImage = previewImages[0] || '';
    if (imageEl && previewImage) imageEl.src = previewImage;
    if (galleryWrapEl && galleryEl && previewImages.length > 1) {
      galleryWrapEl.classList.remove('hidden');
      const setActive = (index) => {
        if (!Number.isInteger(index) || index < 0 || index >= previewImages.length) return;
        activePreviewIndex = index;
        if (imageEl) imageEl.src = previewImages[index];
        const thumbs = galleryEl.querySelectorAll('[data-preview-gallery-index]');
        thumbs.forEach((thumb, thumbIndex) => {
          thumb.classList.toggle('border-[#e2ff31]', thumbIndex === index);
          thumb.classList.toggle('ring-2', thumbIndex === index);
          thumb.classList.toggle('ring-[#e2ff31]/60', thumbIndex === index);
        });
      };
      const renderGallery = () => {
        galleryEl.textContent = '';
        previewImages.forEach((url, index) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.draggable = true;
          btn.dataset.previewGalleryIndex = String(index);
          btn.className = 'group relative w-24 h-20 rounded-xl overflow-hidden border border-white/20 bg-black/40 shrink-0 transition-all hover:border-[#e2ff31]/70';
          btn.setAttribute('aria-label', `${i18n('listing_field_image')} ${index + 1}`);
          if (index === 0) {
            const badge = document.createElement('span');
            badge.className = 'absolute left-1.5 bottom-1.5 z-10 text-[9px] px-1.5 py-0.5 rounded bg-[#e2ff31]/90 text-black font-bold';
            badge.textContent = `${i18n('listing_field_image')} 1`;
            btn.appendChild(badge);
          }
          if (index > 0) {
            const makeCover = document.createElement('span');
            makeCover.dataset.makeCoverGalleryIndex = String(index);
            makeCover.className = 'absolute right-1.5 bottom-1.5 z-10 text-[9px] px-1.5 py-0.5 rounded bg-black/70 border border-white/20 text-white/90';
            makeCover.textContent = i18n('listing_set_cover');
            btn.appendChild(makeCover);
          }
          const img = document.createElement('img');
          img.src = url;
          img.alt = `${i18n('listing_field_image')} ${index + 1}`;
          img.className = 'w-full h-full object-cover';
          btn.appendChild(img);
          galleryEl.appendChild(btn);
        });
        if (galleryCountEl) {
          galleryCountEl.textContent = i18n('listing_files_selected').replace('{count}', String(previewImages.length));
        }
        setActive(Math.min(activePreviewIndex, Math.max(0, previewImages.length - 1)));
      };
      renderGallery();
      setActive(0);
      galleryEl.addEventListener('click', function (event) {
        const makeCoverEl = event.target.closest('[data-make-cover-gallery-index]');
        if (makeCoverEl) {
          const coverIndex = Number(makeCoverEl.getAttribute('data-make-cover-gallery-index'));
          if (Number.isInteger(coverIndex) && coverIndex > 0) {
            previewImages = moveItem(previewImages, coverIndex, 0);
            activePreviewIndex = 0;
            persistPreviewOrder();
            renderGallery();
          }
          return;
        }
        const btn = event.target.closest('[data-preview-gallery-index]');
        if (!btn) return;
        const index = Number(btn.getAttribute('data-preview-gallery-index'));
        setActive(index);
      });
      galleryEl.addEventListener('dragstart', function (event) {
        const btn = event.target.closest('[data-preview-gallery-index]');
        if (!btn) return;
        const index = Number(btn.getAttribute('data-preview-gallery-index'));
        if (!Number.isInteger(index) || index < 0) return;
        draggingPreviewIndex = index;
        btn.classList.add('opacity-50');
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', String(index));
        }
      });
      galleryEl.addEventListener('dragover', function (event) {
        const btn = event.target.closest('[data-preview-gallery-index]');
        if (!btn || draggingPreviewIndex === null) return;
        event.preventDefault();
        btn.classList.add('ring-2', 'ring-[#e2ff31]/60');
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      });
      galleryEl.addEventListener('dragleave', function (event) {
        const btn = event.target.closest('[data-preview-gallery-index]');
        if (!btn) return;
        btn.classList.remove('ring-2', 'ring-[#e2ff31]/60');
      });
      galleryEl.addEventListener('drop', function (event) {
        event.preventDefault();
        const btn = event.target.closest('[data-preview-gallery-index]');
        if (!btn || draggingPreviewIndex === null) return;
        btn.classList.remove('ring-2', 'ring-[#e2ff31]/60');
        const dropIndex = Number(btn.getAttribute('data-preview-gallery-index'));
        if (!Number.isInteger(dropIndex) || dropIndex < 0 || dropIndex === draggingPreviewIndex) {
          draggingPreviewIndex = null;
          return;
        }
        previewImages = moveItem(previewImages, draggingPreviewIndex, dropIndex);
        draggingPreviewIndex = null;
        activePreviewIndex = 0;
        persistPreviewOrder();
        renderGallery();
      });
      galleryEl.addEventListener('dragend', function () {
        draggingPreviewIndex = null;
        const thumbs = galleryEl.querySelectorAll('[data-preview-gallery-index]');
        thumbs.forEach((thumb) => {
          thumb.classList.remove('opacity-50', 'ring-2', 'ring-[#e2ff31]/60');
        });
      });
    } else if (galleryWrapEl) {
      galleryWrapEl.classList.add('hidden');
    }
    if (hasVideoEl && draft.videoUrl) hasVideoEl.classList.remove('hidden');
    if (hasFloorPlanEl && draft.floorPlanUrl) hasFloorPlanEl.classList.remove('hidden');
    if (extraDetailsEl) {
      const labels = {
        buildYear: i18n('listing_field_build_year'),
        floor: i18n('listing_field_floor'),
        balconies: i18n('listing_field_balconies'),
        bathrooms: i18n('listing_field_bathrooms'),
        toilets: i18n('listing_field_toilets'),
        buildArea: i18n('listing_field_build_area'),
        lotArea: i18n('listing_field_lot_area'),
        floors: i18n('listing_field_floors'),
        length: i18n('listing_field_length'),
        width: i18n('listing_field_width'),
      };
      const details = draft.listingDetails || {};
      extraDetailsEl.textContent = '';
      Object.entries(labels)
        .filter(([key]) => details[key] !== undefined && details[key] !== null && details[key] !== '')
        .forEach(([key, label]) => {
          const card = document.createElement('div');
          card.className = 'bg-white/5 border border-white/10 rounded-2xl p-4';
          const p1 = document.createElement('p');
          p1.className = 'text-white/40 mb-1';
          p1.textContent = label;
          const p2 = document.createElement('p');
          p2.className = 'font-bold text-white';
          p2.textContent = String(details[key]);
          card.appendChild(p1);
          card.appendChild(p2);
          extraDetailsEl.appendChild(card);
        });
    }

    const checklist = [
      ['Title', (draft.title || '').length >= 3],
      ['Description', (draft.description || '').length >= 20],
      ['Image', previewImages.length > 0 || (draft.imageCount || 0) > 0 || !!draft.imageUrl],
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
      submitBtn.textContent = i18n('listing_submitting');

      try {
        const payload = {
          title: draft.title,
          location: draft.city,
          price: Number(draft.price),
          listingDetails: {
            ...(draft.listingDetails || {}),
            watermarkEnabled: Boolean(draft.watermarkEnabled),
          },
          imageUrls: Array.isArray(draft.imageUrls)
            ? draft.imageUrls.filter((x) => typeof x === 'string' && x.trim())
            : (draft.imageUrl ? [draft.imageUrl] : []),
        };
        const primaryImage = (payload.imageUrls && payload.imageUrls[0]) || draft.imageUrl || '';
        if (primaryImage) payload.imageUrl = primaryImage;
        if (draft.propertyType) payload.propertyType = draft.propertyType;
        if (typeof draft.livingArea === 'number' && Number.isFinite(draft.livingArea) && draft.livingArea > 0) {
          payload.livingArea = draft.livingArea;
        }
        const draftRooms = Number(draft.rooms ?? draft.listingDetails?.rooms);
        if (Number.isFinite(draftRooms) && draftRooms > 0) payload.rooms = draftRooms;
        if (draft.address && String(draft.address).trim()) payload.address = draft.address;
        if (draft.description && String(draft.description).trim()) payload.description = draft.description;
        if (draft.videoUrl && String(draft.videoUrl).trim()) payload.videoUrl = draft.videoUrl;
        if (draft.floorPlanUrl && String(draft.floorPlanUrl).trim()) payload.floorPlanUrl = draft.floorPlanUrl;

        const body = await window.RimalisAPI.request('/users/me/listings', {
          method: 'POST',
          auth: true,
          body: JSON.stringify(payload),
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
          msg.textContent = err.message || i18n('listing_create_failed');
          msg.classList.remove('hidden');
        } else {
          alert(err.message || i18n('listing_create_failed'));
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = i18n('listing_submit_for_review');
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
      listingMetaEl.textContent = `${i18n('listing_reference_prefix')}: ${refFromUrl}`;
      return;
    }

    if (!listingId || !window.RimalisAPI?.request) {
      listingMetaEl.textContent = listingId ? `${i18n('listing_reference_prefix')}: ${referenceFromId(listingId)}` : `${i18n('listing_reference_prefix')}: -`;
      return;
    }

    try {
      const body = await window.RimalisAPI.request('/users/me/listings', { auth: true });
      const listings = body.listings || [];
      const listing = listings.find((x) => x.id === listingId);
      if (listing?.referenceCode) {
        listingMetaEl.textContent = `${i18n('listing_reference_prefix')}: ${listing.referenceCode}`;
        return;
      }
    } catch (_err) {
      // Fall through to legacy id text
    }

    listingMetaEl.textContent = `${i18n('listing_reference_prefix')}: ${referenceFromId(listingId)}`;
  }

  async function boot() {
    if (initialized) return;
    initialized = true;
    await ensureI18nReady();
    migrateLegacyDraftKey();
    initStep1();
    initStep2();
    initStep3();
    initSuccess();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      boot();
    });
  } else {
    boot();
  }

  // Safari/Chrome kan återställa sida från bfcache.
  window.addEventListener('pageshow', function () {
    if (!initialized) boot();
  });
})();
