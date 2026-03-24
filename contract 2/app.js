const STORAGE_KEY = "syrian-contract-system-v2";
const BACKUP_KEY = "syrian-contract-backup-v2";
const SIGNATURE_NAMES = ["seller", "buyer", "witness1", "witness2"];

const REQUIRED_FIELDS = [
  "contractNumber", "placeDate", "contractDate",
  "sellerName", "sellerBirth", "sellerID",
  "buyerName", "buyerBirth", "buyerID",
  "propertyNumber", "propertyZone", "propertyType", "propertyArea",
  "priceTotal", "deposit", "deliveryDeadline",
  "witness1", "witness2"
];

const ARABIC_LABELS = {
  contractNumber: "رقم العقد",
  placeDate: "مكان التحرير",
  contractDate: "التاريخ",
  sellerName: "اسم البائع",
  sellerBirth: "سنة ميلاد البائع",
  sellerID: "رقم هوية البائع",
  buyerName: "اسم المشتري",
  buyerBirth: "سنة ميلاد المشتري",
  buyerID: "رقم هوية المشتري",
  propertyNumber: "رقم العقار",
  propertyZone: "المنطقة العقارية",
  propertyType: "نوع العقار",
  propertyArea: "مساحة العقار",
  priceTotal: "الثمن الإجمالي",
  deposit: "العربون",
  deliveryDeadline: "مدة التسليم",
  witness1: "الشاهد الأول",
  witness2: "الشاهد الثاني"
};

const DEFAULT_DATA = {
  contractNumber: "RG-2025-001",
  fileNumber: "12/ع.ب/2025",
  placeDate: "دمشق",
  contractDate: "2025-04-07",
  sellerName: "محمد أحمد حسن",
  sellerFather: "أحمد",
  sellerMother: "فاطمة خالد",
  sellerBirth: "1975",
  sellerID: "123456789",
  sellerIDPlace: "دمشق",
  sellerIDDate: "1995-05-15",
  sellerPhone: "+963 11 123 4567",
  sellerEmail: "seller@example.com",
  buyerName: "سامر خالد محمود",
  buyerFather: "خالد",
  buyerMother: "ناديا يوسف",
  buyerBirth: "1985",
  buyerID: "987654321",
  buyerIDPlace: "حلب",
  buyerIDDate: "2005-08-22",
  buyerPhone: "+963 21 987 6543",
  buyerEmail: "buyer@example.com",
  propertyNumber: "127",
  propertyZone: "المزة",
  propertyType: "شقة سكنية",
  propertyArea: "150",
  propertyFloor: "الثالث",
  propertyRooms: "4",
  propertyRegistry: "أ/127/مزة",
  propertyView: "شارع رئيسي",
  propertyDesc: "شقة سكنية في الطابق الثالث، تشطيب سوبر لوكس، مطبخ أمريكي",
  propertyBoundaries: "الشرق: شارع عام عرضه 12م، الغرب: بناء آل الأحمد، الشمال: حديقة مشتركة، الجنوب: بناء رقم 15",
  propertyMortgages: "خالٍ من أي رهن أو تكليف أو نزاع",
  priceTotal: "75000000",
  currency: "ل.س",
  deposit: "15000000",
  paymentMethod: "نقداً",
  deliveryDeadline: "60 يوماً",
  delayPenalty: "100000",
  breachPenalty: "10000000",
  depositWords: "",
  remainingWords: "",
  witness1: "عمر عبد الله سالم",
  witness1ID: "112233",
  witness2: "ليلى محمد حسين",
  witness2ID: "445566",
  special1: "يتم تسليم العقار خالياً من المستأجرين",
  special2: "البائع ملزم بدفع جميع فواتير الكهرباء والمياه حتى تاريخ الفراغ",
  specialConditions: "يُقرّ الفريق الأول بأن العقار خالٍ من أي دعاوى قضائية أو نزاعات ملكية.",
  attachments: "صورة هوية البائع - صورة هوية المشتري - بيان قيد عقاري - رخصة البناء"
};

const TEMPLATES = {
  apartment: {
    propertyType: "شقة سكنية", propertyArea: "120", propertyFloor: "الثاني",
    propertyRooms: "3", propertyView: "شارع داخلي",
    propertyDesc: "شقة سكنية، تشطيب حديث، مطبخ منفصل",
    propertyMortgages: "خالٍ من أي رهن",
    deliveryDeadline: "60 يوماً", delayPenalty: "50000", breachPenalty: "5000000",
    specialConditions: "يتم تسليم الشقة خالية من المستأجرين وبكامل ملحقاتها."
  },
  villa: {
    propertyType: "فيلا", propertyArea: "400", propertyFloor: "أرضي وأول",
    propertyRooms: "6", propertyView: "شارع رئيسي",
    propertyDesc: "فيلا مستقلة على طابقين مع حديقة ومسبح",
    propertyMortgages: "خالٍ من أي رهن أو تكليف",
    deliveryDeadline: "90 يوماً", delayPenalty: "200000", breachPenalty: "25000000",
    specialConditions: "تشمل الصفقة المفروشات الثابتة والمطبخ والأجهزة الكهربائية."
  },
  land: {
    propertyType: "أرض", propertyArea: "500", propertyFloor: "",
    propertyRooms: "0", propertyView: "شارع رئيسي",
    propertyDesc: "قطعة أرض مستوية صالحة للبناء، مسوّرة",
    propertyMortgages: "خالٍ من أي رهن",
    deliveryDeadline: "30 يوماً", delayPenalty: "100000", breachPenalty: "10000000",
    specialConditions: "تسلم الأرض بعد استكمال إجراءات نقل الملكية في السجل العقاري."
  },
  commercial: {
    propertyType: "محل تجاري", propertyArea: "80", propertyFloor: "أرضي",
    propertyRooms: "2", propertyView: "شارع تجاري رئيسي",
    propertyDesc: "محل تجاري في موقع حيوي، واجهة زجاجية",
    propertyMortgages: "خالٍ من أي رهن",
    deliveryDeadline: "45 يوماً", delayPenalty: "75000", breachPenalty: "8000000",
    specialConditions: "يُسلَّم المحل خالياً من البضائع والمستأجرين ومن كافة العوائق."
  },
  farm: {
    propertyType: "مزرعة", propertyArea: "5000", propertyFloor: "",
    propertyRooms: "1", propertyView: "طريق ترابي",
    propertyDesc: "مزرعة بمساحة 5000م² تضم أشجاراً مثمرة وبيتاً للحراسة",
    propertyMortgages: "خالٍ من أي رهن",
    deliveryDeadline: "30 يوماً", delayPenalty: "50000", breachPenalty: "5000000",
    specialConditions: "تشمل الصفقة الأشجار والمحاصيل القائمة وحق الوصول للمياه."
  }
};

