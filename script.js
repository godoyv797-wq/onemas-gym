/**
 * ONE+ GIMNASIO - SCRIPT PRINCIPAL
 * Integración de:
 * 1. Componente animado <StrokeText /> (React Bits) con GSAP y Archivo Black
 * 2. Gráficas interactivas con Chart.js (Flujo de gente por hora/días e Ingresos/Egresos)
 * 3. Búsqueda y filtrado por fecha y texto en todas las herramientas del panel admin
 * 4. Alternador de visibilidad de contraseña (mostrar/ocultar)
 * 5. Seguridad: credenciales gestionadas 100% en backend (sin datos expuestos en frontend)
 */

// Estado global de la aplicación
const APP_STATE = {
  theme: localStorage.getItem("oneplus_theme") || "light",
  adminToken: sessionStorage.getItem("oneplus_admin_token") || null,
  sociosData: [],
  stockData: [],
  maquinasData: [],
  finanzasData: {},
  mensajesData: [],
  flujoAsistencia: null,
  checkinsLog: [],
  chartAttendance: null,
  chartFinances: null,
  currentSocioFilterEstado: "todos"
};

// Catálogo oficial de Planes ONE+ Gym
const ONEPLUS_PLANES = {
  "Pase Libre (Todos los días)": {
    nombre: "Pase Libre (Todos los días)",
    cuota: 28000,
    clases: "Ilimitadas"
  },
  "3 veces a la semana": {
    nombre: "3 veces a la semana",
    cuota: 22000,
    clases: 3
  },
  "Promo Amigos": {
    nombre: "Promo Amigos",
    cuota: 23000,
    clases: "Ilimitadas"
  },
  "Personalizados": {
    nombre: "Personalizados",
    cuota: 43000,
    clases: 12
  },
  "Clase individual": {
    nombre: "Clase individual",
    cuota: 8000,
    clases: 1
  }
};

// ===================================================================
// UTILIDADES DE FECHAS (FORMATO DD/MM/YYYY Y REGLA DE VENCIMIENTOS)
// ===================================================================
function parseDateString(val) {
  if (!val) return null;
  val = String(val).trim();
  const mD = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mD) {
    return new Date(parseInt(mD[3], 10), parseInt(mD[2], 10) - 1, parseInt(mD[1], 10));
  }
  const mI = val.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (mI) {
    return new Date(parseInt(mI[1], 10), parseInt(mI[2], 10) - 1, parseInt(mI[3], 10));
  }
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateDisplay(val, includeTime = false) {
  if (!val) return "-";
  val = String(val).trim();

  // Si ya tiene formato DD/MM/YYYY o DD/MM/YYYY HH:MM
  const ddmmyyyyRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}:\d{2})(?::\d{2})?)?$/;
  const matchD = val.match(ddmmyyyyRegex);
  if (matchD) {
    const d = matchD[1].padStart(2, "0");
    const m = matchD[2].padStart(2, "0");
    const y = matchD[3];
    const time = matchD[4];
    if (includeTime && time) return `${d}/${m}/${y} ${time}`;
    return `${d}/${m}/${y}`;
  }

  // Si tiene formato ISO YYYY-MM-DD
  const isoRegex = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}:\d{2})(?::\d{2})?)?/;
  const matchIso = val.match(isoRegex);
  if (matchIso) {
    const y = matchIso[1];
    const m = matchIso[2].padStart(2, "0");
    const d = matchIso[3].padStart(2, "0");
    const time = matchIso[4];
    if (includeTime && time) return `${d}/${m}/${y} ${time}`;
    return `${d}/${m}/${y}`;
  }

  const parsed = new Date(val);
  if (!isNaN(parsed.getTime())) {
    const d = String(parsed.getDate()).padStart(2, "0");
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const y = parsed.getFullYear();
    if (includeTime) {
      const hh = String(parsed.getHours()).padStart(2, "0");
      const mm = String(parsed.getMinutes()).padStart(2, "0");
      return `${d}/${m}/${y} ${hh}:${mm}`;
    }
    return `${d}/${m}/${y}`;
  }

  return val;
}

function toIsoDate(val) {
  if (!val) return "";
  val = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.substring(0, 10);
  const m = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  const parsed = new Date(val);
  if (!isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
  }
  return "";
}

function toDdmmyyyy(val) {
  if (!val) return "";
  val = String(val).trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(val)) {
    const p = val.split(" ")[0].split("/");
    return `${p[0].padStart(2, "0")}/${p[1].padStart(2, "0")}/${p[2]}`;
  }
  const m = val.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    return `${m[3].padStart(2, "0")}/${m[2].padStart(2, "0")}/${m[1]}`;
  }
  const parsed = new Date(val);
  if (!isNaN(parsed.getTime())) {
    return `${String(parsed.getDate()).padStart(2, "0")}/${String(parsed.getMonth() + 1).padStart(2, "0")}/${parsed.getFullYear()}`;
  }
  return val;
}

/**
 * Regla de vencimiento automática:
 * "Cada vez que el dia de vencimiento pase tiene que establecerlo como cuota vencida
 * al instante que sean las 12 del dia siguiente al que vence."
 */
function calcularEstadoCuotaSocio(vencStr, now = new Date()) {
  const vDate = parseDateString(vencStr);
  if (!vDate) return "Al día";

  // Límite: las 12:00 hs del día siguiente al que vence
  const limiteVencimiento = new Date(vDate.getFullYear(), vDate.getMonth(), vDate.getDate() + 1, 12, 0, 0);

  if (now >= limiteVencimiento) {
    return "Vencido";
  }

  // Si estamos en el día de vencimiento o en la mañana del día siguiente antes de las 12hs
  const inicioDiaVenc = new Date(vDate.getFullYear(), vDate.getMonth(), vDate.getDate(), 0, 0, 0);
  if (now >= inicioDiaVenc) {
    return "Por vencer";
  }

  // Si faltan 3 días o menos
  const diffTime = inicioDiaVenc - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays <= 3) {
    return "Por vencer";
  }

  return "Al día";
}

function actualizarEstadosSociosFront(sociosList) {
  if (!Array.isArray(sociosList)) return;
  const now = new Date();
  sociosList.forEach(s => {
    if (s.vencimiento) {
      s.estado = calcularEstadoCuotaSocio(s.vencimiento, now);
    }
  });
}

function calculateNewVencimiento(baseDateStr, mesesAbonados = 1) {
  const base = parseDateString(baseDateStr);
  const now = new Date();
  
  // Si la cuota ya venció, el nuevo ciclo de pago inicia a partir de hoy
  // Si la cuota aún no venció, se añaden los meses a la fecha de vencimiento actual
  let start;
  if (base && base > now) {
    start = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  
  start.setMonth(start.getMonth() + Number(mesesAbonados));
  const d = String(start.getDate()).padStart(2, "0");
  const m = String(start.getMonth() + 1).padStart(2, "0");
  const y = start.getFullYear();
  return `${d}/${m}/${y}`;
}

// ===================================================================
// INICIALIZACIÓN GENERAL
// ===================================================================
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initLiveGymStatus();
  initMobileMenu();
  initGuestbook();
  initAdminModal();
  initAdminTabs();
  initPasswordVisibilityToggle();

  // Inicializar StrokeText con la fuente Archivo Black
  initStrokeTextHero();

  // Cargar mensajes iniciales del libro de visitas
  fetchGuestbookMessages();

  // Actualizar año en footer
  const yearEl = document.getElementById("current-year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
});


// ===================================================================
// 1. TEMA CLARO / OSCURO (ACTUALIZA CONTRASTE Y GRÁFICAS)
// ===================================================================
function initTheme() {
  document.documentElement.setAttribute("data-theme", APP_STATE.theme);
  updateThemeIcons();

  const toggleBtn = document.getElementById("theme-toggle");
  const adminToggleBtn = document.getElementById("admin-theme-toggle");

  const handleToggle = () => {
    APP_STATE.theme = APP_STATE.theme === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", APP_STATE.theme);
    localStorage.setItem("oneplus_theme", APP_STATE.theme);
    updateThemeIcons();

    // Re-renderizar StrokeText con el nuevo color del tema
    initStrokeTextHero();

    // Actualizar colores de las gráficas de administración si están instanciadas
    updateChartsTheme();

    Toast.info(
      APP_STATE.theme === "dark" ? "Modo oscuro activado (alto contraste)" : "Modo claro activado",
      "La interfaz se adaptó para una óptima lectura."
    );
  };

  if (toggleBtn) toggleBtn.addEventListener("click", handleToggle);
  if (adminToggleBtn) adminToggleBtn.addEventListener("click", handleToggle);
}

function updateThemeIcons() {
  const isDark = APP_STATE.theme === "dark";
  const iconMarkup = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
  
  const toggleBtn = document.getElementById("theme-toggle");
  const adminToggleBtn = document.getElementById("admin-theme-toggle");

  if (toggleBtn) toggleBtn.innerHTML = iconMarkup;
  if (adminToggleBtn) adminToggleBtn.innerHTML = iconMarkup;
}


// ===================================================================
// 2. COMPONENTE <StrokeText /> DE REACT BITS (ADAPTADO A VANILLA JS + GSAP)
// Usa la fuente de Google 'Archivo Black' para destacar a primera vista que es un gimnasio
// ===================================================================
function initStrokeTextHero() {
  const container = document.getElementById("hero-stroke-text-wrap");
  if (!container) return;

  const isDark = APP_STATE.theme === "dark";
  const text = "GIMNASIO ONE+";
  const strokeColor = isDark ? "#00fc9f" : "#10b981";
  const fillColor = isDark ? "#f8fafc" : "#0f172a";
  const strokeWidth = 1.8;
  const drawDuration = 1.6;
  const fillDelay = 0.2;
  const stagger = 0.05;
  const ease = "power2.out";
  const wipeFrom = "left";
  const fontFamily = "'Archivo Black', sans-serif";
  const letterSpacing = -2;

  // Ajuste responsivo de tamaño de fuente
  const isMobile = window.innerWidth < 640;
  const isTablet = window.innerWidth >= 640 && window.innerWidth < 1024;
  const fontSize = isMobile ? 38 : (isTablet ? 54 : 68);

  renderVanillaStrokeText(container, {
    text,
    strokeColor,
    fillColor,
    strokeWidth,
    drawDuration,
    fillDelay,
    stagger,
    ease,
    fillMode: "wipe",
    wipeFrom,
    fontSize,
    fontWeight: 900,
    fontFamily,
    letterSpacing,
    hoverRedraw: true,
    shadow: true,
    shadowColor: isDark ? "rgba(0, 252, 159, 0.4)" : "rgba(16, 185, 129, 0.3)"
  });
}

/**
 * Motor de renderizado y animación StrokeText basado en la implementación de React Bits
 */
function renderVanillaStrokeText(container, props) {
  const {
    text = "GIMNASIO ONE+",
    strokeColor = "#10b981",
    fillColor = "currentColor",
    strokeWidth = 1.6,
    drawDuration = 1.6,
    fillDelay = 0.2,
    stagger = 0.05,
    ease = "power2.out",
    fillMode = "wipe",
    wipeFrom = "left",
    fontSize = 64,
    fontWeight = 900,
    fontFamily = "'Archivo Black', sans-serif",
    letterSpacing = -2,
    hoverRedraw = true,
    shadow = true,
    shadowColor = "rgba(16, 185, 129, 0.3)"
  } = props;

  const uniqueId = `st_${Math.random().toString(36).substring(2, 9)}`;
  const wipeId = `stroke-text-wipe-${uniqueId}`;
  const shadowId = `stroke-text-shadow-${uniqueId}`;

  const characters = Array.from(String(text));
  const dash = Math.max(fontSize * 7, 200);
  const lift = fontSize * 0.06;
  const softness = fontSize * 0.016;

  const fontStyle = `font-family: ${fontFamily}; font-size: ${fontSize}px; font-weight: ${fontWeight}; letter-spacing: ${letterSpacing}px;`;

  // Construcción del SVG inicial
  container.innerHTML = `
    <span class="stroke-text ${hoverRedraw ? 'stroke-text--hover' : ''}" role="img" aria-label="${text}">
      <svg class="stroke-text__svg" viewBox="0 ${-fontSize * 0.9} 800 ${fontSize * 1.4}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" style="overflow: visible;">
        <defs>
          <clipPath id="${wipeId}" clipPathUnits="userSpaceOnUse">
            <rect id="${wipeId}-rect" x="0" y="${-fontSize * 1.2}" width="0" height="${fontSize * 2}" />
          </clipPath>
          ${shadow ? `
            <filter id="${shadowId}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
              <feDropShadow id="${shadowId}-drop" dx="0" dy="0" stdDeviation="${softness}" flood-color="${shadowColor}" flood-opacity="0" />
            </filter>
          ` : ''}
        </defs>

        <!-- Capa de trazo SVG contorno -->
        <text class="stroke-text__stroke" x="0" y="0" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round" style="${fontStyle}">
          ${characters.map((char) => `<tspan data-stroke-char>${char === ' ' ? '&#160;' : char}</tspan>`).join('')}
        </text>

        <!-- Capa de relleno con barrido wipe -->
        <g ${shadow ? `filter="url(#${shadowId})"` : ''}>
          <text class="stroke-text__fill" x="0" y="0" fill="${fillColor}" stroke="none" style="${fontStyle}" clip-path="url(#${wipeId})">
            ${characters.map((char) => `<tspan data-fill-char>${char === ' ' ? '&#160;' : char}</tspan>`).join('')}
          </text>
        </g>
      </svg>
    </span>
  `;

  const svg = container.querySelector("svg");
  const strokeTextEl = container.querySelector(".stroke-text__stroke");
  const wipeRect = container.querySelector(`#${wipeId}-rect`);
  const shadowDrop = container.querySelector(`#${shadowId}-drop`);

  const runAnimation = () => {
    let bbox;
    try {
      bbox = strokeTextEl.getBBox();
    } catch (e) {
      bbox = { x: 0, y: -fontSize, width: fontSize * text.length * 0.65, height: fontSize * 1.3 };
    }

    if (!bbox || !bbox.width) return;

    const pad = Math.max(Number(strokeWidth) || 1, fontSize * 0.1);
    const box = {
      x: bbox.x - pad,
      y: bbox.y - pad,
      width: bbox.width + pad * 2,
      height: bbox.height + pad * 2
    };

    svg.setAttribute("viewBox", `${box.x} ${box.y} ${box.width} ${box.height}`);

    const strokes = container.querySelectorAll("[data-stroke-char]");
    const fills = container.querySelectorAll("[data-fill-char]");
    const fillDuration = Math.max(0.4, drawDuration * 0.55);

    // Wipe frames
    const wipeStart = { x: box.x, y: box.y, width: 0, height: box.height };
    const wipeEnd = { x: box.x, y: box.y, width: box.width, height: box.height };

    if (wipeRect) {
      wipeRect.setAttribute("x", wipeStart.x);
      wipeRect.setAttribute("y", wipeStart.y);
      wipeRect.setAttribute("width", 0);
      wipeRect.setAttribute("height", wipeStart.height);
    }

    if (typeof gsap === "undefined") {
      // Fallback si gsap no está disponible
      if (wipeRect) wipeRect.setAttribute("width", wipeEnd.width);
      return;
    }

    // Configurar estado inicial GSAP
    gsap.set(strokes, { strokeDasharray: dash, strokeDashoffset: dash, strokeOpacity: 1 });
    gsap.set(fills, { opacity: 1 });

    const tl = gsap.timeline({ defaults: { overwrite: "auto" } });

    // 1. Dibujo progresivo de cada trazo
    tl.to(strokes, {
      strokeDashoffset: 0,
      duration: drawDuration,
      ease,
      stagger: { each: stagger }
    }, 0);

    // 2. Barrido wipe del relleno líquido
    if (wipeRect) {
      tl.to(wipeRect, {
        attr: { width: wipeEnd.width },
        duration: fillDuration,
        ease: "power2.inOut"
      }, drawDuration + fillDelay);
    }

    // 3. Sombra dinámica
    if (shadowDrop) {
      tl.to(shadowDrop, {
        attr: { dx: lift, dy: lift, "flood-opacity": 0.45 },
        duration: fillDuration * 1.3,
        ease: "power3.out"
      }, drawDuration + fillDelay);
    }

    // Hover Redraw
    if (hoverRedraw) {
      container.onpointerenter = () => {
        if (tl.isActive()) return;
        const redrawTl = gsap.timeline();
        redrawTl
          .to(strokes, { strokeOpacity: 0.3, duration: 0.15, ease: "power1.out" })
          .set(strokes, { strokeDashoffset: dash, strokeOpacity: 1 })
          .to(strokes, { strokeDashoffset: 0, duration: drawDuration * 0.8, ease, stagger });
      };
    }
  };

  // Medir después de que las fuentes estén listas
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(runAnimation).catch(runAnimation);
  } else {
    setTimeout(runAnimation, 100);
  }
}


