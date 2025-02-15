// src/config/socketConfig.js
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('./config');

function configureSocket(server) {
    const io = new Server(server, {
        path: '/api/socket.io', // Especificar el path para coincidir con el cliente
        cors: {
            origin: config.cors.origin,
            methods: ['GET', 'POST'],
            credentials: true
        },
        transports: ['polling', 'websocket'], // Permitir ambos transportes
        allowUpgrades: true,
        pingTimeout: 60000, // Aumentar el timeout
        pingInterval: 25000,
        cookie: {
            name: 'io',
            path: '/',
            httpOnly: true,
            sameSite: 'lax'
        }
    });

    // Middleware para manejar la autenticación
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                socket.userData = decoded; // Guardar datos del usuario en el socket
                next();
            } catch (error) {
                console.log('Error de autenticación:', error.message);
                next();
            }
        } else {
            next(); // Permitir conexiones sin autenticación
        }
    });

    io.on('connection', (socket) => {
        console.log('Nuevo cliente conectado:', socket.id);
        
        const isAuthenticated = !!socket.userData;
        const userName = isAuthenticated ? socket.userData.nombre : '';

        // Unir al usuario a la sala general
        socket.join('sala_general');

        // Enviar mensaje de bienvenida personalizado
        if (isAuthenticated && userName) {
            socket.emit('mensaje_sistema', {
                mensaje: `¡Hola bienvenido a Bellisima, ${userName}!`,
                isAuthenticated: true,
                userName: userName
            });
        } else {
            socket.emit('mensaje_sistema', {
                mensaje: '¡Hola bienvenido a Bellisima!',
                isAuthenticated: false
            });
        }

        // Manejar mensajes entrantes
        socket.on('enviarMensaje', (data) => {
            const mensaje = {
                contenido: data.contenido,
                usuario: isAuthenticated ? userName : 'Visitante',
                timestamp: new Date(),
                isAuthenticated: isAuthenticated
            };

            // Emitir el mensaje a todos en la sala general
            io.to('sala_general').emit('nuevoMensaje', mensaje);
        });

        // Indicador de escritura con debounce
        let escrituraTimeout;
        socket.on('escribiendo', () => {
            clearTimeout(escrituraTimeout);
            
            socket.broadcast.emit('usuario_escribiendo', {
                usuario: isAuthenticated ? userName : 'Visitante'
            });

            escrituraTimeout = setTimeout(() => {
                socket.broadcast.emit('usuario_dejo_de_escribir');
            }, 2000);
        });

        // Manejar errores de socket
        socket.on('error', (error) => {
            console.error('Error en el socket:', error);
            socket.emit('mensaje_sistema', {
                mensaje: 'Hubo un error en la conexión',
                tipo: 'error'
            });
        });

        // Manejar reconexiones
        socket.on('reconnect', (attemptNumber) => {
            console.log('Cliente reconectado después de', attemptNumber, 'intentos');
        });

        // Manejar desconexiones
        socket.on('disconnect', (reason) => {
            console.log('Cliente desconectado:', isAuthenticated ? userName : 'Visitante', 'Razón:', reason);
            clearTimeout(escrituraTimeout);
        });
    });

    return io;
}

module.exports = configureSocket;