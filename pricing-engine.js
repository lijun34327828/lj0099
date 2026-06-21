const DISCOUNT_LIMIT_RATIO = 0.30;

const TIME_PERIODS = {
  weekday: { label: '平日', color: '#3B82F6' },
  night: { label: '夜间', color: '#8B5CF6' },
  weekend: { label: '周末', color: '#F59E0B' }
};

const MUTUALLY_EXCLUSIVE_GROUPS = [
  ['member_discount', 'coupon_discount'],
  ['early_bird', 'last_minute'],
  ['group_discount', 'promo_code']
];

const serviceModules = [
  {
    id: 'ski_basic',
    name: '基础滑雪',
    category: 'sports',
    basePrice: 199,
    unit: '人次',
    icon: '⛷️',
    description: '含雪具租赁'
  },
  {
    id: 'ski_advanced',
    name: '高级滑雪道',
    category: 'sports',
    basePrice: 299,
    unit: '人次',
    icon: '🏂',
    description: '专业雪道+教练'
  },
  {
    id: 'snowboard',
    name: '单板滑雪',
    category: 'sports',
    basePrice: 259,
    unit: '人次',
    icon: '🎿',
    description: '单板装备全套'
  },
  {
    id: 'ski_suit_rental',
    name: '滑雪服租赁',
    category: 'equipment',
    basePrice: 80,
    unit: '套/天',
    icon: '🧥',
    description: '上衣+裤子'
  },
  {
    id: 'helmet_rental',
    name: '头盔租赁',
    category: 'equipment',
    basePrice: 30,
    unit: '个/天',
    icon: '⛑️',
    description: '专业防护头盔'
  },
  {
    id: 'goggles_rental',
    name: '雪镜租赁',
    category: 'equipment',
    basePrice: 40,
    unit: '副/天',
    icon: '🥽',
    description: '防雾滑雪镜'
  },
  {
    id: 'locker',
    name: '储物柜',
    category: 'service',
    basePrice: 25,
    unit: '个/天',
    icon: '🗄️',
    description: '大号储物柜'
  },
  {
    id: 'lesson_1v1',
    name: '1对1私教',
    category: 'service',
    basePrice: 500,
    unit: '小时',
    icon: '👨‍🏫',
    description: '专业教练一对一'
  },
  {
    id: 'lesson_group',
    name: '团体课程',
    category: 'service',
    basePrice: 150,
    unit: '人次',
    icon: '👥',
    description: '5人以上团体课'
  },
  {
    id: 'food_coupon',
    name: '餐饮代金券',
    category: 'service',
    basePrice: 50,
    unit: '张',
    icon: '🍱',
    description: '山顶餐厅通用'
  }
];

const discountTypes = [
  { id: 'member_discount', name: '会员折扣', type: 'percentage', value: 0.15, group: 'membership' },
  { id: 'coupon_discount', name: '优惠券', type: 'fixed', value: 30, group: 'membership' },
  { id: 'early_bird', name: '早鸟优惠', type: 'percentage', value: 0.20, group: 'timing' },
  { id: 'last_minute', name: '限时特惠', type: 'fixed', value: 50, group: 'timing' },
  { id: 'group_discount', name: '团购折扣', type: 'percentage', value: 0.25, group: 'quantity' },
  { id: 'promo_code', name: '优惠码', type: 'fixed', value: 80, group: 'quantity' }
];

const templates = [
  {
    id: 'classic_blue',
    name: '经典蓝',
    primaryColor: '#1E40AF',
    secondaryColor: '#3B82F6',
    bgColor: '#EFF6FF',
    textColor: '#1E3A8A',
    fontStyle: 'modern',
    layout: 'standard'
  },
  {
    id: 'warm_orange',
    name: '暖橙活力',
    primaryColor: '#EA580C',
    secondaryColor: '#F59E0B',
    bgColor: '#FFF7ED',
    textColor: '#9A3412',
    fontStyle: 'bold',
    layout: 'compact'
  },
  {
    id: 'elegant_purple',
    name: '优雅紫',
    primaryColor: '#7C3AED',
    secondaryColor: '#A78BFA',
    bgColor: '#F5F3FF',
    textColor: '#5B21B6',
    fontStyle: 'elegant',
    layout: 'premium'
  },
  {
    id: 'fresh_green',
    name: '清新绿',
    primaryColor: '#059669',
    secondaryColor: '#34D399',
    bgColor: '#ECFDF5',
    textColor: '#065F46',
    fontStyle: 'fresh',
    layout: 'minimal'
  }
];

