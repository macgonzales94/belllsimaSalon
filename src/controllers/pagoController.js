// controllers/pagoController.js
const mongoose = require('mongoose');
const Culqi = require('culqi-node');
const Pedido = require('../models/Pedido');
const Carrito = require('../models/Carrito');
const jwt = require('jsonwebtoken');

// Inicializar Culqi con las llaves
const culqi = new Culqi({
    privateKey: process.env.CULQI_PRIVATE_KEY,
    publicKey: process.env.CULQI_PUBLIC_KEY,
    pciCompliant: true,
    apiVersion: "v2"
});

const pagoController = {
    // Método para obtener la llave pública que usaremos en el frontend
    obtenerConfig: async (req, res) => {
        try {
            res.json({
                publicKey: process.env.CULQI_PUBLIC_KEY
            });
        } catch (error) {
            res.status(500).json({
                mensaje: 'Error al obtener configuración',
                error: error.message
            });
        }
    },

    // Método para generar el token de la tarjeta
    generarToken: async (req, res) => {
        try {
            // Obtener los datos de la tarjeta del request
            const { card_number, cvv, expiration_month, expiration_year, email } = req.body;

            // Hacer la petición a Culqi para generar el token
            const response = await fetch('https://secure.culqi.com/v2/tokens', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.CULQI_PUBLIC_KEY}`
                },
                body: JSON.stringify({
                    card_number,
                    cvv,
                    expiration_month,
                    expiration_year,
                    email
                })
            });

            // Obtener la respuesta
            const data = await response.json();

            // Si hay error en la respuesta, lanzar error
            if (!response.ok) {
                return res.status(400).json({
                    mensaje: 'Error al generar token',
                    error: data.user_message || data.merchant_message
                });
            }

            // Devolver el token generado
            res.json({
                token: data.id
            });

        } catch (error) {
            console.error('Error al generar token:', error);
            res.status(500).json({
                mensaje: 'Error al generar token',
                error: error.message
            });
        }
    },

    // Método para procesar el pago con el token generado
    procesarPago: async (req, res) => {
        try {
            // Obtener datos necesarios del request
            const { token, pedidoId, cargoData } = req.body;

            if (!token || !pedidoId) {
                return res.status(400).json({
                    mensaje: 'Token y pedidoId son requeridos'
                });
            }

            // Buscar el pedido en la base de datos
            const pedido = await Pedido.findById(pedidoId)
                .populate('usuario', 'email nombre apellido');

            if (!pedido) {
                return res.status(404).json({
                    mensaje: 'Pedido no encontrado'
                });
            }

            // Validar que el pedido no haya sido pagado
            if (pedido.pago && pedido.pago.estado === 'completado') {
                return res.status(400).json({
                    mensaje: 'Este pedido ya ha sido pagado'
                });
            }

            // Crear el objeto de cargo para Culqi
            const datosCargo = {
                amount: Math.round(pedido.total * 100),
                currency_code: 'PEN',
                email: pedido.usuario.email,
                source_id: token,
                description: `Pedido #${pedido._id}`,
                antifraud_details: {
                    first_name: pedido.usuario.nombre,
                    last_name: pedido.usuario.apellido,
                    address: pedido.direccionEnvio.calle,
                    address_city: pedido.direccionEnvio.ciudad,
                    country_code: 'PE',
                    phone: pedido.direccionEnvio.telefono
                }
            };

            // Procesar el cargo en Culqi
            console.log('Procesando cargo en Culqi:', datosCargo);
            const cargo = await culqi.charges.create(datosCargo);
            console.log('Respuesta de Culqi:', cargo);

            // Actualizar el pedido con la información del pago
            pedido.pago = {
                estado: 'completado',
                metodoPago: 'tarjeta',
                referencia: cargo.id,
                fecha: new Date(),
                detallesCargo: {
                    monto: cargo.amount / 100,
                    moneda: cargo.currency_code,
                    ultimosDigitos: cargo.source.last_four,
                    marca: cargo.source.brand
                }
            };

            await pedido.save();
            console.log('Pedido actualizado:', pedido._id);

            // Enviar respuesta exitosa
            res.json({
                mensaje: 'Pago procesado exitosamente',
                cargo: {
                    id: cargo.id,
                    monto: cargo.amount / 100,
                    moneda: cargo.currency_code
                },
                pedido: {
                    id: pedido._id,
                    estado: pedido.pago.estado
                }
            });

        } catch (error) {
            console.error('Error en procesamiento de pago:', error);

            // Manejar errores específicos de Culqi
            if (error.type === 'card_error') {
                return res.status(400).json({
                    mensaje: 'Error con la tarjeta',
                    error: error.user_message
                });
            }

            if (error.type === 'invalid_request_error') {
                return res.status(400).json({
                    mensaje: 'Error en la solicitud',
                    error: error.user_message
                });
            }

            // Error general
            res.status(500).json({
                mensaje: 'Error al procesar el pago',
                error: error.message || 'Error interno del servidor'
            });
        }
    },

    // Método para verificar el estado de un pago
    verificarPago: async (req, res) => {
        try {
            // Obtener el ID del cargo de los parámetros
            const { cargoId } = req.params;
            // Consultar el estado del cargo en Culqi
            const cargo = await culqi.charges.get(cargoId);

            // Devolver el estado del cargo
            res.json({
                estado: cargo.outcome.type,
                detalles: cargo.outcome
            });

        } catch (error) {
            console.error('Error al verificar pago:', error);
            res.status(400).json({
                mensaje: 'Error al verificar el pago',
                error: error.message
            });
        }
    }
};

module.exports = pagoController;