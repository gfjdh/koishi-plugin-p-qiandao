import { Context, h, Schema, Session, Time } from 'koishi'

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

export const inject = { required: ['database'] }

// 类型定义增强
declare module 'koishi' {
  interface Tables {
    p_system: UserData
    p_graze?: GrazeData  // 可选字段
  }
}

interface UserData {
  id: number
  userid: string
  usersname: string
  p: number
  time: Date
  favorability: number
  items?: Record<string, ItemInfo>
}

// 道具数据模型
interface ItemInfo {
  id: string;
  count: number;
  price: number;
  description?: string;
  favorability_limit?: number;
}

interface GrazeData {
  id: number
  channelid: string
  bullet: number
  p: number
  users: string
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
  taxRate: Schema.number().role('slider').min(0).max(1).step(0.01).default(0.05)
}).i18n({
  'zh-CN': require('./locales/zh-CN'),
})

// 工具函数
namespace Utils {
  export function randomInt(a: number, b: number): number {
    [a, b] = a > b ? [b, a] : [a, b]
    return Math.floor(Math.random() * (b - a + 1) + a)
  }

  export function formatDate(offset: number, time?: Date): string {
    if (time) return Time.template('yyyy-MM-dd', new Date(time.getTime()))
    return Time.template('yyyy-MM-dd', new Date(Date.now() + offset * 60 * 1000))
  }

  export function getGreetingKey(): string {
    const hour = new Date().getHours()
    const timeRanges = [
      { start: 0, end: 2, label: '23-2' },
      { start: 2, end: 6, label: '2-6' },
      { start: 6, end: 8, label: '6-8' },
      { start: 8, end: 11, label: '8-11' },
      { start: 11, end: 17, label: '11-17' },
      { start: 17, end: 19, label: '17-19' },
      { start: 19, end: 21, label: '19-21' },
      { start: 21, end: 23, label: '21-23' },
      { start: 23, end: 24, label: '23-2' }
    ]
    const range = timeRanges.find(r => hour >= r.start && hour < r.end)
    return `.greating-${range.label}.${randomInt(0, 2)}`
  }
}

// 数据库服务
class DatabaseService {
  constructor(private ctx: Context, private config: Config) {}

  async getUser(userId: string): Promise<UserData> {
    const [user] = await this.ctx.database.get('p_system', { userid: userId })
    return user
  }

  async createUser(userId: string, username: string): Promise<void> {
    await this.ctx.database.create('p_system', {
      userid: userId,
      usersname: username,
      p: this.config.init_p,
      favorability: 0,
      time: new Date()
    })
  }

  async updateUser(userId: string, data: Partial<UserData>): Promise<void> {
    await this.ctx.database.set('p_system', { userid: userId }, data)
  }
}

// 签到服务
class SignService {
  private db: DatabaseService

  constructor(private ctx: Context, private config: Config) {
    this.db = new DatabaseService(ctx, config)
  }

  async handleSign(session: Session): Promise<string> {
    const { userId, username } = session
    if (!userId) return session.text('.sign-failed')

    const user = await this.db.getUser(userId)
    const isNewUser = !user
    const isAdmin = this.config.adminUsers.includes(userId)

    // 处理新用户
    if (isNewUser) {
      await this.db.createUser(userId, username)
      return session.text('.new-user', [this.config.init_p])
    }

    // 更新用户名
    await this.db.updateUser(userId, { usersname: username })

    // 检查签到状态
    if (!this.canSignToday(user, isAdmin)) {
      return h('at', { id: userId }) + session.text('.already-signed')
    }

    // 执行签到逻辑
    const bonus = Utils.randomInt(this.config.lower_limit, this.config.upper_limit)
    const newBalance = user.p + bonus
    await this.db.updateUser(userId, {
      p: newBalance,
      time: new Date(),
      favorability: user.favorability + 1
    })

    // 处理爆炸逻辑
    const result = await this.handleExplosion(session, newBalance, bonus)
    this.logSign(userId, username)

    if (this.config.enable_greatting) {
      session.send(result)
      await new Promise(resolve => setTimeout(resolve, 500))
      return session.text(Utils.getGreetingKey())
    } else {
      return result
    }
  }

  private canSignToday(user: UserData, isAdmin: boolean): boolean {
    if (isAdmin) return true
    const lastSignDate = Utils.formatDate(this.config.signOffset, user.time)
    const currentDate = Utils.formatDate(this.config.signOffset)
    return lastSignDate !== currentDate
  }

