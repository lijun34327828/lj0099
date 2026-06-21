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

const BILLING_DIMENSION = {
  PER_PERSON: 'per_person',
  PER_ORDER: 'per_order'
};

const PRICE_MODE = {
  FIXED: 'fixed',
  DISCOUNT: 'discount'
};

const PACKAGE_PRICING_MODE = {
  FIXED_PRICE: 'fixed_price',
  DISCOUNT: 'discount'
};

const RULE_PRIORITY_DEFAULT = [
  'period_base_price',
  'people_tier',
  'package_price',
  'member_discount',
  'timing_discount',
  'quantity_discount'
];

const RULE_LABELS = {
  period_base_price: '时段基础价',
  people_tier: '人数阶梯',
  package_price: '套餐优惠',
  member_discount: '会员类折扣',
  timing_discount: '时段类折扣',
  quantity_discount: '数量类折扣'
};

const DISCOUNT_CATEGORY = {
  member_discount: 'member_discount',
  coupon_discount: 'member_discount',
  early_bird: 'timing_discount',
  last_minute: 'timing_discount',
  group_discount: 'quantity_discount',
  promo_code: 'quantity_discount'
};

const serviceModules = [
  {
    id: 'ski_basic',
    name: '基础滑雪',
    category: 'sports',
    basePrice: 199,
    unit: '人次',
    icon: '⛷️',
    description: '含雪具租赁',
    billingDimension: BILLING_DIMENSION.PER_PERSON,
    tieredPricing: {
      enabled: false,
      tiers: [
        { id: 't1', minPeople: 1, maxPeople: 4, priceMode: PRICE_MODE.FIXED, value: 199, label: '1-4人' },
        { id: 't2', minPeople: 5, maxPeople: 9, priceMode: PRICE_MODE.DISCOUNT, value: 0.9, label: '5-9人' },
        { id: 't3', minPeople: 10, maxPeople: 999, priceMode: PRICE_MODE.DISCOUNT, value: 0.8, label: '10人及以上' }
      ]
    }
  },
  {
    id: 'ski_advanced',
    name: '高级滑雪道',
    category: 'sports',
    basePrice: 299,
    unit: '人次',
    icon: '🏂',
    description: '专业雪道+教练',
    billingDimension: BILLING_DIMENSION.PER_PERSON,
    tieredPricing: {
      enabled: false,
      tiers: [
        { id: 't1', minPeople: 1, maxPeople: 4, priceMode: PRICE_MODE.FIXED, value: 299, label: '1-4人' },
        { id: 't2', minPeople: 5, maxPeople: 9, priceMode: PRICE_MODE.DISCOUNT, value: 0.9, label: '5-9人' },
        { id: 't3', minPeople: 10, maxPeople: 999, priceMode: PRICE_MODE.DISCOUNT, value: 0.8, label: '10人及以上' }
      ]
    }
  },
  {
    id: 'snowboard',
    name: '单板滑雪',
    category: 'sports',
    basePrice: 259,
    unit: '人次',
    icon: '🎿',
    description: '单板装备全套',
    billingDimension: BILLING_DIMENSION.PER_PERSON,
    tieredPricing: {
      enabled: false,
      tiers: [
        { id: 't1', minPeople: 1, maxPeople: 4, priceMode: PRICE_MODE.FIXED, value: 259, label: '1-4人' },
        { id: 't2', minPeople: 5, maxPeople: 9, priceMode: PRICE_MODE.DISCOUNT, value: 0.9, label: '5-9人' },
        { id: 't3', minPeople: 10, maxPeople: 999, priceMode: PRICE_MODE.DISCOUNT, value: 0.8, label: '10人及以上' }
      ]
    }
  },
  {
    id: 'ski_suit_rental',
    name: '滑雪服租赁',
    category: 'equipment',
    basePrice: 80,
    unit: '套/天',
    icon: '🧥',
    description: '上衣+裤子',
    billingDimension: BILLING_DIMENSION.PER_PERSON,
    tieredPricing: {
      enabled: false,
      tiers: [
        { id: 't1', minPeople: 1, maxPeople: 4, priceMode: PRICE_MODE.FIXED, value: 80, label: '1-4人' },
        { id: 't2', minPeople: 5, maxPeople: 9, priceMode: PRICE_MODE.DISCOUNT, value: 0.95, label: '5-9人' },
        { id: 't3', minPeople: 10, maxPeople: 999, priceMode: PRICE_MODE.DISCOUNT, value: 0.9, label: '10人及以上' }
      ]
    }
  },
  {
    id: 'helmet_rental',
    name: '头盔租赁',
    category: 'equipment',
    basePrice: 30,
    unit: '个/天',
    icon: '⛑️',
    description: '专业防护头盔',
    billingDimension: BILLING_DIMENSION.PER_PERSON,
    tieredPricing: {
      enabled: false,
      tiers: [
        { id: 't1', minPeople: 1, maxPeople: 4, priceMode: PRICE_MODE.FIXED, value: 30, label: '1-4人' },
        { id: 't2', minPeople: 5, maxPeople: 9, priceMode: PRICE_MODE.DISCOUNT, value: 0.95, label: '5-9人' },
        { id: 't3', minPeople: 10, maxPeople: 999, priceMode: PRICE_MODE.DISCOUNT, value: 0.9, label: '10人及以上' }
      ]
    }
  },
  {
    id: 'goggles_rental',
    name: '雪镜租赁',
    category: 'equipment',
    basePrice: 40,
    unit: '副/天',
    icon: '🥽',
    description: '防雾滑雪镜',
    billingDimension: BILLING_DIMENSION.PER_PERSON,
    tieredPricing: {
      enabled: false,
      tiers: [
        { id: 't1', minPeople: 1, maxPeople: 4, priceMode: PRICE_MODE.FIXED, value: 40, label: '1-4人' },
        { id: 't2', minPeople: 5, maxPeople: 9, priceMode: PRICE_MODE.DISCOUNT, value: 0.95, label: '5-9人' },
        { id: 't3', minPeople: 10, maxPeople: 999, priceMode: PRICE_MODE.DISCOUNT, value: 0.9, label: '10人及以上' }
      ]
    }
  },
  {
    id: 'locker',
    name: '储物柜',
    category: 'service',
    basePrice: 25,
    unit: '个/天',
    icon: '🗄️',
    description: '大号储物柜',
    billingDimension: BILLING_DIMENSION.PER_ORDER,
    tieredPricing: { enabled: false, tiers: [] }
  },
  {
    id: 'lesson_1v1',
    name: '1对1私教',
    category: 'service',
    basePrice: 500,
    unit: '小时',
    icon: '👨‍🏫',
    description: '专业教练一对一',
    billingDimension: BILLING_DIMENSION.PER_ORDER,
    tieredPricing: { enabled: false, tiers: [] }
  },
  {
    id: 'lesson_group',
    name: '团体课程',
    category: 'service',
    basePrice: 150,
    unit: '人次',
    icon: '👥',
    description: '5人以上团体课',
    billingDimension: BILLING_DIMENSION.PER_PERSON,
    tieredPricing: {
      enabled: false,
      tiers: [
        { id: 't1', minPeople: 5, maxPeople: 9, priceMode: PRICE_MODE.FIXED, value: 150, label: '5-9人' },
        { id: 't2', minPeople: 10, maxPeople: 19, priceMode: PRICE_MODE.DISCOUNT, value: 0.9, label: '10-19人' },
        { id: 't3', minPeople: 20, maxPeople: 999, priceMode: PRICE_MODE.DISCOUNT, value: 0.8, label: '20人及以上' }
      ]
    }
  },
  {
    id: 'food_coupon',
    name: '餐饮代金券',
    category: 'service',
    basePrice: 50,
    unit: '张',
    icon: '🍱',
    description: '山顶餐厅通用',
    billingDimension: BILLING_DIMENSION.PER_ORDER,
    tieredPricing: { enabled: false, tiers: [] }
  }
];

