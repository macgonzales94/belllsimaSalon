// controllers/pedidoController.js
const mongoose = require('mongoose');
const Pedido = require('../models/Pedido');
const Carrito = require('../models/Carrito');
const Usuario = require('../models/Usuario');
const Producto = require('../models/Producto');
const emailService = require('../utils/emailService');
const jwt = require('jsonwebtoken');


 // Función auxiliar para obtener dirección predeterminada

const pedidoController = {

    // Agregar este nuevo método
    crearDesdeCarrito: async (req, res) => {
        // Iniciar sesión de transacción
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            if (!req.usuario?._id) {
                return res.status(401).json({ mensaje: 'Usuario no autenticado' });
            }

            const usuarioId = req.usuario._id;

            // Verificar pedido pendiente y carrito en una sola operación
            const [pedidoExistente, carrito] = await Promise.all([
                Pedido.findOne(
                    { usuario: usuarioId, estado: 'pendiente' }
                ).session(session),
                Carrito.findOne(
                    { usuario: usuarioId, estado: 'activo' }
                ).populate('productos.producto').session(session)
            ]);

            if (pedidoExistente) {
                await session.abortTransaction();
                return res.status(400).json({ mensaje: 'Ya tienes un pedido en proceso' });
            }

            if (!carrito?.productos?.length) {
                await session.abortTransaction();
                return res.status(400).json({ mensaje: 'Carrito vacío' });
            }

            // Preparar actualizaciones de stock
            const productosActualizados = [];
            const productosParaPedido = [];

            for (const item of carrito.productos) {
                const producto = item.producto;
                
                if (!producto || producto.stock < item.cantidad) {
                    await session.abortTransaction();
                    return res.status(400).json({ 
                        mensaje: `Stock insuficiente para ${producto?.nombre || 'producto desconocido'}` 
                    });
                }

                productosActualizados.push({
                    updateOne: {
                        filter: { _id: producto._id },
                        update: { $inc: { stock: -item.cantidad } }
                    }
                });

                productosParaPedido.push({
                    producto: producto._id,
                    cantidad: item.cantidad,
                    precioUnitario: producto.precio,
                    nombre: producto.nombre,  // Guardar para referencia histórica
                    sku: producto.sku        // Guardar para referencia histórica
                });
            }

            // Crear el pedido
            const pedido = new Pedido({
                usuario: usuarioId,
                productos: productosParaPedido,
                estado: 'pendiente',
                pago: { 
                    estado: 'pendiente', 
                    metodoPago: req.body.metodoPago || 'culqi',
                    intentos: 0
                },
                metadata: {
                    userAgent: req.headers['user-agent'],
                    ip: req.ip,
                    origen: req.body.origen || 'web'
                }
            });

            pedido.calcularTotales();

            // Ejecutar todas las operaciones en la transacción
            await Promise.all([
                Producto.bulkWrite(productosActualizados, { session }),
                pedido.save({ session }),
                Carrito.findByIdAndUpdate(
                    carrito._id,
                    { 
                        estado: 'procesado',
                        procesadoEn: new Date(),
                        pedidoAsociado: pedido._id
                    },
                    { session }
                )
            ]);

            // Confirmar la transacción
            await session.commitTransaction();

            res.status(201).json({
                mensaje: 'Pedido creado exitosamente',
                pedido: {
                    _id: pedido._id,
                    codigoPedido: pedido.codigoPedido,
                    productos: pedido.productos,
                    subtotal: pedido.subtotal,
                    total: pedido.total,
                    estado: pedido.estado,
                    createdAt: pedido.createdAt
                }
            });

        } catch (error) {
            await session.abortTransaction();
            console.error('Error al crear pedido:', error);
            res.status(500).json({ 
                mensaje: 'Error al crear pedido', 
                error: error.message 
            });
        } finally {
            session.endSession();
        }
    },

    // Obtener pedidos del usuario
    listarPedidosUsuario: async (req, res) => {
        try {
            const pedidos = await Pedido.find({ usuario: req.usuario._id })
                .populate('productos.producto')
                .sort({ createdAt: -1 });

            res.json(pedidos);
        } catch (error) {
            console.error('Error al listar pedidos:', error);
            res.status(500).json({
                mensaje: 'Error al listar pedidos',
                error: error.message
            });
        }
    },

    // Obtener un pedido específico
    obtenerPedido: async (req, res) => {
        try {
            const pedido = await Pedido.findOne({
                _id: req.params.id,
                usuario: req.usuario._id
            }).populate('productos.producto');

            if (!pedido) {
                return res.status(404).json({
                    mensaje: 'Pedido no encontrado'
                });
            }

            res.json(pedido);
        } catch (error) {
            console.error('Error al obtener pedido:', error);
            res.status(500).json({
                mensaje: 'Error al obtener pedido',
                error: error.message
            });
        }
    },

    // Actualizar pedido (solo admin)
    actualizarPedido: async (req, res) => {
        try {
            // Primero obtenemos el pedido actual
            const pedidoExistente = await Pedido.findById(req.params.id);

            if (!pedidoExistente) {
                return res.status(404).json({
                    mensaje: 'Pedido no encontrado'
                });
            }

            // Preparamos el objeto de actualización
            const actualizacion = {};

            // Actualización de productos
            if (req.body.productos) {
                actualizacion.productos = req.body.productos;
                // Verificar stock para nuevos productos
                for (let item of req.body.productos) {
                    const producto = await Producto.findById(item.producto);
                    if (!producto) {
                        return res.status(400).json({
                            mensaje: `Producto ${item.producto} no encontrado`
                        });
                    }
                    if (producto.stock < item.cantidad) {
                        return res.status(400).json({
                            mensaje: `Stock insuficiente para ${producto.nombre}`
                        });
                    }
                }
            }

            // Actualización de dirección de envío
            if (req.body.direccionEnvio) {
                actualizacion.direccionEnvio = {
                    calle: req.body.direccionEnvio.calle,
                    ciudad: req.body.direccionEnvio.ciudad,
                    estado: req.body.direccionEnvio.estado,
                    codigoPostal: req.body.direccionEnvio.codigoPostal,
                    telefono: req.body.direccionEnvio.telefono
                };
            }

            // Actualización de pago
            if (req.body.pago) {
                actualizacion.pago = {
                    estado: req.body.pago.estado,
                    metodoPago: req.body.pago.metodoPago,
                    referencia: req.body.pago.referencia,
                    numeroYape: req.body.pago.numeroYape,
                    fecha: req.body.pago.fecha,
                    intentos: req.body.pago.intentos
                };
            }

            // Actualización de estado
            if (req.body.estado) {
                actualizacion.estado = req.body.estado;
            }

            // Actualización de costos
            if (req.body.costoEnvio !== undefined) {
                actualizacion.costoEnvio = req.body.costoEnvio;
            }

            // Actualización de número de seguimiento
            if (req.body.numeroSeguimiento) {
                actualizacion.numeroSeguimiento = req.body.numeroSeguimiento;
            }

            // Actualización de notas
            if (req.body.notas) {
                actualizacion.notas = req.body.notas;
            }

            // Realizar la actualización
            const pedidoActualizado = await Pedido.findByIdAndUpdate(
                req.params.id,
                actualizacion,
                {
                    new: true,
                    runValidators: true
                }
            ).populate('productos.producto');

            // Recalcular totales si es necesario
            if (req.body.productos || req.body.costoEnvio !== undefined) {
                pedidoActualizado.calcularTotales();
                await pedidoActualizado.save();
            }

            res.json({
                mensaje: 'Pedido actualizado exitosamente',
                pedido: pedidoActualizado
            });

        } catch (error) {
            console.error('Error al actualizar pedido:', error);
            res.status(500).json({
                mensaje: 'Error al actualizar pedido',
                error: error.message
            });
        }
    },

    // Cancelar pedido
    cancelarPedido: async (req, res) => {
        try {
            const pedido = await Pedido.findOne({
                _id: req.params.id,
                usuario: req.usuario._id,
                estado: 'pendiente'
            });

            if (!pedido) {
                return res.status(404).json({
                    mensaje: 'Pedido no encontrado o no se puede cancelar'
                });
            }

            pedido.estado = 'cancelado';

            // Restaurar stock
            for (let item of pedido.productos) {
                await Producto.findByIdAndUpdate(item.producto, {
                    $inc: { stock: item.cantidad }
                });
            }

            await pedido.save();

            res.json({
                mensaje: 'Pedido cancelado exitosamente',
                pedido
            });
        } catch (error) {
            console.error('Error al cancelar pedido:', error);
            res.status(500).json({
                mensaje: 'Error al cancelar pedido',
                error: error.message
            });
        }
    }
   
};


module.exports = pedidoController;