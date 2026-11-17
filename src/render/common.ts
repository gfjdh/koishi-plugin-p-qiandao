import * as fs from 'fs'
import * as path from 'path'
import { pathToFileURL } from 'url'

export const ROSE = '#e86a92'
export const DEEP_ROSE = '#b51f3c'
export const GOLD = '#f0c27b'
export const VIOLET = '#8f6ad6'
export const LAVENDER = '#b9a6d4'
export const MINT = '#8fd6b4'
export const DANGER = '#ff5c6c'
export const INK = '#f4ecff'

export type CardMood = 'default' | 'risk' | 'boom' | 'muted'
export type CharacterMood = 'neutral' | 'happy' | 'worried' | 'shocked' | 'sleepy'

// 打包后 __dirname 是 lib/render/，源码运行时是 src/render/，两种布局都试一下。
const rendererDir = [
  path.resolve(__dirname, '../renderer'),
  path.resolve(__dirname, '../../renderer'),
].find((dir) => fs.existsSync(path.join(dir, 'page.html')))
  || path.resolve(__dirname, '../renderer')

function assetUrl(...parts: string[]): string | null {
  const file = path.join(rendererDir, ...parts)
  return fs.existsSync(file) ? pathToFileURL(file).href : null
}

// 截图前先打开这个本地空白页，页面才有 file:// 源，背景/立绘这些 file:// 子资源才不会被拦。
export const PAGE_URL = pathToFileURL(path.join(rendererDir, 'page.html')).href
const BG_URL = assetUrl('bg', 'chireiden.jpg') || assetUrl('bg', 'chireiden.png')

const CHARACTER_URLS: Record<CharacterMood, string | null> = {
  neutral: assetUrl('character', 'satori-neutral.png'),
  happy: assetUrl('character', 'satori-happy.png'),
  worried: assetUrl('character', 'satori-worried.png'),
  shocked: assetUrl('character', 'satori-shocked.png'),
  sleepy: assetUrl('character', 'satori-sleepy.png'),
}

export function characterUrl(mood: CharacterMood): string | null {
  return CHARACTER_URLS[mood] || CHARACTER_URLS.neutral || null
}

export function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char])
}

export function fmtInt(value: unknown): string {
  return Number(value || 0).toLocaleString('zh-CN')
}

export function fmtSigned(value: number): string {
  return `${value >= 0 ? '+' : ''}${fmtInt(value)}`
}

export function pctOf(balance: number, limit: number): number {
  if (!Number.isFinite(limit) || limit <= 0) return balance > 0 ? 100 : 0
  return Math.max(0, Math.min(100, (balance / limit) * 100))
}

export function gaugeColor(pct: number): string {
  if (pct >= 100) return DANGER
  if (pct >= 70) return GOLD
  return ROSE
}

const EYE_SVG = `
<svg viewBox="0 0 360 360" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="eye-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ff5c7a" stop-opacity=".45"/>
      <stop offset="55%" stop-color="#b51f3c" stop-opacity=".16"/>
      <stop offset="100%" stop-color="#b51f3c" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="eye-cord" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#b51f3c"/>
      <stop offset="100%" stop-color="#f0c27b"/>
    </linearGradient>
    <filter id="eye-blur" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="8"/>
    </filter>
  </defs>
  <circle cx="180" cy="180" r="150" fill="url(#eye-glow)" filter="url(#eye-blur)"/>
  <g stroke="url(#eye-cord)" stroke-width="5" fill="none" opacity=".6" stroke-linecap="round">
    <path d="M74 150 C 30 120, 12 82, 18 40"/>
    <path d="M112 100 C 92 52, 62 24, 26 8"/>
    <path d="M180 82 C 180 38, 160 12, 138 2"/>
    <path d="M248 100 C 268 52, 298 24, 334 8"/>
    <path d="M286 150 C 330 120, 348 82, 342 40"/>
    <path d="M180 278 C 180 322, 200 348, 222 358"/>
  </g>
  <path d="M48 180 Q180 66 312 180 Q180 294 48 180 Z"
        fill="#150b1e" stroke="#f0c27b" stroke-width="3"/>
  <path d="M48 180 Q180 66 312 180 Q180 294 48 180 Z"
        fill="none" stroke="#e86a92" stroke-width="9" opacity=".18" filter="url(#eye-blur)"/>
  <circle cx="180" cy="180" r="64" fill="#3a0c18"/>
  <circle cx="180" cy="180" r="52" fill="#b51f3c"/>
  <circle cx="180" cy="180" r="40" fill="#7d1028"/>
  <path d="M180 214 C 136 184, 142 142, 180 164 C 218 142, 224 184, 180 214 Z" fill="#ff5c7a"/>
  <circle cx="164" cy="162" r="10" fill="#ffe1e8" opacity=".85"/>
  <circle cx="198" cy="194" r="4" fill="#ffd0d8" opacity=".7"/>
</svg>`

