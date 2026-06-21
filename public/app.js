const ENGINE_API = 'http://localhost:8879/api';

const MUTUALLY_EXCLUSIVE_GROUPS = [
  ['member_discount', 'coupon_discount'],
  ['early_bird', 'last_minute'],
  ['group_discount', 'promo_code']
];

const DISCOUNT_GROUPS = { membership: '会员类', timing: '时段类', quantity: '数量类' };

const RULE_PRIORITY_DEFAULT = [
  'period_base_price', 'people_tier', 'package_price',
  'member_discount', 'timing_discount', 'quantity_discount'
];

const RULE_LABELS = {
  period_base_price: '时段基础价', people_tier: '人数阶梯', package_price: '套餐优惠',
  member_discount: '会员类折扣', timing_discount: '时段类折扣', quantity_discount: '数量类折扣'
};

const DISCOUNT_CATEGORY = {
  member_discount: 'member_discount', coupon_discount: 'member_discount',
  early_bird: 'timing_discount', last_minute: 'timing_discount',
  group_discount: 'quantity_discount', promo_code: 'quantity_discount'
};

const state = {
  currentPeriod: 'weekday',
  currentTemplate: null,
  canvasItems: [],
  pricingRules: {},
  tieredOverrides: {},
  packages: [],
  discounts: {},
  booking: {
    mode: 'single', period: 'weekday', people: 2, days: 1,
    dailySchedule: [], services: [], equipmentRentals: [], selectedDiscounts: []
  },
  draggedItem: null,
  selectedItem: null,
  boxSelectedItems: new Set(),
  boxSelectMode: false,
  rulePriority: [...RULE_PRIORITY_DEFAULT],
  history: { stack: [], index: -1, maxSize: 50 },
  lastCalcResult: null,
  serviceModules: [],
  templates: [],
  discountTypes: [],
  mutexGroups: []
};

let draggedCanvasItem = null;
let boxSelectStart = null;
let editingPackageId = null;

function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

function snapshotState() {
  return {
    canvasItems: deepClone(state.canvasItems),
    pricingRules: deepClone(state.pricingRules),
    tieredOverrides: deepClone(state.tieredOverrides),
    packages: deepClone(state.packages),
    currentTemplate: deepClone(state.currentTemplate),
    rulePriority: [...state.rulePriority]
  };
}

function pushHistory() {
  if (state.history.index < state.history.stack.length - 1) {
    state.history.stack = state.history.stack.slice(0, state.history.index + 1);
  }
  state.history.stack.push(snapshotState());
  if (state.history.stack.length > state.history.maxSize) state.history.stack.shift();
  else state.history.index++;
  updateHistoryButtons();
}

function undo() {
  if (state.history.index <= 0) return;
  state.history.index--;
  const snap = state.history.stack[state.history.index];
  Object.assign(state, {
    canvasItems: deepClone(snap.canvasItems),
    pricingRules: deepClone(snap.pricingRules),
    tieredOverrides: deepClone(snap.tieredOverrides),
    packages: deepClone(snap.packages),
    currentTemplate: deepClone(snap.currentTemplate),
    rulePriority: [...snap.rulePriority]
  });
  if (state.currentTemplate) applyTemplate(state.currentTemplate);
  renderAll();
  updateHistoryButtons();
}

function redo() {
  if (state.history.index >= state.history.stack.length - 1) return;
  state.history.index++;
  const snap = state.history.stack[state.history.index];
  Object.assign(state, {
    canvasItems: deepClone(snap.canvasItems),
    pricingRules: deepClone(snap.pricingRules),
    tieredOverrides: deepClone(snap.tieredOverrides),
    packages: deepClone(snap.packages),
    currentTemplate: deepClone(snap.currentTemplate),
    rulePriority: [...snap.rulePriority]
  });
  if (state.currentTemplate) applyTemplate(state.currentTemplate);
  renderAll();
  updateHistoryButtons();
}

function updateHistoryButtons() {
  const u = document.getElementById('btnUndo'), r = document.getElementById('btnRedo');
  if (u) u.disabled = state.history.index <= 0;
  if (r) r.disabled = state.history.index >= state.history.stack.length - 1;
}

async function init() {
  await loadInitialData();
  pushHistory();
  renderModuleLibrary();
  renderTemplates();
  renderDiscountConfig();
  renderServiceCheckboxes();
  renderDiscountCheckboxes();
  renderTierConfig();
  renderPackageList();
  renderDailySchedule();
  renderPriorityConfig();
  setupEventListeners();
  setupDragAndDrop();
  setupBoxSelect();
  checkEngineConnection();
  updateCalculation();
  renderAll();
}

function renderAll() {
  renderCanvas();
  renderRuleConfig();
  renderTierConfig();
  renderPackageList();
  renderDailySchedule();
  renderPriorityConfig();
  validateRules();
  updateCalculation();
}

async function loadInitialData() {
  try {
    const [m, t] = await Promise.all([
      fetch(`${ENGINE_API}/service-modules`),
      fetch(`${ENGINE_API}/templates`)
    ]);
    state.serviceModules = await m.json();
    state.templates = await t.json();
    if (state.templates.length > 0) {
      state.currentTemplate = state.templates[0];
      applyTemplate(state.currentTemplate);
    }
    state.discountTypes = [
      { id: 'member_discount', name: '会员折扣', type: 'percentage', value: 0.15, group: 'membership', category: 'member_discount' },
      { id: 'coupon_discount', name: '优惠券', type: 'fixed', value: 30, group: 'membership', category: 'member_discount' },
      { id: 'early_bird', name: '早鸟优惠', type: 'percentage', value: 0.20, group: 'timing', category: 'timing_discount' },
      { id: 'last_minute', name: '限时特惠', type: 'fixed', value: 50, group: 'timing', category: 'timing_discount' },
      { id: 'group_discount', name: '团购折扣', type: 'percentage', value: 0.25, group: 'quantity', category: 'quantity_discount' },
      { id: 'promo_code', name: '优惠码', type: 'fixed', value: 80, group: 'quantity', category: 'quantity_discount' }
    ];
    state.discountTypes.forEach(dt => { state.discounts[dt.id] = { enabled: false, value: dt.value }; });
    state.serviceModules.forEach(mod => {
      if (mod.tieredPricing) state.tieredOverrides[mod.id] = deepClone(mod.tieredPricing);
    });
  } catch (e) { console.error('加载初始数据失败:', e); }
}

async function checkEngineConnection() {
  const d = document.getElementById('engineStatus'), t = document.getElementById('engineStatusText');
  try {
    const r = await fetch(`${ENGINE_API}/templates`);
    if (r.ok) { d.className = 'status-dot connected'; t.textContent = '计算引擎已连接'; }
    else throw new Error('连接失败');
  } catch (e) { d.className = 'status-dot error'; t.textContent = '计算引擎连接失败'; }
}

function renderModuleLibrary() {
  const lib = document.getElementById('moduleLibrary');
  lib.innerHTML = '';
  state.serviceModules.forEach(m => {
    const el = document.createElement('div');
    el.className = 'module-item';
    el.draggable = true;
    el.dataset.id = m.id;
    el.innerHTML = `<div class="module-icon">${m.icon}</div><div class="module-name">${m.name}</div><div class="module-price">¥${m.basePrice}/${m.unit}</div>`;
    lib.appendChild(el);
  });
}

function renderTemplates() {
  const g = document.getElementById('templateGrid');
  g.innerHTML = '';
  state.templates.forEach(t => {
    const el = document.createElement('div');
    el.className = 'template-item' + (state.currentTemplate && state.currentTemplate.id === t.id ? ' active' : '');
    el.dataset.id = t.id;
    el.innerHTML = `<div class="template-preview" style="background: linear-gradient(135deg, ${t.primaryColor}, ${t.secondaryColor}); color: white;">Aa</div><div class="template-name">${t.name}</div>`;
    el.addEventListener('click', () => selectTemplate(t.id));
    g.appendChild(el);
  });
}

