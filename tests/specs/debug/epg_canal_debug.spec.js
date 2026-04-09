'use strict'

/**
 * Debug: descubrir TODOS los canales del carousel EPG
 * swipeando horizontalmente y acumulando content-desc únicos.
 */

const { execSync } = require('child_process')

function getDevice() {
  return process.env.DEVICE_NAME || '192.168.1.175:5555'
}

function adb(cmd) {
  try { execSync(`adb -s ${getDevice()} ${cmd}`, { timeout: 5000 }) } catch (_) {}
}

function scrollDown() {
  adb('shell input swipe 540 1700 540 900 300')
}

function scrollToTop() {
  for (let i = 0; i < 6; i++) adb('shell input swipe 540 300 540 1900 100')
}

// Swipe horizontal en el EPG (izquierda → derecha del carousel)
function swipeEpgLeft(y) {
  // Swipe de derecha a izquierda → avanza al siguiente canal
  adb(`shell input swipe 900 ${y} 100 ${y} 400`)
}

function swipeEpgRight(y) {
  // Swipe de izquierda a derecha → vuelve al canal anterior
  adb(`shell input swipe 100 ${y} 900 ${y} 400`)
}

// Extrae todos los content-desc de cards live y programadas del page source
function extractCards(src) {
  const cards = []
  // Live: "EN VIVO, HH:MM - HH:MM (DUR), Título"
  for (const m of src.matchAll(/content-desc="(EN VIVO,[^"]+)"/g)) {
    cards.push({ tipo: 'EN VIVO', desc: m[1] })
  }
  // Programadas: "DD DE MMM (HH:MM - HH:MM), Título" o "MÁS TARDE, ..."
  for (const m of src.matchAll(/content-desc="(\d{2} DE [A-Z]{3}[^"]+)"/g)) {
    cards.push({ tipo: 'PROGRAMADO', desc: m[1] })
  }
  for (const m of src.matchAll(/content-desc="(MÁS TARDE,[^"]+)"/g)) {
    cards.push({ tipo: 'MÁS TARDE', desc: m[1] })
  }
  return cards
}

describe('DEBUG — Todos los canales EPG', () => {

  it('deberia descubrir todos los canales del carousel swipeando', async () => {
    // Navegar al home y encontrar Programación
    adb('shell input tap 135 2222')
    await browser.pause(1500)
    scrollToTop()
    await browser.pause(400)

    let src = ''
    for (let i = 0; i < 10; i++) {
      src = await browser.getPageSource()
      if (src.includes('text="Programación"') || src.includes('"Programación"')) break
      scrollDown()
      await browser.pause(100)
    }

    // Detectar Y del carousel EPG (usamos el Y del primer badge EN VIVO)
    const enVivoIdx = src.indexOf('text="EN VIVO"')
    let epgY = 1300  // fallback
    if (enVivoIdx !== -1) {
      const tagStart = src.lastIndexOf('<', enVivoIdx)
      const tagEnd   = src.indexOf('>', enVivoIdx)
      const tag = src.slice(tagStart, tagEnd + 1)
      const b = tag.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)
      if (b) epgY = Math.round((+b[2] + +b[4]) / 2)
    }
    console.log(`\n  EPG carousel Y detectado: ${epgY}`)

    // Acumular todos los cards únicos swipeando hasta 15 veces
    const seen    = new Set()
    const allCards = []

    for (let swipe = 0; swipe <= 15; swipe++) {
      if (swipe > 0) {
        swipeEpgLeft(epgY)
        await browser.pause(600)
      }

      src = await browser.getPageSource()
      const cards = extractCards(src)
      let newFound = 0

      for (const card of cards) {
        if (!seen.has(card.desc)) {
          seen.add(card.desc)
          allCards.push({ ...card, swipe })
          newFound++
        }
      }

      // Si no hay nada nuevo en 3 swipes consecutivos, llegamos al final
      if (swipe > 0 && newFound === 0) {
        // Verificar si realmente es el final revisando el source
        const prevSize = seen.size
        swipeEpgLeft(epgY)
        await browser.pause(600)
        src = await browser.getPageSource()
        const moreCards = extractCards(src)
        const anyNew = moreCards.some(c => !seen.has(c.desc))
        if (!anyNew) {
          console.log(`  [discover] Fin del carousel en swipe ${swipe}`)
          break
        }
        for (const c of moreCards) {
          if (!seen.has(c.desc)) { seen.add(c.desc); allCards.push({ ...c, swipe }) }
        }
      }
    }

    // ── Reporte final ────────────────────────────────────────────────────────
    const lives      = allCards.filter(c => c.tipo === 'EN VIVO')
    const programado = allCards.filter(c => c.tipo !== 'EN VIVO')

    console.log(`\n  ══ CANALES EN VIVO (${lives.length}) ══`)
    lives.forEach((c, i) => console.log(`  [${String(i + 1).padStart(2)}] ${c.desc}`))

    if (programado.length) {
      console.log(`\n  ══ PROGRAMADOS / MÁS TARDE (${programado.length}) ══`)
      programado.forEach((c, i) => console.log(`  [${String(i + 1).padStart(2)}] ${c.desc}`))
    }

    console.log(`\n  Total cards descubiertos: ${allCards.length}`)

    expect(allCards.length).toBeGreaterThan(0)
  })

})
