import { Context, h, Schema, Time } from 'koishi'

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
  在本地化中可以编辑问候语，按时段从三句中随机一句`;

export const inject = {
  required: ['database'],
  optional: [],
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
  outputLogs: boolean
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
  outputLogs: Schema.boolean().default(true)
}).i18n({
  'zh-CN': require('./locales/zh-CN'),
})

function mathRandomInt(a: number, b: number) {
  if (a > b) {      // Swap a and b to ensure a is smaller.
    var c = a; a = b; b = c;
  } return Math.floor(Math.random() * (b - a + 1) + a);
}
async function isTargetIdExists(ctx: Context, USERID: string) {
  //检查数据表中是否有指定id者
  const targetInfo = await ctx.database.get('p_system', { userid: USERID });
  return targetInfo.length == 0;
}
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

export async function apply(ctx: Context, cfg: Config) {
  ctx.model.extend('p_system', {
    id: 'unsigned',
    userid: 'string',
    time: 'timestamp',
    usersname: 'string',
    p: 'integer',
    favorability: 'integer'
  }, { autoInc: true })

  if(cfg.entry_to_channel)
  {
    ctx.model.extend('p_graze', {
      id: 'unsigned',
      channelid: 'string',
      bullet: 'integer',
      p: 'integer',
      users: 'string'
    }, { autoInc: true })
  }

  const logger = ctx.logger("p-签到")
  ctx.i18n.define('zh-CN', require('./locales/zh-CN'))

  ctx.command('p/p-sign').alias('签到').action(async ({ session }) => {
    if ((session.userId) == null) return session.text('.sign-failed');
    const USERNAME = session.username; //发送者的用户名
    const USERID = session.userId;     //发送者的用户id
    const notExists = await isTargetIdExists(ctx, USERID); //该群中的该用户是否签到过
    if (notExists) {
      await ctx.database.create('p_system', { userid: USERID, usersname: USERNAME, p: cfg.init_p,  favorability: 0,time: new Date() })
      await session.sendQueued(session.text('.new-user', [cfg.init_p]));
    }
    await ctx.database.set('p_system', { userid: USERID }, { usersname: USERNAME })//更新用户名

    const usersdata = await ctx.database.get('p_system', { userid: USERID });
    const saving = usersdata[0].p;

    let oldDate: string;
    if (usersdata[0]?.time) oldDate = Time.template('yyyy-MM-dd', usersdata[0].time);
    const newDate = Time.template('yyyy-MM-dd', new Date());

    let bonus = Number(mathRandomInt(cfg.lower_limit, cfg.upper_limit));

    if (cfg.adminUsers.includes(USERID) || newDate != oldDate || notExists) //管理员||新日期||新用户
    {
      await ctx.database.set('p_system', { userid: USERID }, { time: new Date() }) //更新签到时间
      await ctx.database.set('p_system', { userid: USERID }, { p: Number(saving + bonus) }) //更新余额
      const new_usersdata = await ctx.database.get('p_system', { userid: USERID });

      if (new_usersdata[0]?.p > cfg.limit_p && cfg.boom_chance)
      {
        const explodeProbability = cfg.boom_chance; // 概率触发存爆
        const shouldExplode = Math.random() < explodeProbability;

        if (shouldExplode) {
          const CHANNELID = session.channelId;
          const explodeRange = [cfg.boom_lower_limit, cfg.boom_upper_limit];
          const explodeAmount = Math.floor(new_usersdata[0].p * (explodeRange[0] + (explodeRange[1] - explodeRange[0]) * Math.random()));
          const newBalance = cfg.limit_p - explodeAmount;
          await ctx.database.set('p_system', { userid: USERID }, { p: newBalance });
          let result = `${h('at', { id: USERID })}.\n${session.text('.sign-succeed', [bonus])}\n${session.text('.explode-warning', [explodeAmount])}\n`
          if(cfg.entry_to_channel)
          {
            await ctx.database.set('p_graze', { channelid: CHANNELID }, { p: explodeAmount })
            result += `${session.text('.entry_to_channel')}`
          }
          await session.sendQueued(result);
        } else {
          await ctx.database.set('p_system', { userid: USERID }, { p: cfg.limit_p })
          await session.sendQueued(`${h('at', { id: USERID })}.\n${session.text('.sign-succeed', [bonus])}\n${session.text('.balance-show', [cfg.limit_p])}`);
        }
      }
      else
        await session.sendQueued(`${h('at', { id: USERID })}.\n${session.text('.sign-succeed', [bonus])}\n${session.text('.balance-show', [new_usersdata[0].p])}`);

      await ctx.database.set('p_system', { userid: USERID }, { favorability: usersdata[0].favorability + 1 });//增加好感

      if (saving >= cfg.limit_p) return session.text('.exceeding-limit', [cfg.limit_p]);

      const hour = Number((Time.template('hh', new Date())));
      const x = mathRandomInt(0, 2);
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
      ];

      let url = '.greating-';
      const currentRange = timeRanges.find(range => hour >= range.start && hour < range.end);
      url += currentRange.label + '.' + x;

      await session.send(session.text(url));
      if (cfg.outputLogs) logger.success(USERID + USERNAME + '完成了一次签到！');
    }
    else {
      await session.sendQueued(h('at', { id: USERID }) + session.text('.already-signed'));
      if (cfg.outputLogs) logger.info(USERID + USERNAME + '该用户已经签到');
    }
  });

  ctx.command('p/p-query').alias('查询p点', 'p点查询').action(async ({ session }) => {
    const USERID = session.userId;//发送者的用户id
    const notExists = await isTargetIdExists(ctx, USERID); //该群中的该用户是否签到过
    if (notExists) return session.text('.account-notExists');
    const usersdata = await ctx.database.get('p_system', { userid: USERID });
    const saving = usersdata[0]?.p;
    await session.sendQueued(session.text('.result', [saving]));
  });

  ctx.command('p/p-transfer [target] [value:number]').alias('转账').action(async ({ session }, target, value) => {
    if ((target) == null) { return '“转账 @对方 转账额度”'; }
    const USERID = session.userId;//发送者的用户id
    const notExists = await isTargetIdExists(ctx, USERID); //用户是否签到过
    if (notExists) return session.text('.account-notExists');
    const usersdata = await ctx.database.get('p_system', { userid: USERID });
    var targetid = target;
    const p = Number(value);
    let text = session.elements.filter((element) => element.type == 'at');
    let regex = /\b([1-9]\d{6,})\b/;
    let match = regex.exec(String(target));
    if (!(text.length === 0) || !match) {
      if (!match) return session.text('.no-id');
      targetid = String(text.map(element => element.attrs.id)); // 提取 @ 元素的 id
    }

    const targetNotExists = await isTargetIdExists(ctx, targetid); //目标用户是否签到过
    if (targetNotExists) return session.text('.target-notExists');
    const targetData = await ctx.database.get('p_system', { userid: targetid });
    if (USERID == targetid) return session.text('.self-target');
    if (!(p > 0) && !cfg.adminUsers.includes(USERID)) return session.text('.wrong-value'); //管理员可转负数
    if (usersdata[0].p < p) return session.text('.no-enough-p');

    // 更新发送者和接收者的余额
    await ctx.database.set('p_system', { userid: USERID }, { p: usersdata[0].p - p });
    await ctx.database.set('p_system', { userid: targetid }, { p: targetData[0].p + p });

    const senderBalance = (await ctx.database.get('p_system', { userid: USERID }))[0].p;
    const receiverBalance = (await ctx.database.get('p_system', { userid: targetid }))[0].p;

    return `${session.text('.transfer-succeed')}\n.${session.text('.result', [targetid,receiverBalance])}\n.${session.text('.result', [USERID,senderBalance])}`;
  });
}