// ===================================================================
// 3. ACTIVAR / DESACTIVAR VISIBILIDAD DE CONTRASEÑA
// ===================================================================
function initPasswordVisibilityToggle() {
  const toggleBtn = document.getElementById("toggle-password-btn");
  const passInput = document.getElementById("login-password");
  const passIcon = document.getElementById("toggle-password-icon");

  if (!toggleBtn || !passInput || !passIcon) return;

  toggleBtn.addEventListener("click", () => {
    const isPassword = passInput.getAttribute("type") === "password";
    passInput.setAttribute("type", isPassword ? "text" : "password");
    passIcon.className = isPassword ? "fa-regular fa-eye-slash" : "fa-regular fa-eye";
    toggleBtn.setAttribute("title", isPassword ? "Ocultar contraseña" : "Ver contraseña");
  });
}


// ===================================================================
// 4. INDICADOR EN TIEMPO REAL DEL GYM (HORARIOS SALTA)
// ===================================================================
function initLiveGymStatus() {
  const statusEl = document.getElementById("live-gym-status");
  if (!statusEl) return;

  const now = new Date();
  const day = now.getDay(); // 0: Dom, 1: Lun, ..., 6: Sáb
  const hour = now.getHours();
  const minutes = now.getMinutes();
  const currentTime = hour + minutes / 60;

  let isOpen = false;
  let text = "Cerrado ahora";

  if (day >= 1 && day <= 5) {
    // Lunes a Viernes: 8 a 12 y 15 a 23
    if ((currentTime >= 8 && currentTime < 12) || (currentTime >= 15 && currentTime < 23)) {
      isOpen = true;
      text = "Abierto ahora (Lun a Vie hasta 23:00)";
    } else if (currentTime < 8) {
      text = "Cerrado &bull; Abre hoy a las 8:00";
    } else if (currentTime >= 12 && currentTime < 15) {
      text = "Cerrado al mediodía &bull; Abre a las 15:00";
    } else {
      text = "Cerrado por hoy &bull; Abre mañana 8:00";
    }
  } else if (day === 6) {
    // Sábados: 9 a 12
    if (currentTime >= 9 && currentTime < 12) {
      isOpen = true;
      text = "Abierto ahora (Sábados hasta 12:00)";
    } else if (currentTime < 9) {
      text = "Cerrado &bull; Abre hoy a las 9:00";
    } else {
      text = "Cerrado por hoy &bull; Abre el lunes a las 8:00";
    }
  } else {
    // Domingo: Cerrado
    text = "Cerrado los domingos &bull; Abre lunes a las 8:00";
  }

  statusEl.className = `status-live-pill ${isOpen ? "open" : "closed"}`;
  statusEl.innerHTML = `<i class="fa-solid ${isOpen ? "fa-circle-check" : "fa-clock"}"></i> <span>${text}</span>`;
}


// ===================================================================
// 5. MENÚ MÓVIL
// ===================================================================
function initMobileMenu() {
  const menuBtn = document.getElementById("mobile-menu-btn");
  const navLinks = document.getElementById("nav-links");

  if (!menuBtn || !navLinks) return;

  menuBtn.addEventListener("click", () => {
    navLinks.classList.toggle("mobile-open");
  });

  navLinks.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("mobile-open");
    });
  });
}


// ===================================================================
// 6. LIBRO DE VISITAS (GUESTBOOK API CLIENT)
// ===================================================================
function initGuestbook() {
  const form = document.getElementById("guestbook-form");
  const refreshBtn = document.getElementById("gb-refresh-btn");

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nombreInput = document.getElementById("gb-nombre");
      const textoInput = document.getElementById("gb-texto");
      const submitBtn = document.getElementById("gb-submit-btn");

      const nombre = nombreInput.value.trim();
      const texto = textoInput.value.trim();

      if (!nombre || !texto) {
        Toast.warning("Faltan datos obligatorios", "Ingresá tu nombre y el mensaje antes de publicar.");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Publicando...';

      try {
        const response = await fetch("/api/mensajes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre, texto })
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.detail || "Error al publicar mensaje");
        }

        Toast.success("¡Mensaje publicado con éxito!", "Tu comentario ya está disponible en la cartelera.");
        form.reset();
        await fetchGuestbookMessages();
      } catch (error) {
        console.error("Error en POST /api/mensajes:", error);
        Toast.error("No se pudo publicar tu mensaje", `Detalle: ${error.message}. Reintentá en unos instantes.`);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Publicar Mensaje';
      }
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      fetchGuestbookMessages();
    });
  }
}

/**
 * Renderiza el skeleton con animación de pulso y la misma forma que las tarjetas reales
 */
function renderGuestbookSkeleton(count = 3) {
  return Array(count).fill(`
    <div class="skeleton-message-card">
      <div class="skeleton-header">
        <div class="skeleton-author">
          <div class="skeleton-avatar skeleton-pulse"></div>
          <div class="skeleton-meta">
            <div class="skeleton-line skeleton-name skeleton-pulse"></div>
            <div class="skeleton-line skeleton-date skeleton-pulse"></div>
          </div>
        </div>
        <div class="skeleton-btn skeleton-pulse"></div>
      </div>
      <div class="skeleton-body">
        <div class="skeleton-line skeleton-text skeleton-pulse" style="width: 100%;"></div>
        <div class="skeleton-line skeleton-text skeleton-pulse" style="width: 88%;"></div>
        <div class="skeleton-line skeleton-text skeleton-pulse" style="width: 60%;"></div>
      </div>
    </div>
  `).join("");
}

