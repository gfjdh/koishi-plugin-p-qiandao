import {
  DANGER,
  fmtInt,
  fmtSigned,
  GOLD,
  pctOf,
  shell,
} from './common'

const EYEBROW = 'SATOKI KOMEIJI · CHIREIDEN'
const TITLE = '地灵殿 · 心之账本 <small>P 点存折</small>'
const FOOTER_LEFT = '地灵殿 · 心之账本'
const FOOTER_RIGHT = 'P 点仅限群内娱乐'

function maskId(id: string): string {
  const text = String(id || '')
  if (text.length <= 6) return text
  return `${text.slice(0, 3)}****${text.slice(-3)}`
}

function displayName(name: string): string {
  return name || '无名客'
}

function gaugeBlock(balance: number, safeLimit: number, boomChance: number): string {
  const pct = pctOf(balance, safeLimit)
  const overLimit = balance > safeLimit
  const distance = Math.max(0, safeLimit - balance)
  let note: string
  if (overLimit && boomChance > 0) {
    note = `已超过安全线，每次签到有 ${Math.round(boomChance * 100)}% 概率存爆`
  } else if (overLimit) {
    note = '已超过安全线，存爆机制已关闭'
  } else {
    note = `距离安全线还有 ${fmtInt(distance)} P`
  }
  const fill = overLimit
    ? `linear-gradient(90deg, #b51f3c, ${DANGER})`
    : 'linear-gradient(90deg, #8f6ad6, #e86a92, #f0c27b)'
  return `<div class="gauge">
    <div class="gauge-head">
      <span class="label">安全线</span>
      <span class="gauge-pct">${overLimit ? '已超线' : `${pct.toFixed(1)}%`}</span>
    </div>
    <div class="gauge-track"><div class="gauge-fill" style="width:${pct}%;background:${fill}"></div></div>
    <div class="gauge-note">${note}</div>
  </div>`
}

function chipsBlock(items: string[]): string {
  const content = items.filter(Boolean).join('')
  return content ? `<div class="chips">${content}</div>` : ''
}

function balanceBlock(options: {
  userName: string
  balance: number
  event: string
}): string {
  return `<div class="balance-block">
    <div class="label">当前余额</div>
    <div class="balance">${fmtInt(options.balance)}<span class="unit">P</span></div>
    <div class="event">${displayName(options.userName)} · ${options.event}</div>
  </div>`
}

function boomNotice(amount: number, poolInjected: boolean): string {
  return `<div class="notice">
    <div class="notice-title">存爆损失 ${fmtInt(amount)} P</div>
    <div class="notice-body">${poolInjected
      ? `爆出的 P 点已注入本群奖池 ${fmtInt(amount)} P`
      : '爆出的 P 点未能进入群奖池'}</div>
  </div>`
}

export interface SignCardOptions {
  userName: string
  userId: string
  isNew: boolean
  isAdmin: boolean
  bonus: number
  balance: number
  initP: number
  safeLimit: number
  exploded: boolean
  explodeAmount: number
  poolInjected: boolean
  boomChance: number
  dialogue: string
  dateLabel: string
  timeLabel: string
}

export function signCard(options: SignCardOptions): string {
  const overLimit = options.balance > options.safeLimit
  const risky = overLimit && options.boomChance > 0
  const event = options.isNew
    ? `本次 ${fmtSigned(options.bonus)} P · 初始赠送 ${fmtInt(options.initP)} P`
    : `本次 ${fmtSigned(options.bonus)} P`

  let badge: { text: string; tone: 'success' | 'danger' | 'muted' | 'risk'; mood: 'default' | 'risk' | 'boom'; character: 'neutral' | 'happy' | 'worried' | 'shocked' }
  if (options.exploded) {
    badge = { text: '存爆', tone: 'danger', mood: 'boom', character: 'shocked' }
  } else if (options.isNew) {
    badge = { text: '新账户', tone: 'success', mood: 'default', character: 'happy' }
  } else if (risky) {
    badge = { text: '存爆风险', tone: 'risk', mood: 'risk', character: 'worried' }
  } else if (overLimit) {
    badge = { text: '超出安全线', tone: 'muted', mood: 'default', character: 'neutral' }
  } else {
    badge = { text: '签到成功', tone: 'success', mood: 'default', character: 'neutral' }
  }

  const chips = chipsBlock([
    options.isAdmin ? '<span class="chip chip-gold">管理员</span>' : '',
    options.exploded
      ? ''
      : options.isNew
        ? '<span class="chip chip-gold">新账户</span>'
        : '<span class="chip chip-gold">今日已签</span>',
    risky ? '<span class="chip chip-red">存爆风险</span>' : '',
    `<span class="chip chip-muted">${maskId(options.userId)}</span>`,
  ])

  const body = `
    ${balanceBlock({ userName: options.userName, balance: options.balance, event })}
    ${gaugeBlock(options.balance, options.safeLimit, options.boomChance)}
    ${chips}
    ${options.exploded ? boomNotice(options.explodeAmount, options.poolInjected) : ''}`

  return shell({
    eyebrow: EYEBROW,
    title: TITLE,
    subtitle: `${options.dateLabel} · ${options.timeLabel}`,
    badge: badge.text,
    badgeTone: badge.tone,
    mood: badge.mood,
    characterMood: badge.character,
    body,
    dialogue: { speaker: '觉', text: options.dialogue },
    footerLeft: FOOTER_LEFT,
    footerRight: FOOTER_RIGHT,
  })
}

