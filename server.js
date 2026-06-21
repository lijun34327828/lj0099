const express = require('express');
const cors = require('cors');
const path = require('path');

const pricingEngine = require('./pricing-engine');

const editorApp = express();
const engineApp = express();

editorApp.use(cors());
editorApp.use(express.json());
editorApp.use(express.static(path.join(__dirname, 'public')));

engineApp.use(cors());
engineApp.use(express.json());

engineApp.post('/api/calculate', (req, res) => {
  const result = pricingEngine.calculateTotal(req.body);
  res.json(result);
});

engineApp.post('/api/validate-rules', (req, res) => {
  const result = pricingEngine.validateRules(req.body.rules || []);
  res.json(result);
});

engineApp.post('/api/check-discount-limit', (req, res) => {
  const result = pricingEngine.checkDiscountLimit(req.body);
  res.json(result);
});

engineApp.get('/api/templates', (req, res) => {
  res.json(pricingEngine.getTemplates());
});

engineApp.get('/api/service-modules', (req, res) => {
  res.json(pricingEngine.getServiceModules());
});

const EDITOR_PORT = 3874;
const ENGINE_PORT = 8879;

editorApp.listen(EDITOR_PORT, () => {
  console.log(`可视化编辑界面运行在: http://localhost:${EDITOR_PORT}`);
});

engineApp.listen(ENGINE_PORT, () => {
  console.log(`定价计算引擎运行在: http://localhost:${ENGINE_PORT}`);
});
