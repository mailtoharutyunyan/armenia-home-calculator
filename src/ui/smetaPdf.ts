// Open a clean, print-ready one-page estimate in a new window (Save as PDF).
export interface SmetaData {
  lang: string
  house: string // "13×14 м · 2 этажа · каркас + газоблок"
  area: string // "252 м²"
  shell: string // коробка
  turnkey: string // под ключ
  perM2: string
  perM2Act: string
  sections: { label: string; value: string }[]
  material: string
  labor: string
  date: string
  disclaimer: string
}

export function openSmetaPdf(d: SmetaData) {
  const w = window.open('', '_blank', 'width=800,height=1000')
  if (!w) return
  const L = (ru: string, hy: string, en: string) => (d.lang === 'hy' ? hy : d.lang === 'en' ? en : ru)
  const rows = d.sections.map((s) => `<tr><td>${esc(s.label)}</td><td class="n">${esc(s.value)}</td></tr>`).join('')
  const html = `<!doctype html><html lang="${d.lang}"><head><meta charset="utf-8">
<title>${L('Смета · Тун РА', 'Նախահաշիվ · Տուն ՀՀ', 'Estimate · Tun RA')}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1a1a1a; margin: 0; padding: 32px 36px; }
  h1 { font-family: Georgia, serif; font-size: 22px; margin: 0 0 2px; }
  .sub { color: #666; font-size: 12px; margin-bottom: 18px; }
  .tiles { display: flex; gap: 14px; margin: 14px 0 20px; }
  .tile { flex: 1; border: 1px solid #ddd; border-left: 3px solid #9c5b43; border-radius: 8px; padding: 10px 12px; }
  .tile .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: #888; }
  .tile .val { font-size: 18px; font-weight: 700; margin-top: 2px; }
  .tile .m2 { font-size: 11px; color: #9c5b43; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  td { padding: 6px 4px; border-bottom: 1px solid #eee; }
  td.n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .tot td { border-top: 2px solid #1a1a1a; border-bottom: none; font-weight: 700; padding-top: 8px; }
  .foot { margin-top: 22px; font-size: 10px; color: #888; line-height: 1.5; }
  @media print { body { padding: 0; } @page { margin: 16mm; } }
</style></head>
<body>
  <h1>${L('Смета строительства', 'Շինարարության նախահաշիվ', 'Construction estimate')}</h1>
  <div class="sub">${esc(d.house)} · ${esc(d.area)} · ${L('прайс от', 'գին՝', 'prices')} ${esc(d.date)}</div>
  <div class="tiles">
    <div class="tile"><div class="lbl">${L('Акт / коробка', 'Ակտ / կմախք', 'Shell')}</div><div class="val">${esc(d.shell)}</div><div class="m2">${esc(d.perM2Act)} / м²</div></div>
    <div class="tile" style="border-left-color:#c9a24b"><div class="lbl">${L('Под ключ', 'Բանալի հանձնում', 'Turnkey')}</div><div class="val">${esc(d.turnkey)}</div><div class="m2">${esc(d.perM2)} / м²</div></div>
  </div>
  <table>
    <tbody>${rows}
      <tr class="tot"><td>${L('Материалы', 'Նյութեր', 'Materials')}</td><td class="n">${esc(d.material)}</td></tr>
      <tr><td>${L('Работа', 'Աշխատանք', 'Labour')}</td><td class="n">${esc(d.labor)}</td></tr>
      <tr class="tot"><td>${L('ИТОГО под ключ', 'ԸՆԴԱՄԵՆԸ', 'TOTAL turnkey')}</td><td class="n">${esc(d.turnkey)}</td></tr>
    </tbody>
  </table>
  <div class="foot">${esc(d.disclaimer)}</div>
  <script>window.onload=function(){setTimeout(function(){window.print()},150)}</script>
</body></html>`
  w.document.open()
  w.document.write(html)
  w.document.close()
}

function esc(s: string) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
}
