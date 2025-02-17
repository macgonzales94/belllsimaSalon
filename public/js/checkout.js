// checkout.js

// Configuración y Variables Globales
const API_BASE_URL = '/api';
const routes = {
    //usuario:`${API_BASE_URL}usuarios/${id}`,
    carrito: `${API_BASE_URL}/carrito`,
    pedidos: {
        crearDesdeCarrito: `${API_BASE_URL}/pedidos/crear-desde-carrito`,
        obtener: (id) => `${API_BASE_URL}/pedidos/${id}`
    },
    pagos: {
        config: `${API_BASE_URL}/pagos/config`,
        generarToken: `${API_BASE_URL}/pagos/generar-token`,
        procesar: `${API_BASE_URL}/pagos/procesar`
    }
};

let pedidoId = null;
let carrito = null;
let resultadoPago = null;

// Funciones de Utilidad
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'productos.html';
        return null;
    }
    return token;
}

function mostrarError(mensaje) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-mensaje';
    errorDiv.textContent = mensaje;

    const form = document.querySelector('.checkout-form');
    form.insertBefore(errorDiv, form.firstChild);

    setTimeout(() => errorDiv.remove(), 3000);
}

// Función modificada para obtener el ID del pedido
function obtenerPedidoId() {
    console.log('Obteniendo ID del pedido...');
    
    // Primero intentar obtener de la URL
    const urlParams = new URLSearchParams(window.location.search);
    const pedidoIdFromUrl = urlParams.get('pedidoId');
    
    // Si no está en la URL, intentar obtener del localStorage
    const pedidoIdFromStorage = localStorage.getItem('pedidoActual');
    
    // Usar el ID de la URL si existe, sino usar el del localStorage
    const pedidoId = pedidoIdFromUrl || pedidoIdFromStorage;
    
    console.log('PedidoId desde URL:', pedidoIdFromUrl);
    console.log('PedidoId desde localStorage:', pedidoIdFromStorage);
    console.log('PedidoId final:', pedidoId);

    if (!pedidoId) {
        console.log('No se encontró ID del pedido');
        return null;
    }

    return pedidoId;
}

function validarFormulario() {
    const numero = document.getElementById('numeroTarjeta').value.replace(/\s/g, '');
    const cvv = document.getElementById('cvv').value;
    const [mes, anio] = document.getElementById('fechaVencimiento').value.split('/');
    const email = document.getElementById('email').value;

    if (!numero || numero.length < 13) throw new Error('Número de tarjeta inválido');
    if (!cvv || cvv.length < 3) throw new Error('CVV inválido');
    if (!mes || !anio || mes.length !== 2 || anio.length !== 2) {
        throw new Error('Fecha de vencimiento inválida');
    }
    if (!email || !email.includes('@')) throw new Error('Email inválido');

    return {
        card_number: numero,
        cvv,
        expiration_month: mes,
        expiration_year: '20' + anio,
        email
    };
}

function obtenerDireccion() {
    const direccion = {
        calle: document.getElementById('calle').value,
        ciudad: document.getElementById('ciudad').value,
        estado: document.getElementById('distrito').value,
        codigoPostal: document.getElementById('codigoPostal').value,
        telefono: document.getElementById('telefono').value
    };

    if (!direccion.calle || !direccion.ciudad || !direccion.estado ||
        !direccion.codigoPostal || !direccion.telefono) {
        throw new Error('Por favor complete todos los campos de dirección');
    }

    return direccion;
}

function mostrarResumenCompra() {
    if (!carrito || !carrito.productos) return;

    const carritoId = carrito._id

    const subtotal = carrito.productos.reduce((total, item) =>
        total + (item.precioUnitario * item.cantidad), 0);
    const envio = subtotal > 100 ? 0 : 10;
    const total = subtotal + envio;

    document.getElementById('subtotal').textContent = `S/. ${subtotal.toFixed(2)}`;
    document.getElementById('envio').textContent = `S/. ${envio.toFixed(2)}`;
    document.getElementById('total').textContent = `S/. ${total.toFixed(2)}`;
    document.getElementById('carritoId').textContent = carritoId;

    const resumenProductos = document.getElementById('resumenProductos');
    resumenProductos.innerHTML = carrito.productos.map(item => `
        <div class="resumen-item">
            <span>${item.producto.nombre} x ${item.cantidad}</span>
            <span>S/. ${(item.precioUnitario * item.cantidad).toFixed(2)}</span>
        </div>
    `).join('');
}

function validarEstadoCarrito() {
    const token = localStorage.getItem('token');
    if (!token) {
        console.error('Usuario no autenticado');
        window.location.href = 'productos.html';
        return false;
    }

    // Obtener pedidoId de ambas fuentes
    const pedidoId = obtenerPedidoId();
    
    if (!pedidoId) {
        console.error('No se encontró un pedido activo');
        window.location.href = 'productos.html';
        return false;
    }

    return true;
}
// Nueva función para limpiar datos después del pago exitoso
function limpiarDatosDespuesDePago() {
    localStorage.removeItem('pedidoActual');
    localStorage.removeItem('carritoTemp');
    // Cualquier otro dato que necesite ser limpiado
}

