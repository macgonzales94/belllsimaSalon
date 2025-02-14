const API_BASE_URL = '/api'

// Rutas centralizadas
const routes = {
    productos: `${API_BASE_URL}/productos`,
    productoById: (id) => `${API_BASE_URL}/productos/${id}`,
    login: `${API_BASE_URL}/usuarios/login`,
    registro: `${API_BASE_URL}/usuarios/registro`,
    sincronizarCarrito: `${API_BASE_URL}/carrito/sincronizar`,
    crearPedido: `${API_BASE_URL}/pedidos/crear-desde-carrito`
  };

function isLoggedIn() {
    return localStorage.getItem('token') !== null;
}

// Cargar productos
async function cargarProductos() {
    try {
        const response = await fetch(routes.productos);
        if (!response.ok) throw new Error('Error en la respuesta del servidor');
        
        const data = await response.json();
        if (!data.productos || !Array.isArray(data.productos)) {
            throw new Error('Formato de datos inválido');
        }
        
        mostrarProductos(data.productos);
        verificarCarritoTemporal();
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('Error al cargar productos: ' + error.message);
    }
}

// Verificar carrito temporal
function verificarCarritoTemporal() {
    if (!isLoggedIn() && localStorage.getItem('carritoTemp')) {
        mostrarMensajeBienvenida();
    }
}

function actualizarResumenCompra() {
    const carritoTemp = JSON.parse(localStorage.getItem('carritoTemp') || '[]');
    
    // Calcular subtotal
    const subtotal = carritoTemp.reduce((total, item) => 
        total + (item.producto.precio * item.cantidad), 0);
    
    // Calcular envío
    const envio = subtotal > 100 ? 0 : 10;
    
    // Calcular total
    const total = subtotal + envio;

    // Actualizar DOM
    document.getElementById('subtotal').textContent = `S/. ${subtotal.toFixed(2)}`;
    document.getElementById('envio').textContent = `S/. ${envio.toFixed(2)}`;
    document.getElementById('total').textContent = `S/. ${total.toFixed(2)}`;
}

// Agregar al carrito
async function agregarAlCarrito(productoId) {
    if (!productoId) {
        mostrarMensaje('Error: Producto inválido');
        return;
    }

    const carritoTemp = JSON.parse(localStorage.getItem('carritoTemp') || '[]');
    if (carritoTemp.length >= 20) {
        mostrarMensaje('No puedes agregar más productos al carrito');
        return;
    }

    try {
        const response = await fetch(routes.productoById(productoId));
        const producto = await response.json();

        if (!isLoggedIn()) {
            const productoExistente = carritoTemp.find(item => item.producto._id === productoId);
            if (productoExistente) {
                productoExistente.cantidad += 1;
            } else {
                carritoTemp.push({
                    producto: producto,
                    cantidad: 1,
                    precioUnitario: producto.precio
                });
            }
            localStorage.setItem('carritoTemp', JSON.stringify(carritoTemp));
        } else {
            await agregarProductoServidor(productoId);
        }

        actualizarContadorCarrito();
        actualizarResumenCompra();
        mostrarMensaje('Producto agregado al carrito');
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('Error al agregar producto');
    }
}
// Mostrar productos
function mostrarProductos(productos) {
    const container = document.getElementById('productosContainer');
    container.innerHTML = productos.map(producto => `
        <div class="producto-card">
            <img src="${producto.imagenes[0]?.url || 'assets/placeholder.jpg'}" 
                 alt="${producto.nombre}"
                 class="producto-imagen">
            <div class="producto-info">
                <h3>${producto.nombre}</h3>
                <p class="marca">${producto.marca}</p>
                <p class="precio">S/. ${producto.precio.toFixed(2)}</p>
                <button onclick="agregarAlCarrito('${producto._id}')" 
                        class="btn-agregar">
                    Agregar al carrito
                </button>
            </div>
        </div>
    `).join('');
}

// Actualizar contador del carrito
function actualizarContadorCarrito() {
    const carritoTemp = JSON.parse(localStorage.getItem('carritoTemp') || '[]');
    const contador = carritoTemp.reduce((total, item) => total + item.cantidad, 0);
    
    const contadorElement = document.querySelector('.cart-count');
    if (contadorElement) {
        contadorElement.textContent = contador;
    }
}

function mostrarModalAuth() {
    const modal = document.getElementById('authModal');
    if (modal) {
        modal.style.display = 'block';
        inicializarModal(); // Inicializar los event listeners del modal
    }
}

