const express = require('express');
const cors = require('cors');
const path = require('path');

const pricingEngine = require('./pricing-engine');

const editorApp = express();
const engineApp = express();

editorApp.use(cors());
editorApp.use(express.json({ limit: '10mb' }));
editorApp.use(express.static(path.join(__dirname, 'public')));

engineApp.use(cors());
engineApp.use(express.json({ limit: '10mb' }));

engineApp.post('/api/calculate', (req, res) => {
  try {
    const result = pricingEngine.calculateTotal(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

engineApp.post('/api/validate-rules', (req, res) => {
  try {
    const result = pricingEngine.validateRules(req.body.rules || [], {
      packages: req.body.packages || [],
      tieredOverrides: req.body.tieredOverrides || {}
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

engineApp.post('/api/validate-full-config', (req, res) => {
  try {
    const result = pricingEngine.validateFullConfig(req.body.config || req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

engineApp.post('/api/check-discount-limit', (req, res) => {
  try {
    const result = pricingEngine.checkDiscountLimit(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

engineApp.get('/api/templates', (req, res) => {
  res.json(pricingEngine.getTemplates());
});

engineApp.get('/api/service-modules', (req, res) => {
  res.json(pricingEngine.getServiceModules());
});

engineApp.get('/api/discount-types', (req, res) => {
  res.json(pricingEngine.getDiscountTypes());
});

engineApp.get('/api/time-periods', (req, res) => {
  res.json(pricingEngine.getTimePeriods());
});

engineApp.get('/api/meta', (req, res) => {
  res.json({
    DISCOUNT_LIMIT_RATIO: pricingEngine.DISCOUNT_LIMIT_RATIO,
    MUTUALLY_EXCLUSIVE_GROUPS: pricingEngine.MUTUALLY_EXCLUSIVE_GROUPS,
    BILLING_DIMENSION: pricingEngine.BILLING_DIMENSION,
    PRICE_MODE: pricingEngine.PRICE_MODE,
    PACKAGE_PRICING_MODE: pricingEngine.PACKAGE_PRICING_MODE,
    RULE_PRIORITY_DEFAULT: pricingEngine.RULE_PRIORITY_DEFAULT,
    RULE_LABELS: pricingEngine.RULE_LABELS,
    TIME_PERIODS: pricingEngine.TIME_PERIODS
  });
});

engineApp.post('/api/export-config', (req, res) => {
  try {
    const config = req.body || {};
    const validation = pricingEngine.validateFullConfig(config);
    const payload = {
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      config,
      validation
    };
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="pricing-config.json"');
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

engineApp.post('/api/import-config', (req, res) => {
  try {
    const payload = req.body || {};
    let config;
    if (payload.config) {
      config = payload.config;
    } else {
      config = payload;
    }
    const validation = pricingEngine.validateFullConfig(config);
    res.json({ valid: validation.valid, config, validation });
  } catch (err) {
    res.status(500).json({ error: err.message, valid: false });
  }
});

const EDITOR_PORT = 3874;
const ENGINE_PORT = 8879;

editorApp.listen(EDITOR_PORT, () => {
  console.log(`可视化编辑界面运行在: http://localhost:${EDITOR_PORT}`);
});

engineApp.listen(ENGINE_PORT, () => {
  console.log(`定价计算引擎运行在: http://localhost:${ENGINE_PORT}`);
});
