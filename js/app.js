/* ==========================================================================
   EcoAlerta - Main JavaScript Application Logic (Firebase Integrated)
   ========================================================================== */

/**
 * Estado Global da Aplicação
 */
let map = null;
let ocorrencias = [];
let userLocationMarker = null;
let fotoBase64Temp = null;
let filtroCategoriaAtiva = 'TODOS';
let filtroStatusAtivo = 'TODOS';

// Mapeamento de Ícones/Emojis por Categoria
const CATEGORY_ICONS = {
    'Lixo Acumulado': '🗑️',
    'Vazamento': '💧',
    'Bueiro Entupido': '🕳️',
    'Alagamento': '🌊',
    'Erosão / Deslizamento': '⛰️',
    'Árvore em Risco': '🌳',
    'Queimada': '🔥',
    'Poluição': '🏭',
    'Outro': '📍'
};

// Mapeamento de Classes de Status
const STATUS_CLASSES = {
    'Registrado': 'marker-status-registrado',
    'Em análise': 'marker-status-analise',
    'Encaminhado': 'marker-status-encaminhado',
    'Resolvido': 'marker-status-resolvido'
};

// Dados Mock Iniciais (usados no modo local / demonstração)
const INITIAL_MOCK_OCORRENCIAS = [
    {
        id: 'oc-1',
        tipo: 'Lixo Acumulado',
        rua: 'Rua das Flores',
        numero: '125',
        bairro: 'Centro',
        cidade: 'São Paulo - SP',
        descricao: 'Grande quantidade de entulho e sacos de lixo acumulados na calçada.',
        status: 'Registrado',
        lat: -23.55052,
        lng: -46.633308,
        data: '06/08/2026',
        foto: null
    },
    {
        id: 'oc-2',
        tipo: 'Vazamento',
        rua: 'Av. Paulista',
        numero: '1000',
        bairro: 'Bela Vista',
        cidade: 'São Paulo - SP',
        descricao: 'Vazamento de água potável em tubulação aberta na calçada.',
        status: 'Em análise',
        lat: -23.561414,
        lng: -46.655881,
        data: '05/08/2026',
        foto: null
    },
    {
        id: 'oc-3',
        tipo: 'Bueiro Entupido',
        rua: 'Rua Augusta',
        numero: '450',
        bairro: 'Consolação',
        cidade: 'São Paulo - SP',
        descricao: 'Bueiro tomado por resíduos vegetais com risco de alagamento nas chuvas.',
        status: 'Encaminhado',
        lat: -23.5489,
        lng: -46.6480,
        data: '04/08/2026',
        foto: null
    }
];

document.addEventListener('DOMContentLoaded', () => {
    console.log('🌱 EcoAlerta — Aplicação Inicializada.');

    // Inicializa o Mapa Leaflet
    initMap();

    // Tenta obter localização atual para centralizar o mapa
    tentarTornarMapaCentradoUsuario();

    // Carrega ocorrencias (Nuvem ou Local) e ativa listeners
    iniciarEscutaOcorrencias();

    // Configura eventos da interface (Modal, Foto, Formulário, Botões, Filtros)
    setupEventListeners();
});

/**
 * Inicializa o Mapa Leaflet.js
 */
function initMap() {
    const mapElement = document.getElementById('map');
    if (!mapElement) return;

    const defaultLat = -23.55052;
    const defaultLng = -46.633308;

    map = L.map('map', {
        zoomControl: true,
        scrollWheelZoom: false
    }).setView([defaultLat, defaultLng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | EcoAlerta'
    }).addTo(map);
}

/**
 * Solicita a geolocalização do navegador para centralizar o mapa na cidade/bairro do usuário
 */
