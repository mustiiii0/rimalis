(function () {
  const DRAFT_KEY = 'rimalis_mobile_listing_draft_v2';
  const TYPE_APARTMENT = 'Lägenhet';
  const TYPE_HOUSE = 'Villa/Hus';
  const TYPE_LAND = 'Byggmark';
  const TYPE_FARM = 'Odlingsmark';
  const CATEGORY_FIELDS = {
    [TYPE_APARTMENT]: [
      { key: 'area', labelKey: 'listing_field_area', type: 'number', min: 1, placeholder: '85', required: true },
      { key: 'buildYear', labelKey: 'listing_field_build_year', type: 'number', min: 1700, max: 2100, placeholder: '2018', required: false },
      { key: 'floor', labelKey: 'listing_field_floor', type: 'number', min: 0, placeholder: '4', required: false },
      { key: 'rooms', labelKey: 'listing_field_rooms', type: 'number', min: 0, placeholder: '3', required: true },
      { key: 'balconies', labelKey: 'listing_field_balconies', type: 'number', min: 0, placeholder: '1', required: false },
      { key: 'bathrooms', labelKey: 'listing_field_bathrooms', type: 'number', min: 0, placeholder: '1', required: false },
      { key: 'toilets', labelKey: 'listing_field_toilets', type: 'number', min: 0, placeholder: '1', required: false },
    ],
    [TYPE_HOUSE]: [
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
    [TYPE_FARM]: [
      { key: 'area', labelKey: 'listing_field_area', type: 'number', min: 1, placeholder: '12000', required: true },
      { key: 'length', labelKey: 'listing_field_length', type: 'number', min: 0, placeholder: '120', required: false },
      { key: 'width', labelKey: 'listing_field_width', type: 'number', min: 0, placeholder: '80', required: false },
    ],
    [TYPE_LAND]: [
      { key: 'area', labelKey: 'listing_field_area', type: 'number', min: 1, placeholder: '950', required: true },
      { key: 'length', labelKey: 'listing_field_length', type: 'number', min: 0, placeholder: '40', required: false },
      { key: 'width', labelKey: 'listing_field_width', type: 'number', min: 0, placeholder: '24', required: false },
    ],
  };
  const DETAIL_LABELS = {
    area: 'listing_field_area',
    buildYear: 'listing_field_build_year',
    floor: 'listing_field_floor',
    rooms: 'listing_field_rooms',
    balconies: 'listing_field_balconies',
    bathrooms: 'listing_field_bathrooms',
    toilets: 'listing_field_toilets',
    buildArea: 'listing_field_build_area',
    lotArea: 'listing_field_lot_area',
    floors: 'listing_field_floors',
    length: 'listing_field_length',
    width: 'listing_field_width',
  };
  const state = {
    propertyType: TYPE_HOUSE,
    dynamicFields: [],
    files: [],
    uploadedImageUrls: [],
  };

  function i18n(key, fallback) {
    return window.RimalisI18n?.t?.(key, fallback) || fallback;
  }

  async function ensureI18nReady() {
    if (window.RimalisI18n?.refresh) {
      await window.RimalisI18n.refresh(window.RimalisI18n.getLanguage?.());
    }
  }

  function localizedPropertyType(value) {
    const raw = String(value || '').trim();
    if (!raw) return i18n('property_type_default', 'Bostad');
    const normalized = raw.toLowerCase();
    if (['villa', 'villa/hus', 'hus', 'house'].includes(normalized)) return i18n('property_type_house', 'Villa');
    if (['lägenhet', 'lagenhet', 'apartment'].includes(normalized)) return i18n('property_type_apartment', 'Lägenhet');
    if (['radhus', 'townhouse'].includes(normalized)) return i18n('property_type_townhouse', 'Radhus');
    if (['fritidshus', 'fritid', 'holiday home', 'holiday_home'].includes(normalized)) return i18n('property_type_holiday_home', 'Fritidshus');
    if (['byggmark', 'plot', 'land', 'tomt'].includes(normalized)) return i18n('property_type_plot', 'Byggmark');
    if (['odlingsmark', 'farm', 'farmland'].includes(normalized)) return i18n('property_type_farm', 'Odlingsmark');
    return raw;
  }

  function isLandType(propertyType) {
    return propertyType === TYPE_LAND || propertyType === TYPE_FARM;
  }

  function readDraft() {
    try {
      return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || '{}');
    } catch (_err) {
      return {};
    }
  }

  function writeDraft(patch) {
    const next = { ...readDraft(), ...patch };
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(next));
    return next;
  }

  function clearDraft() {
    sessionStorage.removeItem(DRAFT_KEY);
  }

  function qs(id) {
    return document.getElementById(id);
  }

  function formatSek(value) {
    const num = Number(value || 0);
    return num > 0 ? `${new Intl.NumberFormat('sv-SE').format(num)} kr` : '-';
  }

  function getDynamicValues() {
    const out = {};
    state.dynamicFields.forEach((meta) => {
      const value = meta.input.value;
      if (value === '') return;
      out[meta.key] = meta.type === 'number' ? Number(value) : value.trim();
    });
    return out;
  }

  function currentPayload() {
    const draft = readDraft();
    const listingDetails = getDynamicValues();
    const payload = {
      propertyType: draft.propertyType || state.propertyType || TYPE_HOUSE,
      title: qs('titleInput') ? qs('titleInput').value.trim() : (draft.title || ''),
      price: qs('priceInput') ? Number(qs('priceInput').value || 0) : Number(draft.price || 0),
      location: qs('locationInput') ? qs('locationInput').value.trim() : (draft.location || ''),
      address: qs('addressInput') ? qs('addressInput').value.trim() : (draft.address || ''),
      postalCode: qs('postalCodeInput') ? qs('postalCodeInput').value.trim() : (draft.postalCode || ''),
      description: qs('descriptionInput') ? qs('descriptionInput').value.trim() : (draft.description || ''),
      videoUrl: qs('videoUrlInput') ? qs('videoUrlInput').value.trim() : (draft.videoUrl || ''),
      floorPlanUrl: qs('floorPlanUrlInput') ? qs('floorPlanUrlInput').value.trim() : (draft.floorPlanUrl || ''),
      imageUrls: state.uploadedImageUrls.length ? state.uploadedImageUrls.slice() : (Array.isArray(draft.imageUrls) ? draft.imageUrls.slice() : []),
      listingDetails: Object.keys(listingDetails).length ? listingDetails : (draft.listingDetails || {}),
      livingArea: Number((Object.keys(listingDetails).length ? listingDetails.area : draft.listingDetails?.area) || 0),
      rooms: Number((Object.keys(listingDetails).length ? listingDetails.rooms : draft.listingDetails?.rooms) || 0),
    };
    writeDraft(payload);
    return payload;
  }

  function renderDynamicFields() {
    const container = qs('dynamicFields');
    if (!container) return;
    const defs = CATEGORY_FIELDS[state.propertyType] || [];
    const draft = readDraft();
    const draftDetails = draft.listingDetails || {};
    state.dynamicFields = [];
    container.innerHTML = defs.map((field) => `
      <label>
        <span>${i18n(field.labelKey, field.labelKey || '')}${field.required ? ' <span class="mobile-create-required">*</span>' : ''}</span>
        <input
          class="input-field"
          id="field_${field.key}"
          type="${field.type}"
          ${field.min != null ? `min="${field.min}"` : ''}
          ${field.max != null ? `max="${field.max}"` : ''}
          placeholder="${field.placeholder || ''}"
        >
      </label>
    `).join('');
    defs.forEach((field) => {
      const input = qs(`field_${field.key}`);
      if (!input) return;
      const value = draftDetails[field.key];
      if (value != null && value !== '') input.value = String(value);
      input.addEventListener('input', updateStep1Status);
      state.dynamicFields.push({ ...field, input });
    });
  }

  function applyStepper(step) {
    document.querySelectorAll('[data-stepper]').forEach((node, index) => {
      node.classList.remove('is-active', 'is-complete');
      if (index + 1 < step) node.classList.add('is-complete');
      if (index + 1 === step) node.classList.add('is-active');
    });
  }

  function updateProgressBar(step, total) {
    const percent = Math.round((step / total) * 100);
    document.querySelectorAll('[data-progress-fill]').forEach((node) => {
      node.style.width = `${percent}%`;
    });
    document.querySelectorAll('[data-progress-text]').forEach((node) => {
      node.textContent = `${percent}% klart`;
    });
  }

  function showStepMessage(text, type) {
    const el = qs('stepMessage');
    if (!el) return;
    el.textContent = text;
    el.className = `mobile-create-error ${type || ''}`;
  }

  function clearStepMessage() {
    const el = qs('stepMessage');
    if (!el) return;
    el.textContent = '';
    el.className = 'mobile-create-error';
  }

  function updateAddressState() {
    const city = qs('locationInput')?.value.trim() || '';
    const addressInput = qs('addressInput');
    const hint = qs('addressHint');
    if (!addressInput) return;
    addressInput.disabled = !city;
    if (!city) {
      addressInput.value = '';
      addressInput.placeholder = i18n('listing_choose_city_first', 'Välj stad först');
      if (hint) hint.textContent = i18n('listing_address_hint_waiting', 'Fyll i stad först. Därefter får du adressförslag inom den staden.');
      const suggestions = qs('addressSuggestions');
      if (suggestions) suggestions.textContent = '';
      return;
    }
    addressInput.placeholder = i18n('listing_address_in_city', 'Skriv adress i {city}').replace('{city}', city);
    if (hint) hint.textContent = i18n('listing_address_suggestions_for_city', 'Adressförslag visas för {city}.').replace('{city}', city);
  }

  let addressDebounce = null;
  let addressFetchSeq = 0;
  function renderAddressSuggestions(rows) {
    const suggestions = qs('addressSuggestions');
    if (!suggestions) return;
    suggestions.textContent = '';
    rows.slice(0, 6).forEach((row) => {
      const option = document.createElement('option');
      const addr = row?.address || {};
      const street = row?.name || row?.display_name || '';
      const postcode = addr.postcode || '';
      const locality = addr.city || addr.town || addr.village || addr.municipality || (qs('locationInput')?.value.trim() || '');
      option.value = [street, postcode, locality].filter(Boolean).join(', ');
      suggestions.appendChild(option);
    });
  }
  async function fetchAddressSuggestions() {
    const city = qs('locationInput')?.value.trim() || '';
    const address = qs('addressInput')?.value.trim() || '';
    const suggestions = qs('addressSuggestions');
    if (!city || !address || address.length < 2 || !suggestions) {
      if (suggestions) suggestions.textContent = '';
      return;
    }
    const query = `${address}, ${city}, Sweden`;
    const currentSeq = ++addressFetchSeq;
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=se&limit=6&q=${encodeURIComponent(query)}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) return;
      const rows = await res.json();
      if (currentSeq !== addressFetchSeq || !Array.isArray(rows)) return;
      renderAddressSuggestions(rows);
    } catch (_err) {
      // ignore autocomplete errors
    }
  }

  function updateStep1Status() {
    currentPayload();
    const data = readDraft();
    const requiredByType = (CATEGORY_FIELDS[data.propertyType] || []).filter((field) => field.required);
    const done = [
      Boolean(data.propertyType),
      Boolean(data.title && data.title.length >= 3),
      Boolean(data.price > 0),
      Boolean(data.location && data.location.length >= 2),
      Boolean(data.address && data.address.length >= 4),
      requiredByType.every((field) => {
        const value = data.listingDetails?.[field.key];
        return value !== undefined && value !== null && value !== '';
      }),
      Boolean(data.description && data.description.length >= 20),
    ].filter(Boolean).length;
    const badge = qs('step1Status');
    if (badge) badge.textContent = `${done}/7 klara`;
  }

  function validateStep1() {
    const data = currentPayload();
    const missing = [];
    const requiredByType = (CATEGORY_FIELDS[data.propertyType] || []).filter((field) => field.required);
    if (!data.propertyType) missing.push(i18n('listing_property_type', 'objektstyp'));
    if (!data.title || data.title.length < 3) missing.push(i18n('listing_title', 'rubrik'));
    if (!(data.price > 0)) missing.push(i18n('price', 'pris'));
    if (!data.location || data.location.length < 2) missing.push(i18n('city', 'stad'));
    if (!data.address || data.address.length < 4) missing.push(i18n('address', 'adress'));
    requiredByType.forEach((field) => {
      const value = data.listingDetails?.[field.key];
      if (value === undefined || value === null || value === '') missing.push(field.label.toLowerCase());
    });
    if (!data.description || data.description.length < 20) missing.push('beskrivning');
    if (missing.length) throw new Error(`Fyll i ${missing.join(', ')}.`);
  }

  function renderMediaGrid() {
    const grid = qs('listingImageGrid');
    const count = qs('listingImageGridCount');
    const summary = qs('selectedFilesText');
    if (!grid || !count || !summary) return;
    grid.innerHTML = '';
    const draft = readDraft();
    if (!state.files.length) {
      const urls = Array.isArray(draft.imageUrls) ? draft.imageUrls : [];
      if (!urls.length) {
        summary.textContent = 'Inga bilder valda';
        count.textContent = '0';
        return;
      }
      urls.forEach((url, index) => {
        const tile = document.createElement('div');
        tile.className = 'preview-tile';
        tile.innerHTML = `<img src="${url}" alt="Bild">${index === 0 ? '<span class="preview-badge">Omslag</span>' : ''}`;
        grid.appendChild(tile);
      });
      summary.textContent = `${urls.length} sparade bild(er)`;
      count.textContent = `${urls.length} bilder`;
      return;
    }
    state.files.forEach((file, index) => {
      const tile = document.createElement('div');
      tile.className = 'preview-tile';
      tile.innerHTML = `
        <img src="${URL.createObjectURL(file)}" alt="Bild">
        <button class="preview-remove" type="button" data-index="${index}"><i class="fas fa-times"></i></button>
        ${index === 0 ? '<span class="preview-badge">Omslag</span>' : ''}
      `;
      grid.appendChild(tile);
    });
    summary.textContent = `${state.files.length} fil(er) valda`;
    count.textContent = `${state.files.length} bilder`;
  }

  async function uploadImages() {
    if (!state.files.length) return Array.isArray(readDraft().imageUrls) ? readDraft().imageUrls : [];
    const uploaded = [];
    for (const file of state.files) {
      const formData = new FormData();
      formData.append('image', file);
      const body = await window.RimalisAPI.request('/uploads/image', {
        method: 'POST',
        auth: true,
        body: formData,
      });
      if (!body?.imageUrl) throw new Error('Kunde inte ladda upp en av bilderna.');
      uploaded.push(body.imageUrl);
    }
    state.uploadedImageUrls = uploaded.slice();
    writeDraft({ imageUrls: uploaded.slice() });
    return uploaded;
  }

  function updateStep2Status() {
    currentPayload();
    const draft = readDraft();
    const hasImages = state.files.length > 0 || (Array.isArray(draft.imageUrls) && draft.imageUrls.length > 0);
    const hasPlan = Boolean(draft.floorPlanUrl);
    const hasVideo = Boolean(draft.videoUrl);
    const badge = qs('step2Status');
    if (badge) badge.textContent = `${[hasImages, hasPlan, hasVideo].filter(Boolean).length}/3 klara`;
  }

  function validateStep2() {
    const draft = currentPayload();
    const hasImages = state.files.length > 0 || draft.imageUrls.length > 0;
    if (!hasImages) throw new Error('Lägg till minst en bild innan du fortsätter.');
  }

  function buildListingPayload(imageUrls) {
    const data = currentPayload();
    const landType = isLandType(data.propertyType);
    return {
      title: data.title,
      location: data.location,
      price: data.price,
      propertyType: data.propertyType,
      address: data.address,
      description: data.description,
      imageUrl: imageUrls[0] || '',
      imageUrls,
      ...(!landType && data.livingArea > 0 ? { livingArea: data.livingArea } : {}),
      ...(!landType && data.rooms > 0 ? { rooms: data.rooms } : {}),
      ...(data.videoUrl ? { videoUrl: data.videoUrl } : {}),
      ...(data.floorPlanUrl ? { floorPlanUrl: data.floorPlanUrl } : {}),
      listingDetails: {
        ...data.listingDetails,
        ...(data.postalCode ? { postalCode: data.postalCode } : {}),
      },
    };
  }

  function renderReview() {
    const draft = readDraft();
    const landType = isLandType(draft.propertyType);
    if (qs('previewTitle')) qs('previewTitle').textContent = draft.title || '-';
    if (qs('previewLocation')) qs('previewLocation').textContent = draft.location || '-';
    if (qs('previewAddress')) qs('previewAddress').textContent = [draft.address, draft.postalCode].filter(Boolean).join(', ') || '-';
    if (qs('previewPrice')) qs('previewPrice').textContent = formatSek(draft.price);
    if (qs('previewPropertyType')) qs('previewPropertyType').textContent = localizedPropertyType(draft.propertyType);
    if (qs('previewLivingArea')) qs('previewLivingArea').textContent = draft.livingArea || '-';
    if (qs('previewAreaLabel')) qs('previewAreaLabel').textContent = landType ? i18n('listing_field_area', 'Area') : i18n('property_feature_living_area', 'Boarea');
    if (qs('previewRooms')) qs('previewRooms').textContent = draft.rooms || '-';
    if (qs('previewRoomsCard')) qs('previewRoomsCard').style.display = landType ? 'none' : '';
    if (qs('previewDescription')) qs('previewDescription').textContent = draft.description || i18n('property_description_missing', 'Beskrivning saknas.');
    const image = (Array.isArray(draft.imageUrls) && draft.imageUrls[0]) || '';
    if (qs('previewImage') && image) qs('previewImage').src = image;
    if (qs('previewHasVideo')) qs('previewHasVideo').classList.toggle('hidden', !draft.videoUrl);
    if (qs('previewHasFloorPlan')) qs('previewHasFloorPlan').classList.toggle('hidden', !draft.floorPlanUrl);
    const extra = qs('previewExtraDetails');
    if (extra) {
      extra.textContent = '';
      Object.entries(DETAIL_LABELS)
        .filter(([key]) => draft.listingDetails?.[key] !== undefined && draft.listingDetails?.[key] !== null && draft.listingDetails?.[key] !== '')
        .forEach(([key, labelKey]) => {
          const article = document.createElement('article');
          const value = document.createElement('span');
          value.className = 'mobile-create-preview-extra__value';
          value.textContent = String(draft.listingDetails[key]);
          const label = document.createElement('strong');
          label.className = 'mobile-create-preview-extra__label';
          label.textContent = i18n(labelKey, labelKey);
          article.append(value, label);
          extra.appendChild(article);
        });
    }
  }

  async function publishListing() {
    const button = qs('submitListingBtn');
    const error = qs('createListingError');
    if (error) error.classList.add('hidden');
    if (button) {
      button.disabled = true;
      button.textContent = i18n('saving', 'Sparar...');
    }
    try {
      const draft = readDraft();
      if (!draft.title || !draft.location || !draft.price) throw new Error(i18n('listing_fill_basic_info_first', 'Gå tillbaka och fyll i grundinformationen först.'));
      const body = await window.RimalisAPI.request('/users/me/listings', {
        method: 'POST',
        auth: true,
        body: JSON.stringify(buildListingPayload(Array.isArray(draft.imageUrls) ? draft.imageUrls : [])),
      });
      clearDraft();
      const listingId = body?.listing?.id || '';
      const ref = body?.listing?.referenceCode || '';
      const params = new URLSearchParams();
      if (listingId) params.set('id', listingId);
      if (ref) params.set('ref', ref);
      window.location.href = `submitted_success.html?${params.toString()}`;
    } catch (err) {
      if (error) {
        error.textContent = err.message || i18n('listing_create_failed', 'Kunde inte skapa annons');
        error.classList.remove('hidden');
      }
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = i18n('listing_submit_for_review', 'Skicka till granskning');
      }
    }
  }

  async function initStep1() {
    if (!document.body.dataset.createStep || document.body.dataset.createStep !== '1') return;
    applyStepper(1);
    updateProgressBar(1, 3);
    const draft = readDraft();
    state.propertyType = draft.propertyType || state.propertyType;
    document.querySelectorAll('[data-type]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.type === state.propertyType);
      btn.addEventListener('click', function () {
        document.querySelectorAll('[data-type]').forEach((node) => node.classList.remove('active'));
        this.classList.add('active');
        state.propertyType = this.dataset.type;
        const current = readDraft();
        current.listingDetails = {};
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...current, propertyType: state.propertyType, livingArea: 0, rooms: 0 }));
        renderDynamicFields();
        updateStep1Status();
      });
    });
    if (qs('titleInput')) qs('titleInput').value = draft.title || '';
    if (qs('priceInput')) qs('priceInput').value = draft.price || '';
    if (qs('locationInput')) qs('locationInput').value = draft.location || '';
    if (qs('addressInput')) qs('addressInput').value = draft.address || '';
    if (qs('postalCodeInput')) qs('postalCodeInput').value = draft.postalCode || '';
    if (qs('descriptionInput')) qs('descriptionInput').value = draft.description || '';
    renderDynamicFields();
    updateAddressState();
    ['titleInput', 'priceInput', 'locationInput', 'addressInput', 'postalCodeInput', 'descriptionInput'].forEach((id) => {
      const el = qs(id);
      if (!el) return;
      el.addEventListener('input', updateStep1Status);
    });
    qs('locationInput')?.addEventListener('input', function () {
      updateAddressState();
      updateStep1Status();
    });
    qs('addressInput')?.addEventListener('input', function () {
      if (addressDebounce) clearTimeout(addressDebounce);
      addressDebounce = setTimeout(fetchAddressSuggestions, 250);
    });
    qs('saveDraftBtn')?.addEventListener('click', function () {
      currentPayload();
      clearStepMessage();
      showStepMessage('Utkast sparat i denna session.');
    });
    qs('nextStepBtn')?.addEventListener('click', function () {
      try {
        clearStepMessage();
        validateStep1();
        window.location.href = 'step2_media.html';
      } catch (err) {
        showStepMessage(err.message);
      }
    });
    updateStep1Status();
  }

  function initStep2() {
    if (!document.body.dataset.createStep || document.body.dataset.createStep !== '2') return;
    applyStepper(2);
    updateProgressBar(2, 3);
    const draft = readDraft();
    state.propertyType = draft.propertyType || state.propertyType;
    if (!draft.title || !draft.location || !draft.price) {
      window.location.href = 'step1_listing_info.html';
      return;
    }
    state.uploadedImageUrls = Array.isArray(draft.imageUrls) ? draft.imageUrls.slice() : [];
    if (qs('listingVideoUrl')) qs('listingVideoUrl').value = draft.videoUrl || '';
    if (qs('listingFloorPlanUrl')) qs('listingFloorPlanUrl').value = draft.floorPlanUrl || '';
    renderMediaGrid();
    updateStep2Status();
    qs('listingImages')?.addEventListener('change', function () {
      state.files = Array.from(this.files || []);
      renderMediaGrid();
      updateStep2Status();
    });
    qs('listingImageGrid')?.addEventListener('click', function (event) {
      const btn = event.target.closest('[data-index]');
      if (!btn) return;
      state.files.splice(Number(btn.dataset.index), 1);
      renderMediaGrid();
      updateStep2Status();
    });
    ['listingVideoUrl', 'listingFloorPlanUrl'].forEach((id) => {
      qs(id)?.addEventListener('input', function () {
        currentPayload();
        updateStep2Status();
      });
    });
    qs('goToReviewBtn')?.addEventListener('click', async function () {
      try {
        clearStepMessage();
        currentPayload();
        validateStep2();
        const button = this;
        button.disabled = true;
        button.textContent = i18n('listing_upload_status_uploading', 'Laddar upp...');
        const imageUrls = await uploadImages();
        writeDraft({
          imageUrls,
          imageUrl: imageUrls[0] || '',
          videoUrl: qs('listingVideoUrl')?.value.trim() || '',
          floorPlanUrl: qs('listingFloorPlanUrl')?.value.trim() || '',
        });
        window.location.href = 'step3_preview_submit.html';
      } catch (err) {
        showStepMessage(err.message);
      } finally {
        const button = qs('goToReviewBtn');
        if (button) {
          button.disabled = false;
          button.textContent = 'Fortsätt till granskning';
        }
      }
    });
  }

  function initStep3() {
    if (!document.body.dataset.createStep || document.body.dataset.createStep !== '3') return;
    applyStepper(3);
    updateProgressBar(3, 3);
    const draft = readDraft();
    state.propertyType = draft.propertyType || state.propertyType;
    if (!draft.title || !draft.location || !draft.price) {
      window.location.href = 'step1_listing_info.html';
      return;
    }
    renderReview();
    qs('submitListingBtn')?.addEventListener('click', publishListing);
  }

  async function initSuccess() {
    if (!document.body.dataset.createStep || document.body.dataset.createStep !== 'success') return;
    const meta = qs('submittedListingMeta');
    if (!meta) return;
    const params = new URLSearchParams(window.location.search);
    const ref = (params.get('ref') || '').trim();
    const id = (params.get('id') || '').trim();
    if (ref) {
      meta.textContent = `Annonsreferens: ${ref}`;
      return;
    }
    if (!id || !window.RimalisAPI?.request) {
      meta.textContent = id ? `Annons-ID: ${id}` : 'Annonsreferens: -';
      return;
    }
    try {
      const body = await window.RimalisAPI.request('/users/me/listings', { auth: true });
      const listings = body?.listings || [];
      const listing = listings.find((item) => item.id === id);
      meta.textContent = listing?.referenceCode ? `Annonsreferens: ${listing.referenceCode}` : `Annons-ID: ${id}`;
    } catch (_err) {
      meta.textContent = `Annons-ID: ${id}`;
    }
  }

  async function boot() {
    await ensureI18nReady();
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

  window.addEventListener('rimalis:language-changed', function () {
    ensureI18nReady().then(() => {
      if (document.body.dataset.createStep === '3') renderReview();
      if (document.body.dataset.createStep === '1') renderDynamicFields();
    });
  });
})();
