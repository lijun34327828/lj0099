const ENGINE_API = 'http://localhost:8879/api';

const state = {
  currentPeriod: 'weekday',
  currentTemplate: null,
  canvasItems: [],
  pricingRules: {},
  discounts: {},
  booking: {
    period: 'weekday',
    people: 2,
    days: 1,
    services: [],
    equipmentRentals: [],
    selectedDiscounts: []
  },
  draggedItem: null,
  selectedItem: null,
  serviceModules: [],
  templates: [],
  discountTypes: [],
  mutexGroups: []
};

const MUTUALLY_EXCLUSIVE_GROUPS = [
  ['member_discount', 'coupon_discount'],
  ['early_bird', 'last_minute'],
  ['group_discount', 'promo_code']
];

const DISCOUNT_GROUPS = {
  membership: '会员类',
  timing: '时段类',
  quantity: '数量类'
};

async function init() {
  await loadInitialData();
  renderModuleLibrary();
  renderTemplates();
  renderDiscountConfig();
  renderServiceCheckboxes();
  renderDiscountCheckboxes();
  setupEventListeners();
  setupDragAndDrop();
  checkEngineConnection();
  updateCalculation();
}

async function loadInitialData() {
  try {
    const [modulesRes, templatesRes] = await Promise.all([
      fetch(`${ENGINE_API}/service-modules`),
      fetch(`${ENGINE_API}/templates`)
    ]);
    
    state.serviceModules = await modulesRes.json();
    state.templates = await templatesRes.json();
    
    if (state.templates.length > 0) {
      state.currentTemplate = state.templates[0];
      applyTemplate(state.currentTemplate);
    }
    
    state.discountTypes = [
      { id: 'member_discount', name: '会员折扣', type: 'percentage', value: 0.15, group: 'membership' },
      { id: 'coupon_discount', name: '优惠券', type: 'fixed', value: 30, group: 'membership' },
      { id: 'early_bird', name: '早鸟优惠', type: 'percentage', value: 0.20, group: 'timing' },
      { id: 'last_minute', name: '限时特惠', type: 'fixed', value: 50, group: 'timing' },
      { id: 'group_discount', name: '团购折扣', type: 'percentage', value: 0.25, group: 'quantity' },
      { id: 'promo_code', name: '优惠码', type: 'fixed', value: 80, group: 'quantity' }
    ];
    
    state.discountTypes.forEach(dt => {
      state.discounts[dt.id] = { enabled: false, value: dt.value };
    });
    
  } catch (error) {
    console.error('加载初始数据失败:', error);
  }
}

async function checkEngineConnection() {
  const statusDot = document.getElementById('engineStatus');
  const statusText = document.getElementById('engineStatusText');
  
  try {
    const response = await fetch(`${ENGINE_API}/templates`);
    if (response.ok) {
      statusDot.className = 'status-dot connected';
      statusText.textContent = '计算引擎已连接';
    } else {
      throw new Error('连接失败');
    }
  } catch (error) {
    statusDot.className = 'status-dot error';
    statusText.textContent = '计算引擎连接失败';
  }
}

function renderModuleLibrary() {
  const library = document.getElementById('moduleLibrary');
  library.innerHTML = '';
  
  state.serviceModules.forEach(module => {
    const item = document.createElement('div');
    item.className = 'module-item';
    item.draggable = true;
    item.dataset.id = module.id;
    item.innerHTML = `
      <div class="module-icon">${module.icon}</div>
      <div class="module-name">${module.name}</div>
      <div class="module-price">¥${module.basePrice}/${module.unit}</div>
    `;
    library.appendChild(item);
  });
}

function renderTemplates() {
  const grid = document.getElementById('templateGrid');
  grid.innerHTML = '';
  
  state.templates.forEach(template => {
    const item = document.createElement('div');
    item.className = 'template-item' + (state.currentTemplate && state.currentTemplate.id === template.id ? ' active' : '');
    item.dataset.id = template.id;
    item.innerHTML = `
      <div class="template-preview" style="background: linear-gradient(135deg, ${template.primaryColor}, ${template.secondaryColor}); color: white;">
        Aa
      </div>
      <div class="template-name">${template.name}</div>
    `;
    item.addEventListener('click', () => selectTemplate(template.id));
    grid.appendChild(item);
  });
}

