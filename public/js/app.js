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

    // Verificar estado cada 5 segundos en todas las páginas
    checkStatus();
    let statusInterval = setInterval(checkStatus, 5000);

    // Si estamos en la página principal, solo permitir enviar mensajes
    if (!isAuthPage) {
        const form = document.getElementById('messageForm');
        const result = document.getElementById('resultContainer');
        const resultMessage = document.getElementById('resultMessage');
        const logoutBtn = document.getElementById('logoutBtn');
        const statusText = document.getElementById('statusText');

        // --- PROTECCIÓN: Remover listeners previos ---
        if (form) {
            form.replaceWith(form.cloneNode(true));
            const newForm = document.getElementById('messageForm');
            newForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                const phone = newForm.phoneNumber.value;
                const message = newForm.message.value;
                if (!phone || !message) {
                    showResult('Completa todos los campos', 'error');
                    return;
                }
                const btn = newForm.querySelector('button');
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
                        newForm.reset();
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

        // Mostrar/ocultar botón logout según estado
        function updateLogoutBtn() {
            if (logoutBtn && statusText) {
                if (statusText.textContent.trim().toLowerCase().includes('conectado')) {
                    logoutBtn.style.display = '';
                } else {
                    logoutBtn.style.display = 'none';
                }
            }
        }
        updateLogoutBtn();
        if (statusText) {
            // Actualizar cuando cambie el texto
            const observer = new MutationObserver(updateLogoutBtn);
            observer.observe(statusText, { childList: true, subtree: true, characterData: true });
        }
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async function() {
                if (!confirm('¿Seguro que deseas cerrar la sesión y eliminar la cuenta de este servidor?')) return;
                logoutBtn.disabled = true;
                logoutBtn.textContent = 'Cerrando...';
                try {
                    const resp = await fetch('/api/logout', { method: 'POST' });
                    const data = await resp.json();
                    if (data.success) {
                        alert('Sesión cerrada correctamente.');
                        window.location.href = '/auth';
                    } else {
                        alert(data.error || 'No se pudo cerrar la sesión.');
                    }
                } catch (e) {
                    alert('Error de red al cerrar sesión.');
                } finally {
                    logoutBtn.disabled = false;
                    logoutBtn.textContent = 'Cerrar sesión';
                }
            });
        }
        // Verificar estado cada 5 segundos
        checkStatus();
        setInterval(checkStatus, 5000);
    }

    // Si estamos en /auth, mostrar QR solo si no está autenticado
    if (isAuthPage) {
        const qrContainer = document.getElementById('qrContainer');
        const qrCode = document.getElementById('qrCode');
        const requestQrBtn = document.getElementById('requestQrBtn');
        let qrExpiresIn = 0;
        let qrTimerInterval = null;
        const qrExpireMsg = document.createElement('div');
        qrExpireMsg.style.color = 'red';
        qrExpireMsg.style.fontWeight = 'bold';
        qrExpireMsg.style.marginTop = '10px';
        qrExpireMsg.id = 'qrExpireMsg';
        qrCode && qrCode.parentNode && qrCode.parentNode.appendChild(qrExpireMsg);

        async function checkAuthAndShowQR(isAuto = false) {
            try {
                // Pausar el polling de estado para evitar doble petición
                if (typeof statusInterval !== 'undefined') clearInterval(statusInterval);
                const statusResp = await fetch('/api/status');
                const statusData = await statusResp.json();
                if (statusData.connected) {
                    window.location.href = '/';
                    return;
                }
                // Si no está conectado, pedir QR
                const qrResp = await fetch('/api/qr' + (isAuto ? '?auto=1' : ''));
                const qrData = await qrResp.json();
                if (qrData.blocked) {
                    qrContainer.style.display = 'none';
                    stopQrExpireTimer();
                    if (requestQrBtn) {
                        requestQrBtn.disabled = false;
                    }
                    qrExpireMsg.textContent = '⚠️ Límite de intentos automáticos alcanzado. Haz clic en "Solicitar QR" para reintentar.';
                    qrExpireMsg.style.color = 'red';
                    qrExpireMsg.style.fontWeight = 'bold';
                    if (qrCode && qrCode.parentNode && !qrExpireMsg.parentNode) {
                        qrCode.parentNode.appendChild(qrExpireMsg);
                    }
                    return;
                }
                if (qrData.qr) {
                    await generateQRCodeImage(qrData.qr);
                    qrContainer.style.display = 'block';
                    qrExpiresIn = qrData.expiresIn || 0;
                    startQrExpireTimer();
                } else {
                    qrContainer.style.display = 'none';
                    stopQrExpireTimer();
                }
            } catch (error) {
                if (statusText && status) {
                    statusText.textContent = 'Error de conexión';
                    status.className = 'status error';
                }
                if (qrContainer) qrContainer.style.display = 'none';
            } finally {
                // Reanudar el polling de estado
                statusInterval = setInterval(checkStatus, 5000);
            }
        }

        let qrAutoRequestCount = 0;
        let qrAutoRequestInterval = null;

        function resetQrAutoRequest() {
            qrAutoRequestCount = 0;
            if (qrAutoRequestInterval) {
                clearInterval(qrAutoRequestInterval);
                qrAutoRequestInterval = null;
            }
        }

        async function autoRequestQR() {
            if (qrAutoRequestCount < 5) {
                qrAutoRequestCount++;
                await checkAuthAndShowQR(true); // true = automático
            } else {
                resetQrAutoRequest();
                if (requestQrBtn) requestQrBtn.disabled = false;
            }
        }

        if (requestQrBtn) {
            requestQrBtn.addEventListener('click', function() {
                resetQrAutoRequest();
                checkAuthAndShowQR(false); // false = manual
                if (requestQrBtn) requestQrBtn.disabled = true;
                qrAutoRequestInterval = setInterval(autoRequestQR, 5000); // 5 segundos
            });
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

        function startQrExpireTimer() {
            stopQrExpireTimer();
            updateQrExpireMsg();
            qrTimerInterval = setInterval(() => {
                if (qrExpiresIn > 0) {
                    qrExpiresIn--;
                    updateQrExpireMsg();
                } else {
                    updateQrExpireMsg();
                    stopQrExpireTimer();
                }
            }, 1000);
        }
        function stopQrExpireTimer() {
            if (qrTimerInterval) {
                clearInterval(qrTimerInterval);
                qrTimerInterval = null;
            }
            qrExpireMsg.textContent = '';
        }
        function updateQrExpireMsg() {
            if (qrExpiresIn > 0) {
                if (qrExpiresIn <= 5) {
                    qrExpireMsg.textContent = `⚠️ El código QR está por vencer en ${qrExpiresIn} segundos. Recarga la página o espera un nuevo QR.`;
                } else {
                    qrExpireMsg.textContent = `El código QR vence en ${qrExpiresIn} segundos.`;
                }
            } else {
                qrExpireMsg.textContent = 'El código QR ha vencido. Esperando uno nuevo...';
            }
        }

    }
});