// Función para sincronizar el carrito temporal con el servidor
async function sincronizarCarritoConServidor() {
    try {
        const carritoTemp = JSON.parse(localStorage.getItem('carritoTemp') || '[]');
        if (carritoTemp.length === 0) return;

        const token = localStorage.getItem('token');
        if (!token) return;

        const response = await fetch(routes.sincronizarCarrito, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                productos: carritoTemp.map(item => ({
                    producto: item.producto._id,
                    cantidad: item.cantidad
                }))
            })
        });

        if (!response.ok) {
            throw new Error('Error al sincronizar el carrito');
        }

        localStorage.removeItem('carritoTemp');
        actualizarContadorCarrito();
        actualizarResumenCompra();

    } catch (error) {
        console.error('Error al sincronizar carrito:', error);
        mostrarMensaje('Error al sincronizar tu carrito');
    }
}


function inicializarModal() {
    if (!document.getElementById('authModal')) {
        console.error('Modal de autenticación no encontrado');
        return;
    }
    // Event listeners para los botones del modal
    const btnLogin = document.getElementById('btnLogin');
    const btnRegistro = document.getElementById('btnRegistro');
    const loginForm = document.getElementById('loginForm');
    const registroForm = document.getElementById('registroForm');

    if (btnLogin) {
        btnLogin.addEventListener('click', () => {
            loginForm.style.display = 'block';
            registroForm.style.display = 'none';
        });
    }

    if (btnRegistro) {
        btnRegistro.addEventListener('click', () => {
            loginForm.style.display = 'none';
            registroForm.style.display = 'block';
        });
    }

  // Login form handler
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {
            const response = await fetch(routes.login, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();
            if (response.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('usuario', JSON.stringify(data.usuario));
                await sincronizarCarritoConServidor();
                window.location.href = 'checkout.html';
            } else {
                mostrarMensaje(data.mensaje || 'Error al iniciar sesión');
            }
        } catch (error) {
            console.error('Error:', error);
            mostrarMensaje('Error al iniciar sesión');
        }
    });
}

if (registroForm) {
    registroForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = {
            nombre: document.getElementById('regNombre').value,
            email: document.getElementById('regEmail').value,
            password: document.getElementById('regPassword').value,
            telefono: document.getElementById('regTelefono').value
        };

        try {
            const response = await fetch(routes.registro, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();
            if (response.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('usuario', JSON.stringify(data.usuario));
                await sincronizarCarritoConServidor();
                window.location.href = 'checkout.html';
            } else {
                mostrarMensaje(data.mensaje || 'Error al registrar usuario');
            }
        } catch (error) {
            console.error('Error:', error);
            mostrarMensaje('Error al registrar usuario');
        }
    });
}
}

async function procederAlPago() {
    if (!isLoggedIn()) {
        mostrarModalAuth();
        return;
    }

    try {
        const btnProcederPago = document.getElementById('btnProcederPago');
        btnProcederPago.disabled = true;
        btnProcederPago.textContent = 'Procesando...';

        // Verificar que haya productos en el carrito
        const carritoTemp = JSON.parse(localStorage.getItem('carritoTemp') || '[]');
        if (!carritoTemp.length) {
            throw new Error('El carrito está vacío');
        }

        // Crear el pedido desde el carrito
        const response = await fetch(routes.crearPedido, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.mensaje || 'Error al crear el pedido');
        }

        const { pedido } = await response.json();
        
        // Limpiar el carrito temporal
        localStorage.removeItem('carritoTemp');
        
        // Guardar el ID del pedido en localStorage para recuperarlo en checkout
        localStorage.setItem('pedidoActual', pedido._id);
        
        // Redirigir a checkout
        window.location.href = `checkout.html?pedidoId=${pedido._id}`;

    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje(error.message || 'Error al procesar el pedido');
    } finally {
        const btnProcederPago = document.getElementById('btnProcederPago');
        if (btnProcederPago) {
            btnProcederPago.disabled = false;
            btnProcederPago.textContent = 'Proceder al Pago';
        }
    }
}

// Event listeners para el modal
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('close')) {
        const modal = document.getElementById('authModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
    cargarProductos();
    actualizarContadorCarrito();
    actualizarResumenCompra();
    inicializarModal();
    
    const btnProcederPago = document.getElementById('btnProcederPago');
    if (btnProcederPago) {
        btnProcederPago.addEventListener('click', procederAlPago);
    }
});