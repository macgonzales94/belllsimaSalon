const express = require('express');
const router = express.Router();
const pedidoController = require('../controllers/pedidoController');
const { verificarToken } = require('../middlewares/autenticacion');

// Aplicar verificación de token a todas las rutas
router.use(verificarToken);

// Rutas
router.post('/crear-desde-carrito', pedidoController.crearDesdeCarrito);
router.get('/usuario', pedidoController.listarPedidosUsuario);
router.get('/:id', pedidoController.obtenerPedido);
router.put('/:id', pedidoController.actualizarPedido);
router.delete('/:id', pedidoController.cancelarPedido);

module.exports = router;