const fmt = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? new Intl.NumberFormat("en-US").format(Number(digits)) : "";
};

const num = (value) => String(value || "").replace(/\D/g, "");

const esc = (value) => String(value || "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

function numToArabicWords(n) {
  if (!n || Number.isNaN(n)) return "";
  n = Math.floor(+n);
  if (n === 0) return "صفر";

  const ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة", "عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
  const tens = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
  const hundreds = ["", "مئة", "مئتان", "ثلاثمئة", "أربعمئة", "خمسمئة", "ستمئة", "سبعمئة", "ثمانمئة", "تسعمئة"];

  function below1000(number) {
    let out = "";
    const h = Math.floor(number / 100);
    const rem = number % 100;
    if (h) out += hundreds[h];
    if (rem) {
      if (out) out += " و";
      if (rem < 20) out += ones[rem];
      else {
        const t = Math.floor(rem / 10);
        const o = rem % 10;
        if (o) out += `${ones[o]} و`;
        out += tens[t];
      }
    }
    return out;
  }

  const segments = [
    { v: 1e9, s: "مليار", d: "ملياران", p: "مليارات" },
    { v: 1e6, s: "مليون", d: "مليونان", p: "ملايين" },
    { v: 1e3, s: "ألف", d: "ألفان", p: "آلاف" }
  ];

  let rem = n;
  const parts = [];
  for (const segment of segments) {
    const q = Math.floor(rem / segment.v);
    if (!q) continue;
    if (q === 1) parts.push(segment.s);
    else if (q === 2) parts.push(segment.d);
    else if (q < 11) parts.push(`${below1000(q)} ${segment.p}`);
    else parts.push(`${below1000(q)} ${segment.s}`);
    rem -= q * segment.v;
  }
  if (rem) parts.push(below1000(rem));
  return parts.join(" و");
}

const App = {
  state: {},
  _saveTimer: null,
  _backupTimer: null,
  _debounceTimer: null,
  _sigPads: {},
  _livePreviewOn: false,
  _rates: { SYP: 1, USD: 1 / 13000, EUR: 1 / 14200, TRY: 1 / 390 },

  init() {
    this.state = this.loadData();
    this.bindUI();
    this.populateForm();
    this.recalc();
    this.updateCNPreview();
    this.renderPreview();
    this.updateProgress();
    this.initSigPads();
    this._saveTimer = setInterval(() => this.autoSave(), 1000);
    this._backupTimer = setInterval(() => this.backup(), 30000);
    window.addEventListener("beforeunload", () => this.autoSave());
  },

  loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...DEFAULT_DATA, ...JSON.parse(raw) } : { ...DEFAULT_DATA };
    } catch {
      return { ...DEFAULT_DATA };
    }
  },

  autoSave() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      const time = new Date().toLocaleTimeString("ar-SY");
      const status = document.getElementById("autosave-status");
      if (status) {
        status.textContent = "محفوظ";
        status.className = "badge badge-ok";
      }
      const lastSave = document.getElementById("last-save-time");
      if (lastSave) lastSave.textContent = time;
    } catch { }
  },

  backup() {
    try {
      localStorage.setItem(BACKUP_KEY, JSON.stringify(this.state));
    } catch { }
  },

  bindUI() {
    document.querySelectorAll("[data-field]").forEach((element) => {
      element.addEventListener("input", () => {
        clearTimeout(this._debounceTimer);
        this._debounceTimer = setTimeout(() => {
          this.state[element.dataset.field] = element.value;
          this.recalc();
          this.validateField(element.dataset.field);
          this.renderPreview();
          this.updateProgress();
          this.renderLivePreview();
        }, 60);
      });
    });

    document.querySelectorAll("[data-tab-link]").forEach((button) => {
      button.addEventListener("click", () => this.switchTab(button.dataset.tabLink, button));
    });

    document.querySelectorAll("[data-scroll-target]").forEach((button) => {
      button.addEventListener("click", () => this.scrollTo(button.dataset.scrollTarget));
    });

    document.querySelectorAll("[data-template]").forEach((button) => {
      button.addEventListener("click", () => this.applyTemplate(button.dataset.template));
    });

    document.querySelectorAll("[data-clear-signature]").forEach((button) => {
      button.addEventListener("click", () => this.clearSig(button.dataset.clearSignature));
    });

    document.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => this.handleAction(button.dataset.action));
    });

    document.getElementById("import-input").addEventListener("change", (event) => this.handleImport(event.target));
    document.getElementById("cur-syp-input").addEventListener("input", (event) => this.convertCurrency(event.target.value));
    ["cn-prefix", "cn-year", "cn-seq"].forEach((id) => {
      document.getElementById(id).addEventListener("input", () => this.updateCNPreview());
    });
  },

  handleAction(action) {
    if (action === "toggle-live") this.toggleLivePreview();
    if (action === "print") this.print();
    if (action === "export-json") this.exportJSON();
    if (action === "import-json") this.importJSON();
    if (action === "share-email") this.shareEmail();
    if (action === "validate") this.validate();
    if (action === "reset") this.resetToDefault();
    if (action === "apply-contract-number") this.applyCN();
  },

  populateForm() {
    document.querySelectorAll("[data-field]").forEach((element) => {
      const value = this.state[element.dataset.field];
      if (value !== undefined) element.value = value;
    });
  },

  recalc() {
    const total = Number(num(this.state.priceTotal)) || 0;
    const deposit = Number(num(this.state.deposit)) || 0;
    const area = Number(num(this.state.propertyArea)) || 0;
    const remaining = Math.max(total - deposit, 0);
    const pricePerMeter = area > 0 ? Math.round(total / area) : 0;
    const currency = this.state.currency || "ل.س";

    document.getElementById("f-remaining").value = remaining ? `${fmt(remaining)} ${currency}` : "";
    document.getElementById("f-pricePerMeter").value = pricePerMeter ? `${fmt(pricePerMeter)} ${currency}` : "";

    if (!this.state.depositWords && deposit) {
      this.state.depositWords = `${numToArabicWords(deposit)} ${currency}`;
      document.getElementById("f-depositWords").value = this.state.depositWords;
    }
    if (!this.state.remainingWords && remaining) {
      this.state.remainingWords = `${numToArabicWords(remaining)} ${currency}`;
      document.getElementById("f-remainingWords").value = this.state.remainingWords;
    }

    this.state._remaining = remaining;
    this.state._pricePerMeter = pricePerMeter;
  },

  updateProgress() {
    const filled = REQUIRED_FIELDS.filter((field) => {
      const element = document.getElementById(`f-${field}`);
      return element && element.value.trim() !== "";
    }).length;
    const pct = Math.round((filled / REQUIRED_FIELDS.length) * 100);
    document.getElementById("progress-fill").style.width = `${pct}%`;
    document.getElementById("progress-pct").textContent = `${pct}%`;
  },

  setError(field, message) {
    document.getElementById(`f-${field}`)?.classList.add("err");
    const err = document.getElementById(`e-${field}`);
    if (err) {
      err.textContent = message;
      err.classList.add("show");
    }
  },

  clearErrors() {
    document.querySelectorAll(".field input, .field select, .field textarea").forEach((element) => element.classList.remove("err"));
    document.querySelectorAll(".field-error").forEach((element) => {
      element.textContent = "";
      element.classList.remove("show");
    });
  },

  validateField(field) {
    const element = document.getElementById(`f-${field}`);
    if (!element) return true;
    const value = element.value.trim();
    element.classList.remove("err");
    const err = document.getElementById(`e-${field}`);
    if (err) {
      err.textContent = "";
      err.classList.remove("show");
    }

    if (REQUIRED_FIELDS.includes(field) && !value) {
      this.setError(field, "هذا الحقل إلزامي");
      return false;
    }
    if ((field === "sellerBirth" || field === "buyerBirth") && value && !/^\d{4}$/.test(value)) {
      this.setError(field, "يجب أن تكون سنة الميلاد 4 أرقام");
      return false;
    }
    if ((field === "sellerEmail" || field === "buyerEmail") && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      this.setError(field, "صيغة البريد الإلكتروني غير صحيحة");
      return false;
    }
    if ((field === "sellerPhone" || field === "buyerPhone") && value && !/^[+\d\s()-]{7,}$/.test(value)) {
      this.setError(field, "صيغة رقم الهاتف غير صحيحة");
      return false;
    }
    if (["priceTotal", "deposit", "delayPenalty", "breachPenalty", "sellerID", "buyerID", "witness1ID", "witness2ID"].includes(field) && value && !/^[\d,\s]+$/.test(value)) {
      this.setError(field, "يجب إدخال أرقام فقط");
      return false;
    }
    if (field === "contractDate" && value && Number.isNaN(new Date(value).getTime())) {
      this.setError(field, "التاريخ غير صالح");
      return false;
    }
    return true;
  },

  validate() {
    this.clearErrors();
    const errors = [];
    const pushError = (field) => errors.push({ field, msg: document.getElementById(`e-${field}`)?.textContent || "قيمة غير صالحة" });

    REQUIRED_FIELDS.forEach((field) => {
      if (!this.validateField(field)) pushError(field);
    });

    ["sellerEmail", "buyerEmail", "sellerPhone", "buyerPhone", "sellerIDDate", "buyerIDDate"].forEach((field) => {
      const element = document.getElementById(`f-${field}`);
      if (element?.value && !this.validateField(field)) pushError(field);
    });

    const total = Number(num(this.state.priceTotal)) || 0;
    const deposit = Number(num(this.state.deposit)) || 0;
    if (deposit && total && deposit > total) {
      this.setError("deposit", "يجب ألا يتجاوز العربون الثمن الإجمالي");
      pushError("deposit");
    }

    const sellerDate = this.state.sellerIDDate ? new Date(this.state.sellerIDDate) : null;
    const buyerDate = this.state.buyerIDDate ? new Date(this.state.buyerIDDate) : null;
    const contractDate = this.state.contractDate ? new Date(this.state.contractDate) : null;
    if (sellerDate && contractDate && sellerDate > contractDate) {
      this.setError("sellerIDDate", "تاريخ إصدار هوية البائع يجب أن يسبق تاريخ العقد");
      pushError("sellerIDDate");
    }
    if (buyerDate && contractDate && buyerDate > contractDate) {
      this.setError("buyerIDDate", "تاريخ إصدار هوية المشتري يجب أن يسبق تاريخ العقد");
      pushError("buyerIDDate");
    }

    const panel = document.getElementById("val-panel");
    const list = document.getElementById("val-list");
    if (errors.length) {
      list.innerHTML = errors.map((entry) => `<li class="val-item" data-focus-field="${entry.field}">${ARABIC_LABELS[entry.field] || entry.field}: ${entry.msg}</li>`).join("");
      panel.classList.add("show");
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
      list.querySelectorAll("[data-focus-field]").forEach((item) => item.addEventListener("click", () => this.focusField(item.dataset.focusField)));
      this.toast(`يوجد ${errors.length} خطأ في البيانات`, "err");
      return false;
    }

    panel.classList.remove("show");
    list.innerHTML = "";
    this.toast("جميع البيانات صحيحة", "ok");
    return true;
  },

  focusField(field) {
    const element = document.getElementById(`f-${field}`);
    if (!element) return;
    this.switchTab("form", document.getElementById("tab-form-btn"));
    setTimeout(() => {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.focus();
    }, 80);
  },

  switchTab(name, sourceButton) {
    document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.remove("active"));
    document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
    document.querySelectorAll(".sidebar-link").forEach((link) => {
      if (link.dataset.tabLink) link.classList.toggle("active", link.dataset.tabLink === name);
    });
    document.getElementById(`tab-${name}`)?.classList.add("active");
    if (sourceButton?.classList.contains("tab")) sourceButton.classList.add("active");
    else document.getElementById(`tab-${name}-btn`)?.classList.add("active");
    if (name === "preview") this.renderPreview();
    if (name === "tools") {
      const base = num(this.state.priceTotal);
      if (base) {
        document.getElementById("cur-syp-input").value = base;
        this.convertCurrency(base);
      }
    }
  },

  scrollTo(id) {
    this.switchTab("form", document.getElementById("tab-form-btn"));
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 50);
  },

  applyTemplate(name) {
    const template = TEMPLATES[name];
    if (!template) return;
    Object.entries(template).forEach(([key, value]) => {
      this.state[key] = value;
      const field = document.getElementById(`f-${key}`);
      if (field) field.value = value;
    });
    this.recalc();
    this.renderPreview();
    this.updateProgress();
    this.toast(`تم تطبيق قالب: ${({ apartment: "شقة", villa: "فيلا", land: "أرض", commercial: "محل تجاري", farm: "مزرعة" })[name]}`);
  },

  resetToDefault() {
    if (!window.confirm("هل تريد مسح جميع البيانات وإعادة التعبئة بالبيانات التجريبية؟")) return;
    this.state = { ...DEFAULT_DATA };
    SIGNATURE_NAMES.forEach((name) => delete this.state[`sig_${name}`]);
    this.populateForm();
    this.recalc();
    this.clearSignatureCanvases();
    this.renderPreview();
    this.updateProgress();
    document.getElementById("val-panel").classList.remove("show");
    this.toast("تم استعادة البيانات التجريبية");
  },

  exportJSON() {
    const blob = new Blob([JSON.stringify(this.state, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `عقد-بيع-${this.state.contractNumber || "جديد"}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    this.toast("تم تصدير الملف");
  },

  importJSON() {
    document.getElementById("import-input").click();
  },

  handleImport(input) {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        this.state = { ...DEFAULT_DATA, ...JSON.parse(event.target.result) };
        this.populateForm();
        this.recalc();
        this.renderPreview();
        this.updateProgress();
        this.initSigPads(true);
        this.toast("تم استيراد الملف بنجاح");
      } catch {
        this.toast("خطأ في قراءة الملف", "err");
      } finally {
        input.value = "";
      }
    };
    reader.readAsText(file);
  },

  shareEmail() {
    const subject = encodeURIComponent(`عقد بيع قطعي رقم ${this.state.contractNumber}`);
    const body = encodeURIComponent(
      `عقد بيع قطعي\nرقم العقد: ${this.state.contractNumber}\nالتاريخ: ${this.state.contractDate}\n\n` +
      `البائع: ${this.state.sellerName}\nالمشتري: ${this.state.buyerName}\n\n` +
      `العقار: ${this.state.propertyType} - ${this.state.propertyZone}\nالمساحة: ${this.state.propertyArea} م²\n` +
      `الثمن: ${fmt(this.state.priceTotal)} ${this.state.currency}`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`);
  },

  toggleLivePreview() {
    this._livePreviewOn = !this._livePreviewOn;
    document.getElementById("live-preview-panel").hidden = !this._livePreviewOn;
    document.getElementById("live-toggle-btn").classList.toggle("on", this._livePreviewOn);
    document.getElementById("main-area").style.paddingRight = this._livePreviewOn ? "296px" : "";
    if (this._livePreviewOn) this.renderLivePreview();
  },

  renderLivePreview() {
    if (!this._livePreviewOn) return;
    const target = document.getElementById("live-doc-wrap");
    const page = document.querySelector("#doc-wrap .doc-page");
    if (!target || !page) return;
    target.innerHTML = "";
    target.appendChild(page.cloneNode(true));
  },

  initSigPads(force = false) {
    SIGNATURE_NAMES.forEach((name) => {
      const canvas = document.getElementById(`sig-${name}`);
      if (!canvas || (this._sigPads[name] && !force)) return;
      const ctx = canvas.getContext("2d");
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.strokeStyle = "#1c1712";
      ctx.lineWidth = 1.8;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      let drawing = false;
      let lastX = 0;
      let lastY = 0;

      const getPos = (event) => {
        const currentRect = canvas.getBoundingClientRect();
        const point = event.touches ? event.touches[0] : event;
        return [point.clientX - currentRect.left, point.clientY - currentRect.top];
      };

      const start = (event) => {
        event.preventDefault();
        drawing = true;
        [lastX, lastY] = getPos(event);
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
      };

      const move = (event) => {
        if (!drawing) return;
        event.preventDefault();
        const [x, y] = getPos(event);
        ctx.lineTo(x, y);
        ctx.stroke();
        lastX = x;
        lastY = y;
      };

      const end = () => {
        if (!drawing) return;
        drawing = false;
        this.saveSig(name, canvas);
      };

      canvas.onmousedown = start;
      canvas.onmousemove = move;
      canvas.onmouseup = end;
      canvas.onmouseleave = end;
      canvas.ontouchstart = start;
      canvas.ontouchmove = move;
      canvas.ontouchend = end;

      this._sigPads[name] = { canvas, ctx };
      this.redrawSignature(name);
    });
  },

  redrawSignature(name) {
    const pad = this._sigPads[name];
    if (!pad) return;
    const { canvas, ctx } = pad;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const data = this.state[`sig_${name}`];
    if (!data) return;
    const image = new Image();
    image.onload = () => ctx.drawImage(image, 0, 0, canvas.getBoundingClientRect().width, canvas.getBoundingClientRect().height);
    image.src = data;
  },

  saveSig(name, canvas) {
    this.state[`sig_${name}`] = canvas.toDataURL();
    this.renderPreview();
  },

  clearSig(name) {
    const pad = this._sigPads[name];
    if (!pad) return;
    pad.ctx.clearRect(0, 0, pad.canvas.width, pad.canvas.height);
    this.state[`sig_${name}`] = "";
    this.renderPreview();
  },

  clearSignatureCanvases() {
    SIGNATURE_NAMES.forEach((name) => this.clearSig(name));
  },

  updateCNPreview() {
    const prefix = document.getElementById("cn-prefix")?.value || "RG";
    const year = document.getElementById("cn-year")?.value || new Date().getFullYear();
    const seq = String(document.getElementById("cn-seq")?.value || 1).padStart(3, "0");
    document.getElementById("cn-preview").textContent = `${prefix}-${year}-${seq}`;
  },

  applyCN() {
    const value = document.getElementById("cn-preview").textContent;
    this.state.contractNumber = value;
    document.getElementById("f-contractNumber").value = value;
    this.renderPreview();
    this.toast(`تم تطبيق رقم العقد: ${value}`);
  },

  convertCurrency(value) {
    const syp = parseFloat(String(value).replace(/,/g, "")) || 0;
    const pretty = (n) => (n >= 1000 ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n) : n.toFixed(2));
    document.getElementById("cur-syp").textContent = syp ? new Intl.NumberFormat("en-US").format(syp) : "—";
    document.getElementById("cur-usd").textContent = syp ? pretty(syp * this._rates.USD) : "—";
    document.getElementById("cur-eur").textContent = syp ? pretty(syp * this._rates.EUR) : "—";
    document.getElementById("cur-try").textContent = syp ? pretty(syp * this._rates.TRY) : "—";
  },

  generateQR(text) {
    const canvas = document.createElement("canvas");
    canvas.width = 120;
    canvas.height = 120;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, 120, 120);
    ctx.fillStyle = "#1c1712";
    const seed = text.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const size = 6;
    let rng = seed;
    [[0, 0], [0, 13], [13, 0]].forEach(([row, col]) => {
      ctx.fillRect(col * size, row * size, 7 * size, 7 * size);
      ctx.fillStyle = "#fff";
      ctx.fillRect((col + 1) * size, (row + 1) * size, 5 * size, 5 * size);
      ctx.fillStyle = "#1c1712";
      ctx.fillRect((col + 2) * size, (row + 2) * size, 3 * size, 3 * size);
    });
    for (let row = 0; row < 20; row += 1) {
      for (let col = 0; col < 20; col += 1) {
        rng = (rng * 1664525 + 1013904223) & 0xffffffff;
        const skip = (row < 8 && col < 8) || (row < 8 && col > 11) || (row > 11 && col < 8);
        if (!skip && ((rng >>> 16) & 1)) ctx.fillRect(col * size, row * size, size, size);
      }
    }
    return canvas.toDataURL();
  },

  signatureMarkup(name) {
    const data = this.state[`sig_${name}`];
    if (!data) return '<span style="color:#c4baa8;font-size:10px;">لم يُوقَّع بعد</span>';
    return `<img src="${data}" alt="signature">`;
  },

  renderPreview() {
    const d = this.state;
    const total = Number(num(d.priceTotal)) || 0;
    const deposit = Number(num(d.deposit)) || 0;
    const area = Number(num(d.propertyArea)) || 0;
    const remaining = Math.max(total - deposit, 0);
    const ppm = area > 0 ? Math.round(total / area) : 0;
    const currency = d.currency || "ل.س";
    const depositWords = d.depositWords || (deposit ? `${numToArabicWords(deposit)} ${currency}` : "—");
    const remainingWords = d.remainingWords || (remaining ? `${numToArabicWords(remaining)} ${currency}` : "—");
    const display = (value, fallback = "—") => esc(value || fallback);
    const qrDataUrl = this.generateQR([d.contractNumber, d.contractDate, d.sellerName, d.buyerName, `${fmt(total)} ${currency}`].join(" | "));

    document.getElementById("doc-wrap").innerHTML = `
      <div class="doc-page page-one">
        <div class="doc-frame"></div>
        <div class="doc-inner">
          <div class="doc-header">
            <div class="dh-right">
              <div class="dh-emblem"><img src="./Emblem.png" alt="شعار" onerror="this.style.display='none'"></div>
              <div class="dh-state">الجُمهُورِيَّةُ العَرَبِيَّةُ السُّورِيَّةُ</div>
            </div>
            <div class="dh-rule"></div>
            <div class="dh-left">
              <div class="dh-meta">رقم العقد: <strong>${display(d.contractNumber)}</strong></div>
              <div class="dh-meta">مكان التحرير: <strong>${display(d.placeDate)}</strong></div>
              <div class="dh-meta">التاريخ: <strong>${display(d.contractDate)}</strong></div>
            </div>
          </div>

          <div class="doc-title-block">
            <div class="doc-ornament"><div class="doc-orn-line single"></div></div>
            <div class="doc-main-title">عقد بيع قطعي</div>
            <div class="doc-sub-title">خاص ببيع وانتقال ملكية عقار بصورة نهائية وملزمة</div>
          </div>

          <div class="doc-section">
            <div class="doc-sec-label">بيانات الأطراف المتعاقدة</div>
            <div class="doc-grid">
              <div class="doc-panel">
                <div class="doc-party-name">الفريق الأول — البائع</div>
                <div class="doc-row"><span class="doc-lbl">الاسم</span><span class="doc-val">${display(d.sellerName)}</span></div>
                <div class="doc-row"><span class="doc-lbl">ابن</span><span class="doc-val">${display(d.sellerFather)}</span></div>
                <div class="doc-row"><span class="doc-lbl">والدته</span><span class="doc-val">${display(d.sellerMother)}</span></div>
                <div class="doc-row"><span class="doc-lbl">تولد</span><span class="doc-val">${display(d.sellerBirth)}</span></div>
                <div class="doc-row"><span class="doc-lbl">هوية</span><span class="doc-val">${display(d.sellerID)}</span></div>
                <div class="doc-row"><span class="doc-lbl">صادرة عن</span><span class="doc-val">${display(d.sellerIDPlace)}</span></div>
                <div class="doc-row"><span class="doc-lbl">بتاريخ</span><span class="doc-val">${display(d.sellerIDDate)}</span></div>
                ${d.sellerPhone ? `<div class="doc-row"><span class="doc-lbl">الهاتف</span><span class="doc-val">${display(d.sellerPhone)}</span></div>` : ""}
              </div>
              <div class="doc-panel">
                <div class="doc-party-name buyer">الفريق الثاني — المشتري</div>
                <div class="doc-row"><span class="doc-lbl">الاسم</span><span class="doc-val">${display(d.buyerName)}</span></div>
                <div class="doc-row"><span class="doc-lbl">ابن</span><span class="doc-val">${display(d.buyerFather)}</span></div>
                <div class="doc-row"><span class="doc-lbl">والدته</span><span class="doc-val">${display(d.buyerMother)}</span></div>
                <div class="doc-row"><span class="doc-lbl">تولد</span><span class="doc-val">${display(d.buyerBirth)}</span></div>
                <div class="doc-row"><span class="doc-lbl">هوية</span><span class="doc-val">${display(d.buyerID)}</span></div>
                <div class="doc-row"><span class="doc-lbl">صادرة عن</span><span class="doc-val">${display(d.buyerIDPlace)}</span></div>
                <div class="doc-row"><span class="doc-lbl">بتاريخ</span><span class="doc-val">${display(d.buyerIDDate)}</span></div>
                ${d.buyerPhone ? `<div class="doc-row"><span class="doc-lbl">الهاتف</span><span class="doc-val">${display(d.buyerPhone)}</span></div>` : ""}
              </div>
            </div>
          </div>

          <div class="doc-section">
            <div class="doc-sec-label">بيانات العقار المبيع</div>
            <div class="doc-prop-grid">
              <div class="doc-pc"><div class="doc-row"><span class="doc-lbl">رقم العقار</span><span class="doc-val">${display(d.propertyNumber)}</span></div></div>
              <div class="doc-pc"><div class="doc-row"><span class="doc-lbl">المنطقة</span><span class="doc-val">${display(d.propertyZone)}</span></div></div>
              <div class="doc-pc"><div class="doc-row"><span class="doc-lbl">نوع العقار</span><span class="doc-val">${display(d.propertyType)}</span></div></div>
              <div class="doc-pc"><div class="doc-row"><span class="doc-lbl">المساحة م²</span><span class="doc-val">${display(d.propertyArea)}</span></div></div>
              <div class="doc-pc"><div class="doc-row"><span class="doc-lbl">الطابق</span><span class="doc-val">${display(d.propertyFloor)}</span></div></div>
              <div class="doc-pc no-bot"><div class="doc-row"><span class="doc-lbl">عدد الغرف</span><span class="doc-val">${display(d.propertyRooms)}</span></div></div>
              <div class="doc-pc full"><div class="doc-row"><span class="doc-lbl">الوصف</span><span class="doc-val">${display(d.propertyDesc)}</span></div></div>
              <div class="doc-pc full no-bot"><div class="doc-row"><span class="doc-lbl">الحدود</span><span class="doc-val">${display(d.propertyBoundaries)}</span></div></div>
            </div>
          </div>

          <div class="doc-price-strip">
            <div class="dps-cell"><span class="dps-label">ثمن البيع الإجمالي</span><span class="dps-val">${total ? `${fmt(total)} ${currency}` : "—"}</span></div>
            <div class="dps-cell"><span class="dps-label">العربون المدفوع</span><span class="dps-val">${deposit ? `${fmt(deposit)} ${currency}` : "—"}</span></div>
            <div class="dps-cell"><span class="dps-label">الرصيد المتبقي</span><span class="dps-val">${remaining ? `${fmt(remaining)} ${currency}` : "—"}</span></div>
          </div>

          <div class="doc-section">
            <div class="doc-sec-label">الشروط المالية والتنفيذية</div>
            <div class="doc-prop-grid financial-grid">
              <div class="doc-pc no-bot"><div class="doc-row"><span class="doc-lbl">سعر المتر</span><span class="doc-val">${ppm ? `${fmt(ppm)} ${currency}` : "—"}</span></div></div>
              <div class="doc-pc no-bot"><div class="doc-row"><span class="doc-lbl">طريقة الدفع</span><span class="doc-val">${display(d.paymentMethod)}</span></div></div>
              <div class="doc-pc no-bot"><div class="doc-row"><span class="doc-lbl">مدة التسليم</span><span class="doc-val">${display(d.deliveryDeadline)}</span></div></div>
            </div>
          </div>

          <div class="doc-section compact-sigs" style="margin-bottom:0;">
            <div class="doc-sec-label">التواقيع والشهود</div>
            <div class="doc-sig-grid compact">
              <div class="doc-sb">
                <div class="doc-st">البائع — الفريق الأول</div>
                <div class="doc-row"><span class="doc-lbl">الاسم</span><span class="doc-val">${display(d.sellerName)}</span></div>
                <div class="doc-sig-line">${this.signatureMarkup("seller")}</div>
                <div class="doc-sig-cap">يوقع أمام الشهود</div>
              </div>
              <div class="doc-sb">
                <div class="doc-st">المشتري — الفريق الثاني</div>
                <div class="doc-row"><span class="doc-lbl">الاسم</span><span class="doc-val">${display(d.buyerName)}</span></div>
                <div class="doc-sig-line">${this.signatureMarkup("buyer")}</div>
                <div class="doc-sig-cap">يوقع بعد التحقق</div>
              </div>
              <div class="doc-sb">
                <div class="doc-st">الشاهد الأول</div>
                <div class="doc-row"><span class="doc-lbl">الاسم</span><span class="doc-val">${display(d.witness1)}</span></div>
                <div class="doc-sig-line">${this.signatureMarkup("witness1")}</div>
                <div class="doc-sig-cap">يشهد بصحة التوقيع</div>
              </div>
              <div class="doc-sb">
                <div class="doc-st">الشاهد الثاني</div>
                <div class="doc-row"><span class="doc-lbl">الاسم</span><span class="doc-val">${display(d.witness2)}</span></div>
                <div class="doc-sig-line">${this.signatureMarkup("witness2")}</div>
                <div class="doc-sig-cap">يشهد بصحة التوقيع</div>
              </div>
            </div>
          </div>

          <div class="doc-bottom" style="border-top: 1px solid var(--rule); margin-top: 10px;">
            <div class="doc-stamp-area">
              <div style="text-align:center;">
                <div class="doc-stamp-circle">محل<br>الختم<br>الرسمي</div>
                <div style="margin-top:8px;">
                  <img src="${qrDataUrl}" width="24" height="24" alt="QR" style="display:block;margin:0 auto;">
                  <div style="margin-top:3px;font-size:7.5px;color:var(--mid);text-align:center;">QR</div>
                </div>
              </div>
            </div>
            <div class="doc-footer-area">
              <div class="doc-footer-fields">
                <div class="doc-row"><span class="doc-lbl">تحريراً في</span><span class="doc-val">${display(d.placeDate)}</span></div>
                <div class="doc-row"><span class="doc-lbl">بتاريخ</span><span class="doc-val">${display(d.contractDate)}</span></div>
              </div>
              ${d.attachments ? `<div style="margin-top:6px;font-size:10px;color:var(--mid);"><strong>المرفقات:</strong> ${esc(d.attachments)}</div>` : ""}
              <div class="doc-footer-note">حُرِّر هذا العقد من صفحتين متكاملتين ويُعمل به بعد التوقيع والختم حيث يلزم</div>
            </div>
          </div>

          <div class="page-number">صفحة 1 من 2 · ${display(d.contractNumber)}</div>
        </div>
      </div>

      <div class="doc-page">
        <div class="doc-frame"></div>
        <div class="doc-inner">
          <div style="display:flex;align-items:center;justify-content:space-between;font-size:10px;color:var(--mid);margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid var(--rule);">
            <span>عقد بيع قطعي — الصفحة الثانية</span>
            <span>${display(d.contractDate)} · ${display(d.placeDate)}</span>
          </div>

          <div class="doc-section">
            <div class="doc-sec-label">البنود القانونية</div>
            <p class="doc-clause-intro">اتفق الفريقان وهما بكامل الأوصاف المطلوبة شرعاً وقانوناً على ما يلي:</p>
            <div class="doc-clause"><span class="doc-cn">١</span><div>يُصرّح الفريق الأول بأنه يمتلك العقار رقم <strong>${display(d.propertyNumber)}</strong> من المنطقة العقارية <strong>${display(d.propertyZone)}</strong>، وهو عبارة عن <strong>${display(d.propertyType)}</strong> — ${display(d.propertyDesc)}، والبالغة مساحته <strong>${display(d.propertyArea)} م²</strong>. وقد باع العقار المذكور بيعاً قطعياً لا نكول فيه إلى الفريق الثاني بمبلغ إجمالي قدره <strong>${total ? `${fmt(total)} ${currency}` : "—"}</strong> وبسعر المتر المربع <strong>${ppm ? `${fmt(ppm)} ${currency}` : "—"}</strong>.</div></div>
            <div class="doc-clause"><span class="doc-cn">٢</span><div>قبض الفريق الأول من الفريق الثاني عربوناً مقداره رقماً <strong>${deposit ? `${fmt(deposit)} ${currency}` : "—"}</strong> كتابةً: <strong>${esc(depositWords)}</strong>. والرصيد البالغ <strong>${remaining ? `${fmt(remaining)} ${currency}` : "—"}</strong> كتابةً: <strong>${esc(remainingWords)}</strong> يُدفع عند إتمام إجراءات نقل الملكية في السجل العقاري بطريقة <strong>${display(d.paymentMethod)}</strong>.</div></div>
            <div class="doc-clause"><span class="doc-cn">٣</span><div>يلتزم الفريق الأول بتسليم العقار خالياً من جميع الشواغل والمستأجرين وبكامل مرافقه خلال مدة أقصاها <strong>${display(d.deliveryDeadline)}</strong> اعتباراً من تاريخ هذا العقد. وفي حال تأخره يدفع غرامة تأخير يومية قدرها <strong>${d.delayPenalty ? `${fmt(d.delayPenalty)} ${currency}` : "—"}</strong> عن كل يوم تأخير دون الحاجة لإنذار أو إدعاء.</div></div>
            <div class="doc-clause"><span class="doc-cn">٤</span><div>يُصرّح الفريق الثاني بأنه قبل الشراء المذكور بشكل قطعي ونهائي وأسقط حقه من الرجوع أو النكول. وفي حال نكول أي من الفريقين يدفع الناكل للآخر كعطل وضرر مبلغ <strong>${d.breachPenalty ? `${fmt(d.breachPenalty)} ${currency}` : "—"}</strong> دون الحاجة لإنذار أو قرار قضائي.</div></div>
            <div class="doc-clause"><span class="doc-cn">٥</span><div>يُقرّ الفريق الأول بأن العقار المذكور خالٍ من جميع الرهون والتكاليف والدعاوى القضائية والنزاعات حتى تاريخ هذا العقد. ${d.propertyMortgages ? `ملاحظة: ${esc(d.propertyMortgages)}.` : ""} وأن جميع الرسوم والضرائب المترتبة على العقار حتى تاريخ الفراغ في السجل العقاري تقع على عاتق الفريق الأول.</div></div>
            <div class="doc-clause"><span class="doc-cn">٦</span><div>نُظِّم هذا العقد على ثلاث نسخ أصلية متطابقة وقّعها الفريقان بحضور الشهود الموقعين ذيلاً، واحتفظ كل فريق بنسخة والمكتب الوسيط بالنسخة الثالثة. ويُعمل به بعد التوقيع والختم وفق الأصول القانونية النافذة.</div></div>
          </div>

          ${(d.special1 || d.special2 || d.specialConditions) ? `
            <div class="doc-section">
              <div class="doc-sec-label">شروط خاصة</div>
              <div style="border:1px solid var(--rule);padding:12px;background:#fffdf8;font-size:12.5px;line-height:1.9;">
                ${d.special1 ? `<p>— ${esc(d.special1)}</p>` : ""}
                ${d.special2 ? `<p>— ${esc(d.special2)}</p>` : ""}
                ${d.specialConditions ? `<p style="margin-top:6px">${esc(d.specialConditions)}</p>` : ""}
              </div>
            </div>
          ` : ""}
        </div>
        <div class="page-number">صفحة 2 من 2 · ${display(d.contractNumber)}</div>
      </div>
    `;

    this.renderLivePreview();
  },

  print() {
    this.renderPreview();
    setTimeout(() => {
      window.print();
    }, 100);
  },

  toast(message, type = "") {
    const wrap = document.getElementById("toast-wrap");
    const element = document.createElement("div");
    element.className = "toast";
    element.style.borderRightColor = type === "err" ? "var(--danger)" : type === "ok" ? "#2e7d52" : "var(--gold)";
    element.textContent = message;
    wrap.appendChild(element);
    requestAnimationFrame(() => requestAnimationFrame(() => element.classList.add("show")));
    setTimeout(() => {
      element.classList.remove("show");
      setTimeout(() => element.remove(), 300);
    }, 2800);
  }
};

document.addEventListener("DOMContentLoaded", () => App.init());