function renderDiscountConfig() {
  const c = document.getElementById('discountConfig');
  c.innerHTML = '';
  const groups = {};
  state.discountTypes.forEach(d => { if (!groups[d.group]) groups[d.group] = []; groups[d.group].push(d); });
  for (const [gid, ds] of Object.entries(groups)) {
    const gl = document.createElement('div');
    gl.style.cssText = 'font-size: 11px; color: #64748b; margin: 8px 0 4px; padding-left: 4px;';
    gl.textContent = DISCOUNT_GROUPS[gid] || gid;
    c.appendChild(gl);
    ds.forEach(d => {
      const on = state.discounts[d.id]?.enabled;
      const locked = isDiscountLocked(d.id);
      const el = document.createElement('div');
      el.className = 'discount-item' + (on ? ' enabled' : '') + (locked ? ' locked' : '');
      el.dataset.id = d.id;
      const v = d.type === 'percentage' ? `${Math.round(d.value * 100)}%` : `¥${d.value}`;
      el.innerHTML = `<div class="discount-checkbox"></div><div class="discount-info"><div class="discount-name">${d.name}</div><div class="discount-value">${v}</div></div>${hasMutexConflict(d.id) && on ? '<span class="mutex-tag">互斥</span>' : ''}`;
      el.addEventListener('click', () => toggleDiscount(d.id));
      c.appendChild(el);
    });
  }
}

function hasMutexConflict(id) {
  if (!state.discounts[id]?.enabled) return false;
  for (const g of MUTUALLY_EXCLUSIVE_GROUPS) {
    if (g.includes(id) && g.filter(x => state.discounts[x]?.enabled).length > 1) return true;
  }
  return false;
}

function isDiscountLocked(id) {
  return state.lastCalcResult?.lockedDiscounts?.includes(id);
}

function toggleDiscount(id) {
  const cur = state.discounts[id]?.enabled;
  if (!cur) {
    for (const g of MUTUALLY_EXCLUSIVE_GROUPS) {
      if (g.includes(id)) {
        const other = g.find(x => x !== id && state.discounts[x]?.enabled);
        if (other) {
          const od = state.discountTypes.find(d => d.id === other);
          if (!confirm(`该折扣与「${od.name}」互斥，是否替换？`)) return;
          state.discounts[other].enabled = false;
        }
      }
    }
  }
  pushHistory();
  state.discounts[id].enabled = !cur;
  const sd = state.booking.selectedDiscounts;
  const i = sd.indexOf(id);
  if (state.discounts[id].enabled) { if (i === -1) sd.push(id); }
  else { if (i > -1) sd.splice(i, 1); }
  renderDiscountConfig();
  renderDiscountCheckboxes();
  validateRules();
  updateCalculation();
}

function renderServiceCheckboxes() {
  const c = document.getElementById('serviceCheckboxes');
  c.innerHTML = '';
  state.serviceModules.forEach(m => {
    const sel = state.booking.services.some(s => s.id === m.id) || state.booking.equipmentRentals.some(e => e.id === m.id);
    const inPkg = state.packages.some(p => p.enabled && p.serviceIds.includes(m.id));
    const el = document.createElement('div');
    el.className = 'service-checkbox-item' + (inPkg ? ' locked' : '');
    el.innerHTML = `<input type="checkbox" id="srv_${m.id}" ${sel ? 'checked' : ''} ${inPkg ? 'disabled' : ''}><span>${m.icon} ${m.name}</span><span style="margin-left: auto; color: #f59e0b; font-size: 11px;">¥${m.basePrice}</span>`;
    el.querySelector('input').addEventListener('change', e => toggleBookingService(m.id, e.target.checked));
    c.appendChild(el);
  });
}

function toggleBookingService(id, checked) {
  const m = state.serviceModules.find(x => x.id === id);
  if (!m) return;
  const isEq = m.category === 'equipment';
  if (checked) {
    if (isEq) {
      if (!state.booking.equipmentRentals.some(e => e.id === id))
        state.booking.equipmentRentals.push({ id, quantity: 1, days: state.booking.days });
    } else {
      if (!state.booking.services.some(s => s.id === id))
        state.booking.services.push({ id, quantity: 1 });
    }
  } else {
    if (isEq) state.booking.equipmentRentals = state.booking.equipmentRentals.filter(e => e.id !== id);
    else state.booking.services = state.booking.services.filter(s => s.id !== id);
  }
  updateCalculation();
}

function renderDiscountCheckboxes() {
  const c = document.getElementById('discountCheckboxes');
  c.innerHTML = '';
  state.discountTypes.forEach(d => {
    const sel = state.booking.selectedDiscounts.includes(d.id);
    const locked = state.lastCalcResult?.lockedDiscounts?.includes(d.id);
    const v = d.type === 'percentage' ? `${Math.round(d.value * 100)}%` : `¥${d.value}`;
    const el = document.createElement('div');
    el.className = 'discount-checkbox-item' + (locked ? ' locked' : '');
    el.innerHTML = `<input type="checkbox" id="disc_${d.id}" ${sel ? 'checked' : ''} ${locked ? 'disabled' : ''}><span>${d.name}</span><span style="margin-left: auto; color: #10b981; font-size: 11px;">-${v}</span>`;
    el.querySelector('input').addEventListener('change', e => toggleBookingDiscount(d.id, e.target.checked));
    c.appendChild(el);
  });
}

function toggleBookingDiscount(id, checked) {
  const i = state.booking.selectedDiscounts.indexOf(id);
  if (checked) {
    for (const g of MUTUALLY_EXCLUSIVE_GROUPS) {
      if (g.includes(id)) {
        const other = g.find(x => x !== id && state.booking.selectedDiscounts.includes(x));
        if (other) {
          const od = state.discountTypes.find(d => d.id === other);
          if (!confirm(`该折扣与「${od.name}」互斥，是否替换？`)) {
            const cb = document.getElementById(`disc_${id}`);
            if (cb) cb.checked = false;
            return;
          }
          state.booking.selectedDiscounts = state.booking.selectedDiscounts.filter(x => x !== other);
          const ocb = document.getElementById(`disc_${other}`);
          if (ocb) ocb.checked = false;
        }
      }
    }
    if (i === -1) state.booking.selectedDiscounts.push(id);
  } else if (i > -1) state.booking.selectedDiscounts.splice(i, 1);
  updateCalculation();
}