function characterHtml(mood: CharacterMood): string {
  const url = characterUrl(mood)
  if (url) return `<img src="${url}" alt="">`
  return `<div class="eye-wrap">${EYE_SVG}</div>`
}

const CRACKS_SVG = `
<svg class="cracks" viewBox="0 0 1000 640" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
  <g fill="none" stroke="#ff8b98" stroke-width="1.5" opacity=".22">
    <path d="M0 138 L 96 172 L 74 214 L 168 246 L 142 292"/>
    <path d="M1000 96 L 902 140 L 930 182 L 836 214"/>
    <path d="M742 0 L 706 78 L 748 104 L 704 168"/>
    <path d="M0 520 L 82 492 L 116 540 L 196 512"/>
    <path d="M1000 560 L 918 532 L 892 580 L 812 556"/>
  </g>
</svg>`

export interface Dialogue {
  speaker?: string
  text: string
}

export interface ShellOptions {
  title: string
  eyebrow?: string
  subtitle?: string
  badge?: string
  badgeTone?: 'default' | 'success' | 'danger' | 'muted' | 'risk'
  mood?: CardMood
  characterMood?: CharacterMood
  body: string
  dialogue?: Dialogue
  footerLeft?: string
  footerRight?: string
  width?: number
  height?: number
}