const discountTypes = [
  { id: 'member_discount', name: '会员折扣', type: 'percentage', value: 0.15, group: 'membership', category: 'member_discount' },
  { id: 'coupon_discount', name: '优惠券', type: 'fixed', value: 30, group: 'membership', category: 'member_discount' },
  { id: 'early_bird', name: '早鸟优惠', type: 'percentage', value: 0.20, group: 'timing', category: 'timing_discount' },
  { id: 'last_minute', name: '限时特惠', type: 'fixed', value: 50, group: 'timing', category: 'timing_discount' },
  { id: 'group_discount', name: '团购折扣', type: 'percentage', value: 0.25, group: 'quantity', category: 'quantity_discount' },
  { id: 'promo_code', name: '优惠码', type: 'fixed', value: 80, group: 'quantity', category: 'quantity_discount' }
];

const templates = [
  { id: 'classic_blue', name: '经典蓝', primaryColor: '#1E40AF', secondaryColor: '#3B82F6', bgColor: '#EFF6FF', textColor: '#1E3A8A', fontStyle: 'modern', layout: 'standard' },
  { id: 'warm_orange', name: '暖橙活力', primaryColor: '#EA580C', secondaryColor: '#F59E0B', bgColor: '#FFF7ED', textColor: '#9A3412', fontStyle: 'bold', layout: 'compact' },
  { id: 'elegant_purple', name: '优雅紫', primaryColor: '#7C3AED', secondaryColor: '#A78BFA', bgColor: '#F5F3FF', textColor: '#5B21B6', fontStyle: 'elegant', layout: 'premium' },
  { id: 'fresh_green', name: '清新绿', primaryColor: '#059669', secondaryColor: '#34D399', bgColor: '#ECFDF5', textColor: '#065F46', fontStyle: 'fresh', layout: 'minimal' }
];

