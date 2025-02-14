// models/Pedido.js
const mongoose = require('mongoose');

const pedidoSchema = new mongoose.Schema({
    codigoPedido: {
        type: String,
        unique: true
    },
    usuario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    productos: [{
        producto: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Producto',
            required: true
        },
        cantidad: {
            type: Number,
            required: true,
            min: 1
        },
        precioUnitario: {
            type: Number,
            required: true,
            min: 0
        }
    }],
    estado: {
        type: String,
        enum: ['pendiente', 'en_proceso', 'completado', 'cancelado'],
        default: 'pendiente'
    },
    direccionEnvio: {
        calle: String,
        ciudad: String,
        estado: String,
        codigoPostal: String,
        telefono: String
    },
    pago: {
        estado: {
            type: String,
            enum: ['pendiente', 'procesando', 'completado', 'fallido'],
            default: 'pendiente'
        },
        metodoPago: {
            type: String,
            enum: ['yape', 'culqi'],
            required: true
        },
        referencia: String,
        numeroYape: String,
        fecha: Date,
        intentos: {
            type: Number,
            default: 0
        }
    },
    subtotal: {
        type: Number,
        default: 0
    },
    costoEnvio: {
        type: Number,
        default: 0
    },
    total: {
        type: Number,
        default: 0
    },
    numeroSeguimiento: String,
    notas: String
}, {
    timestamps: true
});

// Middleware pre-save para generar código de pedido
pedidoSchema.pre('save', async function(next) {
    if (!this.codigoPedido) {
        const date = new Date();
        const year = date.getFullYear();
        const count = await mongoose.model('Pedido').countDocuments();
        this.codigoPedido = `PED-${year}-${(count + 1).toString().padStart(3, '0')}`;
    }
    next();
});

// Método para calcular totales
pedidoSchema.methods.calcularTotales = function() {
    // Calcular subtotal
    this.subtotal = this.productos.reduce((total, item) => {
        return total + (item.cantidad * item.precioUnitario);
    }, 0);

    // Calcular total (subtotal + costo de envío)
    this.total = this.subtotal + (this.costoEnvio || 0);
};

// Método para verificar stock disponible
pedidoSchema.methods.verificarStock = async function() {
    for (let item of this.productos) {
        const producto = await mongoose.model('Producto').findById(item.producto);
        if (!producto || producto.stock < item.cantidad) {
            throw new Error(`Stock insuficiente para ${producto ? producto.nombre : 'producto no encontrado'}`);
        }
    }
    return true;
};

// Método para actualizar stock
pedidoSchema.methods.actualizarStock = async function() {
    for (let item of this.productos) {
        await mongoose.model('Producto').findByIdAndUpdate(
            item.producto,
            { $inc: { stock: -item.cantidad } }
        );
    }
};

// Método para restaurar stock (en caso de cancelación)
pedidoSchema.methods.restaurarStock = async function() {
    for (let item of this.productos) {
        await mongoose.model('Producto').findByIdAndUpdate(
            item.producto,
            { $inc: { stock: item.cantidad } }
        );
    }
};

// Índices
pedidoSchema.index({ usuario: 1, createdAt: -1 });
pedidoSchema.index({ codigoPedido: 1 }, { unique: true });

const Pedido = mongoose.model('Pedido', pedidoSchema);

module.exports = Pedido;