function renderTierConfig() {
  const c = document.getElementById('tierConfig');
  if (!state.selectedItem) { c.innerHTML = '<p class="section-hint">选择画布模块后配置阶梯定价</p>'; return; }
  const m = state.serviceModules.find(x => x.id === state.selectedItem);
  if (!m) { c.innerHTML = '<p class="section-hint">模块不存在</p>'; return; }
  const cfg = state.tieredOverrides[state.selectedItem] || { enabled: false, tiers: [] };
  c.innerHTML = `<div class="tier-item"><div class="tier-item-header"><label class="tier-enable"><input type="checkbox" id="tierEnabled" ${cfg.enabled ? 'checked' : ''}><span>${m.icon} ${m.name} · 阶梯定价</span></label><button class="tier-add-btn" id="tierAddBtn">+ 新增阶梯</button></div><div id="tierRows"></div></div>`;
  const rc = document.getElementById('tierRows');
  if (cfg.enabled) {
    cfg.tiers.forEach((t, idx) => {
      const r = document.createElement('div');
      r.className = 'tier-row';
      r.innerHTML = `<input type="number" class="tier-min" value="${t.minPeople}" min="1"><span class="tier-hyphen">—</span><input type="number" class="tier-max" value="${t.maxPeople}" min="1"><select class="tier-mode"><option value="fixed" ${t.priceMode === 'fixed' ? 'selected' : ''}>固定价</option><option value="discount" ${t.priceMode === 'discount' ? 'selected' : ''}>折扣率</option></select><input type="number" class="tier-value" value="${t.value}" step="0.01" min="0"><button class="tier-delete" data-idx="${idx}">×</button>`;
      rc.appendChild(r);
      r.querySelectorAll('input, select').forEach(el => {
        el.addEventListener('input', collectTierData);
        el.addEventListener('change', collectTierData);
      });
      r.querySelector('.tier-delete').addEventListener('click', () => {
        const cur = state.tieredOverrides[state.selectedItem] || { enabled: false, tiers: [] };
        cur.tiers.splice(idx, 1);
        pushHistory();
        state.tieredOverrides[state.selectedItem] = cur;
        renderTierConfig(); validateRules(); updateCalculation(); renderCanvas();
      });
    });
  }
  document.getElementById('tierEnabled').addEventListener('change', e => {
    const cur = state.tieredOverrides[state.selectedItem] || deepClone(m.tieredPricing);
    cur.enabled = e.target.checked;
    pushHistory();
    state.tieredOverrides[state.selectedItem] = cur;
    renderTierConfig(); validateRules(); updateCalculation(); renderCanvas();
  });
  document.getElementById('tierAddBtn').addEventListener('click', () => {
    const cur = state.tieredOverrides[state.selectedItem] || { enabled: true, tiers: [] };
    const last = cur.tiers[cur.tiers.length - 1];
    const nm = last ? last.maxPeople + 1 : 1;
    cur.tiers.push({ id: 't' + Date.now(), minPeople: nm, maxPeople: nm + 4, priceMode: 'discount', value: 0.95, label: `${nm}-${nm + 4}人` });
    cur.enabled = true;
    pushHistory();
    state.tieredOverrides[state.selectedItem] = cur;
    renderTierConfig(); validateRules(); updateCalculation(); renderCanvas();
  });
}

function collectTierData() {
  if (!state.selectedItem) return;
  const rows = document.querySelectorAll('#tierRows .tier-row');
  const tiers = [];
  rows.forEach(r => {
    const mn = parseInt(r.querySelector('.tier-min').value) || 1;
    const mx = parseInt(r.querySelector('.tier-max').value) || 1;
    const md = r.querySelector('.tier-mode').value;
    const v = parseFloat(r.querySelector('.tier-value').value) || 0;
    tiers.push({ id: 't' + Date.now() + Math.random(), minPeople: mn, maxPeople: mx, priceMode: md, value: v, label: `${mn}-${mx === 999 ? '' : mx}人` });
  });
  const cur = state.tieredOverrides[state.selectedItem] || { enabled: true, tiers: [] };
  cur.tiers = tiers;
  state.tieredOverrides[state.selectedItem] = cur;
  validateRules(); updateCalculation(); renderCanvas();
}

function renderPriorityConfig() {
  const c = document.getElementById('priorityConfig');
  c.innerHTML = '';
  state.rulePriority.forEach((rid, i) => {
    const el = document.createElement('div');
    el.className = 'priority-item';
    el.draggable = true;
    el.dataset.rule = rid;
    el.innerHTML = `<span class="priority-handle">⋮⋮</span><span class="priority-number">${i + 1}</span><span>${RULE_LABELS[rid] || rid}</span>`;
    el.addEventListener('dragstart', e => { el.classList.add('dragging'); e.dataTransfer.setData('text/plain', rid); });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));
    el.addEventListener('dragover', e => {
      e.preventDefault();
      const dg = document.querySelector('.priority-item.dragging');
      if (dg && dg !== el) {
        const rect = el.getBoundingClientRect();
        const after = e.clientY - rect.top > rect.height / 2;
        if (after) el.parentNode.insertBefore(dg, el.nextSibling);
        else el.parentNode.insertBefore(dg, el);
      }
    });
    el.addEventListener('drop', e => {
      e.preventDefault();
      const no = [];
      c.querySelectorAll('.priority-item').forEach(p => no.push(p.dataset.rule));
      if (JSON.stringify(no) !== JSON.stringify(state.rulePriority)) {
        pushHistory();
        state.rulePriority = no;
        renderPriorityConfig();
        updateCalculation();
      }
    });
    c.appendChild(el);
  });
}

function renderPackageList() {
  const l = document.getElementById('packageList');
  if (state.packages.length === 0) { l.innerHTML = '<p class="section-hint">暂无套餐，框选画布模块创建</p>'; return; }
  l.innerHTML = '';
  state.packages.forEach(p => {
    const card = document.createElement('div');
    card.className = 'package-card';
    const pt = p.pricing.mode === 'fixed_price' ? `¥${p.pricing.value}` : `${Math.round(p.pricing.value * 100)}%`;
    card.innerHTML = `<div class="package-card-header"><span class="package-card-name">${p.enabled ? '📦' : '📪'} ${p.name}</span><div class="package-card-actions"><button class="package-card-action" data-action="toggle" data-id="${p.id}">${p.enabled ? '禁用' : '启用'}</button><button class="package-card-action" data-action="edit" data-id="${p.id}">编辑</button><button class="package-card-action" data-action="delete" data-id="${p.id}">删除</button></div></div><div class="package-card-info">${p.serviceIds.length} 项服务 · ${pt}</div>`;
    card.querySelectorAll('.package-card-action').forEach(b => {
      b.addEventListener('click', e => {
        e.stopPropagation();
        const a = b.dataset.action, id = b.dataset.id;
        if (a === 'toggle') togglePackage(id);
        if (a === 'edit') editPackage(id);
        if (a === 'delete') deletePackage(id);
      });
    });
    l.appendChild(card);
  });
}

function togglePackage(id) {
  const p = state.packages.find(x => x.id === id);
  if (!p) return;
  pushHistory();
  p.enabled = !p.enabled;
  renderPackageList(); renderServiceCheckboxes(); validateRules(); updateCalculation(); renderCanvas();
}

function editPackage(id) {
  const p = state.packages.find(x => x.id === id);
  if (!p) return;
  editingPackageId = id;
  document.getElementById('pkgName').value = p.name;
  document.getElementById('pkgPricingMode').value = p.pricing.mode;
  document.getElementById('pkgPricingValue').value = p.pricing.value;
  renderPackageServiceList(p.serviceIds);
  document.getElementById('packageModal').classList.add('active');
}

function deletePackage(id) {
  if (!confirm('确定删除该套餐？')) return;
  pushHistory();
  state.packages = state.packages.filter(p => p.id !== id);
  renderPackageList(); renderServiceCheckboxes(); validateRules(); updateCalculation(); renderCanvas();
}

function renderPackageServiceList(pre = []) {
  const l = document.getElementById('packageServiceList');
  l.innerHTML = '';
  state.canvasItems.forEach(it => {
    const m = state.serviceModules.find(x => x.id === it.id);
    if (!m) return;
    const c = pre.includes(it.id);
    const r = document.createElement('label');
    r.className = 'package-service-item';
    r.innerHTML = `<input type="checkbox" data-id="${it.id}" ${c ? 'checked' : ''}><span>${m.icon} ${m.name}</span><span style="margin-left: auto; color: #f59e0b; font-size: 11px;">¥${m.basePrice}</span>`;
    l.appendChild(r);
  });
  if (state.canvasItems.length === 0) l.innerHTML = '<p class="section-hint">画布暂无模块</p>';
}

function openCreatePackageFromSelection() {
  const sel = Array.from(state.boxSelectedItems);
  if (sel.length < 2) { alert('请至少框选2个服务模块来创建套餐'); return; }
  editingPackageId = null;
  document.getElementById('pkgName').value = '';
  document.getElementById('pkgPricingMode').value = 'fixed_price';
  document.getElementById('pkgPricingValue').value = '';
  renderPackageServiceList(sel);
  document.getElementById('packageModal').classList.add('active');
}