function renderDiscountConfig() {
  const config = document.getElementById('discountConfig');
  config.innerHTML = '';
  
  const groups = {};
  state.discountTypes.forEach(dt => {
    if (!groups[dt.group]) groups[dt.group] = [];
    groups[dt.group].push(dt);
  });
  
  for (const [group, discounts] of Object.entries(groups)) {
    const groupLabel = document.createElement('div');
    groupLabel.style.cssText = 'font-size: 11px; color: #64748b; margin: 8px 0 4px; padding-left: 4px;';
    groupLabel.textContent = DISCOUNT_GROUPS[group] || group;
    config.appendChild(groupLabel);
    
    discounts.forEach(discount => {
      const isEnabled = state.discounts[discount.id]?.enabled;
      const isLocked = isDiscountLocked(discount.id);
      
      const item = document.createElement('div');
      item.className = 'discount-item' + (isEnabled ? ' enabled' : '') + (isLocked ? ' locked' : '');
      item.dataset.id = discount.id;
      
      const displayValue = discount.type === 'percentage' 
        ? `${Math.round(discount.value * 100)}%` 
        : `¥${discount.value}`;
      
      item.innerHTML = `
        <div class="discount-checkbox"></div>
        <div class="discount-info">
          <div class="discount-name">${discount.name}</div>
          <div class="discount-value">${displayValue}</div>
        </div>
        ${hasMutexConflict(discount.id) && isEnabled ? '<span class="mutex-tag">互斥</span>' : ''}
      `;
      
      item.addEventListener('click', () => toggleDiscount(discount.id));
      config.appendChild(item);
    });
  }
}

function hasMutexConflict(discountId) {
  if (!state.discounts[discountId]?.enabled) return false;
  
  for (const group of MUTUALLY_EXCLUSIVE_GROUPS) {
    if (group.includes(discountId)) {
      const enabledInGroup = group.filter(id => state.discounts[id]?.enabled);
      if (enabledInGroup.length > 1) return true;
    }
  }
  return false;
}

function isDiscountLocked(discountId) {
  return false;
}

function toggleDiscount(discountId) {
  const currentlyEnabled = state.discounts[discountId]?.enabled;
  
  if (!currentlyEnabled) {
    for (const group of MUTUALLY_EXCLUSIVE_GROUPS) {
      if (group.includes(discountId)) {
        const otherEnabled = group.find(id => id !== discountId && state.discounts[id]?.enabled);
        if (otherEnabled) {
          const otherDiscount = state.discountTypes.find(d => d.id === otherEnabled);
          if (!confirm(`该折扣与「${otherDiscount.name}」互斥，是否替换？`)) {
            return;
          }
          state.discounts[otherEnabled].enabled = false;
        }
      }
    }
  }
  
  state.discounts[discountId].enabled = !currentlyEnabled;
  
  const simDiscounts = state.booking.selectedDiscounts;
  const idx = simDiscounts.indexOf(discountId);
  if (state.discounts[discountId].enabled) {
    if (idx === -1) simDiscounts.push(discountId);
  } else {
    if (idx > -1) simDiscounts.splice(idx, 1);
  }
  
  renderDiscountConfig();
  renderDiscountCheckboxes();
  validateRules();
  updateCalculation();
}

function renderServiceCheckboxes() {
  const container = document.getElementById('serviceCheckboxes');
  container.innerHTML = '';
  
  state.serviceModules.forEach(module => {
    const isSelected = state.booking.services.some(s => s.id === module.id) ||
                       state.booking.equipmentRentals.some(e => e.id === module.id);
    
    const item = document.createElement('div');
    item.className = 'service-checkbox-item';
    item.innerHTML = `
      <input type="checkbox" id="srv_${module.id}" ${isSelected ? 'checked' : ''}>
      <span>${module.icon} ${module.name}</span>
      <span style="margin-left: auto; color: #f59e0b; font-size: 11px;">¥${module.basePrice}</span>
    `;
    
    const checkbox = item.querySelector('input');
    checkbox.addEventListener('change', () => toggleBookingService(module.id, checkbox.checked));
    container.appendChild(item);
  });
}

function toggleBookingService(serviceId, checked) {
  const module = state.serviceModules.find(m => m.id === serviceId);
  if (!module) return;
  
  const isEquipment = module.category === 'equipment';
  
  if (checked) {
    if (isEquipment) {
      if (!state.booking.equipmentRentals.some(e => e.id === serviceId)) {
        state.booking.equipmentRentals.push({
          id: serviceId,
          quantity: 1,
          days: state.booking.days
        });
      }
    } else {
      if (!state.booking.services.some(s => s.id === serviceId)) {
        state.booking.services.push({
          id: serviceId,
          quantity: 1
        });
      }
    }
  } else {
    if (isEquipment) {
      state.booking.equipmentRentals = state.booking.equipmentRentals.filter(e => e.id !== serviceId);
    } else {
      state.booking.services = state.booking.services.filter(s => s.id !== serviceId);
    }
  }
  
  updateCalculation();
}