async function fetchGuestbookMessages() {
  const listEl = document.getElementById("guestbook-list");
  const countEl = document.getElementById("gb-count");
  const adminTbody = document.getElementById("admin-mensajes-table-body");

  // Mostrar de inmediato los skeletons con pulso mientras se cargan los datos
  if (listEl) {
    listEl.innerHTML = renderGuestbookSkeleton(3);
  }
  if (adminTbody && (!APP_STATE.mensajesData || APP_STATE.mensajesData.length === 0)) {
    adminTbody.innerHTML = `
      <tr class="skeleton-table-row">
        <td><div class="skeleton-line skeleton-pulse" style="width: 100px; height: 16px;"></div></td>
        <td><div class="skeleton-line skeleton-pulse" style="width: 130px; height: 16px;"></div></td>
        <td><div class="skeleton-line skeleton-pulse" style="width: 90%; height: 16px;"></div></td>
        <td><div class="skeleton-btn skeleton-pulse" style="width: 65px; height: 26px;"></div></td>
      </tr>
      <tr class="skeleton-table-row">
        <td><div class="skeleton-line skeleton-pulse" style="width: 110px; height: 16px;"></div></td>
        <td><div class="skeleton-line skeleton-pulse" style="width: 140px; height: 16px;"></div></td>
        <td><div class="skeleton-line skeleton-pulse" style="width: 80%; height: 16px;"></div></td>
        <td><div class="skeleton-btn skeleton-pulse" style="width: 65px; height: 26px;"></div></td>
      </tr>
    `;
  }

  try {
    const res = await fetch("/api/mensajes");
    if (!res.ok) throw new Error("No se pudieron cargar los mensajes.");
    
    const mensajes = await res.json();
    APP_STATE.mensajesData = mensajes;

    if (countEl) countEl.textContent = mensajes.length;

    renderGuestbookList(mensajes);
    renderAdminMensajesTable(mensajes);
  } catch (error) {
    console.error("Error en GET /api/mensajes:", error);
    if (listEl) {
      listEl.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-circle-exclamation" style="color: var(--status-danger);"></i>
          <p>No se pudo conectar al backend de mensajes.<br><small>Verificá que el servidor esté activo en el puerto 8000.</small></p>
        </div>
      `;
    }
  }
}

function renderGuestbookList(mensajes) {
  const listEl = document.getElementById("guestbook-list");
  if (!listEl) return;

  if (mensajes.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <i class="fa-regular fa-comment-dots"></i>
        <p>Aún no hay mensajes. ¡Sé el primero en dejar una reseña en ONE+!</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = mensajes.map(msg => {
    const initial = msg.nombre ? msg.nombre.charAt(0).toUpperCase() : "U";
    const isAdmin = !!APP_STATE.adminToken;
    
    return `
      <div class="message-card" data-id="${msg.id}">
        <div class="message-card-header">
          <div class="message-author">
            <div class="author-avatar">${initial}</div>
            <div>
              <div class="author-name">${escapeHtml(msg.nombre)}</div>
              <div class="message-date"><i class="fa-regular fa-clock"></i> ${escapeHtml(formatDateDisplay(msg.fecha, true) || "")}</div>
            </div>
          </div>

          ${isAdmin ? `
            <button class="btn-delete-msg" onclick="deleteMessage('${msg.id}')" title="Eliminar mensaje como Administrador">
              <i class="fa-solid fa-trash-can"></i> Borrar
            </button>
          ` : `
            <button class="btn-table-action" onclick="promptDeleteMessage('${msg.id}')" title="Eliminar mensaje con clave" style="font-size: 0.75rem;">
              <i class="fa-solid fa-key"></i> Borrar
            </button>
          `}
        </div>
        <p class="message-content">${escapeHtml(msg.texto)}</p>
      </div>
    `;
  }).join("");
}

async function promptDeleteMessage(msgId) {
  const key = prompt("Ingresá la clave de administración (.env):");
  if (!key) return;
  await performDeleteMessage(msgId, key);
}

async function deleteMessage(msgId) {
  if (!confirm("¿Deseás eliminar este mensaje del libro de visitas?")) return;
  const key = APP_STATE.adminToken;
  if (!key) {
    promptDeleteMessage(msgId);
    return;
  }
  await performDeleteMessage(msgId, key);
}

async function performDeleteMessage(msgId, key) {
  try {
    const res = await fetch(`/api/mensajes/${msgId}`, {
      method: "DELETE",
      headers: { "x-admin-key": key }
    });

    if (res.status === 403) {
      Toast.error("Clave de administrador incorrecta", "Verificá la clave configurada en el archivo .env.");
      return;
    }

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Error al eliminar");
    }

    Toast.success("Mensaje eliminado correctamente", "El libro de visitas fue actualizado.");
    fetchGuestbookMessages();
  } catch (err) {
    Toast.error("No se pudo eliminar el mensaje", `Detalle: ${err.message}. Intentá nuevamente.`);
  }
}


// ===================================================================
// 7. MODAL DE LOGIN ADMIN (SEGURIDAD EN BACKEND)
// ===================================================================
function initAdminModal() {
  const openBtn = document.getElementById("btn-open-login");
  const footerBtn = document.getElementById("footer-admin-link");
  const closeBtn = document.getElementById("modal-close-btn");
  const modal = document.getElementById("login-modal");
  const form = document.getElementById("admin-login-form");
  const errorMsg = document.getElementById("login-error-msg");
  const backToWebBtn = document.getElementById("btn-back-to-web");
  const logoutBtn = document.getElementById("btn-logout");

  const openModal = (e) => {
    if (e) e.preventDefault();
    if (APP_STATE.adminToken) {
      showAdminView();
      return;
    }
    if (modal) modal.classList.add("active");
  };

  const closeModal = () => {
    if (modal) modal.classList.remove("active");
    if (errorMsg) errorMsg.style.display = "none";
  };

  if (openBtn) openBtn.addEventListener("click", openModal);
  if (footerBtn) footerBtn.addEventListener("click", openModal);
  if (closeBtn) closeBtn.addEventListener("click", closeModal);

  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
  }

  // Validación y envío de credenciales al backend
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const usuario = document.getElementById("login-username").value.trim();
      const password = document.getElementById("login-password").value.trim();

      try {
        const res = await fetch("/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ usuario, password })
        });

        if (!res.ok) {
          throw new Error("Credenciales inválidas");
        }

        const data = await res.json();
        APP_STATE.adminToken = data.token;
        sessionStorage.setItem("oneplus_admin_token", data.token);

        closeModal();
        Toast.success("¡Bienvenido al Panel de Control ONE+!", "Acceso concedido para administrar socios, stock y caja.");
        showAdminView();
        adminRefreshAll();
      } catch (err) {
        if (errorMsg) {
          errorMsg.style.display = "block";
          errorMsg.textContent = "Usuario o contraseña incorrectos.";
        }
        Toast.error("Credenciales inválidas", "Verificá el usuario y la contraseña ingresados.");
      }
    });
  }

  if (backToWebBtn) {
    backToWebBtn.addEventListener("click", () => {
      showPublicView();
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      APP_STATE.adminToken = null;
      sessionStorage.removeItem("oneplus_admin_token");
      Toast.info("Sesión cerrada correctamente", "Has salido del panel de administración.");
      showPublicView();
      fetchGuestbookMessages();
    });
  }
}

function showAdminView() {
  document.getElementById("public-view").style.display = "none";
  document.getElementById("admin-view").classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
  adminRefreshAll();
}

function showPublicView() {
  document.getElementById("admin-view").classList.remove("active");
  document.getElementById("public-view").style.display = "block";
  window.scrollTo({ top: 0, behavior: "smooth" });
}


// ===================================================================
// 8. NAVEGACIÓN DE PESTAÑAS DEL PANEL ADMIN
// ===================================================================
function initAdminTabs() {
  const tabButtons = document.querySelectorAll(".sidebar-item-btn");
  const tabSections = document.querySelectorAll(".admin-panel-tab");

  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetTabId = btn.getAttribute("data-tab");

      tabButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      tabSections.forEach(tab => {
        if (tab.id === targetTabId) {
          tab.classList.add("active");
        } else {
          tab.classList.remove("active");
        }
      });

      // Si se abre el tab de Dashboard o Finanzas, redimensionar gráficas
      if (targetTabId === "tab-dashboard") {
        setTimeout(() => {
          if (APP_STATE.chartAttendance) APP_STATE.chartAttendance.resize();
          if (APP_STATE.chartFinances) APP_STATE.chartFinances.resize();
        }, 150);
      }

      // Si se abre el tab de Check-in en la barra lateral, enfocar el buscador de DNI
      if (targetTabId === "tab-checkin") {
        setTimeout(() => {
          const dniInput = document.getElementById("checkin-dni-input");
          if (dniInput) dniInput.focus();
        }, 120);
      }
    });
  });
}


// ===================================================================
// 9. CARGA Y REFRESH DE DATOS DEL PANEL ADMIN
// ===================================================================
async function adminRefreshAll() {
  if (!APP_STATE.adminToken) return;

  try {
    const res = await fetch("/api/admin/data", {
      headers: { "x-admin-key": APP_STATE.adminToken }
    });

    if (!res.ok) throw new Error("No se pudo obtener datos del gimnasio");

    const gymData = await res.json();
    APP_STATE.sociosData = gymData.socios || [];
    actualizarEstadosSociosFront(APP_STATE.sociosData);
    APP_STATE.stockData = gymData.stock || [];
    APP_STATE.maquinasData = gymData.maquinas || [];
    APP_STATE.finanzasData = gymData.finanzas || {};
    APP_STATE.flujoAsistencia = gymData.flujo_asistencia || null;
    APP_STATE.checkinsLog = gymData.checkins_log || [];

    renderAdminKPIs();
    renderSociosTable();
    renderStockTable();
    renderMaquinasTable();
    renderFinanzas();
    fetchGuestbookMessages();

    // Inicializar o actualizar Gráficas Chart.js
    initOrUpdateCharts();
  } catch (err) {
    console.error("Error al refrescar panel admin:", err);
    Toast.error("Error al refrescar el panel", `Detalle: ${err.message}. Comprobá la conexión.`);
  }
}

function renderAdminKPIs() {
  const socios = APP_STATE.sociosData;
  const finanzas = APP_STATE.finanzasData;

  const total = socios.length;
  const alDia = socios.filter(s => s.estado === "Al día").length;
  const vencidas = socios.filter(s => s.estado === "Vencido").length;

  const kpiTotal = document.getElementById("kpi-total-socios");
  const kpiAlDia = document.getElementById("kpi-cuotas-al-dia");
  const kpiVencidas = document.getElementById("kpi-cuotas-vencidas");
  const kpiIngresos = document.getElementById("kpi-ingresos-mes");

  if (kpiTotal) kpiTotal.textContent = total;
  if (kpiAlDia) kpiAlDia.textContent = alDia;
  if (kpiVencidas) kpiVencidas.textContent = vencidas;
  if (kpiIngresos) kpiIngresos.textContent = `$${(finanzas.ingresos_mes || 0).toLocaleString("es-AR")}`;

  // Alertas de socios
  const alertasSociosEl = document.getElementById("quick-alertas-socios");
  if (alertasSociosEl) {
    const problem = socios.filter(s => s.estado !== "Al día");
    if (problem.length === 0) {
      alertasSociosEl.innerHTML = `<div style="color: var(--status-success); font-weight: 700;"><i class="fa-solid fa-circle-check"></i> Todos los socios están al día.</div>`;
    } else {
      alertasSociosEl.innerHTML = problem.map(s => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px dashed var(--border-color);">
          <div>
            <strong>${escapeHtml(s.nombre)}</strong> &bull; <small>Venc: ${formatDateDisplay(s.vencimiento)}</small>
          </div>
          <span class="status-chip ${s.estado === 'Vencido' ? 'danger' : 'warning'}">${escapeHtml(s.estado)}</span>
        </div>
      `).join("");
    }
  }

  // Alertas de máquinas
  const alertasMaqEl = document.getElementById("quick-alertas-maquinas");
  if (alertasMaqEl) {
    const mant = APP_STATE.maquinasData.filter(m => m.estado !== "Operativa");
    if (mant.length === 0) {
      alertasMaqEl.innerHTML = `<div style="color: var(--status-success); font-weight: 700;"><i class="fa-solid fa-circle-check"></i> Todas las máquinas operativas.</div>`;
    } else {
      alertasMaqEl.innerHTML = mant.map(m => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px dashed var(--border-color);">
          <div>
            <strong>${escapeHtml(m.nombre)}</strong> (${escapeHtml(m.zona)})
          </div>
          <span class="status-chip warning">${escapeHtml(m.estado)}</span>
        </div>
      `).join("");
    }
  }
}


// ===================================================================
// 10. GRÁFICAS CHART.JS (FLUJO HORARIO/DÍAS E INGRESOS/EGRESOS)
// ===================================================================
const ATTENDANCE_DATASETS = {
  promedio: {
    labels: ["08:00", "09:00", "10:00", "11:00", "12:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00"],
    values: [22, 42, 38, 25, 14, 20, 34, 52, 74, 82, 78, 60, 32, 10]
  },
  lunes: {
    labels: ["08:00", "09:00", "10:00", "11:00", "12:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00"],
    values: [26, 48, 45, 30, 16, 24, 40, 58, 85, 92, 86, 68, 36, 12]
  },
  martes: {
    labels: ["08:00", "09:00", "10:00", "11:00", "12:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00"],
    values: [20, 38, 36, 24, 12, 18, 32, 50, 72, 80, 75, 58, 30, 9]
  },
  miercoles: {
    labels: ["08:00", "09:00", "10:00", "11:00", "12:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00"],
    values: [24, 44, 40, 26, 15, 22, 36, 54, 76, 84, 80, 62, 34, 11]
  },
  jueves: {
    labels: ["08:00", "09:00", "10:00", "11:00", "12:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00"],
    values: [19, 36, 34, 22, 11, 17, 30, 48, 70, 78, 72, 55, 28, 8]
  },
  viernes: {
    labels: ["08:00", "09:00", "10:00", "11:00", "12:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00"],
    values: [25, 45, 42, 28, 14, 22, 38, 55, 78, 86, 74, 48, 22, 6]
  },
  sabado: {
    labels: ["09:00", "10:00", "11:00", "12:00"],
    values: [35, 58, 64, 40]
  }
};

function getAttendanceData(dayKey) {
  if (APP_STATE.flujoAsistencia && APP_STATE.flujoAsistencia[dayKey]) {
    const dayObj = APP_STATE.flujoAsistencia[dayKey];
    return {
      labels: Object.keys(dayObj),
      values: Object.values(dayObj)
    };
  }
  return ATTENDANCE_DATASETS[dayKey] || ATTENDANCE_DATASETS.promedio;
}

function initOrUpdateCharts() {
  if (typeof Chart === "undefined") return;

  const isDark = APP_STATE.theme === "dark";
  const gridColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)";
  const textColor = isDark ? "#cbd5e1" : "#475569";
  const accentGreen = isDark ? "#00fc9f" : "#10b981";

  // 1. Gráfica de Asistencia / Flujo de Gente
  const canvasAtt = document.getElementById("chart-attendance");
  if (canvasAtt) {
    const ctx = canvasAtt.getContext("2d");
    const daySelect = document.getElementById("select-dia-flujo");
    const selectedDay = daySelect ? daySelect.value : "promedio";
    const currentData = getAttendanceData(selectedDay);

    if (APP_STATE.chartAttendance) {
      APP_STATE.chartAttendance.destroy();
    }

    // Gradiente verde
    const gradient = ctx.createLinearGradient(0, 0, 0, 260);
    gradient.addColorStop(0, isDark ? "rgba(0, 252, 159, 0.45)" : "rgba(16, 185, 129, 0.35)");
    gradient.addColorStop(1, isDark ? "rgba(0, 252, 159, 0.01)" : "rgba(16, 185, 129, 0.01)");

    APP_STATE.chartAttendance = new Chart(ctx, {
      type: "line",
      data: {
        labels: currentData.labels,
        datasets: [{
          label: "Personas entrenando",
          data: currentData.values,
          borderColor: accentGreen,
          backgroundColor: gradient,
          fill: true,
          tension: 0.38,
          pointBackgroundColor: accentGreen,
          pointBorderColor: isDark ? "#141b24" : "#ffffff",
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.parsed.y} personas entrenando`
            }
          }
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: textColor, font: { family: "'Roboto Slab', serif" } }
          },
          y: {
            beginAtZero: true,
            grid: { color: gridColor },
            ticks: { color: textColor, font: { family: "'Roboto Slab', serif" } }
          }
        }
      }
    });
  }

  // 2. Gráfica de Ingresos vs Egresos
  const canvasFin = document.getElementById("chart-finances");
  if (canvasFin) {
    const ctx = canvasFin.getContext("2d");
    const fin = APP_STATE.finanzasData || {};
    const ingresos = fin.ingresos_mes || 1845000;
    const egresos = fin.egresos_mes || 690000;

    if (APP_STATE.chartFinances) {
      APP_STATE.chartFinances.destroy();
    }

    APP_STATE.chartFinances = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["Julio", "Agosto", "Septiembre", "Mes Actual (Octubre)"],
        datasets: [
          {
            label: "Ingresos ($)",
            data: [1520000, 1680000, 1750000, ingresos],
            backgroundColor: accentGreen,
            borderRadius: 6
          },
          {
            label: "Egresos ($)",
            data: [590000, 640000, 610000, egresos],
            backgroundColor: isDark ? "#f87171" : "#ef4444",
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: textColor, font: { family: "'Roboto Slab', serif" } }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: $${ctx.parsed.y.toLocaleString("es-AR")}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: textColor, font: { family: "'Roboto Slab', serif" } }
          },
          y: {
            beginAtZero: true,
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              callback: (v) => `$${(v / 1000).toFixed(0)}k`,
              font: { family: "'Roboto Slab', serif" }
            }
          }
        }
      }
    });
  }
}

function updateAttendanceChartDay(dayKey) {
  if (!APP_STATE.chartAttendance) return;
  const data = getAttendanceData(dayKey);
  APP_STATE.chartAttendance.data.labels = data.labels;
  APP_STATE.chartAttendance.data.datasets[0].data = data.values;
  APP_STATE.chartAttendance.update();
}

function updateChartsTheme() {
  initOrUpdateCharts();
}


// ===================================================================
// 11. BÚSQUEDA Y FILTRADO POR TEXTO Y FECHA EN TODAS LAS HERRAMIENTAS
// ===================================================================

// ===================================================================
// CHECK-IN DE SOCIOS EN DASHBOARD (PUERTA)
// ===================================================================
function executeCheckinSearch() {
  const inputEl = document.getElementById("checkin-dni-input");
  const notFoundEl = document.getElementById("checkin-not-found");
  const notFoundText = document.getElementById("checkin-not-found-text");
  const resultCardEl = document.getElementById("checkin-result-card");
  const placeholderEl = document.getElementById("checkin-placeholder");

  if (!inputEl) return;
  const rawDni = inputEl.value.trim();

  if (!rawDni) {
    Toast.warning("DNI requerido", "Ingresá el número de DNI del socio para realizar la búsqueda.");
    return;
  }

  const cleanInputDni = rawDni.replace(/[^0-9]/g, "");
  
  // Buscar socio por DNI normalizado o texto
  const socio = APP_STATE.sociosData.find(s => {
    const sDniClean = String(s.dni || "").replace(/[^0-9]/g, "");
    return (cleanInputDni && sDniClean === cleanInputDni) || String(s.dni || "").toLowerCase() === rawDni.toLowerCase();
  });

  if (!socio) {
    if (placeholderEl) placeholderEl.style.display = "none";
    if (resultCardEl) resultCardEl.style.display = "none";
    if (notFoundEl) {
      notFoundEl.style.display = "flex";
      if (notFoundText) {
        notFoundText.innerHTML = `No se encontró ningún socio inscripto con el DNI <strong>${escapeHtml(rawDni)}</strong>. Podés registrarlo como nuevo socio en la pestaña de Inscriptos.`;
      }
    }
    Toast.error("Socio no encontrado", `No existe un socio registrado con DNI ${rawDni}. Verificá el número.`);
    return;
  }

  // Socio encontrado: ocultar alertas y mostrar tarjeta
  if (notFoundEl) notFoundEl.style.display = "none";
  if (placeholderEl) placeholderEl.style.display = "none";
  if (resultCardEl) {
    resultCardEl.style.display = "flex";
    renderCheckinResultCard(socio);
  }
}