function savePackage() {
  const name = document.getElementById('pkgName').value.trim();
  const mode = document.getElementById('pkgPricingMode').value;
  const value = parseFloat(document.getElementById('pkgPricingValue').value);
  const ids = Array.from(document.querySelectorAll('#packageServiceList input:checked')).map(i => i.dataset.id);
  if (!name) { alert('请填写套餐名称'); return; }
  if (ids.length < 2) { alert('至少选择2个服务'); return; }
  if (isNaN(value) || value < 0) { alert('请填写合法的定价数值'); return; }
  if (mode === 'discount' && (value <= 0 || value > 1)) { alert('折扣率必须在0-1之间'); return; }
  pushHistory();
  if (editingPackageId) {
    const p = state.packages.find(x => x.id === editingPackageId);
    if (p) { p.name = name; p.serviceIds = ids; p.pricing = { mode, value }; }
  } else {
    state.packages.push({ id: 'pkg_' + Date.now(), name, serviceIds: ids, pricing: { mode, value }, enabled: true });
  }
  document.getElementById('packageModal').classList.remove('active');
  editingPackageId = null;
  state.boxSelectedItems.clear();
  exitBoxSelectMode();
  renderPackageList(); renderServiceCheckboxes(); validateRules(); updateCalculation(); renderCanvas();
}

function renderDailySchedule() {
  const c = document.getElementById('dailySchedule');
  c.innerHTML = '';
  if (state.booking.dailySchedule.length === 0) state.booking.dailySchedule.push({ period: 'weekday', date: '' });
  state.booking.dailySchedule.forEach((d, i) => {
    const el = document.createElement('div');
    el.className = 'daily-schedule-item';
    el.innerHTML = `<span class="daily-schedule-day">第${i + 1}天</span><div class="daily-schedule-period"><select data-idx="${i}"><option value="weekday" ${d.period === 'weekday' ? 'selected' : ''}>平日</option><option value="night" ${d.period === 'night' ? 'selected' : ''}>夜间</option><option value="weekend" ${d.period === 'weekend' ? 'selected' : ''}>周末</option></select></div><button class="daily-schedule-delete" data-idx="${i}" ${state.booking.dailySchedule.length <= 1 ? 'disabled' : ''}>×</button>`;
    el.querySelector('select').addEventListener('change', e => {
      state.booking.dailySchedule[i].period = e.target.value;
      updateCalculation();
    });
    el.querySelector('.daily-schedule-delete').addEventListener('click', () => {
      if (state.booking.dailySchedule.length <= 1) return;
      state.booking.dailySchedule.splice(i, 1);
      renderDailySchedule(); updateCalculation();
    });
    c.appendChild(el);
  });
}

function setupEventListeners() {
  document.querySelectorAll('.period-tab').forEach(t => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.period-tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      state.currentPeriod = t.dataset.period;
      renderCanvas(); renderRuleConfig(); validateRules();
    });
  });
  document.getElementById('simPeriod').addEventListener('change', e => { state.booking.period = e.target.value; updateCalculation(); });
  document.getElementById('simPeople').addEventListener('input', e => {
    state.booking.people = parseInt(e.target.value) || 1;
    updateCalculation(); renderCanvas();
  });
  document.getElementById('simDays').addEventListener('input', e => {
    state.booking.days = parseInt(e.target.value) || 1;
    state.booking.equipmentRentals.forEach(x => { x.days = state.booking.days; });
    updateCalculation();
  });
  document.getElementById('btnPreview').addEventListener('click', showPreview);
  document.getElementById('previewClose').addEventListener('click', hidePreview);
  document.querySelector('.preview-overlay').addEventListener('click', hidePreview);
  document.getElementById('btnClear').addEventListener('click', clearCanvas);
  document.getElementById('btnReset').addEventListener('click', resetLayout);
  document.getElementById('btnUndo').addEventListener('click', undo);
  document.getElementById('btnRedo').addEventListener('click', redo);
  document.getElementById('btnExport').addEventListener('click', exportConfig);
  document.getElementById('btnImport').addEventListener('click', () => document.getElementById('fileInput').click());
  document.getElementById('fileInput').addEventListener('change', importConfig);
  document.getElementById('btnCreatePackage').addEventListener('click', () => {
    editingPackageId = null;
    document.getElementById('pkgName').value = '';
    document.getElementById('pkgPricingMode').value = 'fixed_price';
    document.getElementById('pkgPricingValue').value = '';
    renderPackageServiceList([]);
    document.getElementById('packageModal').classList.add('active');
  });
  document.getElementById('btnBoxSelect').addEventListener('click', enterBoxSelectMode);
  document.getElementById('btnExitBoxSelect').addEventListener('click', exitBoxSelectMode);
  document.getElementById('btnSavePackage').addEventListener('click', savePackage);
  document.getElementById('btnCancelPackage').addEventListener('click', () => {
    document.getElementById('packageModal').classList.remove('active'); editingPackageId = null;
  });
  document.getElementById('packageModalOverlay').addEventListener('click', () => {
    document.getElementById('packageModal').classList.remove('active'); editingPackageId = null;
  });
  document.getElementById('btnAddDay').addEventListener('click', () => {
    state.booking.dailySchedule.push({ period: 'weekday', date: '' });
    renderDailySchedule(); updateCalculation();
  });
  document.querySelectorAll('.segment-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.segment-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      state.booking.mode = b.dataset.mode;
      const sg = document.getElementById('singleDayGroup'), mg = document.getElementById('multiDayGroup');
      if (state.booking.mode === 'multi') {
        sg.style.display = 'none'; mg.style.display = 'block';
        if (state.booking.dailySchedule.length === 0) state.booking.dailySchedule.push({ period: 'weekday', date: '' });
        renderDailySchedule();
      } else { sg.style.display = 'block'; mg.style.display = 'none'; }
      updateCalculation();
    });
  });
  document.getElementById('hitChainToggle').closest('.validation-header').addEventListener('click', () => {
    document.getElementById('hitChainPanel').classList.toggle('collapsed');
  });
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    if (e.key === 'Escape') {
      exitBoxSelectMode();
      document.getElementById('packageModal').classList.remove('active');
      document.getElementById('previewModal').classList.remove('active');
    }
  });
}

function setupDragAndDrop() {
  const items = document.querySelectorAll('.module-item');
  const canvas = document.getElementById('posterContent');
  items.forEach(it => { it.addEventListener('dragstart', handleDragStart); it.addEventListener('dragend', handleDragEnd); });
  canvas.addEventListener('dragover', handleDragOver);
  canvas.addEventListener('dragleave', handleDragLeave);
  canvas.addEventListener('drop', handleDrop);
}

function handleDragStart(e) {
  state.draggedItem = e.target.closest('.module-item').dataset.id;
  e.dataTransfer.effectAllowed = 'copy';
  e.target.closest('.module-item').style.opacity = '0.5';
}

function handleDragEnd(e) {
  e.target.closest('.module-item').style.opacity = '1';
  document.getElementById('posterCanvas').classList.remove('drag-over');
}

function handleDragOver(e) {
  if (state.boxSelectMode) return;
  e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
  document.getElementById('posterCanvas').classList.add('drag-over');
}

function handleDragLeave(e) {
  if (!e.currentTarget.contains(e.relatedTarget))
    document.getElementById('posterCanvas').classList.remove('drag-over');
}