function renderDiscountCheckboxes() {
  const container = document.getElementById('discountCheckboxes');
  container.innerHTML = '';
  
  state.discountTypes.forEach(discount => {
    const isSelected = state.booking.selectedDiscounts.includes(discount.id);
    const isLocked = false;
    
    const displayValue = discount.type === 'percentage' 
      ? `${Math.round(discount.value * 100)}%` 
      : `¥${discount.value}`;
    
    const item = document.createElement('div');
    item.className = 'discount-checkbox-item' + (isLocked ? ' locked' : '');
    item.innerHTML = `
      <input type="checkbox" id="disc_${discount.id}" ${isSelected ? 'checked' : ''} ${isLocked ? 'disabled' : ''}>
      <span>${discount.name}</span>
      <span style="margin-left: auto; color: #10b981; font-size: 11px;">-${displayValue}</span>
    `;
    
    const checkbox = item.querySelector('input');
    checkbox.addEventListener('change', () => toggleBookingDiscount(discount.id, checkbox.checked));
    container.appendChild(item);
  });
}

function toggleBookingDiscount(discountId, checked) {
  const idx = state.booking.selectedDiscounts.indexOf(discountId);
  
  if (checked) {
    for (const group of MUTUALLY_EXCLUSIVE_GROUPS) {
      if (group.includes(discountId)) {
        const otherSelected = group.find(id => id !== discountId && state.booking.selectedDiscounts.includes(id));
        if (otherSelected) {
          const otherDiscount = state.discountTypes.find(d => d.id === otherSelected);
          if (!confirm(`该折扣与「${otherDiscount.name}」互斥，是否替换？`)) {
            const checkbox = document.getElementById(`disc_${discountId}`);
            if (checkbox) checkbox.checked = false;
            return;
          }
          state.booking.selectedDiscounts = state.booking.selectedDiscounts.filter(id => id !== otherSelected);
          const otherCheckbox = document.getElementById(`disc_${otherSelected}`);
          if (otherCheckbox) otherCheckbox.checked = false;
        }
      }
    }
    
    if (idx === -1) {
      state.booking.selectedDiscounts.push(discountId);
    }
  } else {
    if (idx > -1) {
      state.booking.selectedDiscounts.splice(idx, 1);
    }
  }
  
  updateCalculation();
}

function setupEventListeners() {
  document.querySelectorAll('.period-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.period-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.currentPeriod = tab.dataset.period;
      renderRuleConfig();
      validateRules();
    });
  });
  
  document.getElementById('simPeriod').addEventListener('change', (e) => {
    state.booking.period = e.target.value;
    updateCalculation();
  });
  
  document.getElementById('simPeople').addEventListener('input', (e) => {
    state.booking.people = parseInt(e.target.value) || 1;
    updateCalculation();
  });
  
  document.getElementById('simDays').addEventListener('input', (e) => {
    state.booking.days = parseInt(e.target.value) || 1;
    state.booking.equipmentRentals.forEach(e => {
      e.days = state.booking.days;
    });
    updateCalculation();
  });
  
  document.getElementById('btnPreview').addEventListener('click', showPreview);
  document.getElementById('previewClose').addEventListener('click', hidePreview);
  document.querySelector('.preview-overlay').addEventListener('click', hidePreview);
  
  document.getElementById('btnClear').addEventListener('click', clearCanvas);
  document.getElementById('btnReset').addEventListener('click', resetLayout);
}

function setupDragAndDrop() {
  const libraryItems = document.querySelectorAll('.module-item');
  const canvas = document.getElementById('posterContent');
  
  libraryItems.forEach(item => {
    item.addEventListener('dragstart', handleDragStart);
    item.addEventListener('dragend', handleDragEnd);
  });
  
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
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  document.getElementById('posterCanvas').classList.add('drag-over');
}

function handleDragLeave(e) {
  if (!e.currentTarget.contains(e.relatedTarget)) {
    document.getElementById('posterCanvas').classList.remove('drag-over');
  }
}

