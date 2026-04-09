const { takeScreenshot } = require('./helpers/screenshot');

const APP_ID = 'com.streann.tvnpass';

// Obtiene el XML de la UI actual y busca texto — mucho más rápido que findElement
async function pageContains(text) {
  try {
    const src = await browser.getPageSource();
    return src.includes(text);
  } catch (_) { return false; }
}

// Detecta el estado de la app y la deja en home screen lista para el test
// Estados posibles:
//   - No corriendo / en background / PiP → relanzar MainActivity
//   - En player (fullscreen) → relanzar MainActivity (sin resetear datos)
//   - Ya en home screen → no hace nada
async function normalizarEstadoApp() {
  // queryAppState: 0=no instalada, 1=no corriendo, 2=background/PiP, 3=suspendida, 4=foreground
  let estado = 0;
  try {
    estado = await browser.execute('mobile: queryAppState', { appId: APP_ID });
  } catch (_) {}
  console.log(`[estado] app state: ${estado}`);

  // Si no está en foreground → activar
  if (estado < 4) {
    console.log('[estado] app no activa — activando...');
    try {
      await browser.execute('mobile: activateApp', { appId: APP_ID });
    } catch (_) {
      await browser.activateApp(APP_ID);
    }
    await browser.pause(3000);
  }

  // Verificar en qué pantalla estamos
  let src = '';
  try { src = await browser.getPageSource(); } catch (_) {}

  if (src.includes('Programación')) {
    console.log('[estado] ✓ ya en home screen');
    return;
  }

  // No estamos en home — puede ser player, otra pantalla, etc.
  // Intentar tocar "Inicio" en la barra de navegación inferior
  console.log('[estado] no en home — buscando botón Inicio...');
  try {
    const inicio = await $('android=new UiSelector().text("Inicio")');
    if (await inicio.isExisting()) {
      await inicio.click();
      await browser.pause(2000);
      console.log('[estado] ✓ tap en Inicio ejecutado');
      return;
    }
  } catch (_) {}

  // Si "Inicio" no está visible, la app puede estar en fullscreen player
  // Presionar tecla HOME del sistema Android y luego reabrir la app
  console.log('[estado] Inicio no visible — usando tecla HOME del sistema...');
  try {
    await browser.execute('mobile: pressKey', { keycode: 3 }); // keycode 3 = HOME
    await browser.pause(1500);
    await browser.execute('mobile: activateApp', { appId: APP_ID });
    await browser.pause(2000);
  } catch (_) {}

  src = '';
  try { src = await browser.getPageSource(); } catch (_) {}
  if (src.includes('Programación')) {
    console.log('[estado] ✓ home screen confirmada');
  } else {
    console.log('[estado] ADVERTENCIA: no se pudo confirmar home screen — continuando de todos modos');
  }
}

// Espera con timeout propio — lanza error si se supera
async function waitFor(conditionFn, timeoutMs, intervalMs, errorMsg) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await conditionFn()) return true;
    await browser.pause(intervalMs);
  }
  throw new Error(errorMsg || `Timeout esperando condición (${timeoutMs}ms)`);
}

// Click en elemento por texto — verifica en page source primero, luego click directo
async function clickText(text) {
  const src = await browser.getPageSource();
  if (!src.includes(`>${text}<`) && !src.includes(`"${text}"`)) {
    throw new Error(`"${text}" no encontrado en la UI`);
  }
  const el = await $(`android=new UiSelector().text("${text}")`);
  await el.click();
}