function tentarTornarMapaCentradoUsuario() {
    if (!('geolocation' in navigator)) return;

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const userLat = position.coords.latitude;
            const userLng = position.coords.longitude;

            if (map) {
                map.setView([userLat, userLng], 14);

                const userIcon = L.divIcon({
                    className: 'custom-leaflet-marker',
                    html: `<div class="user-marker-pulse" title="Sua localização atual"></div>`,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                });

                if (userLocationMarker) {
                    map.removeLayer(userLocationMarker);
                }

                userLocationMarker = L.marker([userLat, userLng], { icon: userIcon })
                    .addTo(map)
                    .bindPopup(`
                        <div style="text-align: center; padding: 4px; font-family: 'Plus Jakarta Sans', sans-serif;">
                            <strong style="color: #0ea5e9;">📍 Você está aqui!</strong><br>
                            <span style="font-size: 0.8rem; color: #94a3b8;">Mapa centralizado na sua região.</span>
                        </div>
                    `);
            }
        },
        (error) => {
            console.log('Geolocalização não concedida para centralização inicial do mapa:', error.message);
        },
        { enableHighAccuracy: true, timeout: 8000 }
    );
}

/**
 * Inicia a escuta das ocorrências em tempo real (Firebase Firestore ou LocalStorage Fallback)
 */
function iniciarEscutaOcorrencias() {
    if (typeof isFirebaseActive !== 'undefined' && isFirebaseActive && db) {
        console.log('⚡ Conectando ao Firebase Firestore em Tempo Real...');
        
        db.collection('ocorrencias')
          .orderBy('criadoEm', 'desc')
          .onSnapshot(
              (snapshot) => {
                  ocorrencias = [];
                  snapshot.forEach((doc) => {
                      ocorrencias.push({ id: doc.id, ...doc.data() });
                  });
                  console.log(`🔥 ${ocorrencias.length} ocorrências recebidas do Cloud Firestore.`);
                  filtrarERenderizarMarcadores();
              },
              (error) => {
                  console.error('Erro no listener do Firestore:', error);
                  carregarLocalFallback();
              }
          );
    } else {
        carregarLocalFallback();
    }
}

/**
 * Modo Fallback Local (localStorage)
 */
function carregarLocalFallback() {
    const salvos = localStorage.getItem('ecoalerta_ocorrencias');
    if (salvos) {
        try {
            ocorrencias = JSON.parse(salvos);
        } catch (e) {
            ocorrencias = [...INITIAL_MOCK_OCORRENCIAS];
        }
    } else {
        ocorrencias = [...INITIAL_MOCK_OCORRENCIAS];
        salvarLocal();
    }
    filtrarERenderizarMarcadores();
}

function salvarLocal() {
    try {
        localStorage.setItem('ecoalerta_ocorrencias', JSON.stringify(ocorrencias));
    } catch (e) {
        console.error('Erro ao salvar no localStorage:', e);
    }
}

/**
 * Filtra as ocorrências ativas e renderiza apenas os marcadores correspondentes
 */
function filtrarERenderizarMarcadores() {
    if (!map) return;

    map.eachLayer((layer) => {
        if (layer instanceof L.Marker && layer !== userLocationMarker) {
            map.removeLayer(layer);
        }
    });

    const ocorrenciasFiltradas = ocorrencias.filter(oc => {
        const matchCategoria = (filtroCategoriaAtiva === 'TODOS') || (oc.tipo === filtroCategoriaAtiva);
        const matchStatus = (filtroStatusAtivo === 'TODOS') || (oc.status === filtroStatusAtivo);
        return matchCategoria && matchStatus;
    });

    ocorrenciasFiltradas.forEach(oc => {
        adicionarMarcadorMapa(oc);
    });

    const counterText = document.getElementById('filter-counter-text');
    if (counterText) {
        let labelFiltro = filtroCategoriaAtiva !== 'TODOS' ? filtroCategoriaAtiva : (filtroStatusAtivo === 'Resolvido' ? 'Resolvidos' : 'todas as categorias');
        counterText.innerHTML = `Exibindo <strong>${ocorrenciasFiltradas.length}</strong> ocorrência(s) em <em>${escapeHtml(labelFiltro)}</em>`;
    }
}

/**
 * Adiciona um marcador individual no mapa com ícone personalizado e popup interativo
 */