function handleDrop(e) {
  e.preventDefault();
  document.getElementById('posterCanvas').classList.remove('drag-over');
  
  const moduleId = state.draggedItem;
  if (!moduleId) return;
  
  if (state.canvasItems.some(item => item.id === moduleId)) {
    return;
  }
  
  const module = state.serviceModules.find(m => m.id === moduleId);
  if (!module) return;
  
  state.canvasItems.push({
    id: module.id,
    name: module.name,
    icon: module.icon,
    description: module.description,
    basePrice: module.basePrice,
    order: state.canvasItems.length
  });
  
  if (!state.pricingRules[module.id]) {
    state.pricingRules[module.id] = {
      weekday: { price: module.basePrice, enabled: true },
      night: { price: module.basePrice * 0.8, enabled: true },
      weekend: { price: module.basePrice * 1.2, enabled: true }
    };
  }
  
  renderCanvas();
  renderRuleConfig();
  validateRules();
}

function renderCanvas() {
  const content = document.getElementById('posterContent');
  
  if (state.canvasItems.length === 0) {
    content.innerHTML = `
      <div class="empty-hint">
        <p>👆 从左侧拖拽服务模块到这里</p>
        <p class="hint-sub">自由排版 · 实时预览</p>
      </div>
    `;
    return;
  }
  
  content.innerHTML = '';
  
  state.canvasItems.forEach((item, index) => {
    const priceInfo = state.pricingRules[item.id]?.[state.currentPeriod];
    const displayPrice = priceInfo?.price || item.basePrice;
    
    const element = document.createElement('div');
    element.className = 'poster-item' + (state.selectedItem === item.id ? ' selected' : '');
    element.dataset.id = item.id;
    element.draggable = true;
    element.innerHTML = `
      <button class="poster-item-delete" onclick="event.stopPropagation(); deleteItem('${item.id}')">×</button>
      <div class="poster-item-header">
        <span class="poster-item-icon">${item.icon}</span>
        <span class="poster-item-name">${item.name}</span>
        <span class="poster-item-price">¥${Math.round(displayPrice)}</span>
      </div>
      <div class="poster-item-desc">${item.description || ''}</div>
    `;
    
    element.addEventListener('click', () => selectItem(item.id));
    element.addEventListener('dragstart', handleCanvasItemDragStart);
    element.addEventListener('dragend', handleCanvasItemDragEnd);
    element.addEventListener('dragover', handleCanvasItemDragOver);
    element.addEventListener('drop', handleCanvasItemDrop);
    
    content.appendChild(element);
  });
  
  setupCanvasItemDrag();
}

let draggedCanvasItem = null;

function setupCanvasItemDrag() {
  const items = document.querySelectorAll('.poster-item');
}

function handleCanvasItemDragStart(e) {
  draggedCanvasItem = e.target.closest('.poster-item').dataset.id;
  e.dataTransfer.effectAllowed = 'move';
  e.target.closest('.poster-item').style.opacity = '0.5';
}

function handleCanvasItemDragEnd(e) {
  e.target.closest('.poster-item').style.opacity = '1';
  draggedCanvasItem = null;
}

function handleCanvasItemDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handleCanvasItemDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  
  const targetId = e.target.closest('.poster-item').dataset.id;
  if (!draggedCanvasItem || draggedCanvasItem === targetId) return;
  
  const fromIdx = state.canvasItems.findIndex(i => i.id === draggedCanvasItem);
  const toIdx = state.canvasItems.findIndex(i => i.id === targetId);
  
  if (fromIdx > -1 && toIdx > -1) {
    const [removed] = state.canvasItems.splice(fromIdx, 1);
    state.canvasItems.splice(toIdx, 0, removed);
    renderCanvas();
  }
}

function deleteItem(itemId) {
  state.canvasItems = state.canvasItems.filter(i => i.id !== itemId);
  delete state.pricingRules[itemId];
  
  state.booking.services = state.booking.services.filter(s => s.id !== itemId);
  state.booking.equipmentRentals = state.booking.equipmentRentals.filter(e => e.id !== itemId);
  
  renderCanvas();
  renderRuleConfig();
  renderServiceCheckboxes();
  validateRules();
  updateCalculation();
}

function selectItem(itemId) {
  state.selectedItem = itemId;
  renderCanvas();
}

