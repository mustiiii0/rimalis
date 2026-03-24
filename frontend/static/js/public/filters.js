// ===== FILTER FUNKTIONALITET =====

function i18n(key) {
    return window.RimalisI18n?.t?.(key, key) || key;
}

function i18nArray(key, fallback = []) {
    const value = window.RimalisI18n?.t?.(key, fallback);
    return Array.isArray(value) ? value : fallback;
}

function defaultPropertyTypeLabel() {
    return i18nArray('option_property_types', [''])[0] || '';
}

function defaultRoomCountLabel() {
    return i18nArray('option_room_count', [''])[0] || '';
}

function defaultLivingAreaLabel() {
    return i18nArray('option_living_area', [''])[0] || '';
}

function formatI18nNumber(value) {
    return window.RimalisI18n?.formatNumber?.(value) || String(value ?? '');
}

function setPriceButtonLabel(labelText) {
    const priceBtn = document.getElementById('priceBtn');
    if (!priceBtn) return;
    const label = priceBtn.querySelector('span');
    const icon = priceBtn.querySelector('i');
    if (label) label.textContent = String(labelText || '');
    if (!icon) {
        const newIcon = document.createElement('i');
        newIcon.className = 'fas fa-chevron-down text-white/30 text-xs';
        priceBtn.appendChild(newIcon);
    }
}

function initFilters() {
    initPriceDropdown();
    initSearchChips();
    initPopularSearches();
    initSelectFilters();
    initSearchActions();
}

// ===== PRIS DROPDOWN =====
function initPriceDropdown() {
    const priceBtn = document.getElementById('priceBtn');
    const pricePanel = document.getElementById('pricePanel');
    const priceOptions = document.querySelectorAll('.price-option');
    const minPrice = document.getElementById('minPrice');
    const maxPrice = document.getElementById('maxPrice');
    const applyPrice = document.getElementById('applyPrice');
    
    if (!priceBtn) return;
    
    // Toggle panel
    priceBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        pricePanel.classList.toggle('active');
    });
    
    // Stäng vid klick utanför
    document.addEventListener('click', () => {
        if (pricePanel) pricePanel.classList.remove('active');
    });
    
    if (pricePanel) {
        pricePanel.addEventListener('click', (e) => e.stopPropagation());
    }
    
    // Prisalternativ
    priceOptions.forEach(option => {
        option.addEventListener('click', () => {
            priceOptions.forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');
            
            const min = option.dataset.min;
            const max = option.dataset.max;
            
            if (minPrice) {
                minPrice.value = min
                  ? (window.RimalisI18n?.formatCurrencySEK?.(parseInt(min, 10), { compact: false })
                    || new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(parseInt(min, 10)))
                  : '';
            }
            
            if (maxPrice) {
                if (max) {
                    maxPrice.value = window.RimalisI18n?.formatCurrencySEK?.(parseInt(max, 10), { compact: false })
                      || new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(parseInt(max, 10));
                } else {
                    maxPrice.value = i18n('filters_unlimited');
                }
            }
        });
    });
    
    // Tillämpa pris
    if (applyPrice) {
        applyPrice.addEventListener('click', () => {
            const min = minPrice ? minPrice.value || '0' : '0';
            const max = maxPrice ? maxPrice.value || i18n('filters_unlimited') : i18n('filters_unlimited');
            
            setPriceButtonLabel(`${min} – ${max}`);
            
            pricePanel.classList.remove('active');
            showNotification(`${i18n('filters_price_filter')}: ${min} – ${max}`, 'info');
            
            filterResults();
        });
    }
}

// ===== SELECT FILTER =====
function initSelectFilters() {
    const selects = document.querySelectorAll('select');
    
    selects.forEach(select => {
        select.addEventListener('change', function() {
            filterResults();
        });
    });
}

// ===== FILTER CHIPS =====
function initSearchChips() {
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', function() {
            this.classList.toggle('active');
            
            const filterText = this.textContent.trim();
            const isActive = this.classList.contains('active');
            
            const action = isActive ? i18n('filters_added') : i18n('filters_removed');
            showNotification(`${action} ${i18n('filters_filter_label')}: ${filterText}`, 'info');
            filterResults();
        });
    });
}

function initSearchActions() {
    document.querySelectorAll('[data-perform-search]').forEach((el) => {
        if (el.dataset.searchActionBound === '1') return;
        el.dataset.searchActionBound = '1';
        el.addEventListener('click', (event) => {
            event.preventDefault();
            performSearch();
        });
    });
}

// ===== POPULÄRA SÖKNINGAR =====
function initPopularSearches() {
    document.querySelectorAll('[data-popular-search]').forEach((item) => {
        if (item.dataset.popularSearchBound === '1') return;
        item.dataset.popularSearchBound = '1';
        item.addEventListener('click', (event) => {
            event.preventDefault();
            popularSearch(item.getAttribute('data-popular-search') || '');
        });
    });
}

// ===== FILTRERA RESULTAT =====
function filterResults() {
    // Hämta alla aktiva filter
    const searchInput = document.getElementById('searchInput');
    const propertyType = document.getElementById('propertyType');
    const roomCount = document.getElementById('roomCount');
    const livingArea = document.getElementById('livingArea');
    const priceBtn = document.getElementById('priceBtn');
    
    const filters = {
        search: searchInput?.value || '',
        type: propertyType?.value !== defaultPropertyTypeLabel() ? propertyType?.value : null,
        rooms: roomCount?.value !== defaultRoomCountLabel() ? roomCount?.value : null,
        area: livingArea?.value !== defaultLivingAreaLabel() ? livingArea?.value : null,
        price: priceBtn?.querySelector('span')?.textContent || i18n('choose_price'),
        chips: Array.from(document.querySelectorAll('.filter-chip.active')).map(c => c.textContent.trim())
    };
    
    console.log('Aktiva filter:', filters);
    
    // Skapa URL med filterparametrar
    const params = new URLSearchParams();
    if (filters.search) params.append('q', filters.search);
    if (filters.type) params.append('type', filters.type);
    if (filters.rooms) params.append('rooms', filters.rooms);
    if (filters.area) params.append('area', filters.area);
    if (filters.price && filters.price !== i18n('choose_price')) params.append('price', filters.price);
    
    // Här kan du uppdatera URL eller göra AJAX-anrop
    // För demo visar vi bara filtren
}

// ===== SÖKNING =====
function performSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput?.value;
    
    if (searchTerm && searchTerm.trim() !== '') {
        showNotification(`${i18n('filters_searching_for')}: ${searchTerm}`, 'info');
        window.location.href = `properties.html?q=${encodeURIComponent(searchTerm)}`;
    } else {
        showNotification(i18n('filters_enter_search_term'), 'error');
    }
}

// ===== POPULÄR SÖKNING =====
function popularSearch(term) {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = term;
        performSearch();
    }
}

// ===== ÅTERSTÄLL FILTER =====
function resetFilters() {
    // Återställ alla select
    document.querySelectorAll('select').forEach(select => {
        select.selectedIndex = 0;
    });
    
    // Återställ sökfält
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    
    // Återställ pris
    const priceBtn = document.getElementById('priceBtn');
    if (priceBtn) {
        setPriceButtonLabel(i18n('choose_price'));
    }
    
    // Ta bort aktiva chips
    document.querySelectorAll('.filter-chip.active').forEach(chip => {
        chip.classList.remove('active');
    });
    
    showNotification(i18n('filters_reset_all_success'), 'success');
    filterResults();
}