function adicionarMarcadorMapa(oc) {
    const emojiIcon = CATEGORY_ICONS[oc.tipo] || '📍';
    const statusClass = STATUS_CLASSES[oc.status] || 'marker-status-registrado';

    const customIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `<div class="marker-icon-bubble ${statusClass}">${emojiIcon}</div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
    });

    const isResolvido = oc.status === 'Resolvido';
    const statusBadgeClass = isResolvido ? 'color: #10b981;' : 'color: #f59e0b;';

    const popupHtml = `
        <div class="popup-card">
            <div class="popup-category">${escapeHtml(oc.tipo)}</div>
            <h4 class="popup-title">${escapeHtml(oc.rua)}${oc.numero ? ', ' + escapeHtml(oc.numero) : ''}</h4>
            ${oc.foto ? `<img src="${oc.foto}" class="popup-img" alt="Foto da Ocorrência">` : ''}
            <p class="popup-address">📍 ${escapeHtml(oc.bairro)} - ${escapeHtml(oc.cidade)}</p>
            <p class="popup-desc">"${escapeHtml(oc.descricao)}"</p>
            <div class="popup-footer">
                <span style="font-size: 0.78rem; font-weight: 600; ${statusBadgeClass}">
                    ${isResolvido ? '🟢 Resolvido' : '🟡 ' + escapeHtml(oc.status)}
                </span>
                ${
                    !isResolvido 
                    ? `<button class="btn-resolve" onclick="marcarComoResolvido('${oc.id}')">✅ Marcar como Resolvido</button>`
                    : `<span class="btn-resolve resolved">✓ Resolvido</span>`
                }
            </div>
        </div>
    `;

    L.marker([oc.lat, oc.lng], { icon: customIcon })
        .addTo(map)
        .bindPopup(popupHtml);
}

/**
 * Altera o status da ocorrência para Resolvido (Firebase Cloud ou Local)
 */
window.marcarComoResolvido = async function(id) {
    if (typeof isFirebaseActive !== 'undefined' && isFirebaseActive && db) {
        try {
            await db.collection('ocorrencias').doc(id).update({
                status: 'Resolvido',
                atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('🟢 Ocorrência atualizada para Resolvida na nuvem!', 'success');
        } catch (e) {
            console.error('Erro ao atualizar no Firestore:', e);
            showToast('⚠️ Falha ao atualizar na nuvem. Tentando modo local.', 'error');
        }
    } else {
        const oc = ocorrencias.find(item => item.id === id);
        if (oc) {
            oc.status = 'Resolvido';
            salvarLocal();
            filtrarERenderizarMarcadores();
            showToast('🟢 Ocorrência marcada como Resolvida com sucesso!', 'success');
        }
    }
};

/**
 * Configura listeners da Interface de Usuário
 */
function setupEventListeners() {
    const modal = document.getElementById('modal-registro');
    const btnHeroRegistrar = document.getElementById('btn-hero-registrar');
    const navBtnRegistrar = document.getElementById('nav-btn-registrar');
    const btnFecharModal = document.getElementById('btn-fechar-modal');
    const btnCancelarModal = document.getElementById('btn-cancelar-modal');

    // Menu Mobile Hamburguer
    const mobileToggle = document.querySelector('.mobile-toggle');
    const navMenu = document.querySelector('.nav');
    const navLinks = document.querySelectorAll('.nav-link');

    if (mobileToggle && navMenu) {
        mobileToggle.addEventListener('click', () => {
            mobileToggle.classList.toggle('active');
            navMenu.classList.toggle('active');
        });

        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                mobileToggle.classList.remove('active');
                navMenu.classList.remove('active');
            });
        });
    }

    // Abertura do Modal
    const abrirModal = (e) => {
        if (e) e.preventDefault();
        if (modal) {
            modal.classList.add('active');
            modal.setAttribute('aria-hidden', 'false');
        }
    };

    // Fechamento do Modal
    const fecharModal = () => {
        if (modal) {
            modal.classList.remove('active');
            modal.setAttribute('aria-hidden', 'true');
        }
    };

    if (btnHeroRegistrar) btnHeroRegistrar.addEventListener('click', abrirModal);
    if (navBtnRegistrar) navBtnRegistrar.addEventListener('click', abrirModal);
    if (btnFecharModal) btnFecharModal.addEventListener('click', fecharModal);
    if (btnCancelarModal) btnCancelarModal.addEventListener('click', fecharModal);

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) fecharModal();
        });
    }

    setupMapFilters();
    setupPhotoUpload();
    setupFormGeolocation();
    setupFormSubmission(fecharModal);
}

/**
 * Configura os botões/chips de filtro do mapa
 */
function setupMapFilters() {
    const filterContainer = document.getElementById('map-filter-chips');
    if (!filterContainer) return;

    filterContainer.addEventListener('click', (e) => {
        const chip = e.target.closest('.filter-chip');
        if (!chip) return;

        const categoria = chip.dataset.categoria;
        const status = chip.dataset.status;

        const allChips = filterContainer.querySelectorAll('.filter-chip');
        allChips.forEach(c => c.classList.remove('active'));

        chip.classList.add('active');

        if (status) {
            filtroStatusAtivo = status;
            filtroCategoriaAtiva = 'TODOS';
        } else if (categoria) {
            filtroCategoriaAtiva = categoria;
            filtroStatusAtivo = 'TODOS';
        }

        filtrarERenderizarMarcadores();
    });
}

/**
 * Trata captura e seleção de foto
 */
function setupPhotoUpload() {
    const fotoInput = document.getElementById('foto-input');
    const photoPlaceholder = document.getElementById('photo-placeholder');
    const photoPreviewBox = document.getElementById('photo-preview-box');
    const fotoImgPreview = document.getElementById('foto-img-preview');
    const btnRemoverFoto = document.getElementById('btn-remover-foto');

    if (!fotoInput) return;

    fotoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            showToast('⚠️ A imagem deve ter no máximo 5MB.', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            fotoBase64Temp = event.target.result;
            fotoImgPreview.src = fotoBase64Temp;
            photoPlaceholder.classList.add('hidden');
            photoPreviewBox.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    });

    if (btnRemoverFoto) {
        btnRemoverFoto.addEventListener('click', (e) => {
            e.stopPropagation();
            fotoBase64Temp = null;
            fotoInput.value = '';
            fotoImgPreview.src = '';
            photoPreviewBox.classList.add('hidden');
            photoPlaceholder.classList.remove('hidden');
        });
    }
}

/**
 * Trata clique no botão de obter geolocalização no formulário
 */
function setupFormGeolocation() {
    const btnGeo = document.getElementById('btn-geolocalizacao');
    const geoStatus = document.getElementById('geo-status');
    const inputLat = document.getElementById('latitude');
    const inputLng = document.getElementById('longitude');

    if (!btnGeo) return;

    btnGeo.addEventListener('click', () => {
        if (!('geolocation' in navigator)) {
            geoStatus.textContent = '❌ Seu navegador não suporta geolocalização.';
            geoStatus.className = 'geo-status-text error';
            return;
        }

        geoStatus.textContent = '⏳ Obtendo coordenadas GPS do dispositivo...';
        geoStatus.className = 'geo-status-text';

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;

                inputLat.value = lat;
                inputLng.value = lng;

                geoStatus.textContent = `✅ Localização capturada! (Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)})`;
                geoStatus.className = 'geo-status-text success';
                showToast('📍 Localização GPS capturada com sucesso!', 'success');
            },
            (err) => {
                let msg = 'Não conseguimos acessar sua localização.';
                if (err.code === 1) {
                    msg = 'Permissão de localização negada. Ative a localização no seu navegador ou celular.';
                } else if (err.code === 2) {
                    msg = 'Sinal de GPS indisponível no momento.';
                }
                geoStatus.textContent = `❌ ${msg}`;
                geoStatus.className = 'geo-status-text error';
                showToast(`⚠️ ${msg}`, 'error');
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    });
}

/**
 * Trata o envio do formulário de ocorrência
 */
function setupFormSubmission(fecharModalCallback) {
    const form = document.getElementById('form-ocorrencia');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const btnSubmit = document.getElementById('btn-submit-ocorrencia');
        if (btnSubmit) btnSubmit.disabled = true;

        const tipo = document.getElementById('tipo-problema').value;
        const rua = document.getElementById('rua').value.trim();
        const numero = document.getElementById('numero').value.trim();
        const bairro = document.getElementById('bairro').value.trim();
        const cidade = document.getElementById('cidade').value.trim() || 'São Paulo - SP';
        const descricao = document.getElementById('descricao').value.trim();
        let lat = parseFloat(document.getElementById('latitude').value);
        let lng = parseFloat(document.getElementById('longitude').value);

        if (isNaN(lat) || isNaN(lng)) {
            const center = map ? map.getCenter() : { lat: -23.55052, lng: -46.633308 };
            lat = center.lat + (Math.random() - 0.5) * 0.01;
            lng = center.lng + (Math.random() - 0.5) * 0.01;
        }

        const idOcorrencia = 'oc-' + Date.now();
        let fotoFinalUrl = null;

        // Se houver foto selecionada, comprime para web (~50KB) para salvar 100% grátis no Firestore
        if (fotoBase64Temp) {
            try {
                fotoFinalUrl = await comprimirImagemParaWeb(fotoBase64Temp, 700, 0.65);
            } catch (err) {
                console.warn('Erro ao comprimir imagem, usando versão original:', err);
                fotoFinalUrl = fotoBase64Temp;
            }
        }

        const novaOcorrencia = {
            id: idOcorrencia,
            tipo,
            rua,
            numero,
            bairro,
            cidade,
            descricao,
            status: 'Registrado',
            lat,
            lng,
            data: new Date().toLocaleDateString('pt-BR'),
            foto: fotoFinalUrl
        };

        // Salva no Firebase Firestore (Nuvem 100% Gratuita) ou no LocalStorage
        if (typeof isFirebaseActive !== 'undefined' && isFirebaseActive && db) {
            try {
                await db.collection('ocorrencias').doc(idOcorrencia).set({
                    ...novaOcorrencia,
                    criadoEm: firebase.firestore.FieldValue.serverTimestamp()
                });
                showToast('🎉 Ocorrência salva no Cloud Firestore com sucesso!', 'success');
            } catch (err) {
                console.error('Erro ao salvar no Firestore:', err);
                salvarLocalmenteFallback(novaOcorrencia);
            }
        } else {
            salvarLocalmenteFallback(novaOcorrencia);
        }

        if (map) {
            map.setView([lat, lng], 15);
        }

        // Reseta formulário e fecha modal
        form.reset();
        fotoBase64Temp = null;
        if (btnSubmit) btnSubmit.disabled = false;
        
        const photoPreviewBox = document.getElementById('photo-preview-box');
        const photoPlaceholder = document.getElementById('photo-placeholder');
        if (photoPreviewBox) photoPreviewBox.classList.add('hidden');
        if (photoPlaceholder) photoPlaceholder.classList.remove('hidden');
        const geoStatus = document.getElementById('geo-status');
        if (geoStatus) {
            geoStatus.textContent = 'Clique no botão acima para capturar o GPS automático.';
            geoStatus.className = 'geo-status-text';
        }

        fecharModalCallback();
    });
}

function salvarLocalmenteFallback(novaOcorrencia) {
    ocorrencias.unshift(novaOcorrencia);
    salvarLocal();
    filtroCategoriaAtiva = 'TODOS';
    filtroStatusAtivo = 'TODOS';
    filtrarERenderizarMarcadores();
    showToast('🎉 Ocorrência registrada com sucesso (modo local)!', 'success');
}

/**
 * Exibe notificação flutuante Toast
 */
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast-notification');
    const toastMsg = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');

    if (!toast || !toastMsg) return;

    toastMsg.textContent = message;
    toastIcon.textContent = type === 'success' ? '🌱' : '⚠️';
    toast.className = `toast ${type}`;

    setTimeout(() => {
        toast.className = 'toast hidden';
    }, 4500);
}

/**
 * Função utilitária para higienizar texto HTML
 */
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Utilitário: Comprime imagem no navegador para um tamanho ultraleve (~40KB-80KB)
 * permitindo salvar fotos 100% grátis no Cloud Firestore sem precisar de cartão ou Firebase Storage!
 */
function comprimirImagemParaWeb(base64Str, maxWidth = 700, quality = 0.65) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
            resolve(compressedBase64);
        };
        img.onerror = (err) => reject(err);
    });
}