function renderRuleConfig() {
  const config = document.getElementById('ruleConfig');
  
  if (state.canvasItems.length === 0) {
    config.innerHTML = '<p class="section-hint">请先从左侧拖拽服务模块到画布</p>';
    return;
  }
  
  config.innerHTML = '';
  
  state.canvasItems.forEach(item => {
    const ruleItem = document.createElement('div');
    ruleItem.className = 'rule-item';
    
    const prices = state.pricingRules[item.id] || {};
    const currentPrice = prices[state.currentPeriod]?.price || item.basePrice;
    
    ruleItem.innerHTML = `
      <div class="rule-item-header">
        <span class="rule-item-icon">${item.icon}</span>
        <span class="rule-item-name">${item.name}</span>
      </div>
      <div class="price-input-group">
        <label>平日</label>
        <input type="number" value="${prices.weekday?.price || item.basePrice}" 
               data-id="${item.id}" data-period="weekday" min="0" step="1">
      </div>
      <div class="price-input-group" style="margin-top: 4px;">
        <label>夜间</label>
        <input type="number" value="${prices.night?.price || Math.round(item.basePrice * 0.8)}" 
               data-id="${item.id}" data-period="night" min="0" step="1">
      </div>
      <div class="price-input-group" style="margin-top: 4px;">
        <label>周末</label>
        <input type="number" value="${prices.weekend?.price || Math.round(item.basePrice * 1.2)}" 
               data-id="${item.id}" data-period="weekend" min="0" step="1">
      </div>
    `;
    
    config.appendChild(ruleItem);
  });
  
  config.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', handlePriceChange);
  });
}

function handlePriceChange(e) {
  const id = e.target.dataset.id;
  const period = e.target.dataset.period;
  const price = parseFloat(e.target.value) || 0;
  
  if (!state.pricingRules[id]) {
    state.pricingRules[id] = {};
  }
  if (!state.pricingRules[id][period]) {
    state.pricingRules[id][period] = {};
  }
  state.pricingRules[id][period].price = price;
  
  if (period === state.currentPeriod) {
    renderCanvas();
  }
  
  if (state.currentTemplate) {
    syncPricingToTemplate(id);
  }
  
  validateRules();
  updateCalculation();
}

function syncPricingToTemplate(serviceId) {
  console.log(`模板 ${state.currentTemplate.id} 定价已同步更新: ${serviceId}`);
}

function selectTemplate(templateId) {
  const template = state.templates.find(t => t.id === templateId);
  if (!template) return;
  
  state.currentTemplate = template;
  applyTemplate(template);
  renderTemplates();
  
  console.log(`切换到模板: ${template.name}，定价参数同步联动`);
}

function applyTemplate(template) {
  const canvas = document.getElementById('posterCanvas');
  canvas.style.setProperty('--primary-color', template.primaryColor);
  canvas.style.setProperty('--secondary-color', template.secondaryColor);
  canvas.style.setProperty('--text-color', template.textColor);
  canvas.style.background = `linear-gradient(180deg, ${template.bgColor} 0%, #ffffff 100%)`;
}

