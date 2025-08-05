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
                this.isConnected = false;
            }

            if (connection === "close") {
               
                if (statusCode !== DisconnectReason.loggedOut) {
                     this.isConnected = false;
                this.qrCode = null;
                    await this.connect();
                }

                if (statusCode === DisconnectReason.loggedOut) {
                     this.isConnected = false;
                this.qrCode = null;
                    console.log("Reiniciar bailey y eliminar carpeta de sesión");
                    const sessionPath = path.join(__dirname, 'Sessions', 'auth');
                    try {
                        await eliminarCarpetaSesion(sessionPath);
                    } catch (e) {
                        console.error('Error eliminando carpeta de sesión al desloguear:', e);
                    }
                    await this.connect();
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
        return this.qrCode;
    }
}

// Crear una instancia de BaileyClient
const bailey = new BaileyClient();

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
app.get('/api/qr', (req, res) => {
    if (!bailey.getConnectionStatus()) {
        const qr = bailey.getQRCode();
        res.json({ qr });
    } else {
        res.json({ qr: null });
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
// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`📱 Conectando a WhatsApp...`);
});

// Conectar Bailey
bailey.connect().then(() => {
    console.log("✅ Bailey iniciado correctamente");
}).catch((error) => {
    console.error("❌ Error al iniciar Bailey:", error);
});