function renderCheckinResultCard(socio) {
  const resultCardEl = document.getElementById("checkin-result-card");
  if (!resultCardEl) return;

  let chipClass = "success";
  if (socio.estado === "Vencido") chipClass = "danger";
  else if (socio.estado === "Por vencer") chipClass = "warning";

  const isLimited = typeof socio.clases_restantes === "number";
  const remainingClasses = isLimited ? socio.clases_restantes : (socio.clases_restantes || "Ilimitadas");
  const totalWeekly = socio.clases_semanales || (isLimited ? 3 : "Ilimitadas");

  const hasNoClassesLeft = isLimited && remainingClasses <= 0;
  const isVencido = socio.estado === "Vencido";

  resultCardEl.innerHTML = `
    <div class="checkin-socio-header">
      <div>
        <h4 class="checkin-socio-title">${escapeHtml(socio.nombre)}</h4>
        <div class="checkin-socio-meta">
          <span><i class="fa-solid fa-id-card"></i> DNI: <strong>${escapeHtml(socio.dni)}</strong></span>
          <span>&bull;</span>
          <a href="https://wa.me/${String(socio.telefono || '').replace(/[^0-9]/g, '')}" target="_blank" style="color: var(--accent-green); font-weight: 700;">
            <i class="fa-brands fa-whatsapp"></i> ${escapeHtml(socio.telefono || 'Sin tel')}
          </a>
        </div>
      </div>
      <div>
        <span class="status-chip ${chipClass}" style="font-size: 0.88rem; padding: 0.35rem 0.85rem;">
          ${escapeHtml(socio.estado)}
        </span>
      </div>
    </div>

    <div class="checkin-stats-grid">
      <div class="checkin-stat-box">
        <div class="checkin-stat-label">Plan Contratado</div>
        <div class="checkin-stat-value" style="font-size: 0.95rem;">${escapeHtml(socio.plan)}</div>
      </div>

      <div class="checkin-stat-box">
        <div class="checkin-stat-label">Vencimiento Cuota</div>
        <div class="checkin-stat-value" style="font-size: 0.95rem; color: ${isVencido ? 'var(--status-danger)' : 'var(--text-primary)'};">
          ${escapeHtml(formatDateDisplay(socio.vencimiento) || '-')}
        </div>
      </div>

      <div class="checkin-stat-box">
        <div class="checkin-stat-label">Clases Disponibles</div>
        <div class="checkin-stat-value ${hasNoClassesLeft ? 'highlight-danger' : 'highlight-green'}">
          ${isLimited ? `${remainingClasses} de ${totalWeekly}` : 'Ilimitadas'}
        </div>
      </div>

      <div class="checkin-stat-box">
        <div class="checkin-stat-label">Asistencias Semana</div>
        <div class="checkin-stat-value">${socio.asistencias_semana || 0} asist.</div>
      </div>

      <div class="checkin-stat-box">
        <div class="checkin-stat-label">Total Histórico</div>
        <div class="checkin-stat-value">${socio.asistencias_totales || 0} asist.</div>
      </div>

      <div class="checkin-stat-box">
        <div class="checkin-stat-label">Último Ingreso</div>
        <div class="checkin-stat-value" style="font-size: 0.85rem; font-weight: 600;">
          ${socio.ultima_asistencia ? formatDateDisplay(socio.ultima_asistencia, true) : 'Primer ingreso'}
        </div>
      </div>
    </div>

    ${hasNoClassesLeft ? `
      <div class="delete-warning-note" style="margin: 0; padding: 0.65rem 0.85rem;">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <span>¡Atención! El socio ya consumió todas sus clases autorizadas para el ciclo actual.</span>
      </div>
    ` : ''}

    ${isVencido ? `
      <div class="delete-warning-note" style="margin: 0; padding: 0.65rem 0.85rem;">
        <i class="fa-solid fa-clock-rotate-left"></i>
        <span>¡Cuota vencida! Recordale abonar su cuota mensual para mantener el acceso regular.</span>
      </div>
    ` : ''}

    <button type="button" class="btn-primary btn-checkin-action" onclick="confirmCheckin(${socio.id})">
      <i class="fa-solid fa-circle-check"></i>
      Registrar Asistencia (Check-in)
      ${isLimited ? ' &bull; Descontar 1 clase' : ''}
    </button>
  `;
}

async function confirmCheckin(socioId) {
  const socio = APP_STATE.sociosData.find(s => s.id === socioId);
  if (!socio) return;

  try {
    const res = await fetch("/api/admin/socios/checkin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": APP_STATE.adminToken
      },
      body: JSON.stringify({ id: socioId })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || "Error en el servidor al registrar check-in");
    }

    const data = await res.json();
    const updatedSocio = data.socio;

    // Actualizar flujo_asistencia y logs de check-in en vivo
    if (data.flujo_asistencia) {
      APP_STATE.flujoAsistencia = data.flujo_asistencia;
    }
    if (data.checkin) {
      if (!APP_STATE.checkinsLog) APP_STATE.checkinsLog = [];
      APP_STATE.checkinsLog.unshift(data.checkin);
    }

    // Actualizar en el estado local
    const idx = APP_STATE.sociosData.findIndex(s => s.id === socioId);
    if (idx !== -1) {
      APP_STATE.sociosData[idx] = updatedSocio;
    }

    // Actualizar la tarjeta de check-in en pantalla
    renderCheckinResultCard(updatedSocio);

    // Refrescar tabla y KPIs
    renderSociosTable();
    renderAdminKPIs();

    // Actualizar la gráfica de flujo en tiempo real
    const selectDia = document.getElementById("select-dia-flujo");
    const currentDayVal = selectDia ? selectDia.value : "promedio";
    updateAttendanceChartDay(currentDayVal);

    const planIsLimited = typeof updatedSocio.clases_restantes === "number";
    const msgClases = planIsLimited 
      ? `Le quedan ${updatedSocio.clases_restantes} clases disponibles.`
      : `Pase libre ilimitado. Total asistencias: ${updatedSocio.asistencias_totales}.`;

    Toast.success(
      `¡Check-in confirmado para ${updatedSocio.nombre}!`,
      `Asistencia registrada correctamente. ${msgClases}`
    );
  } catch (err) {
    console.error("Error en checkin:", err);
    Toast.error("Error al registrar check-in", `Detalle: ${err.message}. Intentá nuevamente.`);
  }
}


// ===================================================================
// HERRAMIENTA 1: INSCRIPTOS Y CUOTAS (CON MENÚ 3 PUNTITOS Y MODALES)
// ===================================================================
function renderSociosTable(filterEstado = null) {
  const tbody = document.getElementById("socios-table-body");
  if (!tbody) return;

  if (filterEstado !== null) {
    APP_STATE.currentSocioFilterEstado = filterEstado;
  }

  const searchText = (document.getElementById("search-socio")?.value || "").toLowerCase().trim();
  const dateFilter = document.getElementById("filter-socio-date")?.value || "";
  const estadoFilter = APP_STATE.currentSocioFilterEstado || "todos";

  let list = APP_STATE.sociosData;

  // 1. Filtro de Estado
  if (estadoFilter && estadoFilter !== "todos") {
    list = list.filter(s => s.estado && s.estado.toLowerCase() === estadoFilter.toLowerCase());
  }

  // 2. Filtro por Texto (Nombre, DNI o Plan)
  if (searchText) {
    list = list.filter(s => 
      (s.nombre && s.nombre.toLowerCase().includes(searchText)) ||
      (s.dni && s.dni.toLowerCase().includes(searchText)) ||
      (s.plan && s.plan.toLowerCase().includes(searchText))
    );
  }

  // 3. Filtro por Fecha de Vencimiento (Soporta DD/MM/YYYY y YYYY-MM-DD)
  if (dateFilter) {
    const formattedDate = toDdmmyyyy(dateFilter);
    list = list.filter(s => s.vencimiento && (s.vencimiento.includes(dateFilter) || s.vencimiento.includes(formattedDate)));
  }

  // 4. Actualizar banner de filtro activo
  const banner = document.getElementById("socios-active-filter-indicator");
  const textEl = document.getElementById("socios-active-filter-text");
  const isFiltered = (estadoFilter !== "todos") || Boolean(searchText) || Boolean(dateFilter);

  if (banner && textEl) {
    if (isFiltered) {
      banner.style.display = "flex";
      let filterTags = [];
      if (estadoFilter !== "todos") {
        filterTags.push(`Estado: <strong>${escapeHtml(estadoFilter)}</strong>`);
      }
      if (searchText) {
        filterTags.push(`Buscando: "<strong>${escapeHtml(searchText)}</strong>"`);
      }
      if (dateFilter) {
        filterTags.push(`Vence: <strong>${escapeHtml(toDdmmyyyy(dateFilter))}</strong>`);
      }
      textEl.innerHTML = `Filtro activo: ${filterTags.join(" &bull; ")} — <strong>${list.length} socio(s) encontrado(s)</strong>`;
    } else {
      banner.style.display = "none";
    }
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--text-muted);"><i class="fa-solid fa-magnifying-glass"></i> No se encontraron socios que coincidan con los criterios de búsqueda.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(s => {
    let chipClass = "success";
    if (s.estado === "Vencido") chipClass = "danger";
    else if (s.estado === "Por vencer") chipClass = "warning";

    return `
      <tr>
        <td><strong>${escapeHtml(s.nombre)}</strong></td>
        <td>${escapeHtml(s.dni)}</td>
        <td>
          <a href="https://wa.me/${String(s.telefono || '').replace(/[^0-9]/g, '')}" target="_blank" style="color: var(--accent-green); font-weight: 700;">
            <i class="fa-brands fa-whatsapp"></i> ${escapeHtml(s.telefono || '-')}
          </a>
        </td>
        <td>${escapeHtml(s.plan)}</td>
        <td><strong>$${(s.cuota || 0).toLocaleString("es-AR")}</strong></td>
        <td>${escapeHtml(formatDateDisplay(s.vencimiento) || "-")}</td>
        <td><span class="status-chip ${chipClass}">${escapeHtml(s.estado)}</span></td>
        <td>
          <!-- Botón de tres puntitos con menú desplegable -->
          <div class="action-dropdown" id="dropdown-wrap-${s.id}">
            <button type="button" class="dropdown-toggle-dots" onclick="toggleSocioDropdown(event, ${s.id})" title="Opciones del socio" aria-label="Opciones del socio">
              <i class="fa-solid fa-ellipsis-vertical"></i>
            </button>
            <div class="action-dropdown-menu" id="dropdown-menu-${s.id}">
              <button type="button" class="action-dropdown-item" onclick="openSocioInfoModal(${s.id})">
                <i class="fa-solid fa-address-card"></i>
                <span>Mostrar toda la información</span>
              </button>
              <button type="button" class="action-dropdown-item" onclick="openEditSocioModal(${s.id})">
                <i class="fa-solid fa-user-pen"></i>
                <span>Cambiar algún dato</span>
              </button>
              <button type="button" class="action-dropdown-item" onclick="openCobroModal(${s.id})">
                <i class="fa-solid fa-receipt"></i>
                <span>Cobrar / Renovar cuota</span>
              </button>
              <div class="action-dropdown-divider"></div>
              <button type="button" class="action-dropdown-item danger" onclick="openDeleteModal(${s.id})">
                <i class="fa-solid fa-trash-can"></i>
                <span>Borrar socio</span>
              </button>
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function filterSociosTable() {
  renderSociosTable();
}

function filterSocioEstado(estado) {
  setSocioEstadoFilter(estado);
}

function setSocioEstadoFilter(estado, btnEl = null) {
  APP_STATE.currentSocioFilterEstado = estado;

  // Marcar visualmente el botón seleccionado en la barra de herramientas
  const buttons = document.querySelectorAll("#socios-filter-buttons .btn-table-action");
  buttons.forEach(btn => btn.classList.remove("filter-btn-active"));

  if (btnEl) {
    btnEl.classList.add("filter-btn-active");
  } else {
    const map = {
      "todos": "filter-btn-todos",
      "al día": "filter-btn-aldia",
      "por vencer": "filter-btn-porvencer",
      "vencido": "filter-btn-vencido"
    };
    const targetId = map[estado.toLowerCase()];
    if (targetId) {
      const el = document.getElementById(targetId);
      if (el) el.classList.add("filter-btn-active");
    }
  }

  renderSociosTable();
}

function clearSociosFilters() {
  const searchInput = document.getElementById("search-socio");
  const dateInput = document.getElementById("filter-socio-date");
  if (searchInput) searchInput.value = "";
  if (dateInput) dateInput.value = "";

  setSocioEstadoFilter("todos", document.getElementById("filter-btn-todos"));
}

// Control del menú desplegable de 3 puntitos
function toggleSocioDropdown(event, socioId) {
  event.stopPropagation();
  const menu = document.getElementById(`dropdown-menu-${socioId}`);
  const isShown = menu && menu.classList.contains("show");

  // Cerrar todos los menús abiertos
  document.querySelectorAll(".action-dropdown-menu.show").forEach(m => m.classList.remove("show"));

  // Si no estaba abierto, abrirlo
  if (!isShown && menu) {
    menu.classList.add("show");
  }
}

// Cerrar menús al hacer click fuera
document.addEventListener("click", () => {
  document.querySelectorAll(".action-dropdown-menu.show").forEach(m => m.classList.remove("show"));
});

// Cobro de cuota: abre el modal con opciones de plan y meses adelantados
function cobrarCuotaSocio(socioId) {
  openCobroModal(socioId);
}

// ===================================================================
// MODAL: COBRO DE CUOTA / RENOVACIÓN CON PLAN Y MESES ADELANTADOS
// ===================================================================
let COBRO_STATE = {
  socioId: null,
  socio: null,
  mode: "same", // "same" o "change"
  planName: "",
  cuotaMensual: 0,
  meses: 1,
  montoTotal: 0,
  nuevoVencimiento: ""
};

function openCobroModal(socioId) {
  closeVencidosModal();
  document.querySelectorAll(".action-dropdown-menu.show").forEach(m => m.classList.remove("show"));

  const socio = APP_STATE.sociosData.find(s => s.id === socioId);
  if (!socio) {
    Toast.error("Socio no encontrado", "No se localizó el socio para registrar el cobro.");
    return;
  }

  COBRO_STATE.socioId = socio.id;
  COBRO_STATE.socio = socio;
  COBRO_STATE.mode = "same";
  COBRO_STATE.planName = socio.plan || "Pase Libre (Todos los días)";
  COBRO_STATE.cuotaMensual = Number(socio.cuota) || 28000;
  COBRO_STATE.meses = 1;

  // Renderizar resumen actual del socio
  const summaryEl = document.getElementById("cobro-socio-summary-card");
  if (summaryEl) {
    const isVencido = socio.estado === "Vencido";
    summaryEl.innerHTML = `
      <div class="cobro-socio-info">
        <h4 class="cobro-socio-name">
          ${escapeHtml(socio.nombre)}
          <span class="status-chip ${isVencido ? 'danger' : 'success'}" style="font-size: 0.76rem; padding: 0.2rem 0.65rem;">
            ${escapeHtml(socio.estado || 'Al día')}
          </span>
        </h4>
        <div class="cobro-socio-meta">
          <span><i class="fa-solid fa-id-card"></i> DNI: <strong>${escapeHtml(socio.dni)}</strong></span>
          <span>&bull;</span>
          <span>Plan actual: <strong>${escapeHtml(socio.plan)}</strong></span>
          <span>&bull;</span>
          <span style="color: ${isVencido ? 'var(--status-danger)' : 'var(--text-muted)'}; font-weight: 700;">
            <i class="fa-solid fa-calendar-days"></i> Vencimiento: ${escapeHtml(formatDateDisplay(socio.vencimiento) || '-')}
          </span>
        </div>
      </div>
    `;
  }

  // Label del plan en opción "Mantener Plan Actual"
  const sameLabel = document.getElementById("choice-same-plan-label");
  if (sameLabel) {
    sameLabel.textContent = `${socio.plan} — $${(Number(socio.cuota) || 0).toLocaleString("es-AR")} / mes`;
  }

  // Reset controles del formulario
  document.getElementById("cobro-socio-id").value = socio.id;
  document.getElementById("choice-mode-same").checked = true;
  document.getElementById("choice-mode-change").checked = false;
  document.getElementById("label-choice-same").classList.add("active");
  document.getElementById("label-choice-change").classList.remove("active");
  document.getElementById("cobro-plan-change-section").style.display = "none";

  // Pre-seleccionar plan en el selector de cambio
  const selectPlan = document.getElementById("select-nuevo-plan");
  if (selectPlan) {
    if (ONEPLUS_PLANES[socio.plan]) {
      selectPlan.value = socio.plan;
    } else {
      selectPlan.selectedIndex = 0;
    }
  }

  // Reset selector de meses a 1
  selectMesesCobro(1, false);

  updateCobroModalSummary();

  const modal = document.getElementById("modal-cobro-cuota");
  if (modal) modal.classList.add("active");
}

function closeCobroModal() {
  const modal = document.getElementById("modal-cobro-cuota");
  if (modal) modal.classList.remove("active");
}

function selectPlanChoice(mode) {
  COBRO_STATE.mode = mode;
  const sameCard = document.getElementById("label-choice-same");
  const changeCard = document.getElementById("label-choice-change");
  const changeSection = document.getElementById("cobro-plan-change-section");
  const sameRadio = document.getElementById("choice-mode-same");
  const changeRadio = document.getElementById("choice-mode-change");

  if (mode === "same") {
    if (sameRadio) sameRadio.checked = true;
    if (sameCard) sameCard.classList.add("active");
    if (changeCard) changeCard.classList.remove("active");
    if (changeSection) changeSection.style.display = "none";
    
    COBRO_STATE.planName = COBRO_STATE.socio?.plan || "Pase Libre (Todos los días)";
    COBRO_STATE.cuotaMensual = Number(COBRO_STATE.socio?.cuota) || 28000;
  } else {
    if (changeRadio) changeRadio.checked = true;
    if (changeCard) changeCard.classList.add("active");
    if (sameCard) sameCard.classList.remove("active");
    if (changeSection) changeSection.style.display = "block";

    const selectEl = document.getElementById("select-nuevo-plan");
    handleNewPlanSelected(selectEl ? selectEl.value : "Pase Libre (Todos los días)");
  }

  updateCobroModalSummary();
}

function handlePlanChoiceChange() {
  const isChange = document.getElementById("choice-mode-change")?.checked;
  selectPlanChoice(isChange ? "change" : "same");
}

function handleNewPlanSelected(planKey) {
  const planInfo = ONEPLUS_PLANES[planKey];
  if (planInfo) {
    COBRO_STATE.planName = planInfo.nombre;
    COBRO_STATE.cuotaMensual = planInfo.cuota;
  } else {
    COBRO_STATE.planName = planKey;
    const opt = document.querySelector(`#select-nuevo-plan option[value="${planKey}"]`);
    COBRO_STATE.cuotaMensual = opt ? Number(opt.dataset.precio || 28000) : 28000;
  }
  updateCobroModalSummary();
}