function getPeopleTier(module, people) {
  if (!module.tieredPricing || !module.tieredPricing.enabled || !module.tieredPricing.tiers || module.tieredPricing.tiers.length === 0) {
    return null;
  }
  const safePeople = people > 0 ? people : 1;
  return module.tieredPricing.tiers.find(t => safePeople >= t.minPeople && safePeople <= t.maxPeople) || null;
}

function applyPeopleTierToPrice(basePrice, tier) {
  if (!tier) return { price: basePrice, applied: false, tier: null };
  if (tier.priceMode === PRICE_MODE.FIXED) {
    return { price: tier.value, applied: true, tier };
  } else if (tier.priceMode === PRICE_MODE.DISCOUNT) {
    return { price: Math.round(basePrice * tier.value * 100) / 100, applied: true, tier };
  }
  return { price: basePrice, applied: false, tier: null };
}

function getPeriodPrice(serviceId, period, customPricing, module) {
  if (customPricing && customPricing[serviceId] && customPricing[serviceId][period] && customPricing[serviceId][period].price !== undefined) {
    return customPricing[serviceId][period].price;
  }
  return module.basePrice;
}

function calculateServiceUnitPrice(serviceId, period, people, customPricing, tieredOverrides) {
  const module = serviceModules.find(m => m.id === serviceId);
  if (!module) return { price: 0, hitChain: [] };

  const hitChain = [];
  const periodPrice = getPeriodPrice(serviceId, period, customPricing, module);
  hitChain.push({
    rule: 'period_base_price',
    label: RULE_LABELS.period_base_price,
    period,
    periodLabel: TIME_PERIODS[period]?.label || period,
    value: periodPrice,
    result: periodPrice
  });

  let effectiveTiered = module.tieredPricing;
  if (tieredOverrides && tieredOverrides[serviceId]) {
    effectiveTiered = tieredOverrides[serviceId];
  }
  const tempModule = { ...module, tieredPricing: effectiveTiered };

  const tier = getPeopleTier(tempModule, people);
  const tierResult = applyPeopleTierToPrice(periodPrice, tier);

  if (tierResult.applied) {
    hitChain.push({
      rule: 'people_tier',
      label: RULE_LABELS.people_tier,
      tierLabel: tier.label,
      tierMode: tier.priceMode,
      tierValue: tier.value,
      original: periodPrice,
      result: tierResult.price
    });
  }

  return {
    price: tierResult.price,
    hitChain,
    periodPrice,
    tier: tierResult.applied ? tier : null
  };
}

