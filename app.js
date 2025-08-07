// Utilidad para eliminar la carpeta de sesión
async function eliminarCarpetaSesion(sessionPath) {
    try {
        await rimraf(sessionPath);
        return { success: true };
    } catch (err) {
        return { success: false, error: err };
    }
}
import fs from "fs";

// ...existing code...

import { rimraf } from "rimraf";


import {
    makeWASocket,
    useMultiFileAuthState,
    Browsers,
    DisconnectReason
} from "baileys";
import PINO from "pino";
import qrcode from "qrcode-terminal";
import express from "express";
import { engine } from "express-handlebars";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configurar Express
const app = express();
const PORT = process.env.PORT || 3000;

// Configurar Handlebars
app.engine('hbs', engine({
    extname: '.hbs',
    defaultLayout: 'main',
    layoutsDir: path.join(__dirname, 'views/layouts'),
    partialsDir: path.join(__dirname, 'views/partials')
}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

class BaileyClient {
    constructor() {
        this.DIR_SESSION = `Sessions/auth`;
        this.isConnected = false;
        this.qrCode = null;
    }

    async connect() {
        try {
            const { state, saveCreds } = await useMultiFileAuthState(this.DIR_SESSION);
            this.client = makeWASocket({
                auth: state,
                browser: Browsers.windows("Desktop"),
                syncFullHistory: false,
                logger: PINO({ level: "error" }),
            });

            this.client.ev.on("creds.update", saveCreds);
            this.client.ev.on("connection.update", this.handleConnectionUpdate);
        } catch (error) {
            console.log("Ha ocurrido un error", error);
        }
    }

    handleConnectionUpdate = async (update) => {
        try {
            const { connection, lastDisconnect, qr } = update;
            const statusCode = lastDisconnect?.error?.output?.statusCode;

            // ✅ Mostrar QR manualmente si existe
            if (qr) {
                console.log("Escanea este código QR para conectar WhatsApp:");
                qrcode.generate(qr, { small: true });
                this.qrCode = qr;
                this.qrGeneratedAt = Date.now();
                this.isConnected = false;
            }

            if (connection === "close") {
                this.isConnected = false;
                this.qrCode = null;
                // Ya no reconectar automáticamente. Solo conectar bajo demanda (por /api/qr)
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log("Reiniciar bailey y eliminar carpeta de sesión");
                    const sessionPath = path.join(__dirname, 'Sessions', 'auth');
                    try {
                        await eliminarCarpetaSesion(sessionPath);
                    } catch (e) {
                        console.error('Error eliminando carpeta de sesión al desloguear:', e);
                    }
                }
            }

            if (connection === "open") {
                console.log("Bailey conectado...");
                this.isConnected = true;
                this.qrCode = null;
            }
        } catch (error) {
            console.log("Ha ocurrido un error, reinicie o verifique su conexión a internet");
            this.isConnected = false;
        }
    }

    async sendMessage(phoneNumber, message) {
        try {
            if (!this.isConnected) {
                throw new Error("No hay conexión con WhatsApp");
            }

            // Formatear número de teléfono
            const formattedNumber = phoneNumber.replace(/\D/g, '') + '@s.whatsapp.net';
            
            const result = await this.client.sendMessage(formattedNumber, {
                text: message
            });

            return { success: true, messageId: result.key.id };
        } catch (error) {
            console.error("Error al enviar mensaje:", error);
            throw new Error(`Error al enviar mensaje: ${error.message}`);
        }
    }

    getConnectionStatus() {
        return this.isConnected;
    }

    getQRCode() {
        // Suponiendo que el QR dura 30 segundos (ajusta según tu implementación real)
        if (this.qrCode && this.qrGeneratedAt) {
            const expiresIn = 30 - Math.floor((Date.now() - this.qrGeneratedAt) / 1000);
            return { qr: this.qrCode, expiresIn: expiresIn > 0 ? expiresIn : 0 };
        }
        return { qr: this.qrCode, expiresIn: 0 };
    }

    async disconnect() {
        try {
            if (this.client) {
                try { await this.client.logout(); } catch (e) {}
                try { await this.client.ws.close(); } catch (e) {}
                // Eliminar listeners para evitar fugas
                if (this.client.ev && this.client.ev.off) {
                    this.client.ev.off('connection.update', this.handleConnectionUpdate);
                }
                this.isConnected = false;
                this.qrCode = null;
                // Eliminar sesión después de desconexión
                const sessionPath = path.join(__dirname, 'Sessions', 'auth');
                await eliminarCarpetaSesion(sessionPath);
                // Limpiar instancia
                this.client = null;
                console.log('Desconexión completa');
            }
        } catch (error) {
            console.error('Error en desconexión:', error);
            throw error;
        }
    }
}

// Crear una instancia de BaileyClient
const bailey = new BaileyClient();
// NO conectar automáticamente. Solo bajo demanda por /api/qr

// Rutas

// Página principal
app.get('/', (req, res) => {
    res.render('index', { title: 'Enviar Mensaje' });
});

// Página de autenticación (solo QR)
app.get('/auth', (req, res) => {
    res.render('auth', { title: 'Autenticación WhatsApp' });
});

// API: solo estado de conexión
app.get('/api/status', (req, res) => {
    res.json({ connected: bailey.getConnectionStatus() });
});

// API: QR solo si no está autenticado
// Contador de intentos automáticos de QR
let qrAutoAttempts = 0;
const MAX_QR_AUTO = 5;

app.get('/api/qr', async (req, res) => {
    const isAuto = req.query.auto === '1';
    if (isAuto) {
        qrAutoAttempts++;
    } else {
        qrAutoAttempts = 0; // Reset al pedir manual
    }
    if (isAuto && qrAutoAttempts >= MAX_QR_AUTO) {
        // Desconectar cliente para liberar recursos
        console.log('⚠️ Límite de intentos automáticos de QR alcanzado. El cliente ha sido apagado. Esperando solicitud manual...');
        await bailey.disconnect();
        return res.json({ qr: null, expiresIn: 0, blocked: true });
    }
    if (!bailey.getConnectionStatus()) {
        let { qr, expiresIn } = bailey.getQRCode();
        // Si no hay QR o está expirado, forzar la generación
        if (!qr || expiresIn <= 0) {
            // Reconectar para forzar QR
            await bailey.connect();
            // Esperar brevemente a que se genere el QR
            await new Promise(resolve => setTimeout(resolve, 1500));
            ({ qr, expiresIn } = bailey.getQRCode());
        }
        res.json({ qr, expiresIn });
    } else {
        res.json({ qr: null, expiresIn: 0 });
    }
});

// API para enviar mensaje
app.post('/api/send-message', async (req, res) => {
    try {
        const { phoneNumber, message } = req.body;

        // Validaciones
        if (!phoneNumber || !message) {
            return res.status(400).json({
                error: 'Número de teléfono y mensaje son requeridos'
            });
        }

        if (!bailey.getConnectionStatus()) {
            return res.status(503).json({
                error: 'No hay conexión con WhatsApp. Escanea el código QR.'
            });
        }

        // Enviar mensaje
        const result = await bailey.sendMessage(phoneNumber, message);
        
        res.json({
            success: true,
            message: 'Mensaje enviado exitosamente',
            messageId: result.messageId
        });

    } catch (error) {
        console.error('Error en API:', error);
        res.status(500).json({
            error: error.message || 'Error interno del servidor'
        });
    }
});
// Endpoint para cerrar sesión y eliminar la carpeta de sesión
app.post('/api/clear', async (req, res) => {
    const sessionPath = path.join(__dirname, 'Sessions', 'auth');
    try {
        // Desconectar cliente si está conectado
        if (bailey.client && bailey.getConnectionStatus()) {
            try { await bailey.client.logout?.(); } catch (e) {}
        }
        // Eliminar carpeta de sesión
        const result = await eliminarCarpetaSesion(sessionPath);
        if (!result.success) {
            console.error('Error eliminando sesión:', result.error);
            return res.status(500).json({ error: 'No se pudo eliminar la sesión.' });
        }
        bailey.isConnected = false;
        bailey.qrCode = null;
        // Reconectar Bailey después de eliminar la carpeta
        bailey.connect().then(() => {
            return res.json({ success: true, message: 'Sesión cerrada, eliminada y reiniciada correctamente.' });
        }).catch((err) => {
            return res.json({ success: true, message: 'Sesión cerrada y eliminada, pero error al reconectar.' });
        });
    } catch (error) {
        console.error('Error en /api/clear:', error);
        res.status(500).json({ error: 'Error interno al cerrar sesión.' });
    }
});
// Nuevo endpoint para desconexión controlada
app.post('/api/logout', async (req, res) => {
    try {
        await bailey.disconnect();
        res.json({ success: true, message: 'Conexión cerrada correctamente' });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: 'Error al cerrar conexión: ' + error.message 
        });
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    // No conectar Bailey automáticamente. Solo bajo demanda por /api/qr
});
