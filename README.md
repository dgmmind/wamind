# WaMind - API para Enviar Mensajes de WhatsApp

Una aplicación web moderna para enviar mensajes de WhatsApp a través de una interfaz web intuitiva usando Baileys y Express.

## 🚀 Características

- ✅ Interfaz web moderna y responsiva
- ✅ Envío de mensajes de texto a WhatsApp
- ✅ Validación de números de teléfono
- ✅ Estado de conexión en tiempo real
- ✅ Diseño moderno con Bootstrap y CSS personalizado
- ✅ API REST para integración con otros sistemas

## 📋 Requisitos

- Node.js (versión 16 o superior)
- npm o yarn
- Conexión a internet

## 🛠️ Instalación

1. **Clonar o descargar el proyecto**
   ```bash
   git clone <tu-repositorio>
   cd wamind
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Iniciar la aplicación**
   ```bash
   npm start
   ```

4. **Para desarrollo (con nodemon)**
   ```bash
   npm run dev
   ```

## 📱 Uso

1. **Acceder a la aplicación**
   - Abre tu navegador y ve a `http://localhost:3000`

2. **Conectar WhatsApp**
   - La primera vez que ejecutes la aplicación, aparecerá un código QR en la consola
   - Escanea el código QR con tu WhatsApp
   - Una vez conectado, el estado cambiará a "Conectado a WhatsApp"

3. **Enviar mensaje**
   - Ingresa el número de teléfono con código de país (ej: 34612345678)
   - Escribe tu mensaje en el textarea
   - Haz clic en "Enviar Mensaje"

## 🔧 Configuración

### Variables de Entorno

Puedes configurar el puerto del servidor:

```bash
PORT=3000 npm start
```

### Estructura del Proyecto

```
wamind/
├── app.js                 # Archivo principal del servidor
├── package.json           # Dependencias del proyecto
├── README.md             # Este archivo
├── views/                # Plantillas Handlebars
│   ├── layouts/
│   │   └── main.hbs     # Layout principal
│   └── index.hbs        # Vista principal
├── public/               # Archivos estáticos
│   ├── css/
│   │   └── style.css    # Estilos personalizados
│   └── js/
│       └── app.js       # JavaScript del cliente
└── Sessions/            # Sesiones de WhatsApp (se crea automáticamente)
    └── auth/
```

## 📡 API Endpoints

### GET /api/status
Verifica el estado de conexión con WhatsApp.

**Respuesta:**
```json
{
  "connected": true
}
```

### POST /api/send-message
Envía un mensaje de WhatsApp.

**Body:**
```json
{
  "phoneNumber": "34612345678",
  "message": "Hola, este es un mensaje de prueba"
}
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "message": "Mensaje enviado exitosamente",
  "messageId": "3EB0C767D82B0A4E"
}
```

**Respuesta de error:**
```json
{
  "error": "No hay conexión con WhatsApp"
}
```

## 🔒 Seguridad

- Los números de teléfono se validan antes del envío
- Las sesiones de WhatsApp se almacenan localmente
- No se almacenan mensajes en el servidor

## 🐛 Solución de Problemas

### Error de conexión
- Verifica tu conexión a internet
- Asegúrate de que el número de teléfono esté registrado en WhatsApp
- Revisa que el código QR se haya escaneado correctamente

### Error de dependencias
```bash
npm install --force
```

### Limpiar sesión
Si tienes problemas de conexión, elimina la carpeta `Sessions/` y reinicia la aplicación.

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## ⚠️ Aviso Legal

Esta aplicación es para uso educativo y personal. Asegúrate de cumplir con los términos de servicio de WhatsApp y las leyes locales sobre privacidad y comunicaciones.

## 🆘 Soporte

Si tienes problemas o preguntas:

1. Revisa la sección de solución de problemas
2. Verifica que todas las dependencias estén instaladas
3. Asegúrate de que estés usando una versión compatible de Node.js

---

**Desarrollado con ❤️ usando Node.js, Express, Baileys y Handlebars**