function calculatePackagePrice(pkg, period, people, customPricing, tieredOverrides) {
  const individualPrices = [];
  let individualTotal = 0;

  pkg.serviceIds.forEach(sid => {
    const unitResult = calculateServiceUnitPrice(sid, period, people, customPricing, tieredOverrides);
    const module = serviceModules.find(m => m.id === sid);
    if (module) {
      const baseQty = 1;
      const qty = module.billingDimension === BILLING_DIMENSION.PER_PERSON ? baseQty * people : baseQty;
      const lineTotal = unitResult.price * qty;
      individualTotal += lineTotal;
      individualPrices.push({
        serviceId: sid,
        module,
        unitPrice: unitResult.price,
        quantity: qty,
        lineTotal,
        hitChain: unitResult.hitChain
      });
    }
  });

  let packagePrice;
  let packageMode;
  let packageValue;
  let packageSavings;

  if (pkg.pricing.mode === PACKAGE_PRICING_MODE.FIXED_PRICE) {
    packagePrice = pkg.pricing.value;
    packageMode = '整包价';
    packageValue = pkg.pricing.value;
  } else {
    packagePrice = Math.round(individualTotal * pkg.pricing.value * 100) / 100;
    packageMode = '整包折扣';
    packageValue = pkg.pricing.value;
  }

  packageSavings = Math.max(0, individualTotal - packagePrice);
  const usePackage = packageSavings > 0;

  return {
    packageId: pkg.id,
    packageName: pkg.name,
    individualPrices,
    individualTotal,
    packagePrice,
    packageMode,
    packageValue,
    packageSavings,
    usePackage,
    finalTotal: usePackage ? packagePrice : individualTotal
  };
}