// Funciones de Carrito y Resumen
async function cargarCarrito() {
    try {
        const token = checkAuth();
        if (!token) return;

        console.log('Token:', token); // Muestra el token

        const response = await fetch(routes.carrito, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Error al cargar el carrito');

        carrito = await response.json();
        console.log('Datos del carrito:', carrito); // Muestra todo el carrito
        console.log('Productos:', carrito.productos); // Muestra solo los productos
        console.log('Respuesta completa:', {
            productos: carrito.productos,
            total: carrito.total,
            cantidadItems: carrito.productos.length
        });

        mostrarResumenCompra();
    } catch (error) {
        console.error('Error:', error);
        mostrarError('Error al cargar el carrito');
    }
}

// Funciones de Pago
async function obtenerConfigCulqi() {
    try {
        const response = await fetch(routes.pagos.config, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        const data = await response.json();
        return data.publicKey;
    } catch (error) {
        console.error('Error al obtener config:', error);
        throw new Error('Error al obtener configuración de pago');
    }
}

// Función para crear pedido desde el carrito
async function crearPedidoDesdeCarrito() {
    try {
        console.log('Iniciando creación de pedido desde carrito...');

        const response = await fetch(routes.pedidos.crearDesdeCarrito, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                metodoPago: 'culqi',
                origen: 'web'
            })
        });

        const data = await response.json();
        console.log('Respuesta crear pedido:', data);

        if (!response.ok) {
            throw new Error(data.mensaje || 'Error al crear pedido');
        }

        // Guardar el pedido creado
        localStorage.setItem('pedidoActual', data.pedido._id);
        localStorage.setItem('codigoPedido', data.pedido.codigoPedido);

        return data.pedido;
    } catch (error) {
        console.error('Error al crear pedido:', error);
        throw error;
    }
}

async function generarTokenCulqi(datosTarjeta) {
    try {
        const response = await fetch(routes.pagos.generarToken, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(datosTarjeta)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.mensaje || 'Error al generar token');
        }

        const data = await response.json();
        return data.token;
    } catch (error) {
        console.error('Error:', error);
        throw new Error('Error al procesar la tarjeta');
    }
}
async function procesarPago(token) {
    console.log('Iniciando procesamiento de pago...');
    console.log('Token recibido:', token);

    // Obtener el ID del pedido existente
    const pedidoId = obtenerPedidoId();
    if (!pedidoId) {
        throw new Error('No se encontró el ID del pedido');
    }


    try {
        // Obtener y verificar dirección
        console.log('Obteniendo dirección de envío...');
        const direccion = obtenerDireccion();
        console.log('Dirección obtenida:', direccion);

        // Obtener y verificar datos del formulario
        console.log('Obteniendo datos del formulario...');
        const email = document.getElementById('email').value;
        const nombre = document.getElementById('nombre').value;
        const apellido = document.getElementById('apellido').value;
        console.log('Datos del formulario:', { email, nombre, apellido });

        // Preparar datos del cargo
        const cargoData = {
            amount: parseInt((carrito.total * 100).toFixed(0)),
            currency_code: "PEN",
            email: email,
            source_id: token,
            description: `pedido ${pedidoId}`,
            antifraud_details: {
                address: direccion.calle,
                address_city: direccion.ciudad,
                country_code: "PE",
                phone: direccion.telefono,
                first_name: nombre,
                last_name: apellido
            }
        };
        console.log('Datos del cargo preparados:', cargoData);

        // Preparar datos completos para enviar
        const bodyData = {
            token,
            pedidoId,
            direccionEnvio: direccion,
            cargoData: cargoData
        };
        console.log('Datos completos a enviar:', bodyData);

        // Realizar petición
        console.log('Enviando petición a:', routes.pagos.procesar);
        const response = await fetch(routes.pagos.procesar, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
            body: JSON.stringify(bodyData)
        });

        console.log('Estado de la respuesta:', response.status);
        console.log('Headers de la respuesta:', Object.fromEntries(response.headers));

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.mensaje || 'Error al procesar el pago');
        }

        const resultadoPago = await response.json();
        return resultadoPago;

    } catch (error) {
        console.error('Error en procesamiento:', error);
        throw error;
    }
}

async function manejarPago() {
    const btnPagar = document.getElementById('btnPagar');
    btnPagar.disabled = true;
    btnPagar.textContent = 'Procesando...';

    try {
        // Validar estado del carrito antes de proceder
        if (!validarEstadoCarrito()) {
            throw new Error('Estado del carrito inválido');
        }

        const datosTarjeta = validarFormulario();
        const publicKey = await obtenerConfigCulqi();
        if (!publicKey) throw new Error('Error al obtener configuración');

        const token = await generarTokenCulqi(datosTarjeta);
        if (!token) throw new Error('No se pudo generar el token');

        const resultadoPago = await procesarPago(token);

        if (resultadoPago.success) {  // Verificamos el resultado
            limpiarDatosDespuesDePago();
            window.location.href = 'confirmacion.html';
        } else {
            throw new Error(resultadoPago.mensaje || 'Error en el pago');
        }


        window.location.href = 'confirmacion.html';

    } catch (error) {
        console.log(manejarPago);
        console.error('Error:', error);
        mostrarError(error.message);
    } finally {
        btnPagar.disabled = false;
        btnPagar.textContent = 'Realizar Pago';
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {

    if (!localStorage.getItem('token')) {
        window.location.href = 'productos.html';
        return;
    }

    if (!validarEstadoCarrito()) {
        return;
    }

    cargarCarrito();

    document.getElementById('btnPagar').addEventListener('click', manejarPago);

    document.getElementById('numeroTarjeta').addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        value = value.replace(/(\d{4})/g, '$1 ').trim();
        e.target.value = value;
    });

    document.getElementById('fechaVencimiento').addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length >= 2) {
            value = value.substring(0, 2) + '/' + value.substring(2, 4);
        }
        e.target.value = value;
    });

    document.getElementById('cvv').addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '').substring(0, 4);
    });
});