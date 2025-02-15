// routes/pagos.js
const express = require('express');
const router = express.Router();
const pagoController = require('../controllers/pagoController');
const { verificarToken } = require('../middlewares/autenticacion');

router.get('/config', pagoController.obtenerConfig);
router.post('/generar-token', pagoController.generarToken);
router.post('/procesar', pagoController.procesarPago);
router.get('/verificar/:cargoId', pagoController.verificarPago);

module.exports = router;