function calculateTotal(input) {
  const {
    period = 'weekday',
    people = 1,
    services = [],
    equipmentRentals = [],
    discounts = [],
    customPricing = {},
    tieredOverrides = {},
    packages = [],
    dailySchedule = null,
    rulePriority = RULE_PRIORITY_DEFAULT
  } = input;

  const hitChain = [];
  const serviceHitChains = {};

  if (dailySchedule && Array.isArray(dailySchedule) && dailySchedule.length > 0) {
    return calculateMultiDay(input);
  }

  const safePeople = people > 0 ? people : 1;
  const breakdown = [];
  let subtotal = 0;
  const coveredByPackage = new Set();

  packages.forEach(pkg => {
    if (!pkg.enabled) return;
    const pkgResult = calculatePackagePrice(pkg, period, safePeople, customPricing, tieredOverrides);
    if (pkgResult.usePackage) {
      pkg.serviceIds.forEach(sid => coveredByPackage.add(sid));
      subtotal += pkgResult.finalTotal;
      breakdown.push({
        type: 'package',
        packageId: pkg.id,
        name: `📦 ${pkg.name}`,
        unitPrice: pkgResult.packagePrice,
        quantity: 1,
        amount: pkgResult.finalTotal,
        icon: '📦',
        packageDetails: pkgResult,
        hitChain: [
          { rule: 'package_price', label: RULE_LABELS.package_price, packageName: pkg.name, packageMode: pkgResult.packageMode, packageValue: pkgResult.packageValue, savings: pkgResult.packageSavings, result: pkgResult.finalTotal }
        ]
      });
      hitChain.push({ rule: 'package_price', label: `套餐【${pkg.name}】`, detail: `${pkgResult.packageMode}，节省¥${pkgResult.packageSavings.toFixed(2)}`, result: pkgResult.finalTotal });
    }
  });

  const allLineItems = [
    ...services.map(s => ({ ...s, __kind: 'service' })),
    ...equipmentRentals.map(e => ({ ...e, __kind: 'equipment' }))
  ];

  allLineItems.forEach(item => {
    if (coveredByPackage.has(item.id)) return;
    const module = serviceModules.find(m => m.id === item.id);
    if (!module) return;

    const unitResult = calculateServiceUnitPrice(item.id, period, safePeople, customPricing, tieredOverrides);
    serviceHitChains[item.id] = unitResult.hitChain;
    unitResult.hitChain.forEach(h => hitChain.push({ ...h, serviceId: item.id, serviceName: module.name }));

    const baseQuantity = item.quantity || 1;
    const isPerPerson = module.billingDimension === BILLING_DIMENSION.PER_PERSON;
    const quantity = isPerPerson ? baseQuantity * safePeople : baseQuantity;
    const days = item.days || 1;
    const isEquipment = item.__kind === 'equipment';
    const amount = isEquipment ? unitResult.price * quantity * days : unitResult.price * quantity;
    subtotal += amount;

    breakdown.push({
      type: isEquipment ? 'equipment' : 'service',
      serviceId: item.id,
      name: module.name,
      unitPrice: unitResult.price,
      quantity: isEquipment ? `${quantity}${module.unit.split('/')[0]}×${days}天` : quantity,
      amount,
      icon: module.icon,
      hitChain: unitResult.hitChain,
      appliedTier: unitResult.tier
    });
  });

  const mutexErrors = [];
  const discountIds = discounts.filter(d => d.enabled).map(d => d.type);
  for (const group of MUTUALLY_EXCLUSIVE_GROUPS) {
    const foundInGroup = group.filter(d => discountIds.includes(d));
    if (foundInGroup.length > 1) {
      const discountNames = foundInGroup.map(id => {
        const dt = discountTypes.find(d => d.id === id);
        return dt ? dt.name : id;
      }).join('、');
      mutexErrors.push({ group, message: `互斥冲突：${discountNames} 不能同时使用` });
    }
  }

  let totalDiscount = 0;
  const discountBreakdown = [];
  const appliedDiscounts = [];
  const sortedDiscounts = discounts.filter(d => d.enabled).sort((a, b) => {
    const catA = DISCOUNT_CATEGORY[a.type] || 'quantity_discount';
    const catB = DISCOUNT_CATEGORY[b.type] || 'quantity_discount';
    return rulePriority.indexOf(catA) - rulePriority.indexOf(catB);
  });

  sortedDiscounts.forEach(discount => {
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
      value: discount.value || dt.value,
      category: dt.category
    });
    totalDiscount += discountAmount;
    appliedDiscounts.push(discount.type);
    hitChain.push({
      rule: dt.category,
      label: RULE_LABELS[dt.category] || dt.name,
      discountName: dt.name,
      discountAmount,
      result: -discountAmount
    });
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
      } else {
        lockedDiscounts.push(d.type);
      }
    }
    finalDiscount = accumulated;
    hitChain.push({ rule: 'discount_limit', label: '优惠阈值约束', detail: `优惠总额(${totalDiscount.toFixed(2)})超过订单30%上限(${maxDiscount.toFixed(2)})，已自动锁定超限项`, result: -(totalDiscount - accumulated) });
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
    discountBreakdown: discountBreakdown.filter(d => !lockedDiscounts.includes(d.type)),
    discountExceeded,
    lockedDiscounts,
    mutexErrors,
    appliedDiscounts: appliedDiscounts.filter(d => !lockedDiscounts.includes(d)),
    discountLimitReached: discountExceeded,
    hitChain,
    serviceHitChains,
    isMultiDay: false
  };
}