async function validateRules() {
  const rules = [];
  
  for (const [serviceId, periods] of Object.entries(state.pricingRules)) {
    for (const [period, data] of Object.entries(periods)) {
      if (data.enabled !== false) {
        rules.push({
          serviceId,
          period,
          price: data.price,
          enabled: true,
          discountType: null
        });
      }
    }
  }
  
  const enabledDiscounts = Object.entries(state.discounts)
    .filter(([id, d]) => d.enabled)
    .map(([id, d]) => id);
  
  enabledDiscounts.forEach(discountId => {
    rules.push({
      serviceId: 'discount_' + discountId,
      period: state.currentPeriod,
      discountType: discountId,
      enabled: true
    });
  });
  
  try {
    const response = await fetch(`${ENGINE_API}/validate-rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules })
    });
    
    const result = await response.json();
    displayValidationResult(result);
  } catch (error) {
    validateRulesLocally(rules);
  }
}

function validateRulesLocally(rules) {
  const errors = [];
  const warnings = [];
  
  const periodRules = {};
  rules.forEach(rule => {
    if (!periodRules[rule.period]) {
      periodRules[rule.period] = [];
    }
    periodRules[rule.period].push(rule);
  });
  
  for (const [period, periodRuleList] of Object.entries(periodRules)) {
    const activeDiscounts = periodRuleList.filter(r => r.enabled && r.discountType);
    const discountIds = activeDiscounts.map(r => r.discountType);
    
    for (const group of MUTUALLY_EXCLUSIVE_GROUPS) {
      const foundInGroup = group.filter(d => discountIds.includes(d));
      if (foundInGroup.length > 1) {
        const discountNames = foundInGroup.map(id => {
          const dt = state.discountTypes.find(d => d.id === id);
          return dt ? dt.name : id;
        }).join('、');
        errors.push({
          type: 'mutex_conflict',
          period,
          message: `${getPeriodLabel(period)}时段存在互斥折扣冲突：${discountNames} 不能同时使用`,
          conflictingDiscounts: foundInGroup
        });
      }
    }
  }
  
  displayValidationResult({ valid: errors.length === 0, errors, warnings });
}

function getPeriodLabel(period) {
  const labels = { weekday: '平日', night: '夜间', weekend: '周末' };
  return labels[period] || period;
}

function displayValidationResult(result) {
  const content = document.getElementById('validationContent');
  
  if (!result) {
    content.innerHTML = '<p class="validation-placeholder">配置定价规则后自动校验</p>';
    return;
  }
  
  let html = '';
  
  if (result.errors && result.errors.length > 0) {
    result.errors.forEach(error => {
      html += `<div class="validation-error">
        <span>❌</span>
        <span>${error.message}</span>
      </div>`;
    });
  }
  
  if (result.warnings && result.warnings.length > 0) {
    result.warnings.forEach(warning => {
      html += `<div class="validation-warning">
        <span>⚠️</span>
        <span>${warning.message}</span>
      </div>`;
    });
  }
  
  if (result.valid && (!result.errors || result.errors.length === 0)) {
    const warningCount = result.warnings ? result.warnings.length : 0;
    if (warningCount === 0) {
      html = '<div class="validation-success">✅ 所有规则校验通过，无互斥冲突</div>';
    }
  }
  
  content.innerHTML = html || '<p class="validation-placeholder">配置定价规则后自动校验</p>';
}

async function updateCalculation() {
  const services = state.booking.services.map(s => {
    const customPrice = state.pricingRules[s.id]?.[state.booking.period]?.price;
    return {
      id: s.id,
      quantity: s.quantity,
      customPrice: customPrice
    };
  });
  
  const equipmentRentals = state.booking.equipmentRentals.map(e => {
    const customPrice = state.pricingRules[e.id]?.[state.booking.period]?.price;
    return {
      id: e.id,
      quantity: e.quantity,
      days: state.booking.days,
      customPrice: customPrice
    };
  });
  
  const discounts = state.booking.selectedDiscounts.map(dId => {
    const dt = state.discountTypes.find(d => d.id === dId);
    return {
      type: dId,
      enabled: true,
      value: dt ? dt.value : 0
    };
  });
  
  const payload = {
    period: state.booking.period,
    people: state.booking.people,
    services,
    equipmentRentals,
    discounts
  };
  
  try {
    const response = await fetch(`${ENGINE_API}/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    displayCalculationResult(result);
  } catch (error) {
    calculateLocally(payload);
  }
}

function calculateLocally(input) {
  const { period = 'weekday', people = 1, services = [], equipmentRentals = [], discounts = [] } = input;
  
  const BILLING_PER_PERSON = 'per_person';
  const breakdown = [];
  let subtotal = 0;
  const safePeople = people > 0 ? people : 1;
  
  services.forEach(service => {
    const module = state.serviceModules.find(m => m.id === service.id);
    if (module) {
      const customPrice = state.pricingRules[service.id]?.[period]?.price;
      const periodPrice = customPrice !== undefined ? customPrice : module.basePrice;
      const baseQuantity = service.quantity || 1;
      const isPerPerson = module.billingDimension === BILLING_PER_PERSON;
      const quantity = isPerPerson ? baseQuantity * safePeople : baseQuantity;
      const amount = periodPrice * quantity;
      subtotal += amount;
      breakdown.push({
        type: 'service',
        name: module.name,
        unitPrice: periodPrice,
        quantity,
        amount,
        icon: module.icon
      });
    }
  });
  
  equipmentRentals.forEach(item => {
    const module = state.serviceModules.find(m => m.id === item.id);
    if (module) {
      const customPrice = state.pricingRules[item.id]?.[period]?.price;
      const periodPrice = customPrice !== undefined ? customPrice : module.basePrice;
      const baseQuantity = item.quantity || 1;
      const isPerPerson = module.billingDimension === BILLING_PER_PERSON;
      const quantity = isPerPerson ? baseQuantity * safePeople : baseQuantity;
      const days = item.days || 1;
      const amount = periodPrice * quantity * days;
      subtotal += amount;
      breakdown.push({
        type: 'equipment',
        name: module.name,
        unitPrice: periodPrice,
        quantity: `${quantity}${module.unit.split('/')[0]}×${days}天`,
        amount,
        icon: module.icon
      });
    }
  });
  
  let totalDiscount = 0;
  const discountBreakdown = [];
  const appliedDiscounts = [];
  const mutexErrors = [];
  
  const discountIds = discounts.filter(d => d.enabled).map(d => d.type);
  for (const group of MUTUALLY_EXCLUSIVE_GROUPS) {
    const foundInGroup = group.filter(d => discountIds.includes(d));
    if (foundInGroup.length > 1) {
      const discountNames = foundInGroup.map(id => {
        const dt = state.discountTypes.find(d => d.id === id);
        return dt ? dt.name : id;
      }).join('、');
      mutexErrors.push({ group, message: `互斥冲突：${discountNames} 不能同时使用` });
    }
  }
  
  discounts.filter(d => d.enabled).forEach(discount => {
    const dt = state.discountTypes.find(d => d.id === discount.type);
    if (!dt) return;
    
    let discountAmount = 0;
    if (dt.type === 'percentage') {
      discountAmount = subtotal * (discount.value || dt.value);
    } else if (dt.type === 'fixed') {
      discountAmount = discount.value || dt.value;
    }
    
    discountBreakdown.push({
      type: discount.type,
      name: dt.name,
      amount: discountAmount,
      discountType: dt.type,
      value: discount.value || dt.value
    });
    totalDiscount += discountAmount;
    appliedDiscounts.push(discount.type);
  });
  
  const DISCOUNT_LIMIT_RATIO = 0.30;
  const maxDiscount = subtotal * DISCOUNT_LIMIT_RATIO;
  const discountExceeded = totalDiscount > maxDiscount;
  let finalDiscount = totalDiscount;
  let lockedDiscounts = [];
  
  if (discountExceeded) {
    const discountSorted = [...discounts.filter(d => d.enabled)].sort((a, b) => {
      const dtA = state.discountTypes.find(d => d.id === a.type);
      const dtB = state.discountTypes.find(d => d.id === b.type);
      const valA = dtA && dtA.type === 'percentage' ? subtotal * (a.value || dtA.value) : (a.value || (dtA ? dtA.value : 0));
      const valB = dtB && dtB.type === 'percentage' ? subtotal * (b.value || dtB.value) : (b.value || (dtB ? dtB.value : 0));
      return valB - valA;
    });
    
    let accumulated = 0;
    let remainingDiscounts = [];
    for (const d of discountSorted) {
      const dt = state.discountTypes.find(disc => disc.id === d.type);
      let dAmount = 0;
      if (dt.type === 'percentage') {
        dAmount = subtotal * (d.value || dt.value);
      } else {
        dAmount = d.value || dt.value;
      }
      
      if (accumulated + dAmount <= maxDiscount) {
        accumulated += dAmount;
        remainingDiscounts.push(d.type);
      } else {
        lockedDiscounts.push(d.type);
      }
    }
    finalDiscount = accumulated;
  }
  
  const finalTotal = Math.max(0, subtotal - finalDiscount);
  
  const result = {
    subtotal: Math.round(subtotal * 100) / 100,
    totalDiscount: Math.round(finalDiscount * 100) / 100,
    maxAllowedDiscount: Math.round(maxDiscount * 100) / 100,
    discountLimitRatio: DISCOUNT_LIMIT_RATIO,
    finalTotal: Math.round(finalTotal * 100) / 100,
    period,
    people,
    breakdown,
    discountBreakdown: discountBreakdown.filter(d => !lockedDiscounts.includes(d.type)),
    discountExceeded,
    lockedDiscounts,
    mutexErrors,
    appliedDiscounts: appliedDiscounts.filter(d => !lockedDiscounts.includes(d)),
    discountLimitReached: discountExceeded
  };
  
  displayCalculationResult(result);
}

function displayCalculationResult(result) {
  const container = document.getElementById('calculationResult');
  
  if (!result || result.breakdown.length === 0) {
    container.innerHTML = '<div class="result-placeholder">选择服务后自动计算</div>';
    return;
  }
  
  let html = '<div class="result-breakdown">';
  
  result.breakdown.forEach(item => {
    html += `<div class="result-item">
      <span class="result-label">${item.icon} ${item.name} × ${item.quantity}</span>
      <span>¥${item.amount.toFixed(2)}</span>
    </div>`;
  });
  
  if (result.discountBreakdown && result.discountBreakdown.length > 0) {
    result.discountBreakdown.forEach(d => {
      html += `<div class="result-item discount-item">
        <span class="result-label">🏷️ ${d.name}</span>
        <span>-¥${d.amount.toFixed(2)}</span>
      </div>`;
    });
  }
  
  html += '</div>';
  
  html += '<div class="result-divider"></div>';
  
  html += `<div class="result-subtotal">
    <span>商品小计</span>
    <span>¥${result.subtotal.toFixed(2)}</span>
  </div>`;
  
  if (result.totalDiscount > 0) {
    html += `<div class="result-subtotal" style="color: #10b981;">
      <span>优惠减免</span>
      <span>-¥${result.totalDiscount.toFixed(2)}</span>
    </div>`;
  }
  
  html += `<div class="result-total">
    <span class="result-total-label">应付总价</span>
    <span class="result-total-value">¥${result.finalTotal.toFixed(2)}</span>
  </div>`;
  
  const discountPercent = result.subtotal > 0 ? (result.totalDiscount / result.subtotal) * 100 : 0;
  const maxDiscountPercent = result.discountLimitRatio * 100;
  const progressPercent = Math.min(discountPercent / maxDiscountPercent * 100, 100);
  
  html += `<div class="discount-limit-bar">
    <div class="discount-limit-label">
      <span>优惠额度使用</span>
      <span>${discountPercent.toFixed(1)}% / ${maxDiscountPercent}%</span>
    </div>
    <div class="discount-limit-progress">
      <div class="discount-limit-fill" style="width: ${progressPercent}%;"></div>
    </div>
    ${result.discountExceeded ? '<div class="discount-limit-warning">⚠️ 优惠已超限，部分折扣自动锁定</div>' : ''}
  </div>`;
  
  if (result.lockedDiscounts && result.lockedDiscounts.length > 0) {
    html += '<div style="margin-top: 8px; font-size: 11px; color: #f87171;">';
    html += '已锁定折扣: ';
    result.lockedDiscounts.forEach(dId => {
      const dt = state.discountTypes.find(d => d.id === dId);
      if (dt) html += dt.name + '、';
    });
    html = html.slice(0, -1);
    html += '</div>';
  }
  
  container.innerHTML = html;
  
  updateDiscountCheckboxesLockState(result.lockedDiscounts || []);
}

function updateDiscountCheckboxesLockState(lockedDiscounts) {
  const items = document.querySelectorAll('.discount-checkbox-item');
  items.forEach(item => {
    const input = item.querySelector('input');
    const discountId = input.id.replace('disc_', '');
    if (lockedDiscounts.includes(discountId)) {
      item.classList.add('locked');
      input.disabled = true;
    } else {
      item.classList.remove('locked');
      input.disabled = false;
    }
  });
}

function showPreview() {
  const modal = document.getElementById('previewModal');
  const previewCanvas = document.getElementById('previewCanvas');
  const originalCanvas = document.getElementById('posterCanvas');
  
  previewCanvas.innerHTML = originalCanvas.innerHTML;
  previewCanvas.className = 'poster-canvas preview-mode';
  
  if (state.currentTemplate) {
    previewCanvas.style.setProperty('--primary-color', state.currentTemplate.primaryColor);
    previewCanvas.style.setProperty('--secondary-color', state.currentTemplate.secondaryColor);
    previewCanvas.style.setProperty('--text-color', state.currentTemplate.textColor);
    previewCanvas.style.background = `linear-gradient(180deg, ${state.currentTemplate.bgColor} 0%, #ffffff 100%)`;
  }
  
  modal.classList.add('active');
}

function hidePreview() {
  document.getElementById('previewModal').classList.remove('active');
}

function clearCanvas() {
  if (state.canvasItems.length === 0) return;
  if (!confirm('确定要清空画布吗？')) return;
  
  state.canvasItems = [];
  state.pricingRules = {};
  state.selectedItem = null;
  
  state.booking.services = [];
  state.booking.equipmentRentals = [];
  
  renderCanvas();
  renderRuleConfig();
  renderServiceCheckboxes();
  validateRules();
  updateCalculation();
}

function resetLayout() {
  if (!confirm('确定要重置布局和定价规则吗？')) return;
  
  state.canvasItems.forEach(item => {
    const module = state.serviceModules.find(m => m.id === item.id);
    if (module && state.pricingRules[item.id]) {
      state.pricingRules[item.id] = {
        weekday: { price: module.basePrice, enabled: true },
        night: { price: Math.round(module.basePrice * 0.8), enabled: true },
        weekend: { price: Math.round(module.basePrice * 1.2), enabled: true }
      };
    }
  });
  
  renderCanvas();
  renderRuleConfig();
  validateRules();
  updateCalculation();
}

document.addEventListener('DOMContentLoaded', init);