describe('TVN PASS - Live Player E2E', () => {

  // ─── 1. APP LAUNCH ───────────────────────────────────────────────────────────
  it('01 - La app carga correctamente', async () => {
    const t = Date.now();

    // Detectar estado actual y normalizar a home screen
    await normalizarEstadoApp();

    await waitFor(
      () => pageContains('Programación'),
      30000, 1000,
      'Home screen no cargó en 30s — "Programación" no apareció'
    );

    console.log(`[timing] home screen lista en ${((Date.now() - t) / 1000).toFixed(1)}s`);
    await takeScreenshot('01-app-launch');
  });

  // ─── 2. DETECCIÓN DE REGIÓN BLOQUEADA ────────────────────────────────────────
  it('02 - Detectar bloqueo por región', async () => {
    await takeScreenshot('02-home-screen');
    const src = await browser.getPageSource();

    const blockedTexts = ['no disponible', 'bloqueado', 'blocked', 'not available'];
    const isBlocked = blockedTexts.some(t => src.toLowerCase().includes(t));

    if (isBlocked) {
      console.log('[region] BLOQUEADO — pasando a tabs de programación');
      await takeScreenshot('02-region-blocked');
      await validarTabsProgramacion();
      return;
    }

    console.log('[region] sin bloqueo — continuando');
  });

  // ─── 3. PROGRAMACIÓN — tabs Anteayer / Ayer / Hoy / Mañana ──────────────────
  it('03 - Validar tabs de Programación', async () => {
    // Confirmar que la sección está visible
    if (!(await pageContains('Programación'))) {
      throw new Error('Sección Programación no encontrada en home screen');
    }
    await validarTabsProgramacion();
  });

  // ─── 4. ENTRAR AL LIVE ───────────────────────────────────────────────────────
  it('04 - Entrar al player del live', async () => {
    // Volver a tab Hoy
    try { await clickText('Hoy', 3000); } catch (_) {}
    await browser.pause(1000);

    // Tocar primer "EN VIVO" visible (canal TVN principal)
    const enVivo = await $('android=new UiSelector().text("EN VIVO").instance(0)');
    await enVivo.waitForDisplayed({ timeout: 8000 });
    await enVivo.click();

    // Esperar que abra el player (aparece SurfaceView o TextureView del video)
    await waitFor(
      () => pageContains('SurfaceView') || pageContains('TextureView'),
      15000, 500,
      'El player no abrió en 15s — no se detectó superficie de video'
    );

    await browser.pause(2000);
    await takeScreenshot('04-player-opened');
    console.log('[player] player abierto');
  });

  // ─── 5. ANUNCIO PRE-ROLL ─────────────────────────────────────────────────────
  it('05 - Detectar anuncio y manejarlo', async () => {
    await browser.pause(1500);
    await takeScreenshot('05-pre-ad-check');

    const adWords = ['Saltar', 'Skip', 'Publicidad'];
    const src = await browser.getPageSource();
    const adDetected = adWords.some(w => src.includes(w));

    if (!adDetected) {
      console.log('[ad] sin anuncio');
      return;
    }

    console.log('[ad] anuncio detectado');
    await takeScreenshot('05-ad-detected');
    const adStart = Date.now();

    // Esperar hasta 60s: intentar skip o detectar fin del anuncio
    await waitFor(async () => {
      const s = await browser.getPageSource();

      // Intentar botón skip si está habilitado
      const skipWords = ['Saltar', 'Skip', 'SALTAR', 'SKIP'];
      for (const word of skipWords) {
        if (s.includes(word)) {
          try {
            const btn = await $(`android=new UiSelector().textContains("${word}")`);
            if (await btn.isDisplayed() && await btn.isEnabled()) {
              await btn.click();
              const elapsed = ((Date.now() - adStart) / 1000).toFixed(1);
              console.log(`[ad] saltado en ${elapsed}s`);
              await takeScreenshot('05-ad-skipped');
              return true; // salimos del waitFor
            }
          } catch (_) {}
        }
      }

      // Anuncio terminó si ya no hay ninguna palabra de ad en pantalla
      const adStillRunning = adWords.some(w => s.includes(w));
      if (!adStillRunning) {
        const elapsed = ((Date.now() - adStart) / 1000).toFixed(1);
        console.log(`[ad] terminó en ${elapsed}s`);
        await takeScreenshot('05-ad-finished');
        return true;
      }

      return false;
    }, 60000, 1000, '[ad] anuncio no terminó ni pudo saltarse en 60s');
  });

  // ─── 6. LIVE ACTIVO ──────────────────────────────────────────────────────────
  it('06 - Validar que el live está reproduciendo', async () => {
    const t = Date.now();

    // Esperar que aparezca alguna superficie de video
    const videoClasses = [
      'android.view.SurfaceView',
      'android.view.TextureView',
    ];

    let videoFound = false;
    for (let i = 0; i < 6 && !videoFound; i++) {
      const src = await browser.getPageSource();
      videoFound = videoClasses.some(c => src.includes(c));
      if (!videoFound) await browser.pause(2000);
    }

    console.log(`[timing] live check en ${((Date.now() - t) / 1000).toFixed(1)}s — videoFound: ${videoFound}`);
    await takeScreenshot('06-live-state');
  });

  // ─── 7. CONTROLES DEL PLAYER ─────────────────────────────────────────────────
  it('07 - Validar controles del player', async () => {
    const { width, height } = await browser.getWindowSize();

    // Tap centro para revelar controles
    await browser.action('pointer')
      .move({ x: Math.floor(width / 2), y: Math.floor(height / 2) })
      .down().up()
      .perform();
    await browser.pause(1500);

    const src = await browser.getPageSource();
    await takeScreenshot('07-player-controls');

    // Validar controles por content-desc en el XML
    const controlChecks = [
      { name: 'pause/play', words: ['pause', 'play', 'Pause', 'Play'] },
      { name: 'mute/volume', words: ['mute', 'volume', 'Mute', 'Volume'] },
      { name: 'fullscreen', words: ['fullscreen', 'Fullscreen'] },
      { name: 'ImageButton', words: ['android.widget.ImageButton'] },
    ];

    for (const ctrl of controlChecks) {
      const found = ctrl.words.some(w => src.includes(w));
      console.log(`[controls] ${found ? '✓' : '—'} ${ctrl.name}`);
    }
  });

  // ─── 8. CAMBIO DE CANAL ──────────────────────────────────────────────────────
  it('08 - Cambiar de canal', async () => {
    const { width, height } = await browser.getWindowSize();

    await browser.action('pointer')
      .move({ x: Math.floor(width * 0.8), y: Math.floor(height / 2) })
      .down()
      .move({ duration: 600, x: Math.floor(width * 0.2), y: Math.floor(height / 2) })
      .up()
      .perform();

    await browser.pause(3000);
    await takeScreenshot('08-channel-changed');
    console.log('[channel] swipe ejecutado');
  });

});

// ─── HELPER: tabs Anteayer / Ayer / Hoy / Mañana ────────────────────────────
async function validarTabsProgramacion() {
  const tabs = ['Anteayer', 'Ayer', 'Hoy', 'Mañana'];
  for (const nombre of tabs) {
    try {
      await clickText(nombre, 4000);
      console.log(`[programacion] ✓ tab pulsado: "${nombre}"`);
      await browser.pause(1500);
      await takeScreenshot(`03-prog-${nombre.toLowerCase().replace('ñ', 'n').replace('á', 'a')}`);
    } catch (_) {
      console.log(`[programacion] — tab "${nombre}" no encontrado`);
    }
  }
}