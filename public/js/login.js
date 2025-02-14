// login.js
const API_BASE_URL = '/api';

// Rutas centralizadas
const routes = {
    auth: {
        login: `${API_BASE_URL}/usuarios/login`
    },
    dashboard: {
        admin: '/pages/admin/dashboard.html',
        cliente: '/pages/cliente/dashboard.html'
    }
};

// Función para mostrar mensajes de error
function mostrarError(mensaje) {
    const errorDiv = document.getElementById('errorMensaje') || createErrorDiv();
    errorDiv.textContent = mensaje;
    errorDiv.style.display = 'block';
    
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 3000);
}

// Crear div para mensajes de error si no existe
function createErrorDiv() {
    const errorDiv = document.createElement('div');
    errorDiv.id = 'errorMensaje';
    errorDiv.className = 'error-mensaje';
    const form = document.getElementById('loginForm');
    form.insertBefore(errorDiv, form.firstChild);
    return errorDiv;
}

// Validar campos del formulario
function validarFormulario(email, password) {
    const errores = [];
    
    // Validar email
    if (!email || email.trim() === '') {
        errores.push('El email es requerido');
    } else if (!email.includes('@') || !email.includes('.')) {
        errores.push('Por favor ingrese un email válido');
    }
    
    // Validar password
    if (!password || password.trim() === '') {
        errores.push('La contraseña es requerida');
    }
    
    return errores;
}

// Función para mostrar errores
function mostrarError(mensaje) {
    const errorDiv = document.getElementById('error-mensaje') || crearErrorDiv();
    errorDiv.textContent = mensaje;
    errorDiv.style.display = 'block';
    
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 3000);
}

// Crear div para mensajes de error si no existe
function crearErrorDiv() {
    const errorDiv = document.createElement('div');
    errorDiv.id = 'error-mensaje';
    errorDiv.style.cssText = `
        color: #721c24;
        background-color: #f8d7da;
        border: 1px solid #f5c6cb;
        border-radius: 4px;
        padding: 10px;
        margin-bottom: 10px;
        text-align: center;
    `;
    const form = document.getElementById('loginForm');
    form.insertBefore(errorDiv, form.firstChild);
    return errorDiv;
}

// Guardar datos de la sesión
function guardarSesion(data) {
    if (!data.token) {
        throw new Error('No se recibió el token de autenticación');
    }
    
    localStorage.setItem('token', data.token);
    
    if (data.usuario) {
        localStorage.setItem('usuario', JSON.stringify(data.usuario));
    }
}

// Redirigir según el rol del usuario
function redirigirSegunRol(usuario) {
    if (!usuario) {
        throw new Error('No se recibió información del usuario');
    }
    
    const ruta = usuario.rol === 'admin' ? 
        routes.dashboard.admin : 
        routes.dashboard.cliente;
    
    window.location.href = ruta;
}

// Manejar el proceso de login
async function manejarLogin(email, password) {
    try {
        validarFormulario(email, password);

        const response = await fetch(routes.auth.login, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.mensaje || 'Error al iniciar sesión');
        }

        guardarSesion(data);
        redirigirSegunRol(data.usuario);

    } catch (error) {
        console.error('Error:', error);
        mostrarError(error.message);
    }
}

// Deshabilitar botón mientras se procesa
function toggleBotonSubmit(disabled = true) {
    const submitBtn = document.querySelector('#loginForm button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = disabled;
        submitBtn.textContent = disabled ? 'Procesando...' : 'Iniciar Sesión';
    }
}

// Inicializar evento del formulario
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    
    if (!loginForm) {
        console.error('No se encontró el formulario de login');
        return;
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        toggleBotonSubmit(true);
        
        const email = document.getElementById('email')?.value?.trim();
        const password = document.getElementById('password')?.value;
        
        await manejarLogin(email, password);
        toggleBotonSubmit(false);
    });
});

// Manejar el submit del formulario
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    // Validar formulario
    const errores = validarFormulario(email, password);
    if (errores.length > 0) {
        mostrarError(errores[0]);
        return;
    }
    
    // Si la validación es exitosa, proceder con el login
    try {
        const response = await fetch(`${API_BASE_URL}/usuarios/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.mensaje || 'Error al iniciar sesión');
        }

        if (data.token) {
            localStorage.setItem('token', data.token);
            
            // Redirigir según el rol
            if (data.usuario?.rol === 'admin') {
                window.location.href = '/pages/admin/dashboard.html';
            } else {
                window.location.href = '/pages/cliente/dashboard.html';
            }
        } else {
            throw new Error('No se recibió el token de autenticación');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarError(error.message);
    }
});