function selectMesesCobro(numMeses, doUpdate = true) {
  numMeses = Math.min(3, Math.max(1, Number(numMeses)));
  COBRO_STATE.meses = numMeses;

  [1, 2, 3].forEach(n => {
    const btn = document.getElementById(`btn-meses-${n}`);
    if (btn) {
      if (n === numMeses) btn.classList.add("active");
      else btn.classList.remove("active");
    }
  });

  if (doUpdate) updateCobroModalSummary();
}

function updateCobroModalSummary() {
  const socio = COBRO_STATE.socio;
  const meses = COBRO_STATE.meses || 1;
  const cuota = COBRO_STATE.cuotaMensual || 0;
  const total = cuota * meses;
  COBRO_STATE.montoTotal = total;

  const baseVenc = socio ? socio.vencimiento : null;
  const nuevoVenc = calculateNewVencimiento(baseVenc, meses);
  COBRO_STATE.nuevoVencimiento = nuevoVenc;

  const planEl = document.getElementById("summary-cobro-plan-name");
  const cuotaEl = document.getElementById("summary-cobro-cuota-mensual");
  const mesesEl = document.getElementById("summary-cobro-meses-txt");
  const vencEl = document.getElementById("summary-cobro-nuevo-vencimiento");
  const totalEl = document.getElementById("summary-cobro-total-amount");
  const btnSubmit = document.getElementById("btn-confirm-cobro-action");

  if (planEl) planEl.textContent = COBRO_STATE.planName;
  if (cuotaEl) cuotaEl.textContent = `$${cuota.toLocaleString("es-AR")} / mes`;
  if (mesesEl) {
    mesesEl.textContent = meses === 1 ? "1 mes (Estándar)" : `${meses} meses (${meses - 1} adelantado${meses > 2 ? 's' : ''})`;
  }
  if (vencEl) vencEl.textContent = nuevoVenc;
  if (totalEl) totalEl.textContent = `$${total.toLocaleString("es-AR")}`;
  if (btnSubmit) {
    btnSubmit.innerHTML = `<i class="fa-solid fa-circle-check"></i> Confirmar Cobro ($${total.toLocaleString("es-AR")})`;
  }
}

async function handleConfirmarCobro(event) {
  event.preventDefault();
  const socio = COBRO_STATE.socio;
  if (!socio) return;

  const payload = {
    socio_id: socio.id,
    plan: COBRO_STATE.planName,
    cuota: COBRO_STATE.cuotaMensual,
    meses: COBRO_STATE.meses,
    monto_total: COBRO_STATE.montoTotal,
    nuevo_vencimiento: COBRO_STATE.nuevoVencimiento
  };

  try {
    const res = await fetch("/api/admin/socios/cobrar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": APP_STATE.adminToken
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || "Error en el servidor al registrar el cobro");
    }

    const data = await res.json();
    closeCobroModal();

    Toast.success(
      `¡Cobro registrado con éxito para ${socio.nombre}!`,
      `Se acreditó $${payload.monto_total.toLocaleString("es-AR")} (${payload.meses} mes/es) bajo el plan ${payload.plan}. Nueva vigencia hasta el ${payload.nuevo_vencimiento}.`
    );

    // Refrescar todos los datos del panel
    adminRefreshAll();
  } catch (err) {
    console.error("Error al cobrar cuota:", err);
    Toast.error("No se pudo registrar el cobro", `Detalle: ${err.message}. Intentá nuevamente.`);
  }
}

// ===================================================================
// MODAL: INSCRIBIR / EDITAR SOCIO (VALIDACIÓN ESTRICTA)
// ===================================================================
function autoFillPlanDetails(planValue) {
  const cuotaInput = document.getElementById("socio-cuota");
  const clasesSelect = document.getElementById("socio-clases");

  if (!cuotaInput) return;

  if (planValue.includes("22") || planValue.toLowerCase().includes("3 veces")) {
    cuotaInput.value = 22000;
    if (clasesSelect) clasesSelect.value = "3";
  } else if (planValue.includes("23") || planValue.toLowerCase().includes("amigo")) {
    cuotaInput.value = 23000;
    if (clasesSelect) clasesSelect.value = "Ilimitadas";
  } else if (planValue.includes("43") || planValue.toLowerCase().includes("personal")) {
    cuotaInput.value = 43000;
    if (clasesSelect) clasesSelect.value = "12";
  } else if (planValue.toLowerCase().includes("suelta")) {
    cuotaInput.value = 8000;
    if (clasesSelect) clasesSelect.value = "1";
  } else {
    // Pase Libre
    cuotaInput.value = 28000;
    if (clasesSelect) clasesSelect.value = "Ilimitadas";
  }
}

function openNewSocioModal() {
  const modal = document.getElementById("socio-modal");
  const title = document.getElementById("socio-modal-title");
  const icon = document.getElementById("socio-modal-icon");
  const errorAlert = document.getElementById("socio-form-error");

  if (!modal) return;

  // Limpiar campos
  document.getElementById("socio-id").value = "";
  document.getElementById("socio-nombre").value = "";
  document.getElementById("socio-dni").value = "";
  document.getElementById("socio-telefono").value = "+54 387 ";
  document.getElementById("socio-plan").value = "Pase Libre (Todos los días)";
  document.getElementById("socio-cuota").value = "28000";
  document.getElementById("socio-clases").value = "Ilimitadas";
  document.getElementById("socio-estado").value = "Al día";

  // Fecha por defecto: hoy + 30 días
  const nextMonth = new Date();
  nextMonth.setDate(nextMonth.getDate() + 30);
  document.getElementById("socio-vencimiento").value = nextMonth.toISOString().split("T")[0];

  if (title) title.textContent = "Inscribir Nuevo Socio";
  if (icon) icon.className = "fa-solid fa-user-plus";
  if (errorAlert) errorAlert.style.display = "none";

  const submitBtn = document.getElementById("btn-save-socio");
  if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Agregar';

  modal.classList.add("active");
}

function openEditSocioModal(socioId) {
  document.querySelectorAll(".action-dropdown-menu.show").forEach(m => m.classList.remove("show"));
  const socio = APP_STATE.sociosData.find(s => s.id === socioId);
  if (!socio) return;

  const modal = document.getElementById("socio-modal");
  const title = document.getElementById("socio-modal-title");
  const icon = document.getElementById("socio-modal-icon");
  const errorAlert = document.getElementById("socio-form-error");

  if (!modal) return;

  document.getElementById("socio-id").value = socio.id;
  document.getElementById("socio-nombre").value = socio.nombre || "";
  document.getElementById("socio-dni").value = String(socio.dni || "").replace(/[^0-9]/g, "");
  document.getElementById("socio-telefono").value = socio.telefono || "";
  document.getElementById("socio-plan").value = socio.plan || "Pase Libre (Todos los días)";
  document.getElementById("socio-cuota").value = socio.cuota || 28000;
  document.getElementById("socio-vencimiento").value = toIsoDate(socio.vencimiento);
  document.getElementById("socio-clases").value = String(socio.clases_semanales || "Ilimitadas");
  document.getElementById("socio-estado").value = socio.estado || "Al día";

  if (title) title.textContent = "Modificar Datos del Socio";
  if (icon) icon.className = "fa-solid fa-user-pen";
  if (errorAlert) errorAlert.style.display = "none";

  const submitBtn = document.getElementById("btn-save-socio");
  if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios';

  modal.classList.add("active");
}

function closeSocioModal() {
  const modal = document.getElementById("socio-modal");
  if (modal) modal.classList.remove("active");
}

function showSocioFormError(msg) {
  const errorAlert = document.getElementById("socio-form-error");
  const errorText = document.getElementById("socio-form-error-text");
  if (errorAlert && errorText) {
    errorText.textContent = msg;
    errorAlert.style.display = "flex";
  }
  Toast.error("Datos inválidos", msg);
}

