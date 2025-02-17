// src/config/database.js
const mongoose = require('mongoose');

const conectarDB = async () => {
    try {
        const connection = await mongoose.connect(process.env.MONGODB_URI);
        
        // Configurar opciones globales de Mongoose (opcional)
        mongoose.set('strictQuery', false);
        
        console.log(`MongoDB Conectado: ${connection.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = conectarDB;