function calculateMultiDay(input) {
  const {
    people = 1,
    services = [],
    equipmentRentals = [],
    discounts = [],
    customPricing = {},
    tieredOverrides = {},
    packages = [],
    dailySchedule = [],
    rulePriority = RULE_PRIORITY_DEFAULT
  } = input;

  const safePeople = people > 0 ? people : 1;
  const dailyResults = [];
  let totalSubtotal = 0;
  let totalFinal = 0;
  const combinedBreakdown = [];
  const combinedHitChain = [];
  const allServiceHitChains = {};

  dailySchedule.forEach((day, idx) => {
    const dayPeriod = day.period || 'weekday';
    const dayResult = calculateTotal({
      period: dayPeriod,
      people: safePeople,
      services: services.map(s => ({ ...s })),
      equipmentRentals: equipmentRentals.map(e => ({ ...e, days: 1 })),
      discounts: idx === 0 ? discounts : [],
      customPricing,
      tieredOverrides,
      packages,
      rulePriority
    });

    dailyResults.push({
      dayIndex: idx,
      date: day.date,
      period: dayPeriod,
      periodLabel: TIME_PERIODS[dayPeriod]?.label || dayPeriod,
      result: dayResult
    });

    totalSubtotal += dayResult.subtotal;
    dayResult.breakdown.forEach(bd => {
      const existing = combinedBreakdown.find(cb => cb.serviceId === bd.serviceId && cb.type === bd.type && cb.packageId === bd.packageId);
      if (existing) {
        existing.amount += bd.amount;
        if (typeof existing.quantity === 'number') {
          existing.quantity += bd.quantity;
        }
      } else {
        combinedBreakdown.push({ ...bd, amount: bd.amount });
      }
    });

    Object.entries(dayResult.serviceHitChains || {}).forEach(([sid, chain]) => {
      if (!allServiceHitChains[sid]) allServiceHitChains[sid] = [];
      allServiceHitChains[sid].push({ dayIndex: idx, period: dayPeriod, chain });
    });

    combinedHitChain.push({
      rule: 'multi_day',
      label: `第${idx + 1}天 (${TIME_PERIODS[dayPeriod]?.label || dayPeriod})`,
      date: day.date,
      subtotal: dayResult.subtotal,
      result: dayResult.finalTotal
    });
  });

  const firstDayDiscounts = dailyResults[0]?.result || {};
  const finalDiscount = firstDayDiscounts.totalDiscount || 0;
  const maxDiscount = totalSubtotal * DISCOUNT_LIMIT_RATIO;
  let actualDiscount = Math.min(finalDiscount, maxDiscount);
  totalFinal = Math.max(0, totalSubtotal - actualDiscount);

  return {
    subtotal: Math.round(totalSubtotal * 100) / 100,
    totalDiscount: Math.round(actualDiscount * 100) / 100,
    maxAllowedDiscount: Math.round(maxDiscount * 100) / 100,
    discountLimitRatio: DISCOUNT_LIMIT_RATIO,
    finalTotal: Math.round(totalFinal * 100) / 100,
    period: 'multi_day',
    people: safePeople,
    dailyResults,
    breakdown: combinedBreakdown,
    discountBreakdown: firstDayDiscounts.discountBreakdown || [],
    discountExceeded: actualDiscount < finalDiscount,
    lockedDiscounts: firstDayDiscounts.lockedDiscounts || [],
    mutexErrors: firstDayDiscounts.mutexErrors || [],
    appliedDiscounts: firstDayDiscounts.appliedDiscounts || [],
    discountLimitReached: actualDiscount < finalDiscount,
    hitChain: combinedHitChain,
    serviceHitChains: allServiceHitChains,
    isMultiDay: true
  };
}