async function handleSaveSocio(event) {
  event.preventDefault();

  const idVal = document.getElementById("socio-id").value;
  const nombre = document.getElementById("socio-nombre").value.trim();
  const dniRaw = document.getElementById("socio-dni").value.trim();
  const telefono = document.getElementById("socio-telefono").value.trim();
  const plan = document.getElementById("socio-plan").value;
  const cuotaRaw = document.getElementById("socio-cuota").value.trim();
  const vencimiento = document.getElementById("socio-vencimiento").value.trim();
  const clasesVal = document.getElementById("socio-clases").value;
  const estado = document.getElementById("socio-estado").value;

  // 1. VALIDACIÓN: NO PERMITIR ESPACIOS EN BLANCO
  if (!nombre) {
    showSocioFormError("El Nombre y Apellido no puede estar vacío ni contener solo espacios.");
    document.getElementById("socio-nombre").focus();
    return;
  }

  if (nombre.length < 3) {
    showSocioFormError("Ingresá un Nombre y Apellido real de al menos 3 caracteres.");
    document.getElementById("socio-nombre").focus();
    return;
  }

  if (!dniRaw) {
    showSocioFormError("El DNI es obligatorio.");
    document.getElementById("socio-dni").focus();
    return;
  }

  // 2. VALIDACIÓN: DNI SOLO DEBE CONTENER NÚMEROS (SIN STRINGS NI LETRAS)
  if (!/^\d+$/.test(dniRaw)) {
    showSocioFormError("El DNI debe contener únicamente números, sin letras ni espacios.");
    document.getElementById("socio-dni").focus();
    return;
  }

  if (dniRaw.length < 6 || dniRaw.length > 10) {
    showSocioFormError("El DNI debe contener entre 6 y 10 dígitos numéricos.");
    document.getElementById("socio-dni").focus();
    return;
  }

  // 3. VALIDACIÓN: TELÉFONO OBLIGATORIO Y CON DÍGITOS
  if (!telefono || telefono === "+54 387") {
    showSocioFormError("El teléfono o WhatsApp no puede quedar vacío.");
    document.getElementById("socio-telefono").focus();
    return;
  }

  const digitsInPhone = telefono.replace(/[^0-9]/g, "");
  if (digitsInPhone.length < 7) {
    showSocioFormError("Ingresá un número de teléfono válido con al menos 7 dígitos numéricos.");
    document.getElementById("socio-telefono").focus();
    return;
  }

  // 4. VALIDACIÓN: CUOTA SOLO NÚMEROS MAYORES A 0
  if (!cuotaRaw || !/^\d+$/.test(cuotaRaw)) {
    showSocioFormError("El importe de cuota debe contener solo números.");
    document.getElementById("socio-cuota").focus();
    return;
  }

  const cuotaNum = Number(cuotaRaw);
  if (isNaN(cuotaNum) || cuotaNum < 1000) {
    showSocioFormError("El importe de cuota debe ser un número mayor a $1.000.");
    document.getElementById("socio-cuota").focus();
    return;
  }

  // 5. VALIDACIÓN: FECHA DE VENCIMIENTO REQUERIDA
  if (!vencimiento) {
    showSocioFormError("La fecha de vencimiento es obligatoria.");
    document.getElementById("socio-vencimiento").focus();
    return;
  }

  // Formatear DNI con puntos para lectura prolija (ej: 39.421.802)
  const dniFormateado = dniRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  // Preservar estado previo si estamos editando
  const existingSocio = idVal ? APP_STATE.sociosData.find(s => String(s.id) === String(idVal)) : null;

  let clasesSemanales = clasesVal === "Ilimitadas" ? "Ilimitadas" : Number(clasesVal);
  let clasesRestantes = clasesVal === "Ilimitadas" ? "Ilimitadas" : (
    existingSocio && typeof existingSocio.clases_restantes === "number" ? existingSocio.clases_restantes : Number(clasesVal)
  );

  const payloadSocio = {
    nombre,
    dni: dniFormateado,
    telefono,
    plan,
    cuota: cuotaNum,
    vencimiento: toDdmmyyyy(vencimiento),
    estado: calcularEstadoCuotaSocio(toDdmmyyyy(vencimiento)),
    clases_semanales: clasesSemanales,
    clases_restantes: clasesRestantes,
    asistencias_semana: existingSocio ? (existingSocio.asistencias_semana || 0) : 0,
    asistencias_totales: existingSocio ? (existingSocio.asistencias_totales || 0) : 0,
    ultima_asistencia: existingSocio ? (existingSocio.ultima_asistencia || null) : null
  };

  if (idVal) {
    payloadSocio.id = Number(idVal);
  }

  try {
    const res = await fetch("/api/admin/socios", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": APP_STATE.adminToken
      },
      body: JSON.stringify(payloadSocio)
    });

    if (!res.ok) throw new Error("Error en el servidor al guardar el socio");

    closeSocioModal();
    Toast.success(
      idVal ? `Datos de ${nombre} actualizados` : `Socio ${nombre} inscripto con éxito`,
      "Los cambios se registraron correctamente en el sistema."
    );
    adminRefreshAll();
  } catch (err) {
    showSocioFormError(`Error al guardar: ${err.message}`);
  }
}

// ===================================================================
// MODAL: MOSTRAR TODA LA INFORMACIÓN DEL SOCIO
// ===================================================================
function openSocioInfoModal(socioId) {
  document.querySelectorAll(".action-dropdown-menu.show").forEach(m => m.classList.remove("show"));
  const socio = APP_STATE.sociosData.find(s => s.id === socioId);
  if (!socio) return;

  const modal = document.getElementById("socio-info-modal");
  const nombreEl = document.getElementById("info-modal-nombre");
  const dniEl = document.getElementById("info-modal-dni");
  const bodyEl = document.getElementById("info-modal-body");
  const actionBtn = document.getElementById("info-modal-action-btn");

  if (!modal || !bodyEl) return;

  if (nombreEl) nombreEl.textContent = socio.nombre;
  if (dniEl) dniEl.textContent = `DNI: ${socio.dni} &bull; ID de Socio: #${socio.id}`;

  let chipClass = "success";
  if (socio.estado === "Vencido") chipClass = "danger";
  else if (socio.estado === "Por vencer") chipClass = "warning";

  const isLimited = typeof socio.clases_restantes === "number";
  const remainingClasses = isLimited ? `${socio.clases_restantes} disponibles` : "Ilimitadas";

  bodyEl.innerHTML = `
    <div class="socio-detail-item">
      <div class="socio-detail-label">Estado de Suscripción</div>
      <div class="socio-detail-val">
        <span class="status-chip ${chipClass}">${escapeHtml(socio.estado)}</span>
      </div>
    </div>

    <div class="socio-detail-item">
      <div class="socio-detail-label">Plan Contratado</div>
      <div class="socio-detail-val">${escapeHtml(socio.plan)}</div>
    </div>

    <div class="socio-detail-item">
      <div class="socio-detail-label">Importe Cuota Mensual</div>
      <div class="socio-detail-val" style="color: var(--accent-green);">$${(socio.cuota || 0).toLocaleString("es-AR")}</div>
    </div>

    <div class="socio-detail-item">
      <div class="socio-detail-label">Fecha de Vencimiento</div>
      <div class="socio-detail-val">${escapeHtml(formatDateDisplay(socio.vencimiento) || '-')}</div>
    </div>

    <div class="socio-detail-item">
      <div class="socio-detail-label">Clases Disponibles</div>
      <div class="socio-detail-val" style="color: ${isLimited && socio.clases_restantes === 0 ? 'var(--status-danger)' : 'var(--text-primary)'};">
        ${remainingClasses}
      </div>
    </div>

    <div class="socio-detail-item">
      <div class="socio-detail-label">Clases por Semana / Modalidad</div>
      <div class="socio-detail-val">${socio.clases_semanales ? `${socio.clases_semanales} clases` : 'Ilimitadas'}</div>
    </div>

    <div class="socio-detail-item">
      <div class="socio-detail-label">Asistencias en la Semana</div>
      <div class="socio-detail-val">${socio.asistencias_semana || 0} ingresos</div>
    </div>

    <div class="socio-detail-item">
      <div class="socio-detail-label">Asistencias Totales Históricas</div>
      <div class="socio-detail-val">${socio.asistencias_totales || 0} asistencias registradas</div>
    </div>

    <div class="socio-detail-item">
      <div class="socio-detail-label">Último Check-in Registrado</div>
      <div class="socio-detail-val" style="font-size: 0.92rem; font-weight: 600;">
        ${socio.ultima_asistencia ? formatDateDisplay(socio.ultima_asistencia, true) : 'Sin ingresos previos registrados'}
      </div>
    </div>

    <div class="socio-detail-item">
      <div class="socio-detail-label">Contacto / WhatsApp Directo</div>
      <div class="socio-detail-val">
        <a href="https://wa.me/${String(socio.telefono || '').replace(/[^0-9]/g, '')}" target="_blank" style="color: var(--accent-green); text-decoration: underline;">
          <i class="fa-brands fa-whatsapp"></i> ${escapeHtml(socio.telefono || '-')}
        </a>
      </div>
    </div>
  `;

  if (actionBtn) {
    actionBtn.onclick = () => {
      closeSocioInfoModal();
      confirmCheckin(socio.id);
    };
  }

  modal.classList.add("active");
}

function closeSocioInfoModal() {
  const modal = document.getElementById("socio-info-modal");
  if (modal) modal.classList.remove("active");
}

// ===================================================================
// MODAL: CONFIRMACIÓN DE BORRADO DE SOCIO (CON ADVERTENCIA)
// ===================================================================
let socioIdToDelete = null;

function openDeleteModal(socioId) {
  document.querySelectorAll(".action-dropdown-menu.show").forEach(m => m.classList.remove("show"));
  const socio = APP_STATE.sociosData.find(s => s.id === socioId);
  if (!socio) return;

  socioIdToDelete = socioId;
  const modal = document.getElementById("socio-delete-modal");
  const nameEl = document.getElementById("delete-socio-name");
  const dniEl = document.getElementById("delete-socio-dni");

  if (nameEl) nameEl.textContent = socio.nombre;
  if (dniEl) dniEl.textContent = socio.dni;

  if (modal) modal.classList.add("active");
}

function closeDeleteModal() {
  socioIdToDelete = null;
  const modal = document.getElementById("socio-delete-modal");
  if (modal) modal.classList.remove("active");
}

