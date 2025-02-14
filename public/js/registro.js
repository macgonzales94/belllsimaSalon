// registro.js
const API_BASE_URL = '/api';


// Rutas centralizadas
const routes = {
    auth: {
        registro: `${API_BASE_URL}/usuarios/registro`
    },
    pages: {
        login: '/login.html'
    }
};

// Validaciones de campos
const validaciones = {
    nombre: {
        min: 2,
        max: 50,
        pattern: /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/,
        mensaje: 'El nombre debe contener solo letras y espacios'
    },
    email: {
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        mensaje: 'Ingrese un email válido'
    },
    password: {
        min: 6,
        mensaje: 'La contraseña debe tener al menos 6 caracteres'
    },
    telefono: {
        pattern: /^\d{9}$/,
        mensaje: 'Ingrese un número de teléfono válido (9 dígitos)'
    }
};

// Mostrar mensaje de error o éxito
function mostrarMensaje(mensaje, tipo = 'error') {
    const mensajeDiv = document.getElementById('mensajeFeedback') || crearDivMensaje();
    mensajeDiv.textContent = mensaje;
    mensajeDiv.className = `mensaje-${tipo}`;
    mensajeDiv.style.display = 'block';

    setTimeout(() => {
        mensajeDiv.style.display = 'none';
    }, 3000);
}

// Crear div para mensajes si no existe
function crearDivMensaje() {
    const mensajeDiv = document.createElement('div');
    mensajeDiv.id = 'mensajeFeedback';
    const form = document.getElementById('registroForm');
    form.insertBefore(mensajeDiv, form.firstChild);
    return mensajeDiv;
}

// Validar campo individual
function validarCampo(nombre, valor) {
    const validacion = validaciones[nombre];
    if (!validacion) return true;

    if (validacion.min && valor.length < validacion.min) {
        throw new Error(`${nombre} debe tener al menos ${validacion.min} caracteres`);
    }

    if (validacion.max && valor.length > validacion.max) {
        throw new Error(`${nombre} no debe exceder ${validacion.max} caracteres`);
    }

    if (validacion.pattern && !validacion.pattern.test(valor)) {
        throw new Error(validacion.mensaje);
    }

    return true;
}

// Validar todos los campos del formulario
function validarFormulario(formData) {
    if (!formData.nombre || !formData.email || !formData.password) {
        throw new Error('Por favor complete todos los campos obligatorios');
    }

    validarCampo('nombre', formData.nombre);
    validarCampo('email', formData.email);
    validarCampo('password', formData.password);

    if (formData.telefono) {
        validarCampo('telefono', formData.telefono);
    }
}

// Toggle estado del botón de submit
function toggleBotonSubmit(disabled = true) {
    const submitBtn = document.querySelector('#registroForm button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = disabled;
        submitBtn.textContent = disabled ? 'Procesando...' : 'Registrarse';
    }
}

// Manejar el proceso de registro
// Manejar el proceso de registro
async function manejarRegistro(formData) {
    try {
        validarFormulario(formData);

        const response = await fetch(routes.auth.registro, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.mensaje || 'Error en el registro');
        }

        mostrarMensaje('Registro exitoso. Redirigiendo...', 'exito');
        
        // Esperar un momento para que el usuario vea el mensaje de éxito
        setTimeout(() => {
            window.location.href = routes.pages.login;
        }, 2000);

    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje(error.message);
        return false;
    }
    return true;
}

// Limpiar espacios en blanco de los campos
function limpiarCampos(formData) {
    return {
        ...formData,
        nombre: formData.nombre.trim(),
        email: formData.email.trim().toLowerCase(),
        telefono: formData.telefono?.trim(),
        'direccion.calle': formData['direccion.calle']?.trim()
    };
}

// Inicializar evento del formulario
document.addEventListener('DOMContentLoaded', () => {
    const registroForm = document.getElementById('registroForm');
    
    if (!registroForm) {
        console.error('No se encontró el formulario de registro');
        return;
    }

    registroForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        toggleBotonSubmit(true);

        const formData = {
            nombre: document.getElementById('nombre')?.value,
            email: document.getElementById('email')?.value,
            password: document.getElementById('password')?.value,
            telefono: document.getElementById('telefono')?.value,
            direccion: {
                calle: document.getElementById('direccion')?.value
            }
        };

        const formDataLimpio = limpiarCampos(formData);
        const registroExitoso = await manejarRegistro(formDataLimpio);

        if (!registroExitoso) {
            toggleBotonSubmit(false);
        }
    });

    // Validación en tiempo real
    Object.keys(validaciones).forEach(campo => {
        const input = document.getElementById(campo);
        if (input) {
            input.addEventListener('blur', () => {
                try {
                    validarCampo(campo, input.value);
                    input.classList.remove('invalid');
                    input.classList.add('valid');
                } catch (error) {
                    input.classList.remove('valid');
                    input.classList.add('invalid');
                    mostrarMensaje(error.message);
                }
            });
        }
    });
});