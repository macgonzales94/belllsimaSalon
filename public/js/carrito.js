// carrito.js
const API_BASE_URL = '/api';

// Rutas centralizadas
const routes = {
    carrito: `${API_BASE_URL}/carrito`,
    auth: {
        login: `${API_BASE_URL}/usuarios/login`,
        registro: `${API_BASE_URL}/usuarios/registro`
    }
};

// Verificar si el usuario está logueado
function isLoggedIn() {
    return localStorage.getItem('token') !== null;
}


async function cargarCarrito() {
    if (isLoggedIn()) {
        await cargarCarritoServidor();
    } else {
        cargarCarritoTemporal();
    }
}

// Cargar carrito del servidor
async function cargarCarritoServidor() {
    try {
        const response = await fetch(routes.carrito, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Error en la respuesta del servidor');
        }

        const carrito = await response.json();
        mostrarCarrito(carrito);
        calcularTotales(carrito);
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('Error al cargar carrito');
    }
}
// Cargar carrito temporal
function cargarCarritoTemporal() {
    const carritoTemp = JSON.parse(localStorage.getItem('carritoTemp') || '[]');
    mostrarCarrito({ productos: carritoTemp });
    calcularTotales({ productos: carritoTemp });
}

// Mostrar modal de autenticación
function mostrarModalAuth() {
    const modalHTML = `
        <div id="authModal" class="modal">
            <div class="modal-content">
                <span class="close">&times;</span>
                <h2>Para completar tu compra, inicia sesión o crea una cuenta</h2>
                <div class="auth-buttons">
                    <button id="btnMostrarLogin" class="btn-primary">Iniciar sesión</button>
                    <button id="btnMostrarRegistro" class="btn-secondary">Crear cuenta</button>
                </div>
                <form id="loginForm" class="auth-form" style="display: none;">
                    <div class="form-group">
                        <input type="email" id="loginEmail" required placeholder="Email">
                    </div>
                    <div class="form-group">
                        <input type="password" id="loginPassword" required placeholder="Contraseña">
                    </div>
                    <button type="submit" class="btn-submit">Ingresar</button>
                </form>
                <form id="registroForm" class="auth-form" style="display: none;">
                    <div class="form-group">
                        <input type="text" id="regNombre" required placeholder="Nombre completo">
                    </div>
                    <div class="form-group">
                        <input type="email" id="regEmail" required placeholder="Email">
                    </div>
                    <div class="form-group">
                        <input type="password" id="regPassword" required placeholder="Contraseña">
                    </div>
                    <div class="form-group">
                        <input type="tel" id="regTelefono" placeholder="Teléfono">
                    </div>
                    <button type="submit" class="btn-submit">Crear cuenta</button>
                </form>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    abrirModalListeners();
}

// Configurar listeners del modal
function abrirpModalListeners() {
    const modal = document.getElementById('authModal');
    const btnMostrarLogin = document.getElementById('btnMostrarLogin');
    const btnMostrarRegistro = document.getElementById('btnMostrarRegistro');
    const loginForm = document.getElementById('loginForm');
    const registroForm = document.getElementById('registroForm');
    const closeBtn = modal.querySelector('.close');

    btnMostrarLogin?.addEventListener('click', () => {
        loginForm.style.display = 'block';
        registroForm.style.display = 'none';
    });

    btnMostrarRegistro?.addEventListener('click', () => {
        loginForm.style.display = 'none';
        registroForm.style.display = 'block';
    });

    closeBtn?.addEventListener('click', () => {
        modal.remove();
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });

    setupAuthForms();
}


// Configurar formularios de autenticación
function setupAuthForms() {
    const loginForm = document.getElementById('loginForm');
    const registroForm = document.getElementById('registroForm');

    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await manejarLogin(e);
    });

    registroForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await manejarRegistro(e);
    });
}


// Manejar login
async function manejarLogin(e) {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const response = await fetch(routes.auth.login, {
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
            
            await transferirCarritoYProceder();

        } else {
            mostrarMensaje(data.mensaje || 'Error al iniciar sesión');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('Error al iniciar sesión');
    }
}

// Manejar registro
async function manejarRegistro(e) {
    const formData = {
        nombre: document.getElementById('regNombre').value,
        email: document.getElementById('regEmail').value,
        password: document.getElementById('regPassword').value,
        telefono: document.getElementById('regTelefono').value
    };

    try {
        const response = await fetch(routes.auth.registro, {
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
            await transferirCarritoYProceder();
        } else {
            mostrarMensaje(data.mensaje || 'Error al registrar usuario');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('Error al registrar usuario');
    }
}

// Transferir carrito temporal al servidor y proceder al checkout
async function transferirCarritoYProceder() {
    try {
        const carritoTemp = JSON.parse(localStorage.getItem('carritoTemp') || '[]');
        if (carritoTemp.length > 0) {
            // Primero verificar si ya existe un carrito activo
            const verificarCarrito = await fetch(routes.carrito, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const carritoExistente = await verificarCarrito.json();

            // Si existe un carrito, actualizar. Si no, crear nuevo
            const method = carritoExistente._id ? 'PUT' : 'POST';
            const url = carritoExistente._id ?
                `${routes.carrito}/${carritoExistente._id}` :
                routes.carrito;

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    productos: carritoTemp,
                    actualizar: true // Flag para el backend
                })
            });

            if (!response.ok) {
                throw new Error('Error al transferir carrito');
            }

            localStorage.removeItem('carritoTemp');
        }

        // Obtener el ID del carrito actual antes de redirigir
        const carritoActual = await fetch(routes.carrito, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        const { _id: carritoId } = await carritoActual.json();

        // Redirigir con el ID del carrito
        window.location.href = `checkout.html?carritoId=${carritoId}`;
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('Error al procesar el carrito');
    }
}

// Mostrar mensaje
function mostrarMensaje(mensaje) {
    const mensajeDiv = document.createElement('div');
    mensajeDiv.className = 'mensaje-flotante';
    mensajeDiv.textContent = mensaje;
    document.body.appendChild(mensajeDiv);
    setTimeout(() => mensajeDiv.remove(), 3000);
}

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    cargarCarrito();

    const btnProcederPago = document.getElementById('btnProcederPago');
    btnProcederPago?.addEventListener('click', () => {
        if (!isLoggedIn()) {
            mostrarModalAuth();
        } else {
            transferirCarritoYProceder();
        }
    });
});