async function executeDeleteSocio() {
  if (!socioIdToDelete) return;

  const socio = APP_STATE.sociosData.find(s => s.id === socioIdToDelete);
  const socioNombre = socio ? socio.nombre : "El socio";

  try {
    const res = await fetch(`/api/admin/socios/${socioIdToDelete}`, {
      method: "DELETE",
      headers: {
        "x-admin-key": APP_STATE.adminToken
      }
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Error en el servidor al eliminar");
    }

    closeDeleteModal();
    Toast.success(
      "Socio eliminado definitivamente",
      `${socioNombre} fue dado de baja y removido del padrón de ONE+ Gym.`
    );
    adminRefreshAll();
  } catch (err) {
    Toast.error("Error al borrar socio", `Detalle: ${err.message}. Intentá nuevamente.`);
  }
}

// ===================================================================
// MODAL: INFORMACIÓN DETALLADA DE CUOTAS VENCIDAS (DESDE DASHBOARD)
// ===================================================================
function openVencidosModal() {
  const modal = document.getElementById("modal-cuotas-vencidas");
  const body = document.getElementById("vencidos-modal-body");
  const subtitle = document.getElementById("vencidos-modal-subtitle");
  if (!modal || !body) return;

  actualizarEstadosSociosFront(APP_STATE.sociosData);
  const vencidos = APP_STATE.sociosData.filter(s => {
    return s.estado === "Vencido" || calcularEstadoCuotaSocio(s.vencimiento) === "Vencido";
  });

  if (vencidos.length === 0) {
    if (subtitle) subtitle.textContent = "Excelente: no se registran cuotas vencidas.";
    body.innerHTML = `
      <div style="text-align: center; padding: 2.5rem 1rem;">
        <i class="fa-solid fa-circle-check" style="font-size: 3rem; color: var(--status-success); margin-bottom: 1rem; display: block;"></i>
        <h4 style="margin: 0 0 0.5rem 0; font-size: 1.25rem; font-weight: 800; color: var(--text-primary);">¡Todos los socios están al día!</h4>
        <p style="margin: 0; color: var(--text-muted); font-size: 0.92rem;">Actualmente ningún alumno tiene su fecha de cuota vencida en ONE+ Gym.</p>
      </div>
    `;
  } else {
    if (subtitle) subtitle.textContent = `${vencidos.length} socio(s) con pago de cuota vencido o pendiente.`;
    body.innerHTML = vencidos.map(s => {
      const cleanPhone = String(s.telefono || '').replace(/[^0-9]/g, '');
      const waMsg = encodeURIComponent(`Hola ${s.nombre}! Te escribimos de ONE+ Gym para recordarte que tu cuota de ${s.plan} venció el ${formatDateDisplay(s.vencimiento)}. ¡Te esperamos para renovarla y seguir entrenando!`);
      
      return `
        <div class="vencido-item-card">
          <div class="vencido-item-info">
            <h4 class="vencido-item-name">
              ${escapeHtml(s.nombre)}
              <span class="status-chip danger" style="font-size: 0.74rem; padding: 0.2rem 0.65rem;">Cuota Vencida</span>
            </h4>
            <div class="vencido-item-meta">
              <span><i class="fa-solid fa-id-card"></i> DNI: <strong>${escapeHtml(s.dni)}</strong></span>
              <span>&bull;</span>
              <span>Plan: <strong>${escapeHtml(s.plan)}</strong></span>
              <span>&bull;</span>
              <span style="color: var(--status-danger); font-weight: 700;">
                <i class="fa-solid fa-calendar-xmark"></i> Venció el: ${escapeHtml(formatDateDisplay(s.vencimiento) || '-')}
              </span>
            </div>
            <div style="font-size: 0.92rem; font-weight: 800; color: var(--text-primary); margin-top: 0.25rem;">
              Importe adeudado: <span style="color: var(--accent-green);">$${(s.cuota || 0).toLocaleString("es-AR")}</span>
            </div>
          </div>
          <div class="vencido-item-actions">
            ${cleanPhone ? `
              <a href="https://wa.me/${cleanPhone}?text=${waMsg}" target="_blank" class="btn-whatsapp-cobro" title="Enviar recordatorio por WhatsApp">
                <i class="fa-brands fa-whatsapp"></i> Avisar por WhatsApp
              </a>
            ` : ''}
            <button type="button" class="btn-primary" style="font-size: 0.84rem; padding: 0.55rem 1rem;" onclick="cobrarCuotaDesdeVencidos(${s.id})">
              <i class="fa-solid fa-receipt"></i> Cobrar Cuota
            </button>
          </div>
        </div>
      `;
    }).join("");
  }

  modal.classList.add("active");
}

function closeVencidosModal() {
  const modal = document.getElementById("modal-cuotas-vencidas");
  if (modal) modal.classList.remove("active");
}

function cobrarCuotaDesdeVencidos(socioId) {
  closeVencidosModal();
  openCobroModal(socioId);
}


/**
 * HERRAMIENTA 2: STOCK Y SUPLEMENTOS (Búsqueda, agregar producto y menú 3 puntitos)
 */
let stockIdToDelete = null;

function renderStockTable(filterStatus = null) {
  const tbody = document.getElementById("stock-table-body");
  if (!tbody) return;

  const query = (document.getElementById("search-stock")?.value || "").toLowerCase().trim();
  let list = APP_STATE.stockData;

  if (query) {
    list = list.filter(item => 
      item.producto.toLowerCase().includes(query) ||
      item.categoria.toLowerCase().includes(query)
    );
  }

  if (filterStatus === "bajo") {
    list = list.filter(item => item.stock <= (item.minimo || 5));
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);"><i class="fa-solid fa-boxes-stacked"></i> No se encontraron productos en stock.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(item => {
    const isLow = item.stock <= (item.minimo || 5);
    return `
      <tr>
        <td><strong>${escapeHtml(item.producto)}</strong></td>
        <td><span class="badge" style="background: var(--bg-surface-elevated); padding: 0.25rem 0.6rem; border-radius: 4px; font-weight: 700;">${escapeHtml(item.categoria)}</span></td>
        <td>
          <strong style="color: ${isLow ? 'var(--status-danger)' : 'var(--accent-green)'}; font-size: 1.1rem;">
            ${item.stock} unidades
          </strong>
          ${isLow ? '<span class="status-chip danger" style="margin-left: 6px;">¡Stock Bajo!</span>' : ''}
        </td>
        <td><strong>$${(item.precio || 0).toLocaleString("es-AR")}</strong></td>
        <td>${item.minimo || 5} u.</td>
        <td>
          <button class="btn-table-action" onclick="adjustStockItem(${item.id}, 1)" title="Sumar 1 unidad"><i class="fa-solid fa-plus"></i></button>
          <button class="btn-table-action" onclick="adjustStockItem(${item.id}, -1)" title="Restar 1 unidad"><i class="fa-solid fa-minus"></i></button>
        </td>
        <td>
          <!-- Botón de tres puntitos para Stock -->
          <div class="action-dropdown" id="dropdown-stock-wrap-${item.id}">
            <button type="button" class="dropdown-toggle-dots" onclick="toggleStockDropdown(event, ${item.id})" title="Opciones del producto" aria-label="Opciones del producto">
              <i class="fa-solid fa-ellipsis-vertical"></i>
            </button>
            <div class="action-dropdown-menu" id="dropdown-stock-menu-${item.id}">
              <button type="button" class="action-dropdown-item" onclick="openEditStockModal(${item.id})">
                <i class="fa-solid fa-pen-to-square"></i>
                <span>Editar producto</span>
              </button>
              <button type="button" class="action-dropdown-item" onclick="adjustStockItem(${item.id}, 5)">
                <i class="fa-solid fa-boxes-packing"></i>
                <span>Sumar +5 unidades</span>
              </button>
              <div class="action-dropdown-divider"></div>
              <button type="button" class="action-dropdown-item danger" onclick="openDeleteStockModal(${item.id})">
                <i class="fa-solid fa-trash-can"></i>
                <span>Borrar producto</span>
              </button>
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function filterStockTable() {
  renderStockTable();
}

function filterStockStatus(status) {
  renderStockTable(status);
}

function toggleStockDropdown(event, id) {
  event.stopPropagation();
  const menu = document.getElementById(`dropdown-stock-menu-${id}`);
  const isShown = menu && menu.classList.contains("show");
  document.querySelectorAll(".action-dropdown-menu.show").forEach(m => m.classList.remove("show"));
  if (!isShown && menu) {
    menu.classList.add("show");
  }
}

async function adjustStockItem(id, delta) {
  try {
    const res = await fetch("/api/admin/stock/adjust", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": APP_STATE.adminToken
      },
      body: JSON.stringify({ id, delta })
    });
    if (!res.ok) throw new Error("Error ajustando stock");
    Toast.success("Stock actualizado", "La cantidad del producto fue modificada correctamente.");
    adminRefreshAll();
  } catch (err) {
    Toast.error("Error al ajustar stock", `Detalle: ${err.message}.`);
  }
}

// Modal Agregar / Editar Producto de Stock
function openNewStockModal() {
  const modal = document.getElementById("stock-modal");
  const title = document.getElementById("stock-modal-title");
  const icon = document.getElementById("stock-modal-icon");
  const errorAlert = document.getElementById("stock-form-error");
  const btnSave = document.getElementById("btn-save-stock");

  if (!modal) return;

  document.getElementById("stock-prod-id").value = "";
  document.getElementById("stock-prod-nombre").value = "";
  document.getElementById("stock-prod-categoria").value = "Proteínas";
  document.getElementById("stock-prod-unidades").value = "";
  document.getElementById("stock-prod-precio").value = "";
  document.getElementById("stock-prod-minimo").value = "5";

  if (title) title.textContent = "Agregar Producto";
  if (icon) icon.className = "fa-solid fa-boxes-stacked";
  if (errorAlert) errorAlert.style.display = "none";
  if (btnSave) btnSave.innerHTML = '<i class="fa-solid fa-plus"></i> Agregar';

  modal.classList.add("active");
}

function openEditStockModal(id) {
  document.querySelectorAll(".action-dropdown-menu.show").forEach(m => m.classList.remove("show"));
  const item = APP_STATE.stockData.find(p => p.id === id);
  if (!item) return;

  const modal = document.getElementById("stock-modal");
  const title = document.getElementById("stock-modal-title");
  const icon = document.getElementById("stock-modal-icon");
  const errorAlert = document.getElementById("stock-form-error");
  const btnSave = document.getElementById("btn-save-stock");

  if (!modal) return;

  document.getElementById("stock-prod-id").value = item.id;
  document.getElementById("stock-prod-nombre").value = item.producto || "";
  document.getElementById("stock-prod-categoria").value = item.categoria || "Proteínas";
  document.getElementById("stock-prod-unidades").value = item.stock !== undefined ? item.stock : 10;
  document.getElementById("stock-prod-precio").value = item.precio || "";
  document.getElementById("stock-prod-minimo").value = item.minimo || 5;

  if (title) title.textContent = "Modificar Producto";
  if (icon) icon.className = "fa-solid fa-pen-to-square";
  if (errorAlert) errorAlert.style.display = "none";
  if (btnSave) btnSave.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios';

  modal.classList.add("active");
}

function closeStockModal() {
  const modal = document.getElementById("stock-modal");
  if (modal) modal.classList.remove("active");
}

async function handleSaveStock(event) {
  event.preventDefault();

  const idVal = document.getElementById("stock-prod-id").value;
  const producto = document.getElementById("stock-prod-nombre").value.trim();
  const categoria = document.getElementById("stock-prod-categoria").value;
  const unidadesRaw = document.getElementById("stock-prod-unidades").value.trim();
  const precioRaw = document.getElementById("stock-prod-precio").value.trim();
  const minimoRaw = document.getElementById("stock-prod-minimo").value.trim();

  const errorAlert = document.getElementById("stock-form-error");
  const errorText = document.getElementById("stock-form-error-text");

  const showError = (msg) => {
    if (errorAlert && errorText) {
      errorText.textContent = msg;
      errorAlert.style.display = "flex";
    }
    Toast.error("Datos requeridos", msg);
  };

  if (!producto) {
    showError("El nombre del producto no puede estar vacío.");
    return;
  }

  if (!unidadesRaw || isNaN(Number(unidadesRaw)) || Number(unidadesRaw) < 0) {
    showError("Las unidades en stock deben ser un número mayor o igual a 0.");
    return;
  }

  if (!precioRaw || isNaN(Number(precioRaw)) || Number(precioRaw) <= 0) {
    showError("El precio de venta debe ser un número válido mayor a 0.");
    return;
  }

  const payload = {
    producto,
    categoria,
    stock: Number(unidadesRaw),
    precio: Number(precioRaw),
    minimo: Number(minimoRaw) || 5
  };

  if (idVal) payload.id = Number(idVal);

  try {
    const res = await fetch("/api/admin/stock", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": APP_STATE.adminToken
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error("Error en el servidor al guardar el producto");

    closeStockModal();
    Toast.success(
      idVal ? "Producto actualizado" : "Producto agregado a la tienda",
      `${producto} fue registrado correctamente en el inventario.`
    );
    adminRefreshAll();
  } catch (err) {
    showError(`Error al guardar: ${err.message}`);
  }
}

// Modal Borrar Producto
function openDeleteStockModal(id) {
  document.querySelectorAll(".action-dropdown-menu.show").forEach(m => m.classList.remove("show"));
  const item = APP_STATE.stockData.find(p => p.id === id);
  if (!item) return;

  stockIdToDelete = id;
  const modal = document.getElementById("stock-delete-modal");
  const nameEl = document.getElementById("delete-stock-name");

  if (nameEl) nameEl.textContent = item.producto;
  if (modal) modal.classList.add("active");
}

function closeDeleteStockModal() {
  stockIdToDelete = null;
  const modal = document.getElementById("stock-delete-modal");
  if (modal) modal.classList.remove("active");
}

async function executeDeleteStock() {
  if (!stockIdToDelete) return;
  const item = APP_STATE.stockData.find(p => p.id === stockIdToDelete);
  const nombre = item ? item.producto : "El producto";

  try {
    const res = await fetch(`/api/admin/stock/${stockIdToDelete}`, {
      method: "DELETE",
      headers: { "x-admin-key": APP_STATE.adminToken }
    });
    if (!res.ok) throw new Error("Error al eliminar producto");

    closeDeleteStockModal();
    Toast.success("Producto eliminado", `${nombre} fue quitado del catálogo.`);
    adminRefreshAll();
  } catch (err) {
    Toast.error("Error al borrar", err.message);
  }
}


/**
 * HERRAMIENTA 3: ESTADO DE MÁQUINAS (Búsqueda, agregar máquina y menú 3 puntitos)
 */
let maquinaIdToDelete = null;

function renderMaquinasTable(filterEstado = null) {
  const tbody = document.getElementById("maquinas-table-body");
  if (!tbody) return;

  const query = (document.getElementById("search-maquinas")?.value || "").toLowerCase().trim();
  let list = APP_STATE.maquinasData;

  if (filterEstado && filterEstado !== "todos") {
    list = list.filter(m => m.estado.toLowerCase() === filterEstado.toLowerCase());
  }

  if (query) {
    list = list.filter(m => 
      m.nombre.toLowerCase().includes(query) ||
      m.zona.toLowerCase().includes(query) ||
      (m.revision && m.revision.includes(query))
    );
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);"><i class="fa-solid fa-wrench"></i> No se encontraron máquinas.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(m => {
    let chip = "success";
    if (m.estado === "En mantenimiento") chip = "warning";
    else if (m.estado === "Fuera de servicio") chip = "danger";

    return `
      <tr>
        <td><strong>${escapeHtml(m.nombre)}</strong></td>
        <td>${escapeHtml(m.zona)}</td>
        <td>${escapeHtml(formatDateDisplay(m.revision) || "-")}</td>
        <td><span class="status-chip ${chip}">${escapeHtml(m.estado)}</span></td>
        <td>
          <select onchange="updateMachineStatus(${m.id}, this.value)" style="padding: 0.35rem 0.6rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-surface); color: var(--text-primary); font-weight: 700;">
            <option value="Operativa" ${m.estado === 'Operativa' ? 'selected' : ''}>Operativa</option>
            <option value="En mantenimiento" ${m.estado === 'En mantenimiento' ? 'selected' : ''}>En mantenimiento</option>
            <option value="Fuera de servicio" ${m.estado === 'Fuera de servicio' ? 'selected' : ''}>Fuera de servicio</option>
          </select>
        </td>
        <td>
          <!-- Botón de tres puntitos para Máquinas -->
          <div class="action-dropdown" id="dropdown-maq-wrap-${m.id}">
            <button type="button" class="dropdown-toggle-dots" onclick="toggleMaquinaDropdown(event, ${m.id})" title="Opciones de la máquina" aria-label="Opciones de la máquina">
              <i class="fa-solid fa-ellipsis-vertical"></i>
            </button>
            <div class="action-dropdown-menu" id="dropdown-maq-menu-${m.id}">
              <button type="button" class="action-dropdown-item" onclick="openEditMaquinaModal(${m.id})">
                <i class="fa-solid fa-pen-to-square"></i>
                <span>Editar máquina</span>
              </button>
              <div class="action-dropdown-divider"></div>
              <button type="button" class="action-dropdown-item danger" onclick="openDeleteMaquinaModal(${m.id})">
                <i class="fa-solid fa-trash-can"></i>
                <span>Borrar máquina</span>
              </button>
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function filterMaquinasTable() {
  renderMaquinasTable();
}

function filterMaquinasEstado(estado) {
  renderMaquinasTable(estado);
}

function toggleMaquinaDropdown(event, id) {
  event.stopPropagation();
  const menu = document.getElementById(`dropdown-maq-menu-${id}`);
  const isShown = menu && menu.classList.contains("show");
  document.querySelectorAll(".action-dropdown-menu.show").forEach(m => m.classList.remove("show"));
  if (!isShown && menu) {
    menu.classList.add("show");
  }
}

async function updateMachineStatus(id, nuevoEstado) {
  try {
    const res = await fetch("/api/admin/maquinas/status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": APP_STATE.adminToken
      },
      body: JSON.stringify({ id, estado: nuevoEstado })
    });
    if (!res.ok) throw new Error("Error actualizando máquina");
    Toast.success(`Máquina actualizada a: ${nuevoEstado}`, "El estado técnico quedó registrado en el sistema.");
    adminRefreshAll();
  } catch (err) {
    Toast.error("Error al actualizar máquina", `Detalle: ${err.message}.`);
  }
}