function handleDrop(e) {
  e.preventDefault();
  document.getElementById('posterCanvas').classList.remove('drag-over');
  const id = state.draggedItem;
  if (!id) return;
  if (state.canvasItems.some(x => x.id === id)) return;
  const m = state.serviceModules.find(x => x.id === id);
  if (!m) return;
  pushHistory();
  state.canvasItems.push({ id: m.id, name: m.name, icon: m.icon, description: m.description, basePrice: m.basePrice, order: state.canvasItems.length });
  if (!state.pricingRules[m.id]) {
    state.pricingRules[m.id] = {
      weekday: { price: m.basePrice, enabled: true },
      night: { price: Math.round(m.basePrice * 0.8), enabled: true },
      weekend: { price: Math.round(m.basePrice * 1.2), enabled: true }
    };
  }
  if (!state.tieredOverrides[m.id] && m.tieredPricing) state.tieredOverrides[m.id] = deepClone(m.tieredPricing);
  renderCanvas(); renderRuleConfig(); renderTierConfig(); renderServiceCheckboxes(); validateRules();
}

function setupBoxSelect() {
  const w = document.getElementById('canvasWrapper');
  const r = document.getElementById('boxSelectionRect');
  w.addEventListener('mousedown', e => {
    if (!state.boxSelectMode) return;
    if (e.target.closest('.poster-item')) return;
    e.preventDefault();
    const wr = w.getBoundingClientRect();
    boxSelectStart = { x: e.clientX - wr.left, y: e.clientY - wr.top };
    r.style.left = boxSelectStart.x + 'px'; r.style.top = boxSelectStart.y + 'px';
    r.style.width = '0px'; r.style.height = '0px';
    r.classList.add('active');
    state.boxSelectedItems.clear();
  });
  w.addEventListener('mousemove', e => {
    if (!state.boxSelectMode || !boxSelectStart) return;
    const wr = w.getBoundingClientRect();
    const cx = e.clientX - wr.left, cy = e.clientY - wr.top;
    const l = Math.min(boxSelectStart.x, cx), t = Math.min(boxSelectStart.y, cy);
    const wd = Math.abs(cx - boxSelectStart.x), ht = Math.abs(cy - boxSelectStart.y);
    r.style.left = l + 'px'; r.style.top = t + 'px'; r.style.width = wd + 'px'; r.style.height = ht + 'px';
    const ra = { left: l + wr.left, top: t + wr.top, right: l + wd + wr.left, bottom: t + ht + wr.top };
    document.querySelectorAll('.poster-item').forEach(it => {
      const ir = it.getBoundingClientRect();
      const ov = !(ir.right < ra.left || ir.left > ra.right || ir.bottom < ra.top || ir.top > ra.bottom);
      const id = it.dataset.id;
      if (ov) state.boxSelectedItems.add(id); else state.boxSelectedItems.delete(id);
      it.classList.toggle('box-selected', state.boxSelectedItems.has(id));
    });
  });
  document.addEventListener('mouseup', () => {
    if (!state.boxSelectMode) return;
    boxSelectStart = null;
    r.classList.remove('active'); r.style.width = '0px'; r.style.height = '0px';
    if (state.boxSelectedItems.size >= 2) {
      if (confirm(`已框选 ${state.boxSelectedItems.size} 个模块，是否创建套餐？`)) openCreatePackageFromSelection();
    }
  });
}

function enterBoxSelectMode() {
  state.boxSelectMode = true; state.boxSelectedItems.clear();
  document.getElementById('canvasWrapper').classList.add('box-select-mode');
  document.getElementById('btnExitBoxSelect').style.display = 'inline-block';
}

function exitBoxSelectMode() {
  state.boxSelectMode = false; state.boxSelectedItems.clear();
  document.getElementById('canvasWrapper').classList.remove('box-select-mode');
  document.getElementById('btnExitBoxSelect').style.display = 'none';
  document.querySelectorAll('.poster-item.box-selected').forEach(i => i.classList.remove('box-selected'));
}

function renderCanvas() {
  const c = document.getElementById('posterContent');
  if (state.canvasItems.length === 0) {
    c.innerHTML = `<div class="empty-hint"><p>👆 从左侧拖拽服务模块到这里</p><p class="hint-sub">自由排版 · 实时预览 · 框选组套餐</p></div>`;
    return;
  }
  c.innerHTML = '';
  state.canvasItems.forEach((it, idx) => {
    const pi = state.pricingRules[it.id]?.[state.currentPeriod];
    const bp = pi?.price || it.basePrice;
    const tc = state.tieredOverrides[it.id];
    const pp = state.booking.people;
    let fp = bp; let at = null;
    if (tc?.enabled && tc?.tiers) {
      const t = tc.tiers.find(x => pp >= x.minPeople && pp <= x.maxPeople);
      if (t) { at = t; fp = t.priceMode === 'fixed' ? t.value : Math.round(bp * t.value * 100) / 100; }
    }
    const inPkg = state.packages.find(p => p.enabled && p.serviceIds.includes(it.id));
    const el = document.createElement('div');
    el.className = 'poster-item' +
      (state.selectedItem === it.id ? ' selected' : '') +
      (state.boxSelectedItems.has(it.id) ? ' box-selected' : '') +
      (inPkg ? ' in-package' : '');
    el.dataset.id = it.id;
    el.draggable = !state.boxSelectMode;
    const tags = [];
    tags.push(`<span class="rule-tag period-${state.currentPeriod}">${getPeriodLabel(state.currentPeriod)}</span>`);
    if (at) tags.push(`<span class="rule-tag tier">${at.label}${at.priceMode === 'fixed' ? '¥' + at.value : Math.round(at.value * 100) + '%'}</span>`);
    if (inPkg) tags.push(`<span class="rule-tag package">📦${inPkg.name}</span>`);
    el.innerHTML = `<button class="poster-item-delete" onclick="event.stopPropagation(); deleteItem('${it.id}')">×</button>
      <div class="poster-item-header"><span class="poster-item-icon">${it.icon}</span><span class="poster-item-name">${it.name}</span><span class="poster-item-price">¥${Math.round(fp)}</span></div>
      <div class="poster-item-desc">${it.description || ''}</div>
      <div class="poster-item-tags">${tags.join('')}</div>`;
    el.addEventListener('click', () => selectItem(it.id));
    el.addEventListener('dragstart', handleCanvasItemDragStart);
    el.addEventListener('dragend', handleCanvasItemDragEnd);
    el.addEventListener('dragover', handleCanvasItemDragOver);
    el.addEventListener('drop', handleCanvasItemDrop);
    c.appendChild(el);
  });
}

function handleCanvasItemDragStart(e) {
  if (state.boxSelectMode) { e.preventDefault(); return; }
  draggedCanvasItem = e.target.closest('.poster-item').dataset.id;
  e.dataTransfer.effectAllowed = 'move';
  e.target.closest('.poster-item').style.opacity = '0.5';
}

function handleCanvasItemDragEnd(e) {
  e.target.closest('.poster-item').style.opacity = '1';
  draggedCanvasItem = null;
}

function handleCanvasItemDragOver(e) {
  if (state.boxSelectMode) return;
  e.preventDefault(); e.dataTransfer.dropEffect = 'move';
}

function handleCanvasItemDrop(e) {
  if (state.boxSelectMode) return;
  e.preventDefault(); e.stopPropagation();
  const tid = e.target.closest('.poster-item').dataset.id;
  if (!draggedCanvasItem || draggedCanvasItem === tid) return;
  const fi = state.canvasItems.findIndex(i => i.id === draggedCanvasItem);
  const ti = state.canvasItems.findIndex(i => i.id === tid);
  if (fi > -1 && ti > -1) {
    pushHistory();
    const [rm] = state.canvasItems.splice(fi, 1);
    state.canvasItems.splice(ti, 0, rm);
    renderCanvas();
  }
}

function deleteItem(id) {
  pushHistory();
  state.canvasItems = state.canvasItems.filter(i => i.id !== id);
  delete state.pricingRules[id];
  delete state.tieredOverrides[id];
  state.packages.forEach(p => { p.serviceIds = p.serviceIds.filter(sid => sid !== id); });
  state.packages = state.packages.filter(p => p.serviceIds.length >= 2);
  state.booking.services = state.booking.services.filter(s => s.id !== id);
  state.booking.equipmentRentals = state.booking.equipmentRentals.filter(e => e.id !== id);
  if (state.selectedItem === id) state.selectedItem = null;
  renderCanvas(); renderRuleConfig(); renderTierConfig(); renderPackageList(); renderServiceCheckboxes(); validateRules(); updateCalculation();
}

