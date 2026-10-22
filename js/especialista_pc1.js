// js/especialista_pc1.js - Especialista Plano Cartesiano Interactivo (PC1)
(function() {
    const EspecialistaPC1 = {
        normalizar(pRaw) {
            let consignaLimpia = pRaw.consigna || pRaw.enunciado || 'Grafica el punto solicitado en el plano cartesiano:';
            
            // Sanitización de la respuesta correcta esperada
            let rawResp = String(pRaw.respuesta_correcta || pRaw.correcta || pRaw.respuestasCorrectas?.[0] || '').trim();
            let coordenadaLimpia = rawResp.replace(/[()\s]/g, '');

            return {
                id: pRaw.id || pRaw.N_de_orden_pregunta || 'preg_pc1',
                consigna: consignaLimpia,
                coordenadaCorrecta: coordenadaLimpia
            };
        },

        renderTextoConImagen(texto) {
            if (!texto) return '';
            const regexUrl = /(https?:\/\/[^\s]+)/g;
            return texto.replace(regexUrl, (url) => {
                return `<br><img src="${url}" class="img-fluid rounded my-2" style="max-height: 280px; width: auto; max-width: 100%; display: block; margin: 0 auto;" alt="Consigna"><br>`;
            });
        },

        render(pNormalizada, respGuardada) {
            window.pc1Estado = {
                puntoSeleccionado: respGuardada || null,
                pregunta: pNormalizada
            };

            let html = `
                <div class="pregunta-pc1-container text-center" style="max-width: 500px; margin: 0 auto;">
                    <div style="font-size: 1.2rem; font-weight: 700; margin-bottom: 15px; color: #1e293b;">
                        ${this.renderTextoConImagen(pNormalizada.consigna)}
                    </div>

                    <div class="card p-3 mb-3 border-0 bg-light shadow-sm" style="border-radius: 12px; display: inline-block;">
                        <canvas id="canvasPC1" width="320" height="320" style="border: 2px solid #1e293b; border-radius: 8px; background-color: #ffffff; cursor: crosshair;"></canvas>
                    </div>
                </div>
            `;

            // Inicialización diferida del Canvas
            setTimeout(() => this.iniciarCanvas(), 50);

            return html;
        },

        iniciarCanvas() {
            const canvas = document.getElementById('canvasPC1');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const size = canvas.width;
            const minGrid = -5;
            const maxGrid = 5;
            const range = maxGrid - minGrid;
            const step = size / range;

            const dibujarPlano = () => {
                ctx.clearRect(0, 0, size, size);

                // Grilla secundaria
                ctx.strokeStyle = '#e2e8f0';
                ctx.lineWidth = 1;
                for (let i = 0; i <= range; i++) {
                    ctx.beginPath();
                    ctx.moveTo(i * step, 0);
                    ctx.lineTo(i * step, size);
                    ctx.stroke();

                    ctx.beginPath();
                    ctx.moveTo(0, i * step);
                    ctx.lineTo(size, i * step);
                    ctx.stroke();
                }

                // Ejes principales X e Y
                ctx.strokeStyle = '#0f172a';
                ctx.lineWidth = 2;
                
                // Eje Y (X=0)
                const centroX = (-minGrid) * step;
                ctx.beginPath();
                ctx.moveTo(centroX, 0);
                ctx.lineTo(centroX, size);
                ctx.stroke();

                // Eje X (Y=0)
                const centroY = maxGrid * step;
                ctx.beginPath();
                ctx.moveTo(0, centroY);
                ctx.lineTo(size, centroY);
                ctx.stroke();

                // Números de los ejes
                ctx.fillStyle = '#475569';
                ctx.font = '10px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                for (let val = minGrid; val <= maxGrid; val++) {
                    if (val === 0) continue;
                    // Marcas eje X
                    let xPos = (val - minGrid) * step;
                    ctx.fillText(val, xPos, centroY + 12);

                    // Marcas eje Y
                    let yPos = (maxGrid - val) * step;
                    ctx.fillText(val, centroX - 12, yPos);
                }
            };

            const dibujarPunto = (xCoord, yCoord) => {
                dibujarPlano();
                const xPos = (xCoord - minGrid) * step;
                const yPos = (maxGrid - yCoord) * step;

                ctx.beginPath();
                ctx.arc(xPos, yPos, 7, 0, 2 * Math.PI);
                ctx.fillStyle = '#2563eb';
                ctx.fill();
                ctx.strokeStyle = '#1d4ed8';
                ctx.lineWidth = 2;
                ctx.stroke();
            };

            dibujarPlano();

            if (window.pc1Estado.puntoSeleccionado) {
                const partes = window.pc1Estado.puntoSeleccionado.split(';');
                if (partes.length === 2) {
                    dibujarPunto(parseFloat(partes[0]), parseFloat(partes[1]));
                }
            }

            canvas.onclick = (e) => {
                const rect = canvas.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;

                // Snap al entero más cercano
                const gridX = Math.round(mouseX / step) + minGrid;
                const gridY = maxGrid - Math.round(mouseY / step);

                if (gridX >= minGrid && gridX <= maxGrid && gridY >= minGrid && gridY <= maxGrid) {
                    const coordStr = `${gridX};${gridY}`;
                    window.pc1Estado.puntoSeleccionado = coordStr;
                    dibujarPunto(gridX, gridY);

                    if (window.Director) {
                        window.Director.habilitarBotonNavegacion(true);
                    }
                }
            };
        },

        obtenerRespuesta() {
            return window.pc1Estado ? window.pc1Estado.puntoSeleccionado : '';
        },

        calcularPuntaje(respAlumnoStr, respuestaCorrectaEsperada) {
            if (!respAlumnoStr) return 0;
            const respLimpia = String(respAlumnoStr).replace(/[()\s]/g, '');
            const corrLimpia = String(respuestaCorrectaEsperada).replace(/[()\s]/g, '');
            return (respLimpia === corrLimpia) ? 1 : 0;
        }
    };

    window.EspecialistaPC1 = EspecialistaPC1;
})();