function validateRules(rules) {
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
          const dt = discountTypes.find(d => d.id === id);
          return dt ? dt.name : id;
        }).join('、');
        errors.push({
          type: 'mutex_conflict',
          period,
          message: `${TIME_PERIODS[period].label}时段存在互斥折扣冲突：${discountNames} 不能同时使用`,
          conflictingDiscounts: foundInGroup
        });
      }
    }
  }
  
  const modulePrices = {};
  rules.forEach(rule => {
    if (!modulePrices[rule.serviceId]) {
      modulePrices[rule.serviceId] = {};
    }
    if (rule.price !== undefined && rule.price !== null) {
      modulePrices[rule.serviceId][rule.period] = rule.price;
    }
  });
  
  for (const [serviceId, prices] of Object.entries(modulePrices)) {
    const service = serviceModules.find(s => s.id === serviceId);
    if (service) {
      const weekendPrice = prices.weekend;
      const weekdayPrice = prices.weekday;
      if (weekendPrice !== undefined && weekdayPrice !== undefined && weekendPrice < weekdayPrice) {
        warnings.push({
          type: 'price_abnormal',
          serviceId,
          message: `${service.name} 周末价格(${weekendPrice}元)低于平日价格(${weekdayPrice}元)，请确认是否正确`
        });
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

function calculateTotal(input) {
  const { period = 'weekday', people = 1, services = [], equipmentRentals = [], discounts = [] } = input;
  
  const breakdown = [];
  let subtotal = 0;
  
  services.forEach(service => {
    const module = serviceModules.find(m => m.id === service.id);
    if (module) {
      const periodPrice = getPeriodPrice(module, period, service.customPrice);
      const quantity = service.quantity || 1;
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
    const module = serviceModules.find(m => m.id === item.id);
    if (module) {
      const periodPrice = getPeriodPrice(module, period, item.customPrice);
      const quantity = item.quantity || 1;
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
  
  const peopleMultiplier = people > 0 ? people : 1;
  subtotal = subtotal;
  
  let totalDiscount = 0;
  const discountBreakdown = [];
  const appliedDiscounts = [];
  const mutexErrors = [];
  
  const discountIds = discounts.filter(d => d.enabled).map(d => d.type);
  for (const group of MUTUALLY_EXCLUSIVE_GROUPS) {
    const foundInGroup = group.filter(d => discountIds.includes(d));
    if (foundInGroup.length > 1) {
      const discountNames = foundInGroup.map(id => {
        const dt = discountTypes.find(d => d.id === id);
        return dt ? dt.name : id;
      }).join('、');
      mutexErrors.push({
        group,
        message: `互斥冲突：${discountNames} 不能同时使用`
      });
    }
  }
  
  discounts.filter(d => d.enabled).forEach(discount => {
    const dt = discountTypes.find(d => d.id === discount.type);
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
  
  const maxDiscount = subtotal * DISCOUNT_LIMIT_RATIO;
  const discountExceeded = totalDiscount > maxDiscount;
  let finalDiscount = totalDiscount;
  let lockedDiscounts = [];
  
  if (discountExceeded) {
    const discountSorted = [...discounts.filter(d => d.enabled)].sort((a, b) => {
      const dtA = discountTypes.find(d => d.id === a.type);
      const dtB = discountTypes.find(d => d.id === b.type);
      const valA = dtA && dtA.type === 'percentage' ? subtotal * (a.value || dtA.value) : (a.value || (dtA ? dtA.value : 0));
      const valB = dtB && dtB.type === 'percentage' ? subtotal * (b.value || dtB.value) : (b.value || (dtB ? dtB.value : 0));
      return valB - valA;
    });
    
    let accumulated = 0;
    let remainingDiscounts = [];
    for (const d of discountSorted) {
      const dt = discountTypes.find(disc => disc.id === d.type);
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
  
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    totalDiscount: Math.round(finalDiscount * 100) / 100,
    maxAllowedDiscount: Math.round(maxDiscount * 100) / 100,
    discountLimitRatio: DISCOUNT_LIMIT_RATIO,
    finalTotal: Math.round(finalTotal * 100) / 100,
    period,
    people,
    breakdown,
    discountBreakdown: discountBreakdown.filter(d => 
      !lockedDiscounts.includes(d.type)
    ),
    discountExceeded,
    lockedDiscounts,
    mutexErrors,
    appliedDiscounts: appliedDiscounts.filter(d => !lockedDiscounts.includes(d)),
    discountLimitReached: discountExceeded
  };
}

function getPeriodPrice(module, period, customPrice) {
  if (customPrice !== undefined && customPrice !== null) {
    return customPrice;
  }
  return module.basePrice;
}

function checkDiscountLimit(input) {
  const { subtotal, discounts = [] } = input;
  const maxDiscount = subtotal * DISCOUNT_LIMIT_RATIO;
  
  let totalDiscount = 0;
  discounts.forEach(discount => {
    const dt = discountTypes.find(d => d.id === discount.type);
    if (dt) {
      if (dt.type === 'percentage') {
        totalDiscount += subtotal * (discount.value || dt.value);
      } else {
        totalDiscount += discount.value || dt.value;
      }
    }
  });
  
  return {
    subtotal,
    maxDiscount: Math.round(maxDiscount * 100) / 100,
    totalDiscount: Math.round(totalDiscount * 100) / 100,
    ratio: Math.round((totalDiscount / subtotal) * 10000) / 100,
    limitRatio: DISCOUNT_LIMIT_RATIO * 100,
    exceeded: totalDiscount > maxDiscount,
    remainingDiscount: Math.round(Math.max(0, maxDiscount - totalDiscount) * 100) / 100
  };
}

function getTemplates() {
  return templates;
}

function getServiceModules() {
  return serviceModules;
}

function getDiscountTypes() {
  return discountTypes;
}

function getTimePeriods() {
  return TIME_PERIODS;
}

module.exports = {
  calculateTotal,
  validateRules,
  checkDiscountLimit,
  getTemplates,
  getServiceModules,
  getDiscountTypes,
  getTimePeriods,
  DISCOUNT_LIMIT_RATIO,
  MUTUALLY_EXCLUSIVE_GROUPS
};