function selectItem(id) { state.selectedItem = id; renderCanvas(); renderTierConfig(); }

function renderRuleConfig() {
  const c = document.getElementById('ruleConfig');
  if (state.canvasItems.length === 0) { c.innerHTML = '<p class="section-hint">请先从左侧拖拽服务模块到画布</p>'; return; }
  c.innerHTML = '';
  state.canvasItems.forEach(it => {
    const el = document.createElement('div');
    el.className = 'rule-item';
    const pr = state.pricingRules[it.id] || {};
    el.innerHTML = `<div class="rule-item-header"><span class="rule-item-icon">${it.icon}</span><span class="rule-item-name">${it.name}</span></div>
      <div class="price-input-group"><label>平日</label><input type="number" value="${Math.round(pr.weekday?.price ?? it.basePrice)}" data-id="${it.id}" data-period="weekday" min="0" step="1"></div>
      <div class="price-input-group" style="margin-top:4px;"><label>夜间</label><input type="number" value="${Math.round(pr.night?.price ?? (it.basePrice * 0.8))}" data-id="${it.id}" data-period="night" min="0" step="1"></div>
      <div class="price-input-group" style="margin-top:4px;"><label>周末</label><input type="number" value="${Math.round(pr.weekend?.price ?? (it.basePrice * 1.2))}" data-id="${it.id}" data-period="weekend" min="0" step="1"></div>`;
    c.appendChild(el);
  });
  c.querySelectorAll('input').forEach(i => i.addEventListener('change', handlePriceChange));
}

function handlePriceChange(e) {
  const id = e.target.dataset.id, period = e.target.dataset.period;
  const price = parseFloat(e.target.value) || 0;
  if (!state.pricingRules[id]) state.pricingRules[id] = {};
  if (!state.pricingRules[id][period]) state.pricingRules[id][period] = {};
  pushHistory();
  state.pricingRules[id][period].price = price;
  if (period === state.currentPeriod) renderCanvas();
  validateRules(); updateCalculation();
}

function selectTemplate(tid) {
  const t = state.templates.find(x => x.id === tid);
  if (!t) return;
  pushHistory();
  state.currentTemplate = t;
  applyTemplate(t);
  renderTemplates();
}

function applyTemplate(t) {
  const c = document.getElementById('posterCanvas');
  c.style.setProperty('--primary-color', t.primaryColor);
  c.style.setProperty('--secondary-color', t.secondaryColor);
  c.style.setProperty('--text-color', t.textColor);
  c.style.background = `linear-gradient(180deg, ${t.bgColor} 0%, #ffffff 100%)`;
}

function getPeriodLabel(p) { return { weekday: '平日', night: '夜间', weekend: '周末' }[p] || p; }

async function validateRules() {
  const rules = [];
  for (const [sid, periods] of Object.entries(state.pricingRules)) {
    for (const [period, data] of Object.entries(periods)) {
      if (data.enabled !== false) rules.push({ serviceId: sid, period, price: data.price, enabled: true, discountType: null });
    }
  }
  Object.entries(state.discounts).filter(([_, d]) => d.enabled).forEach(([id]) => {
    rules.push({ serviceId: 'discount_' + id, period: state.currentPeriod, discountType: id, enabled: true });
  });
  try {
    const r = await fetch(`${ENGINE_API}/validate-rules`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules, packages: state.packages, tieredOverrides: state.tieredOverrides })
    });
    displayValidationResult(await r.json());
  } catch (e) { validateRulesLocally(rules); }
}

function validateRulesLocally(rules) {
  const errs = [], warns = [];
  const pr = {};
  rules.forEach(r => { if (!pr[r.period]) pr[r.period] = []; pr[r.period].push(r); });
  for (const [period, list] of Object.entries(pr)) {
    const ids = list.filter(r => r.enabled && r.discountType).map(r => r.discountType);
    for (const g of MUTUALLY_EXCLUSIVE_GROUPS) {
      const f = g.filter(d => ids.includes(d));
      if (f.length > 1) errs.push({ type: 'mutex_conflict', message: `${getPeriodLabel(period)}时段互斥冲突` });
    }
  }
  displayValidationResult({ valid: errs.length === 0, errors: errs, warnings: warns });
}

function displayValidationResult(r) {
  const c = document.getElementById('validationContent');
  if (!r) { c.innerHTML = '<p class="validation-placeholder">配置定价规则后自动校验</p>'; return; }
  let h = '';
  if (r.errors?.length) r.errors.forEach(e => { h += `<div class="validation-error"><span>❌</span><span>${e.message}</span></div>`; });
  if (r.warnings?.length) r.warnings.forEach(w => { h += `<div class="validation-warning"><span>⚠️</span><span>${w.message}</span></div>`; });
  if (r.valid && (!r.errors || r.errors.length === 0) && (!r.warnings || r.warnings.length === 0))
    h = '<div class="validation-success">✅ 所有规则校验通过，无互斥冲突</div>';
  c.innerHTML = h || '<p class="validation-placeholder">配置定价规则后自动校验</p>';
}

