import { Context, h, Schema, Session, Time } from 'koishi'
import type {} from 'koishi-plugin-puppeteer'
import { Renderer } from './render'
import { alreadySignedCard, queryCard, signCard, transferCard } from './render/cards'

export const name = 'p-qiandao'

export const usage = `
- **指令：p-query**\n
    别名：查询p点,p点查询\n
- **指令：p-sign**\n
    别名：签到\n
    管理员可以无限签到\n
- **指令：p-transfer [target] [value:number]**\n
    别名：转账\n
    目标用户可以使用@元素或qq号，管理员可以转账负数（制裁用）\n
- 在本地化中可以编辑问候语，按时段从三句中随机一句`;

export const inject = {
  required: ['database'],
  optional: ['puppeteer'],
}

export interface Config {
  adminUsers: string[]
  init_p: number
  limit_p: number
  upper_limit: number
  lower_limit: number
  boom_chance: number
  boom_upper_limit: number
  boom_lower_limit: number
  entry_to_channel: boolean
  enable_greatting: boolean
  signOffset: number
  outputLogs: boolean
  taxEnabled?: boolean
  taxRate?: number
}

export const Config: Schema<Config> = Schema.object({
  adminUsers: Schema.array(Schema.string()),
  init_p: Schema.number().required(),
  limit_p: Schema.number().required(),
  upper_limit: Schema.number().required(),
  lower_limit: Schema.number().required(),
  boom_chance: Schema.number().role('slider').min(0).max(1).step(0.01).default(0),
  entry_to_channel: Schema.boolean().default(false),
  boom_upper_limit: Schema.number().role('slider').min(0).max(1).step(0.01).default(0.8),
  boom_lower_limit: Schema.number().role('slider').min(0).max(1).step(0.01).default(0.2),
  enable_greatting: Schema.boolean().default(true),
  signOffset: Schema.number().default(0),
  outputLogs: Schema.boolean().default(true),
  taxEnabled: Schema.boolean().default(false),
  taxRate: Schema.number().role('slider').min(0).max(1).step(0.01).default(0.05),
}).i18n({
  'zh-CN': require('./locales/zh-CN'),
})

declare module 'koishi' {
  interface Tables { p_system: p_system }
  interface Tables { p_graze: p_graze }
}

export interface p_system {
  id: number
  userid: string
  usersname: string
  p: number
  time: Date
  favorability: number
}

export interface p_graze {
  id: number
  channelid: string
  bullet: number
  p: number
  users: string
}

function mathRandomInt(a: number, b: number) {
  if (a > b) {
    const c = a
    a = b
    b = c
  }
  return Math.floor(Math.random() * (b - a + 1) + a)
}

function dayKey(date: Date): string {
  return Time.template('yyyy-MM-dd', date)
}

function dateLabel(date: Date): string {
  return Time.template('yyyy-MM-dd', date)
}

function clockLabel(date: Date): string {
  return Time.template('hh:mm', date)
}

function fullTimeLabel(date: Date): string {
  return Time.template('yyyy-MM-dd hh:mm', date)
}

function asDate(value: Date | string | number | null | undefined): Date | null {
  if (value == null) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function greetingKey(hour: number): string {
  if (hour >= 23 || hour < 2) return '23-2'
  if (hour < 6) return '2-6'
  if (hour < 8) return '6-8'
  if (hour < 11) return '8-11'
  if (hour < 17) return '11-17'
  if (hour < 19) return '17-19'
  if (hour < 21) return '19-21'
  return '21-23'
}

/** 目标解析：@ 元素优先，其次 <at id="..."/> 文本，最后才接受纯数字 ID。 */
function resolveTargetId(session: Session, target: string | undefined): string | null {
  const ats = (session.elements || []).filter((element) => {
    return element.type === 'at' && String(element.attrs?.id) !== String(session.selfId)
  })
  if (ats.length) {
    const id = ats[0].attrs?.id
    if (id != null) return String(id)
  }
  const text = String(target ?? '').trim()
  if (!text) return null
  const elementMatch = /<at\s+id="([^"]+)"/.exec(text)
  if (elementMatch) return elementMatch[1]
  if (/^\d{4,}$/.test(text)) return text
  return null
}

interface SignOutcome {
  alreadySigned: boolean
  isNew?: boolean
  bonus?: number
  balance: number
  favorability: number
  exploded?: boolean
  explodeAmount?: number
  poolInjected?: boolean
  lastSign?: Date | null
}

type TransferOutcome =
  | { error: 'account-notExists' | 'target-notExists' | 'no-enough-p' }
  | {
    ok: true
    senderBalance: number
    receiverBalance: number
    receiverName: string
    fee: number
    net: number
  }