function validateRules(rules, options = {}) {
  const errors = [];
  const warnings = [];
  const { packages = [], tieredOverrides = {} } = options;

  const periodRules = {};
  rules.forEach(rule => {
    if (!periodRules[rule.period]) periodRules[rule.period] = [];
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
    if (!modulePrices[rule.serviceId]) modulePrices[rule.serviceId] = {};
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

  for (const [serviceId, tierCfg] of Object.entries(tieredOverrides)) {
    if (!tierCfg || !tierCfg.enabled || !tierCfg.tiers) continue;
    const module = serviceModules.find(s => s.id === serviceId);
    if (!module) continue;
    const tiers = [...tierCfg.tiers].sort((a, b) => a.minPeople - b.minPeople);
    for (let i = 0; i < tiers.length; i++) {
      const t = tiers[i];
      if (t.minPeople > t.maxPeople) {
        errors.push({ type: 'tier_invalid', serviceId, message: `${module.name} 的人数阶梯"${t.label}"区间无效：最小值大于最大值` });
      }
      if (i > 0 && tiers[i - 1].maxPeople + 1 !== t.minPeople) {
        warnings.push({ type: 'tier_gap', serviceId, message: `${module.name} 的人数阶梯存在间隔，${tiers[i - 1].maxPeople + 1}至${t.minPeople - 1}人未覆盖` });
      }
      if (t.priceMode === PRICE_MODE.DISCOUNT && (t.value <= 0 || t.value > 1)) {
        errors.push({ type: 'tier_discount_invalid', serviceId, message: `${module.name} 的阶梯"${t.label}"折扣率必须在0-1之间` });
      }
      if (t.priceMode === PRICE_MODE.FIXED && t.value < 0) {
        errors.push({ type: 'tier_price_invalid', serviceId, message: `${module.name} 的阶梯"${t.label}"固定价不能为负数` });
      }
    }
  }

  packages.forEach(pkg => {
    if (!pkg.serviceIds || pkg.serviceIds.length < 2) {
      errors.push({ type: 'package_invalid', packageId: pkg.id, message: `套餐"${pkg.name}"至少需要包含2个服务模块` });
    }
    if (pkg.pricing) {
      if (pkg.pricing.mode === PACKAGE_PRICING_MODE.FIXED_PRICE && pkg.pricing.value < 0) {
        errors.push({ type: 'package_price_invalid', packageId: pkg.id, message: `套餐"${pkg.name}"的整包价不能为负数` });
      }
      if (pkg.pricing.mode === PACKAGE_PRICING_MODE.DISCOUNT && (pkg.pricing.value <= 0 || pkg.pricing.value > 1)) {
        errors.push({ type: 'package_discount_invalid', packageId: pkg.id, message: `套餐"${pkg.name}"的整包折扣率必须在0-1之间` });
      }
    }
  });

  for (let i = 0; i < packages.length; i++) {
    for (let j = i + 1; j < packages.length; j++) {
      const overlap = packages[i].serviceIds.filter(sid => packages[j].serviceIds.includes(sid));
      if (overlap.length > 0) {
        const overlapNames = overlap.map(sid => {
          const m = serviceModules.find(s => s.id === sid);
          return m ? m.name : sid;
        }).join('、');
        warnings.push({ type: 'package_overlap', packageIds: [packages[i].id, packages[j].id], message: `套餐"${packages[i].name}"与"${packages[j].name}"存在重叠服务：${overlapNames}，计算时按更优惠者裁决` });
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

function validateFullConfig(config) {
  const errors = [];
  const warnings = [];

  if (!config) {
    errors.push({ type: 'config_empty', message: '配置为空' });
    return { valid: false, errors, warnings };
  }

  if (config.canvasItems && Array.isArray(config.canvasItems)) {
    config.canvasItems.forEach(item => {
      if (!item.id) errors.push({ type: 'canvas_item_invalid', message: '画布存在缺少ID的模块' });
    });
  }

  const rules = [];
  if (config.pricingRules) {
    for (const [serviceId, periods] of Object.entries(config.pricingRules)) {
      for (const [period, data] of Object.entries(periods)) {
        if (data.enabled !== false) {
          rules.push({ serviceId, period, price: data.price, enabled: true, discountType: null });
        }
      }
    }
  }

  const ruleVal = validateRules(rules, { packages: config.packages || [], tieredOverrides: config.tieredOverrides || {} });
  errors.push(...ruleVal.errors);
  warnings.push(...ruleVal.warnings);

  if (config.dailySchedule && Array.isArray(config.dailySchedule)) {
    config.dailySchedule.forEach((day, idx) => {
      if (!day.period || !TIME_PERIODS[day.period]) {
        errors.push({ type: 'schedule_invalid', message: `第${idx + 1}天的时段类型无效` });
      }
    });
  }

  return { valid: errors.length === 0, errors, warnings };
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

function getTemplates() { return templates; }
function getServiceModules() { return serviceModules; }
function getDiscountTypes() { return discountTypes; }
function getTimePeriods() { return TIME_PERIODS; }

module.exports = {
  calculateTotal,
  validateRules,
  validateFullConfig,
  checkDiscountLimit,
  getTemplates,
  getServiceModules,
  getDiscountTypes,
  getTimePeriods,
  DISCOUNT_LIMIT_RATIO,
  MUTUALLY_EXCLUSIVE_GROUPS,
  BILLING_DIMENSION,
  PRICE_MODE,
  PACKAGE_PRICING_MODE,
  RULE_PRIORITY_DEFAULT,
  RULE_LABELS,
  TIME_PERIODS
};