async function updateCalculation() {
  const services = state.booking.services.map(s => ({
    id: s.id, quantity: s.quantity,
    customPrice: state.pricingRules[s.id]?.[state.booking.period]?.price
  }));
  const equipmentRentals = state.booking.equipmentRentals.map(e => ({
    id: e.id, quantity: e.quantity, days: state.booking.days,
    customPrice: state.pricingRules[e.id]?.[state.booking.period]?.price
  }));
  const discounts = state.booking.selectedDiscounts.map(did => {
    const dt = state.discountTypes.find(d => d.id === did);
    return { type: did, enabled: true, value: dt ? dt.value : 0 };
  });
  const payload = {
    period: state.booking.period, people: state.booking.people,
    services, equipmentRentals, discounts,
    customPricing: state.pricingRules, tieredOverrides: state.tieredOverrides,
    packages: state.packages.filter(p => p.enabled),
    rulePriority: state.rulePriority
  };
  if (state.booking.mode === 'multi' && state.booking.dailySchedule.length > 0)
    payload.dailySchedule = state.booking.dailySchedule;
  try {
    const r = await fetch(`${ENGINE_API}/calculate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await r.json();
    state.lastCalcResult = result;
    displayCalculationResult(result);
    displayHitChain(result);
    updateDiscountCheckboxesLockState(result.lockedDiscounts || []);
  } catch (e) { calculateLocally(payload); }
}

function calculateLocally(input) {
  const { period = 'weekday', people = 1, services = [], equipmentRentals = [], discounts = [], customPricing = {}, tieredOverrides = {}, packages = [], dailySchedule = null } = input;
  const BP = 'per_person';
  const breakdown = [];
  let subtotal = 0;
  const sp = people > 0 ? people : 1;
  const hitChain = [];
  const covered = new Set();
  packages.forEach(pkg => {
    if (!pkg.enabled) return;
    let it = 0;
    pkg.serviceIds.forEach(sid => {
      const m = state.serviceModules.find(x => x.id === sid);
      if (!m) return;
      let pr = customPricing?.[sid]?.[period]?.price ?? m.basePrice;
      const tc = tieredOverrides?.[sid];
      if (tc?.enabled && tc?.tiers) {
        const t = tc.tiers.find(x => sp >= x.minPeople && sp <= x.maxPeople);
        if (t) pr = t.priceMode === 'fixed' ? t.value : Math.round(pr * t.value * 100) / 100;
      }
      const q = m.billingDimension === BP ? sp : 1;
      it += pr * q;
    });
    const pp = pkg.pricing.mode === 'fixed_price' ? pkg.pricing.value : Math.round(it * pkg.pricing.value * 100) / 100;
    const sv = Math.max(0, it - pp);
    if (sv > 0) {
      pkg.serviceIds.forEach(sid => covered.add(sid));
      subtotal += pp;
      breakdown.push({ type: 'package', packageId: pkg.id, name: `📦 ${pkg.name}`, unitPrice: pp, quantity: 1, amount: pp, icon: '📦' });
      hitChain.push({ rule: 'package_price', label: `套餐【${pkg.name}】`, result: pp });
    }
  });
  const all = [...services.map(s => ({ ...s, __k: 's' })), ...equipmentRentals.map(e => ({ ...e, __k: 'e' }))];
  all.forEach(it => {
    if (covered.has(it.id)) return;
    const m = state.serviceModules.find(x => x.id === it.id);
    if (!m) return;
    const periodPrice = customPricing?.[it.id]?.[period]?.price ?? m.basePrice;
    let price = periodPrice; let at = null;
    const tc = tieredOverrides?.[it.id];
    if (tc?.enabled && tc?.tiers) {
      const t = tc.tiers.find(x => sp >= x.minPeople && sp <= x.maxPeople);
      if (t) { at = t; price = t.priceMode === 'fixed' ? t.value : Math.round(periodPrice * t.value * 100) / 100; }
    }
    hitChain.push({ rule: 'period_base_price', label: getPeriodLabel(period), result: periodPrice });
    if (at) hitChain.push({ rule: 'people_tier', label: at.label, result: price });
    const bq = it.quantity || 1;
    const ipp = m.billingDimension === BP;
    const q = ipp ? bq * sp : bq;
    const d = it.days || 1;
    const ie = it.__k === 'e';
    const amt = ie ? price * q * d : price * q;
    subtotal += amt;
    breakdown.push({ type: ie ? 'equipment' : 'service', serviceId: it.id, name: m.name, unitPrice: price, quantity: ie ? `${q}${m.unit.split('/')[0]}×${d}天` : q, amount: amt, icon: m.icon, appliedTier: at });
  });
  const mutexErrors = [];
  const disIds = discounts.filter(d => d.enabled).map(d => d.type);
  for (const g of MUTUALLY_EXCLUSIVE_GROUPS) {
    const f = g.filter(x => disIds.includes(x));
    if (f.length > 1) mutexErrors.push({ group: g, message: '互斥冲突' });
  }
  let td = 0; const db = []; const ad = [];
  discounts.filter(d => d.enabled).forEach(disc => {
    const dt = state.discountTypes.find(x => x.id === disc.type);
    if (!dt) return;
    const da = dt.type === 'percentage' ? subtotal * (disc.value || dt.value) : (disc.value || dt.value);
    db.push({ type: disc.type, name: dt.name, amount: da, discountType: dt.type, value: disc.value || dt.value });
    td += da; ad.push(disc.type);
    hitChain.push({ rule: DISCOUNT_CATEGORY[disc.type] || 'discount', label: dt.name, result: -da });
  });
  const md = subtotal * 0.30;
  const de = td > md; let fd = td; const ld = [];
  if (de) {
    const so = [...discounts.filter(d => d.enabled)].sort((a, b) => {
      const da = state.discountTypes.find(x => x.id === a.type);
      const db2 = state.discountTypes.find(x => x.id === b.type);
      const va = da?.type === 'percentage' ? subtotal * (a.value || da.value) : (a.value || (da?.value || 0));
      const vb = db2?.type === 'percentage' ? subtotal * (b.value || db2.value) : (b.value || (db2?.value || 0));
      return vb - va;
    });
    let acc = 0;
    for (const d of so) {
      const dt = state.discountTypes.find(x => x.id === d.type);
      const da = dt.type === 'percentage' ? subtotal * (d.value || dt.value) : (d.value || dt.value);
      if (acc + da <= md) acc += da; else ld.push(d.type);
    }
    fd = acc;
    hitChain.push({ rule: 'discount_limit', label: '优惠阈值约束', result: -(td - acc) });
  }
  const ft = Math.max(0, subtotal - fd);
  const result = {
    subtotal: Math.round(subtotal * 100) / 100,
    totalDiscount: Math.round(fd * 100) / 100,
    maxAllowedDiscount: Math.round(md * 100) / 100,
    discountLimitRatio: 0.30,
    finalTotal: Math.round(ft * 100) / 100,
    period, people, breakdown,
    discountBreakdown: db.filter(d => !ld.includes(d.type)),
    discountExceeded: de, lockedDiscounts: ld, mutexErrors,
    appliedDiscounts: ad.filter(d => !ld.includes(d)),
    discountLimitReached: de, hitChain, isMultiDay: false
  };
  state.lastCalcResult = result;
  displayCalculationResult(result);
  displayHitChain(result);
  updateDiscountCheckboxesLockState(result.lockedDiscounts || []);
}

function displayCalculationResult(r) {
  const c = document.getElementById('calculationResult');
  if (!r || r.breakdown.length === 0) { c.innerHTML = '<div class="result-placeholder">选择服务后自动计算</div>'; return; }
  let h = '<div class="result-breakdown">';
  if (r.isMultiDay && r.dailyResults) {
    h += '<div class="daily-breakdown">';
    r.dailyResults.forEach(dr => {
      h += `<div class="daily-breakdown-item"><span class="day-label">第${dr.dayIndex + 1}天 ${dr.periodLabel}</span><span>¥${dr.result.finalTotal.toFixed(2)}</span></div>`;
    });
    h += '</div>';
  }
  r.breakdown.forEach(it => {
    if (it.type === 'package') {
      h += `<div class="result-item"><span class="result-label">${it.icon} ${it.name}</span><span>¥${it.amount.toFixed(2)}</span></div>`;
      if (it.packageDetails) h += `<div class="result-package">节省 ¥${(it.packageDetails.packageSavings || 0).toFixed(2)}</div>`;
    } else {
      h += `<div class="result-item"><span class="result-label">${it.icon} ${it.name} × ${it.quantity}</span><span>¥${it.amount.toFixed(2)}</span></div>`;
    }
  });
  if (r.discountBreakdown?.length) r.discountBreakdown.forEach(d => {
    h += `<div class="result-item discount-item"><span class="result-label">🏷️ ${d.name}</span><span>-¥${d.amount.toFixed(2)}</span></div>`;
  });
  h += '</div><div class="result-divider"></div>';
  h += `<div class="result-subtotal"><span>商品小计</span><span>¥${r.subtotal.toFixed(2)}</span></div>`;
  if (r.totalDiscount > 0) h += `<div class="result-subtotal" style="color:#10b981;"><span>优惠减免</span><span>-¥${r.totalDiscount.toFixed(2)}</span></div>`;
  h += `<div class="result-total"><span class="result-total-label">应付总价</span><span class="result-total-value">¥${r.finalTotal.toFixed(2)}</span></div>`;
  const dp = r.subtotal > 0 ? (r.totalDiscount / r.subtotal) * 100 : 0;
  const mp = r.discountLimitRatio * 100;
  const pp = Math.min(dp / mp * 100, 100);
  h += `<div class="discount-limit-bar"><div class="discount-limit-label"><span>优惠额度使用</span><span>${dp.toFixed(1)}% / ${mp}%</span></div><div class="discount-limit-progress"><div class="discount-limit-fill" style="width:${pp}%;"></div></div>${r.discountExceeded ? '<div class="discount-limit-warning">⚠️ 优惠已超限，部分折扣自动锁定</div>' : ''}</div>`;
  if (r.lockedDiscounts?.length) {
    h += '<div style="margin-top:8px;font-size:11px;color:#f87171;">已锁定折扣: ';
    r.lockedDiscounts.forEach(did => {
      const dt = state.discountTypes.find(d => d.id === did);
      if (dt) h += dt.name + '、';
    });
    h = h.slice(0, -1) + '</div>';
  }
  c.innerHTML = h;
}

function displayHitChain(r) {
  const c = document.getElementById('hitChainContent');
  if (!r?.hitChain?.length) { c.innerHTML = '<p class="validation-placeholder">执行计算后显示命中链路</p>'; return; }
  let h = '';
  r.hitChain.forEach(hc => {
    let cls = '', dot = '•';
    if (hc.rule === 'period_base_price') { cls = ''; dot = '⏰'; }
    else if (hc.rule === 'people_tier') { cls = 'tier'; dot = '👥'; }
    else if (hc.rule === 'package_price') { cls = 'package'; dot = '📦'; }
    else if (hc.rule === 'discount_limit') { cls = 'limit'; dot = '🚫'; }
    else if (hc.rule === 'multi_day') { cls = 'multi'; dot = '📅'; }
    else if (hc.rule && hc.rule.includes('discount')) { cls = 'discount'; dot = '🏷️'; }
    const label = hc.serviceName ? `${hc.label} · ${hc.serviceName}` : hc.label;
    const detail = hc.detail || (hc.periodLabel ? hc.periodLabel : '') + (hc.tierLabel ? ' ' + hc.tierLabel : '') + (hc.discountName ? ' ' + hc.discountName : '') + (hc.packageName ? ' ' + hc.packageName : '');
    const res = hc.result !== undefined ? (hc.result >= 0 ? '+' : '') + hc.result.toFixed(2) : '';
    h += `<div class="hit-chain-item"><span class="hit-chain-dot ${cls}">${dot}</span><div class="hit-chain-body"><div class="hit-chain-label">${label}</div>${detail ? `<div class="hit-chain-detail">${detail}</div>` : ''}</div>${res ? `<span class="hit-chain-result">¥${res}</span>` : ''}</div>`;
  });
  c.innerHTML = h;
}

function updateDiscountCheckboxesLockState(ld) {
  document.querySelectorAll('.discount-checkbox-item').forEach(it => {
    const inp = it.querySelector('input');
    const did = inp.id.replace('disc_', '');
    if (ld.includes(did)) { it.classList.add('locked'); inp.disabled = true; }
    else { it.classList.remove('locked'); inp.disabled = false; }
  });
}

function showPreview() {
  const m = document.getElementById('previewModal');
  const pc = document.getElementById('previewCanvas');
  const oc = document.getElementById('posterCanvas');
  pc.innerHTML = oc.innerHTML;
  pc.className = 'poster-canvas preview-mode';
  if (state.currentTemplate) {
    pc.style.setProperty('--primary-color', state.currentTemplate.primaryColor);
    pc.style.setProperty('--secondary-color', state.currentTemplate.secondaryColor);
    pc.style.setProperty('--text-color', state.currentTemplate.textColor);
    pc.style.background = `linear-gradient(180deg, ${state.currentTemplate.bgColor} 0%, #ffffff 100%)`;
  }
  m.classList.add('active');
}

function hidePreview() { document.getElementById('previewModal').classList.remove('active'); }

function clearCanvas() {
  if (state.canvasItems.length === 0) return;
  if (!confirm('确定要清空画布吗？')) return;
  pushHistory();
  state.canvasItems = []; state.pricingRules = {}; state.tieredOverrides = {};
  state.selectedItem = null; state.packages = [];
  state.booking.services = []; state.booking.equipmentRentals = [];
  renderAll();
}

function resetLayout() {
  if (!confirm('确定要重置布局和定价规则吗？')) return;
  pushHistory();
  state.canvasItems.forEach(it => {
    const m = state.serviceModules.find(x => x.id === it.id);
    if (m && state.pricingRules[it.id]) {
      state.pricingRules[it.id] = {
        weekday: { price: m.basePrice, enabled: true },
        night: { price: Math.round(m.basePrice * 0.8), enabled: true },
        weekend: { price: Math.round(m.basePrice * 1.2), enabled: true }
      };
      state.tieredOverrides[it.id] = { enabled: false, tiers: [] };
      if (m.tieredPricing?.tiers?.length) {
        state.tieredOverrides[it.id] = deepClone(m.tieredPricing);
      }
    }
  });
  state.packages = [];
  state.booking.selectedDiscounts = [];
  state.booking.memberLevel = 'normal';
  state.booking.mode = 'single';
  state.booking.dailySchedule = [{ date: 'Day 1', period: 'weekday' }];
  renderAll();
  alert('布局和定价规则已重置为默认值');
}

function exportConfig() {
  const payload = {
    serviceModules: state.serviceModules,
    pricingRules: state.pricingRules,
    tieredOverrides: state.tieredOverrides,
    packages: state.packages,
    canvasItems: state.canvasItems,
    discountTypes: state.discountTypes,
    rulePriority: state.rulePriority,
    currentTemplate: state.currentTemplate,
    templates: state.templates,
    posterConfig: state.posterConfig
  };
  fetch('http://localhost:8879/api/export-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(r => r.json()).then(res => {
    const blob = new Blob([JSON.stringify(res.config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    a.download = `ski-pricing-config-${ts}.json`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert('配置已导出');
  }).catch(err => {
    console.error(err);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    a.download = `ski-pricing-config-${ts}.json`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert('配置已导出（本地生成）');
  });
}

function importConfig(e) {
  if (!e) {
    const inp = document.getElementById('fileInput');
    inp.value = '';
    inp.click();
    return;
  }
  const f = e.target.files?.[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const cfg = JSON.parse(ev.target.result);
      fetch('http://localhost:8879/api/import-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: cfg })
      }).then(r => r.json()).then(res => {
        if (!res.valid) {
          alert('导入配置校验失败:\n' + (res.errors || []).join('\n'));
          return;
        }
        pushHistory();
        if (res.config?.serviceModules) state.serviceModules = res.config.serviceModules;
        if (res.config?.pricingRules) state.pricingRules = res.config.pricingRules;
        if (res.config?.tieredOverrides) state.tieredOverrides = res.config.tieredOverrides;
        if (res.config?.packages) state.packages = res.config.packages;
        if (res.config?.canvasItems) state.canvasItems = res.config.canvasItems;
        if (res.config?.discountTypes) state.discountTypes = res.config.discountTypes;
        if (res.config?.rulePriority) state.rulePriority = res.config.rulePriority;
        if (res.config?.currentTemplate) state.currentTemplate = res.config.currentTemplate;
        if (res.config?.templates) state.templates = res.config.templates;
        if (res.config?.posterConfig) state.posterConfig = res.config.posterConfig;
        renderAll();
        alert('配置导入成功，已完成全量校验');
      }).catch(err => {
        console.error(err);
        pushHistory();
        if (cfg.serviceModules) state.serviceModules = cfg.serviceModules;
        if (cfg.pricingRules) state.pricingRules = cfg.pricingRules;
        if (cfg.tieredOverrides) state.tieredOverrides = cfg.tieredOverrides;
        if (cfg.packages) state.packages = cfg.packages;
        if (cfg.canvasItems) state.canvasItems = cfg.canvasItems;
        if (cfg.discountTypes) state.discountTypes = cfg.discountTypes;
        if (cfg.rulePriority) state.rulePriority = cfg.rulePriority;
        if (cfg.currentTemplate) state.currentTemplate = cfg.currentTemplate;
        if (cfg.templates) state.templates = cfg.templates;
        if (cfg.posterConfig) state.posterConfig = cfg.posterConfig;
        renderAll();
        alert('配置已导入（本地降级）');
      });
    } catch (err) {
      alert('解析JSON失败: ' + err.message);
    }
  };
  reader.readAsText(f);
  e.target.value = '';
}

document.addEventListener('DOMContentLoaded', init);