// Modal Agregar / Editar Máquina
function openNewMaquinaModal() {
  const modal = document.getElementById("maquina-modal");
  const title = document.getElementById("maquina-modal-title");
  const icon = document.getElementById("maquina-modal-icon");
  const errorAlert = document.getElementById("maquina-form-error");
  const btnSave = document.getElementById("btn-save-maquina");

  if (!modal) return;

  document.getElementById("maquina-id").value = "";
  document.getElementById("maquina-nombre").value = "";
  document.getElementById("maquina-zona").value = "Cardio";
  document.getElementById("maquina-estado").value = "Operativa";
  document.getElementById("maquina-revision").value = new Date().toISOString().split("T")[0];

  if (title) title.textContent = "Agregar Máquina";
  if (icon) icon.className = "fa-solid fa-dumbbell";
  if (errorAlert) errorAlert.style.display = "none";
  if (btnSave) btnSave.innerHTML = '<i class="fa-solid fa-plus"></i> Agregar';

  modal.classList.add("active");
}

function openEditMaquinaModal(id) {
  document.querySelectorAll(".action-dropdown-menu.show").forEach(m => m.classList.remove("show"));
  const m = APP_STATE.maquinasData.find(item => item.id === id);
  if (!m) return;

  const modal = document.getElementById("maquina-modal");
  const title = document.getElementById("maquina-modal-title");
  const icon = document.getElementById("maquina-modal-icon");
  const errorAlert = document.getElementById("maquina-form-error");
  const btnSave = document.getElementById("btn-save-maquina");

  if (!modal) return;

  document.getElementById("maquina-id").value = m.id;
  document.getElementById("maquina-nombre").value = m.nombre || "";
  document.getElementById("maquina-zona").value = m.zona || "Cardio";
  document.getElementById("maquina-estado").value = m.estado || "Operativa";
  document.getElementById("maquina-revision").value = toIsoDate(m.revision) || new Date().toISOString().split("T")[0];

  if (title) title.textContent = "Modificar Máquina";
  if (icon) icon.className = "fa-solid fa-pen-to-square";
  if (errorAlert) errorAlert.style.display = "none";
  if (btnSave) btnSave.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios';

  modal.classList.add("active");
}

function closeMaquinaModal() {
  const modal = document.getElementById("maquina-modal");
  if (modal) modal.classList.remove("active");
}

async function handleSaveMaquina(event) {
  event.preventDefault();

  const idVal = document.getElementById("maquina-id").value;
  const nombre = document.getElementById("maquina-nombre").value.trim();
  const zona = document.getElementById("maquina-zona").value;
  const estado = document.getElementById("maquina-estado").value;
  const revision = document.getElementById("maquina-revision").value.trim();

  const errorAlert = document.getElementById("maquina-form-error");
  const errorText = document.getElementById("maquina-form-error-text");

  const showError = (msg) => {
    if (errorAlert && errorText) {
      errorText.textContent = msg;
      errorAlert.style.display = "flex";
    }
    Toast.error("Datos requeridos", msg);
  };

  if (!nombre) {
    showError("El nombre de la máquina no puede estar vacío.");
    return;
  }

  if (!revision) {
    showError("La fecha de última revisión es obligatoria.");
    return;
  }

  const payload = {
    nombre,
    zona,
    estado,
    revision: toDdmmyyyy(revision)
  };

  if (idVal) payload.id = Number(idVal);

  try {
    const res = await fetch("/api/admin/maquinas", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": APP_STATE.adminToken
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error("Error en el servidor al guardar la máquina");

    closeMaquinaModal();
    Toast.success(
      idVal ? "Máquina actualizada" : "Máquina registrada con éxito",
      `${nombre} fue registrada en la zona ${zona}.`
    );
    adminRefreshAll();
  } catch (err) {
    showError(`Error al guardar: ${err.message}`);
  }
}

// Modal Borrar Máquina
function openDeleteMaquinaModal(id) {
  document.querySelectorAll(".action-dropdown-menu.show").forEach(m => m.classList.remove("show"));
  const m = APP_STATE.maquinasData.find(item => item.id === id);
  if (!m) return;

  maquinaIdToDelete = id;
  const modal = document.getElementById("maquina-delete-modal");
  const nameEl = document.getElementById("delete-maquina-name");

  if (nameEl) nameEl.textContent = m.nombre;
  if (modal) modal.classList.add("active");
}

function closeDeleteMaquinaModal() {
  maquinaIdToDelete = null;
  const modal = document.getElementById("maquina-delete-modal");
  if (modal) modal.classList.remove("active");
}

async function executeDeleteMaquina() {
  if (!maquinaIdToDelete) return;
  const m = APP_STATE.maquinasData.find(item => item.id === maquinaIdToDelete);
  const nombre = m ? m.nombre : "La máquina";

  try {
    const res = await fetch(`/api/admin/maquinas/${maquinaIdToDelete}`, {
      method: "DELETE",
      headers: { "x-admin-key": APP_STATE.adminToken }
    });
    if (!res.ok) throw new Error("Error al eliminar la máquina");

    closeDeleteMaquinaModal();
    Toast.success("Máquina eliminada", `${nombre} fue quitada del registro técnico.`);
    adminRefreshAll();
  } catch (err) {
    Toast.error("Error al borrar", err.message);
  }
}


/**
 * HERRAMIENTA 4: INGRESOS Y EGRESOS (Búsqueda por texto, fecha exacta y tipo)
 */
function renderFinanzas() {
  const fin = APP_STATE.finanzasData || {};
  const ingresos = fin.ingresos_mes || 0;
  const egresos = fin.egresos_mes || 0;
  const balance = ingresos - egresos;

  const inEl = document.getElementById("fin-ingresos");
  const egEl = document.getElementById("fin-egresos");
  const balEl = document.getElementById("fin-balance");

  if (inEl) inEl.textContent = `$${ingresos.toLocaleString("es-AR")}`;
  if (egEl) egEl.textContent = `$${egresos.toLocaleString("es-AR")}`;
  if (balEl) {
    balEl.textContent = `$${balance.toLocaleString("es-AR")}`;
    balEl.style.color = balance >= 0 ? "var(--status-success)" : "var(--status-danger)";
  }

  filterFinanzasTable();
}

function filterFinanzasTable() {
  const tbody = document.getElementById("finanzas-table-body");
  if (!tbody) return;

  const fin = APP_STATE.finanzasData || {};
  let movs = fin.movimientos || [];

  const query = (document.getElementById("search-finanzas")?.value || "").toLowerCase().trim();
  const dateFilter = document.getElementById("filter-finanzas-date")?.value || "";
  const tipoFilter = document.getElementById("filter-finanzas-tipo")?.value || "todos";

  // Filtro por tipo
  if (tipoFilter !== "todos") {
    movs = movs.filter(m => m.tipo.toLowerCase() === tipoFilter.toLowerCase());
  }

  // Filtro por fecha
  if (dateFilter) {
    const formattedDate = toDdmmyyyy(dateFilter);
    movs = movs.filter(m => m.fecha && (m.fecha.includes(dateFilter) || m.fecha.includes(formattedDate)));
  }

  // Filtro por texto
  if (query) {
    movs = movs.filter(m => 
      m.concepto.toLowerCase().includes(query) ||
      String(m.monto).includes(query)
    );
  }

  if (movs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted);"><i class="fa-solid fa-receipt"></i> No se encontraron movimientos financieros para esa búsqueda o fecha.</td></tr>`;
    return;
  }

  tbody.innerHTML = movs.map(m => `
    <tr>
      <td>${escapeHtml(formatDateDisplay(m.fecha))}</td>
      <td>
        <span class="status-chip ${m.tipo === 'Ingreso' ? 'success' : 'danger'}">
          ${m.tipo === 'Ingreso' ? '<i class="fa-solid fa-arrow-down-left"></i>' : '<i class="fa-solid fa-arrow-up-right"></i>'} ${escapeHtml(m.tipo)}
        </span>
      </td>
      <td><strong>${escapeHtml(m.concepto)}</strong></td>
      <td><strong>$${(m.monto || 0).toLocaleString("es-AR")}</strong></td>
    </tr>
  `).join("");
}

function openNewFinanzaModal() {
  const tipo = prompt("Tipo de movimiento (Ingreso o Egreso):", "Egreso");
  if (!tipo) return;
  const concepto = prompt("Concepto / Detalle (ej: Reparación de polea, compra de yogur):");
  if (!concepto) return;
  const monto = parseFloat(prompt("Monto en pesos $:", "45000"));
  if (isNaN(monto) || monto <= 0) return;

  fetch("/api/admin/finanzas/movimiento", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": APP_STATE.adminToken
    },
    body: JSON.stringify({ tipo, concepto, monto })
  }).then(r => r.json()).then(() => {
    Toast.success("Movimiento financiero registrado", "El balance mensual de ingresos/egresos fue recalculado.");
    adminRefreshAll();
  }).catch(err => {
    Toast.error("Error al registrar movimiento", `Detalle: ${err.message}.`);
  });
}


/**
 * HERRAMIENTA 5: LIBRO DE VISITAS ADMIN (Búsqueda por autor, texto o fecha - SIN ID EXPUESTO)
 */
function renderAdminMensajesTable(mensajes = null) {
  const tbody = document.getElementById("admin-mensajes-table-body");
  if (!tbody) return;

  let list = mensajes || APP_STATE.mensajesData;
  const query = (document.getElementById("search-mensajes-admin")?.value || "").toLowerCase().trim();

  if (query) {
    list = list.filter(m => 
      m.nombre.toLowerCase().includes(query) ||
      m.texto.toLowerCase().includes(query) ||
      (m.fecha && m.fecha.includes(query))
    );
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted);"><i class="fa-solid fa-comment-slash"></i> No se encontraron mensajes.</td></tr>`;
    return;
  }

  // ID removido por completo de la tabla del libro de visitas
  tbody.innerHTML = list.map(msg => `
    <tr>
      <td>${escapeHtml(formatDateDisplay(msg.fecha, true) || "")}</td>
      <td><strong>${escapeHtml(msg.nombre)}</strong></td>
      <td>${escapeHtml(msg.texto)}</td>
      <td>
        <button class="btn-delete-msg" style="position: static;" onclick="deleteMessage('${msg.id}')" title="Eliminar mensaje">
          <i class="fa-solid fa-trash-can"></i> Borrar
        </button>
      </td>
    </tr>
  `).join("");
}

function filterAdminMensajesTable() {
  renderAdminMensajesTable();
}


// ===================================================================
// 12. COMPONENTE REUTILIZABLE: SISTEMA DE TOASTS
// Aviso chico abajo a la derecha, desaparece a los 3 segundos.
// Verde para éxito, rojo para error con "Qué pasó" y "Qué hacer".
// ===================================================================
const Toast = {
  container: null,

  init() {
    this.container = document.getElementById("toast-container");
    if (!this.container) {
      this.container = document.createElement("div");
      this.container.id = "toast-container";
      this.container.className = "toast-container";
      document.body.appendChild(this.container);
    }
  },

  /**
   * @param {Object} options
   * @param {'success'|'error'|'warning'|'info'} options.type
   * @param {string} options.quePaso
   * @param {string} options.queHacer
   * @param {number} [options.duration=3000]
   */
  show({ type = "success", quePaso = "", queHacer = "", duration = 3000 }) {
    this.init();

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    let icon = "fa-circle-check";
    if (type === "error") icon = "fa-circle-xmark";
    else if (type === "warning") icon = "fa-triangle-exclamation";
    else if (type === "info") icon = "fa-circle-info";

    toast.innerHTML = `
      <div class="toast-main">
        <div class="toast-icon">
          <i class="fa-solid ${icon}"></i>
        </div>
        <div class="toast-content">
          <div class="toast-title">${escapeHtml(quePaso)}</div>
          ${queHacer ? `<div class="toast-subtitle"><i class="fa-solid fa-arrow-right-long toast-arrow"></i> ${escapeHtml(queHacer)}</div>` : ""}
        </div>
        <button type="button" class="toast-close" aria-label="Cerrar">&times;</button>
      </div>
      <div class="toast-progress-track">
        <div class="toast-progress-fill" style="animation-duration: ${duration}ms;"></div>
      </div>
    `;

    const closeToast = () => {
      if (toast.classList.contains("toast-closing")) return;
      toast.classList.add("toast-closing");
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 250);
    };

    const timer = setTimeout(closeToast, duration);

    const closeBtn = toast.querySelector(".toast-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        clearTimeout(timer);
        closeToast();
      });
    }

    this.container.appendChild(toast);
    return toast;
  },

  success(quePaso, queHacer = "Podés continuar con normalidad.") {
    return this.show({ type: "success", quePaso, queHacer, duration: 3000 });
  },

  error(quePaso, queHacer = "Por favor verificá los datos e intentalo nuevamente.") {
    return this.show({ type: "error", quePaso, queHacer, duration: 3000 });
  },

  warning(quePaso, queHacer = "Revisá los campos solicitados.") {
    return this.show({ type: "warning", quePaso, queHacer, duration: 3000 });
  },

  info(quePaso, queHacer = "") {
    return this.show({ type: "info", quePaso, queHacer, duration: 3000 });
  }
};

window.Toast = Toast;

// Intercepta alert() del navegador para que utilice el componente reutilizable Toast
window.alert = function (msg) {
  Toast.warning("Aviso del sistema", String(msg || "Revisá los datos ingresados."));
};

// Wrapper para compatibilidad hacia atrás
function showToast(message, type = "success") {
  if (type === "error") {
    Toast.error(message, "Revisá los datos e intentalo nuevamente.");
  } else if (type === "warning") {
    Toast.warning(message, "Completá los campos requeridos para continuar.");
  } else if (type === "info") {
    Toast.info(message, "");
  } else {
    Toast.success(message, "La acción se procesó correctamente.");
  }
}

function escapeHtml(string) {
  if (!string) return "";
  const str = String(string);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