  private async handleExplosion(session: Session, balance: number, bonus: number): Promise<string> {
    if (balance <= this.config.limit_p || Math.random() >= this.config.boom_chance) {
      return session.text('.sign-succeed', [bonus]) + session.text('.balance-show', [balance])
    }

    const explodeAmount = Math.floor(balance * (
      this.config.boom_lower_limit +
      Math.random() * (this.config.boom_upper_limit - this.config.boom_lower_limit)
    ))

    const newBalance = this.config.limit_p - explodeAmount
    await this.db.updateUser(session.userId, { p: newBalance })

    let result = session.text('.explode-warning', [explodeAmount])
    if (this.config.entry_to_channel) {
      await this.ctx.database.set('p_graze', {
        channelid: session.channelId
      }, { p: explodeAmount })
      result += session.text('.entry_to_channel')
    }

    return result
  }

  private logSign(userId: string, username: string): void {
    if (this.config.outputLogs) {
      this.ctx.logger("p-签到").success(`${userId}${username}完成了一次签到！`)
    }
  }
}

// 转账服务
class TransferService {
  private db: DatabaseService

  constructor(private ctx: Context, private config: Config) {
    this.db = new DatabaseService(ctx, config)
  }

  async handleTransfer(session: Session, target: string, value: number): Promise<string> {
    const senderId = session.userId
    const [sender, targetId] = await Promise.all([
      this.validateSender(session, senderId),
      this.resolveTargetId(session, target)
    ])

    if (typeof targetId !== 'string') return targetId  // 错误信息
    if (sender.p < value) return session.text('.no-enough-p')

    // 计算实际转账金额
    const { netValue, tax } = this.calculateTransfer(value)
    await this.updateBalances(senderId, targetId, value, netValue)

    const [newSender, newReceiver] = await Promise.all([
      this.db.getUser(senderId),
      this.db.getUser(targetId)
    ])

    let result = session.text('.transfer-succeed')
    result += `\n${session.text('.result', [targetId, newReceiver.p])}`
    result += `\n${session.text('.result', [senderId, newSender.p])}`
    if (tax > 0) result += `\n${session.text('.tax-info', [tax])}`

    return result
  }

  private async validateSender(session: Session, senderId: string): Promise<UserData> {
    const sender = await this.db.getUser(senderId)
    if (!sender) throw new Error(session.text('.account-notExists'))
    return sender
  }

  private async resolveTargetId(session: Session, target: string): Promise<string | string> {
    const atTarget = session.elements.find(el => el.type === 'at')?.attrs?.id
    const qqTarget = target.match(/\b([1-9]\d{6,})\b/)?.[1]
    const targetId = atTarget || qqTarget || target

    if (!await this.db.getUser(targetId)) {
      return session.text('.target-notExists')
    }
    if (targetId === session.userId) return session.text('.self-target')

    return targetId
  }

  private calculateTransfer(value: number): { netValue: number; tax: number } {
    const tax = this.config.taxEnabled
      ? Math.floor(value * this.config.taxRate)
      : 0
    return { netValue: value - tax, tax }
  }

  private async updateBalances(senderId: string, targetId: string, sent: number, received: number): Promise<void> {
    const senderP = (await this.db.getUser(senderId)).p
    const receiverP = (await this.db.getUser(targetId)).p
    await Promise.all([
      this.db.updateUser(senderId, { p: senderP - sent }),
      this.db.updateUser(targetId, { p: receiverP + received })
    ])
  }
}

// 主入口
export async function apply(ctx: Context, config: Config) {
  // 初始化数据库
  ctx.model.extend('p_system', {
    id: 'unsigned',
    userid: 'string',
    usersname: 'string',
    p: 'integer',
    time: 'timestamp',
    favorability: 'integer',
    items: 'object'
  }, { autoInc: true })

  if (config.entry_to_channel) {
    ctx.model.extend('p_graze', {
      id: 'unsigned',
      channelid: 'string',
      bullet: 'integer',
      p: 'integer',
      users: 'string'
    }, { autoInc: true })
  }

  // 加载本地化
  ctx.i18n.define('zh-CN', require('./locales/zh-CN'))

  // 初始化服务
  const signService = new SignService(ctx, config)
  const transferService = new TransferService(ctx, config)

  // 注册命令
  ctx.command('p/p-sign', '签到')
    .alias('签到')
    .action(({ session }) => signService.handleSign(session))

  ctx.command('p/p-query', '查询点数')
    .alias('查询p点', 'p点查询')
    .action(async ({ session }) => {
      const user = await new DatabaseService(ctx, config).getUser(session.userId)
      return user
        ? session.text('.result', [user.p])
        : session.text('.account-notExists')
    })

  ctx.command('p/p-transfer [target] [value:number]', '转账')
    .alias('转账')
    .action(({ session }, target, value) =>
      transferService.handleTransfer(session, target, value)
    )
}
