document.addEventListener('DOMContentLoaded', function() {

    // Detectar en qué página estamos
    const isAuthPage = window.location.pathname === '/auth';

    // Elementos comunes
    const status = document.getElementById('connectionStatus');
    const statusText = document.getElementById('statusText');

    // Función para verificar estado y redirigir si es necesario
    async function checkStatus() {
        try {
            const response = await fetch('/api/status');
            const data = await response.json();
            if (!data.connected && !isAuthPage) {
                window.location.href = '/auth';
            }
            if (data.connected && isAuthPage) {
                window.location.href = '/';
            }
            // Actualizar estado visual
            if (statusText && status) {
                statusText.textContent = data.connected ? 'Conectado' : 'No conectado';
                status.className = data.connected ? 'status connected' : 'status';
            }
        } catch (error) {
            if (statusText && status) {
                statusText.textContent = 'Error de conexión';
                status.className = 'status error';
            }
        }
    }

    // Si estamos en la página principal, solo verificar estado y permitir enviar mensajes
    if (!isAuthPage) {
        const form = document.getElementById('messageForm');
        const result = document.getElementById('resultContainer');
        const resultMessage = document.getElementById('resultMessage');

        if (form) {
            form.addEventListener('submit', async function(e) {
                e.preventDefault();
                const phone = form.phoneNumber.value;
                const message = form.message.value;
                if (!phone || !message) {
                    showResult('Completa todos los campos', 'error');
                    return;
                }
                const btn = form.querySelector('button');
                btn.disabled = true;
                btn.textContent = 'Enviando...';
                try {
                    const response = await fetch('/api/send-message', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ phoneNumber: phone, message: message })
                    });
                    const data = await response.json();
                    if (response.ok) {
                        showResult('Mensaje enviado', 'success');
                        form.reset();
                    } else {
                        showResult(data.error || 'Error al enviar', 'error');
                    }
                } catch (error) {
                    showResult('Error de conexión', 'error');
                } finally {
                    btn.disabled = false;
                    btn.textContent = '📤 Enviar';
                }
            });
        }

        function showResult(message, type) {
            if (!result || !resultMessage) return;
            resultMessage.textContent = message;
            result.className = `result ${type}`;
            result.style.display = 'block';
            setTimeout(() => {
                result.style.display = 'none';
            }, 3000);
        }

        // Verificar estado cada 5 segundos
        checkStatus();
        setInterval(checkStatus, 5000);
    }

    // Si estamos en /auth, mostrar QR solo si no está autenticado
    if (isAuthPage) {
        const qrContainer = document.getElementById('qrContainer');
        const qrCode = document.getElementById('qrCode');

        // Verifica estado y muestra QR si corresponde
        async function checkAuthAndShowQR() {
            try {
                const statusResp = await fetch('/api/status');
                const statusData = await statusResp.json();
                if (statusData.connected) {
                    window.location.href = '/';
                    return;
                }
                // Si no está conectado, pedir QR
                const qrResp = await fetch('/api/qr');
                const qrData = await qrResp.json();
                if (qrData.qr) {
                    await generateQRCodeImage(qrData.qr);
                    qrContainer.style.display = 'block';
                } else {
                    qrContainer.style.display = 'none';
                }
            } catch (error) {
                if (statusText && status) {
                    statusText.textContent = 'Error de conexión';
                    status.className = 'status error';
                }
                if (qrContainer) qrContainer.style.display = 'none';
            }
        }

        // Generar QR como imagen (usa la función existente)
        async function generateQRCodeImage(qrData) {
            if (typeof QRCode === 'undefined') {
                // Si no hay librería QR, mostrar como texto
                qrCode.innerHTML = `<div style="padding: 1rem; background: #f5f5f5; border-radius: 4px;"><p><strong>QR Code (Texto):</strong></p><p style="font-family: monospace; font-size: 0.75rem; word-break: break-all;">${qrData}</p></div>`;
                return;
            }
            const qrCodeDataURL = await QRCode.toDataURL(qrData, {
                width: 214,
                margin: 2,
                color: { dark: '#000000', light: '#FFFFFF' }
            });
            qrCode.innerHTML = '';
            const qrImg = document.createElement('img');
            qrImg.src = qrCodeDataURL;
            qrImg.alt = 'QR Code para WhatsApp';
            qrImg.setAttribute('aria-label', 'Escanea este código QR para vincular un dispositivo!');
            qrImg.setAttribute('role', 'img');
            qrCode.appendChild(qrImg);
        }

        // Verificar cada 5 segundos
        checkAuthAndShowQR();
        setInterval(checkAuthAndShowQR, 5000);
    }
});