export function shell(options: ShellOptions): string {
  const width = options.width || 1000
  const height = options.height || 640
  const mood = options.mood || 'default'
  const characterMood = options.characterMood || 'neutral'
  const badgeTone = options.badgeTone || 'default'
  const badge = options.badge
    ? `<span class="badge badge-${badgeTone}">${esc(options.badge)}</span>`
    : ''
  const bgStyle = BG_URL ? ` style="background-image:url('${BG_URL}')"` : ''
  const dialogue = options.dialogue
    ? `<div class="dialogue">
        <span class="speaker">${esc(options.dialogue.speaker || '觉')}</span>
        <span class="line">${esc(options.dialogue.text)}</span>
      </div>`
    : ''
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<style>
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  width: ${width}px;
  min-height: ${height}px;
  background: #0b0711;
  color: ${INK};
  font-family: 'Noto Sans CJK SC', 'Noto Sans SC', 'Microsoft YaHei', 'PingFang SC', sans-serif;
  -webkit-font-smoothing: antialiased;
}
.card {
  position: relative;
  width: ${width}px;
  min-height: ${height}px;
  overflow: hidden;
  background:
    radial-gradient(circle at 76% 38%, rgba(232, 106, 146, .16), transparent 40%),
    radial-gradient(circle at 8% 96%, rgba(240, 194, 123, .10), transparent 42%),
    linear-gradient(155deg, #120b1d 0%, #1b1029 46%, #2a1538 100%);
}
.bg {
  position: absolute;
  inset: 0;
  background-position: center;
  background-size: cover;
  background-repeat: no-repeat;
  filter: saturate(.85) brightness(.72);
  transform: scale(1.02);
}
.overlay {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 74% 40%, rgba(232, 106, 146, .12), transparent 36%),
    radial-gradient(circle at 50% 118%, rgba(240, 194, 123, .10), transparent 48%),
    linear-gradient(90deg, rgba(7, 4, 12, .94) 0%, rgba(7, 4, 12, .72) 40%, rgba(7, 4, 12, .18) 68%, rgba(7, 4, 12, .52) 100%);
}
.card::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  box-shadow: inset 0 0 160px rgba(0, 0, 0, .72);
}
.frame {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: 580px;
  min-height: ${height}px;
  padding: 28px;
}
.panel {
  position: relative;
  z-index: 2;
  padding: 28px 32px 22px;
  background: linear-gradient(160deg, rgba(25, 15, 37, .94), rgba(12, 7, 20, .91));
  border: 1px solid rgba(240, 194, 123, .26);
  border-radius: 20px;
  box-shadow: 0 26px 60px rgba(0, 0, 0, .58), inset 0 0 44px rgba(232, 106, 146, .05);
  backdrop-filter: blur(7px);
  overflow: hidden;
}
.panel::before, .panel::after {
  content: '';
  position: absolute;
  width: 24px;
  height: 24px;
  pointer-events: none;
}
.panel::before {
  left: 10px; top: 10px;
  border-left: 1px solid rgba(240, 194, 123, .55);
  border-top: 1px solid rgba(240, 194, 123, .55);
  border-radius: 7px 0 0 0;
}
.panel::after {
  right: 10px; bottom: 10px;
  border-right: 1px solid rgba(240, 194, 123, .55);
  border-bottom: 1px solid rgba(240, 194, 123, .55);
  border-radius: 0 0 7px 0;
}
.accent {
  position: absolute;
  left: 0; right: 0; top: 0;
  height: 3px;
  background: linear-gradient(90deg, transparent, ${ROSE}, ${GOLD}, transparent);
  opacity: .85;
}
.inner-line {
  position: absolute;
  inset: 8px;
  border: 1px solid rgba(255, 255, 255, .035);
  border-radius: 14px;
  pointer-events: none;
}
.header { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
.eyebrow {
  font-size: 10px;
  letter-spacing: 4px;
  color: ${LAVENDER};
  text-transform: uppercase;
}
.title {
  margin-top: 7px;
  font-family: 'Noto Serif CJK SC', 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'STSong', 'SimSun', serif;
  font-size: 30px;
  font-weight: 700;
  letter-spacing: 3px;
  line-height: 1.2;
  color: #faf3ff;
}
.title small {
  margin-left: 10px;
  font-size: 12px;
  font-weight: 400;
  letter-spacing: 2px;
  color: ${LAVENDER};
}
.subtitle {
  margin-top: 8px;
  font-size: 12px;
  letter-spacing: 1.5px;
  color: #a995c4;
}
.badge {
  flex: none;
  padding: 6px 13px;
  border-radius: 999px;
  border: 1px solid rgba(232, 106, 146, .34);
  background: rgba(232, 106, 146, .10);
  color: #f0b6c8;
  font-size: 12px;
  letter-spacing: 1px;
  white-space: nowrap;
}
.badge-success { border-color: rgba(240, 194, 123, .38); background: rgba(240, 194, 123, .10); color: #f0d29a; }
.badge-danger { border-color: rgba(255, 92, 108, .45); background: rgba(255, 92, 108, .13); color: #ff9aa8; }
.badge-muted { border-color: rgba(185, 166, 212, .22); background: rgba(185, 166, 212, .07); color: #b9a6d4; }
.badge-risk { border-color: rgba(240, 194, 123, .40); background: rgba(240, 194, 123, .10); color: #f0d29a; }
.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 18px 0 16px;
  color: rgba(240, 194, 123, .55);
  font-size: 13px;
}
.divider::before, .divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(240, 194, 123, .32), transparent);
}
.label {
  font-size: 10px;
  letter-spacing: 3px;
  color: #a995c4;
}
.balance {
  margin-top: 7px;
  font-family: 'Noto Serif CJK SC', 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'STSong', 'SimSun', serif;
  font-size: 54px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 1px;
  background: linear-gradient(180deg, #fff3d2 0%, ${GOLD} 48%, #d99a4e 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.balance .unit {
  margin-left: 8px;
  font-size: 18px;
  font-weight: 400;
  letter-spacing: 2px;
  color: ${LAVENDER};
  -webkit-text-fill-color: ${LAVENDER};
}
.event { margin-top: 9px; font-size: 13px; letter-spacing: .5px; color: #f0b6c8; }
.gauge { margin-top: 20px; }
.gauge-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.gauge-pct { font-family: 'Noto Serif SC', 'SimSun', serif; font-size: 15px; color: #e7d8f5; }
.gauge-track {
  height: 9px;
  margin-top: 10px;
  border-radius: 99px;
  background: rgba(255, 255, 255, .07);
  border: 1px solid rgba(255, 255, 255, .05);
  overflow: hidden;
}
.gauge-fill {
  height: 100%;
  border-radius: 99px;
  box-shadow: 0 0 14px rgba(232, 106, 146, .45);
}
.gauge-note { margin-top: 9px; font-size: 12px; line-height: 1.5; color: #a995c4; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.chip {
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid rgba(232, 106, 146, .28);
  background: rgba(232, 106, 146, .09);
  color: #f0b6c8;
  font-size: 11px;
  letter-spacing: .8px;
}
.chip-gold { border-color: rgba(240, 194, 123, .32); background: rgba(240, 194, 123, .09); color: #f0d29a; }
.chip-red { border-color: rgba(255, 92, 108, .35); background: rgba(255, 92, 108, .10); color: #ff9aa8; }
.chip-muted { border-color: rgba(185, 166, 212, .22); background: rgba(185, 166, 212, .07); color: #b9a6d4; }
.notice {
  margin-top: 16px;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid rgba(255, 92, 108, .26);
  background: linear-gradient(135deg, rgba(255, 92, 108, .12), rgba(255, 92, 108, .03));
}
.notice.risk {
  border-color: rgba(240, 194, 123, .28);
  background: linear-gradient(135deg, rgba(240, 194, 123, .10), rgba(240, 194, 123, .03));
}
.notice-title {
  font-family: 'Noto Serif SC', 'SimSun', serif;
  font-size: 18px;
  font-weight: 700;
  color: #ffb3bd;
}
.notice.risk .notice-title { color: #f0d29a; }
.notice-body { margin-top: 6px; font-size: 12px; line-height: 1.65; color: #c9b8dd; }
.dialogue {
  margin-top: 18px;
  padding: 13px 16px;
  border-left: 3px solid ${ROSE};
  background: rgba(8, 4, 14, .55);
  border-radius: 0 14px 14px 0;
}
.speaker {
  display: block;
  margin-bottom: 5px;
  font-size: 10px;
  letter-spacing: 2px;
  color: ${GOLD};
}
.line {
  font-family: 'LXGW WenKai', 'STKaiti', 'KaiTi', 'Kaiti SC', 'Noto Serif CJK SC', serif;
  font-size: 15px;
  line-height: 1.65;
  color: #efe4fb;
}
.footer {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid rgba(240, 194, 123, .12);
  color: #8f7da8;
  font-size: 10px;
  letter-spacing: 1px;
}
.character {
  position: absolute;
  right: 0;
  bottom: 0;
  z-index: 1;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  height: 100%;
  pointer-events: none;
}
.character img {
  display: block;
  height: 96%;
  width: auto;
  max-width: none;
  filter: drop-shadow(0 24px 46px rgba(0, 0, 0, .58));
}
.eye-wrap {
  width: 340px;
  height: 340px;
  margin-bottom: 96px;
  filter: drop-shadow(0 0 34px rgba(232, 106, 146, .38));
}
.eye-wrap svg { width: 100%; height: 100%; }
.flow {
  display: grid;
  grid-template-columns: 1fr 54px 1fr;
  gap: 10px;
  align-items: stretch;
  margin-top: 18px;
}
.nameplate {
  padding: 14px 16px;
  border: 1px solid rgba(240, 194, 123, .20);
  border-radius: 14px;
  background: rgba(255, 255, 255, .03);
}
.name {
  margin-top: 6px;
  font-family: 'Noto Serif SC', 'SimSun', serif;
  font-size: 19px;
  color: #faf3ff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nameplate .sub { margin-top: 6px; font-size: 11px; color: #a995c4; }
.link {
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${ROSE};
  font-size: 24px;
  text-shadow: 0 0 14px rgba(232, 106, 146, .65);
}
.ledger { width: 100%; border-collapse: collapse; margin-top: 16px; }
.ledger td {
  padding: 10px 0;
  border-bottom: 1px dashed rgba(240, 194, 123, .14);
  font-size: 12px;
  color: #c9b8dd;
}
.ledger tr:last-child td { border-bottom: none; }
.ledger td:last-child {
  text-align: right;
  font-family: 'Noto Serif SC', 'SimSun', serif;
  font-size: 16px;
  color: #f0d29a;
}
.cracks {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
}
.mood-risk .panel { border-color: rgba(240, 194, 123, .38); }
.mood-boom .overlay {
  background:
    radial-gradient(circle at 50% 42%, rgba(255, 60, 80, .22), transparent 58%),
    linear-gradient(90deg, rgba(12, 3, 8, .94) 0%, rgba(12, 3, 8, .70) 42%, rgba(20, 4, 10, .30) 70%, rgba(12, 3, 8, .58) 100%);
}
.mood-boom .panel {
  border-color: rgba(255, 92, 108, .42);
  box-shadow: 0 26px 60px rgba(0, 0, 0, .62), inset 0 0 54px rgba(255, 60, 80, .08);
}
.mood-boom .title { color: #ffe0e4; }
.mood-boom .balance {
  background: linear-gradient(180deg, #ffd7dc 0%, ${DANGER} 52%, #b51f3c 100%);
  -webkit-background-clip: text;
  background-clip: text;
}
.mood-boom .character::before {
  content: '';
  position: absolute;
  inset: 12% 6% 10%;
  background: radial-gradient(circle, rgba(255, 60, 80, .30), transparent 62%);
  filter: blur(18px);
}
.mood-muted .bg { filter: saturate(.55) brightness(.62); }
.mood-muted .panel { opacity: .94; }
.mood-muted .character img {
  opacity: .82;
  filter: saturate(.65) brightness(.82) drop-shadow(0 24px 46px rgba(0, 0, 0, .58));
}
.mood-muted .eye-wrap { opacity: .58; filter: grayscale(.25) drop-shadow(0 0 20px rgba(232, 106, 146, .2)); }
</style>
</head>
<body class="mood-${mood}">
<div class="card">
  <div class="bg"${bgStyle}></div>
  <div class="overlay"></div>
  ${mood === 'boom' ? CRACKS_SVG : ''}
  <div class="frame">
    <div class="panel">
      <div class="accent"></div>
      <div class="inner-line"></div>
      <div class="header">
        <div>
          ${options.eyebrow ? `<div class="eyebrow">${esc(options.eyebrow)}</div>` : ''}
          <div class="title">${options.title}</div>
          ${options.subtitle ? `<div class="subtitle">${esc(options.subtitle)}</div>` : ''}
        </div>
        ${badge}
      </div>
      <div class="divider"><span>♡</span></div>
      ${options.body}
      ${dialogue}
      <div class="footer">
        <span>${esc(options.footerLeft || '地灵殿 · 心之账本')}</span>
        <span>${esc(options.footerRight || 'P 点仅限群内娱乐')}</span>
      </div>
    </div>
    <div class="character">${characterHtml(characterMood)}</div>
  </div>
</div>
</body>
</html>`
}