export async function apply(ctx: Context, cfg: Config) {
  ctx.model.extend('p_system', {
    id: 'unsigned',
    userid: 'string',
    time: 'timestamp',
    usersname: 'string',
    p: 'integer',
    favorability: 'integer',
  }, { autoInc: true })

  if (cfg.entry_to_channel) {
    ctx.model.extend('p_graze', {
      id: 'unsigned',
      channelid: 'string',
      bullet: 'integer',
      p: 'integer',
      users: 'string',
    }, { autoInc: true })
  }

  const logger = ctx.logger('p-签到')
  const renderer = new Renderer(ctx)
  const adminUsers = cfg.adminUsers || []
  ctx.i18n.define('zh-CN', require('./locales/zh-CN'))

  // SQLite 同一连接不支持并发或嵌套事务，所有事务统一走这条串行链。
  let txChain: Promise<unknown> = Promise.resolve()
  function transact<T>(callback: (db: any) => Promise<T>): Promise<T> {
    const run = txChain.then(() => ctx.database.transact(callback))
    txChain = run.then(() => undefined, () => undefined)
    return run
  }

  async function output(html: string, fallback: string): Promise<string> {
    const image = await renderer.render(html)
    return image || fallback
  }

  ctx.command('p/p-sign').alias('签到').action(async ({ session }) => {
    const userId = session.userId
    if (!userId) return session.text('.sign-failed')
    const userName = session.username || userId
    const isAdmin = adminUsers.includes(userId)
    const shiftedNow = new Date(Date.now() + cfg.signOffset * 60 * 1000)
    const today = dayKey(shiftedNow)

    let outcome: SignOutcome
    try {
      outcome = await transact<SignOutcome>(async (db) => {
        const [row] = await db.get('p_system', { userid: userId })
        const isNew = !row
        const baseP = isNew ? Number(cfg.init_p || 0) : Number(row?.p || 0)
        const lastSign = asDate(row?.time)
        const canSign = isAdmin || isNew || !lastSign || dayKey(lastSign) !== today

        if (!canSign) {
          if (row && userName !== row.usersname) {
            await db.set('p_system', { userid: userId }, { usersname: userName })
          }
          return {
            alreadySigned: true,
            balance: baseP,
            favorability: Number(row?.favorability || 0),
            lastSign,
          }
        }

        const bonus = Number(mathRandomInt(cfg.lower_limit, cfg.upper_limit))
        let balance = baseP + bonus
        const overLimit = balance > cfg.limit_p
        const exploded = overLimit && cfg.boom_chance > 0 && Math.random() < cfg.boom_chance
        let explodeAmount = 0
        let poolInjected = false

        if (exploded) {
          const low = Math.min(cfg.boom_lower_limit, cfg.boom_upper_limit)
          const high = Math.max(cfg.boom_lower_limit, cfg.boom_upper_limit)
          explodeAmount = Math.floor(balance * (low + (high - low) * Math.random()))
          balance = cfg.limit_p - explodeAmount
          if (cfg.entry_to_channel && session.channelId) {
            const channelId = session.channelId
            const [pool] = await db.get('p_graze', { channelid: channelId })
            if (pool) {
              await db.set('p_graze', { channelid: channelId }, { p: Number(pool.p || 0) + explodeAmount })
            } else {
              await db.create('p_graze', {
                channelid: channelId,
                p: explodeAmount,
                bullet: 0,
                users: userId,
              })
            }
            poolInjected = true
          }
        }

        const favorability = Number(row?.favorability || 0) + 1
        if (isNew) {
          await db.create('p_system', {
            userid: userId,
            usersname: userName,
            p: balance,
            time: shiftedNow,
            favorability,
          })
        } else {
          await db.set('p_system', { userid: userId }, {
            usersname: userName,
            p: balance,
            time: shiftedNow,
            favorability,
          })
        }

        return {
          alreadySigned: false,
          isNew,
          bonus,
          balance,
          favorability,
          exploded,
          explodeAmount,
          poolInjected,
        }
      })
    } catch (error) {
      logger.warn('签到失败：', error)
      return session.text('.sign-failed')
    }

    if (outcome.alreadySigned) {
      const lastSignLabel = outcome.lastSign ? fullTimeLabel(outcome.lastSign) : '暂无记录'
      const fallback = h('at', { id: userId }).toString() + session.text('.already-signed')
      if (cfg.outputLogs) logger.info(userId + userName + '该用户已经签到')
      return output(alreadySignedCard({
        userName,
        userId,
        balance: outcome.balance,
        safeLimit: cfg.limit_p,
        lastSignLabel,
        dateLabel: dateLabel(shiftedNow),
        timeLabel: clockLabel(shiftedNow),
        boomChance: cfg.boom_chance,
        dialogue: session.text('.already-signed'),
      }), fallback)
    }

    const greeting = cfg.enable_greatting
      ? session.text(`.greating-${greetingKey(Number(Time.template('hh', shiftedNow)))}.${mathRandomInt(0, 2)}`)
      : ''
    const risky = outcome.balance > cfg.limit_p && cfg.boom_chance > 0
    const dialogue = outcome.exploded
      ? session.text('.explode-warning', [outcome.explodeAmount])
      : outcome.isNew
        ? session.text('.new-user', [cfg.init_p])
        : risky
          ? session.text('.exceeding-limit', [cfg.limit_p])
          : greeting || session.text('.sign-succeed', [outcome.bonus])

    const lines: string[] = []
    if (outcome.isNew) lines.push(session.text('.new-user', [cfg.init_p]))
    lines.push(session.text('.sign-succeed', [outcome.bonus]))
    if (outcome.exploded) {
      lines.push(session.text('.explode-warning', [outcome.explodeAmount]))
      if (outcome.poolInjected) lines.push(session.text('.entry_to_channel'))
    }
    lines.push(session.text('.balance-show', [outcome.balance]))
    if (outcome.balance > cfg.limit_p && cfg.boom_chance > 0 && !outcome.exploded) {
      lines.push(session.text('.exceeding-limit', [cfg.limit_p]))
    }
    if (greeting) lines.push(greeting)
    const fallback = h('at', { id: userId }).toString() + '\n' + lines.join('\n')

    if (cfg.outputLogs) logger.success(userId + userName + '完成了一次签到！')
    return output(signCard({
      userName,
      userId,
      isNew: outcome.isNew,
      isAdmin,
      bonus: outcome.bonus,
      balance: outcome.balance,
      initP: cfg.init_p,
      safeLimit: cfg.limit_p,
      exploded: outcome.exploded,
      explodeAmount: outcome.explodeAmount,
      poolInjected: outcome.poolInjected,
      boomChance: cfg.boom_chance,
      dialogue,
      dateLabel: dateLabel(shiftedNow),
      timeLabel: clockLabel(shiftedNow),
    }), fallback)
  })

  ctx.command('p/p-query').alias('查询p点', 'p点查询').action(async ({ session }) => {
    const userId = session.userId
    if (!userId) return session.text('.account-notExists')
    const [row] = await ctx.database.get('p_system', { userid: userId })
    if (!row) return session.text('.account-notExists')

    const balance = Number(row.p || 0)
    const lastSign = asDate(row.time)
    const now = new Date(Date.now() + cfg.signOffset * 60 * 1000)
    return output(queryCard({
      userName: row.usersname || session.username || userId,
      userId,
      balance,
      safeLimit: cfg.limit_p,
      lastSignLabel: lastSign ? fullTimeLabel(lastSign) : '暂无记录',
      dateLabel: dateLabel(now),
      timeLabel: clockLabel(now),
      boomChance: cfg.boom_chance,
      dialogue: session.text('.result', [balance]),
    }), session.text('.result', [balance]))
  })

  ctx.command('p/p-transfer [target] [value:number]').alias('转账').action(async ({ session }, target, value) => {
    const userId = session.userId
    if (!userId) return session.text('.account-notExists')

    const amount = Number(value)
    if (!Number.isFinite(amount)) return session.text('.wrong-value')

    const targetId = resolveTargetId(session, target)
    if (!targetId) return session.text('.no-id')
    if (String(targetId) === String(userId)) return session.text('.self-target')

    const isAdmin = adminUsers.includes(userId)
    if (!(amount > 0) && !isAdmin) return session.text('.wrong-value')

    let outcome: TransferOutcome
    try {
      outcome = await transact<TransferOutcome>(async (db) => {
        const [sender] = await db.get('p_system', { userid: userId })
        if (!sender) return { error: 'account-notExists' as const }
        const [receiver] = await db.get('p_system', { userid: targetId })
        if (!receiver) return { error: 'target-notExists' as const }

        const senderBalance = Number(sender.p || 0)
        const receiverBalance = Number(receiver.p || 0)
        if (amount > 0 && senderBalance < amount) return { error: 'no-enough-p' as const }

        let fee = 0
        let net = amount
        if (cfg.taxEnabled && amount > 0) {
          fee = Math.floor(amount * cfg.taxRate)
          net = amount - fee
        }

        const nextSender = Math.floor(senderBalance - amount)
        const nextReceiver = Math.floor(receiverBalance + net)
        await db.set('p_system', { userid: userId }, { p: nextSender })
        await db.set('p_system', { userid: targetId }, { p: nextReceiver })
        return {
          ok: true as const,
          senderBalance: nextSender,
          receiverBalance: nextReceiver,
          receiverName: receiver.usersname || String(targetId),
          fee,
          net,
        }
      })
    } catch (error) {
      logger.warn('转账失败：', error)
      return session.text('.wrong-value')
    }

    if ('error' in outcome) return session.text(`.${outcome.error}`)

    const now = new Date(Date.now() + cfg.signOffset * 60 * 1000)
    const lines = [
      session.text('.transfer-succeed'),
      session.text('.result', [targetId, outcome.receiverBalance]),
      session.text('.result', [userId, outcome.senderBalance]),
    ]
    if (outcome.fee > 0) lines.push(session.text('.tax-info', [outcome.fee]))

    return output(transferCard({
      fromName: session.username || userId,
      fromId: userId,
      toName: outcome.receiverName,
      toId: targetId,
      amount,
      fee: outcome.fee,
      net: outcome.net,
      fromBalance: outcome.senderBalance,
      toBalance: outcome.receiverBalance,
      dateLabel: dateLabel(now),
      timeLabel: clockLabel(now),
      adminAdjust: isAdmin,
      dialogue: session.text('.transfer-succeed'),
    }), lines.join('\n'))
  })
}