export interface AlreadySignedCardOptions {
  userName: string
  userId: string
  balance: number
  safeLimit: number
  lastSignLabel: string
  dateLabel: string
  timeLabel: string
  boomChance: number
  dialogue: string
}

export function alreadySignedCard(options: AlreadySignedCardOptions): string {
  const overLimit = options.balance > options.safeLimit
  const risky = overLimit && options.boomChance > 0
  const body = `
    ${balanceBlock({
      userName: options.userName,
      balance: options.balance,
      event: `上次签到 ${options.lastSignLabel || '暂无记录'}`,
    })}
    ${gaugeBlock(options.balance, options.safeLimit, options.boomChance)}
    ${chipsBlock([
      '<span class="chip chip-muted">今日已签</span>',
      risky ? '<span class="chip chip-red">存爆风险</span>' : '',
      `<span class="chip chip-muted">${maskId(options.userId)}</span>`,
    ])}`

  return shell({
    eyebrow: EYEBROW,
    title: TITLE,
    subtitle: `${options.dateLabel} · ${options.timeLabel}`,
    badge: risky ? '存爆风险' : '今日已签',
    badgeTone: risky ? 'risk' : 'muted',
    mood: 'muted',
    characterMood: 'sleepy',
    body,
    dialogue: { speaker: '觉', text: options.dialogue },
    footerLeft: FOOTER_LEFT,
    footerRight: FOOTER_RIGHT,
  })
}

export interface QueryCardOptions {
  userName: string
  userId: string
  balance: number
  safeLimit: number
  lastSignLabel: string
  dateLabel: string
  timeLabel: string
  boomChance: number
  dialogue: string
}

export function queryCard(options: QueryCardOptions): string {
  const overLimit = options.balance > options.safeLimit
  const risky = overLimit && options.boomChance > 0
  const body = `
    ${balanceBlock({
      userName: options.userName,
      balance: options.balance,
      event: '心之账本',
    })}
    ${gaugeBlock(options.balance, options.safeLimit, options.boomChance)}
    ${chipsBlock([
      `<span class="chip chip-muted">上次签到 ${options.lastSignLabel || '暂无记录'}</span>`,
      risky ? '<span class="chip chip-red">存爆风险</span>' : '',
      `<span class="chip chip-muted">${maskId(options.userId)}</span>`,
    ])}`

  return shell({
    eyebrow: EYEBROW,
    title: TITLE,
    subtitle: `${options.dateLabel} · ${options.timeLabel}`,
    badge: risky ? '存爆风险' : '心之账本',
    badgeTone: risky ? 'risk' : 'success',
    mood: risky ? 'risk' : 'default',
    characterMood: risky ? 'worried' : 'neutral',
    body,
    dialogue: { speaker: '觉', text: options.dialogue },
    footerLeft: FOOTER_LEFT,
    footerRight: FOOTER_RIGHT,
  })
}

export interface TransferCardOptions {
  fromName: string
  fromId: string
  toName: string
  toId: string
  amount: number
  fee: number
  net: number
  fromBalance: number
  toBalance: number
  dateLabel: string
  timeLabel: string
  adminAdjust: boolean
  dialogue: string
}

export function transferCard(options: TransferCardOptions): string {
  const deduct = options.adminAdjust && options.amount < 0
  const amountLabel = deduct ? '调整金额' : '转账金额'
  const netLabel = deduct ? '实际扣减' : '实际到账'
  const fromLabel = deduct ? '操作人' : '转出'
  const toLabel = deduct ? '被调整人' : '转入'
  const amountText = options.amount >= 0 ? fmtInt(options.amount) : fmtSigned(options.amount)
  const netText = options.net >= 0 ? fmtInt(options.net) : fmtSigned(options.net)
  const border = deduct ? 'border-color:rgba(255,92,108,.32)' : ''

  const body = `
    <div class="flow">
      <div class="nameplate" style="${border}">
        <div class="label">${fromLabel}</div>
        <div class="name">${displayName(options.fromName)}</div>
        <div class="sub">${maskId(options.fromId)} · 余额 ${fmtInt(options.fromBalance)} P</div>
      </div>
      <div class="link" style="${deduct ? `color:${DANGER}` : ''}">♡</div>
      <div class="nameplate" style="${border}">
        <div class="label">${toLabel}</div>
        <div class="name">${displayName(options.toName)}</div>
        <div class="sub">${maskId(options.toId)} · 余额 ${fmtInt(options.toBalance)} P</div>
      </div>
    </div>
    <table class="ledger">
      <tr><td>${amountLabel}</td><td>${amountText} P</td></tr>
      ${options.fee > 0 ? `<tr><td>手续费</td><td>${fmtInt(options.fee)} P</td></tr>` : ''}
      <tr><td>${netLabel}</td><td style="color:${options.net >= 0 ? GOLD : DANGER}">${netText} P</td></tr>
    </table>`

  const badge = deduct ? '管理员扣减' : options.adminAdjust ? '管理员调整' : '已到账'

  return shell({
    eyebrow: EYEBROW,
    title: '地灵殿 · 心之账本 <small>转账凭证</small>',
    subtitle: `${options.dateLabel} · ${options.timeLabel}`,
    badge,
    badgeTone: deduct ? 'danger' : options.adminAdjust ? 'risk' : 'success',
    mood: deduct ? 'boom' : 'default',
    characterMood: deduct ? 'worried' : 'happy',
    body,
    dialogue: { speaker: '觉', text: options.dialogue },
    footerLeft: FOOTER_LEFT,
    footerRight: FOOTER_RIGHT,
  })
}
