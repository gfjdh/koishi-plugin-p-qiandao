# koishi-plugin-p-qiandao

[![npm](https://img.shields.io/npm/v/koishi-plugin-p-qiandao?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-p-qiandao) [![MIT License](https://img.shields.io/badge/license-MIT-blue.svg?style=flat)](http://choosealicense.com/licenses/mit/) ![Language](https://img.shields.io/badge/language-TypeScript-brightgreen) ![Static Badge](https://img.shields.io/badge/QQ交流群-2167028216-green)

东方风签到系统插件，提供P点管理、社交互动与风险机制，建议配合 [p-graze](https://github.com/gfjdh/p-graze) 擦弹插件，[satori-ai](https://github.com/gfidh/satori-ai) ai插件使用

---

## 功能特性

- **每日签到**：随机奖励与风险机制并存
- **P点经济**：支持用户间转账与税收系统
- **动态问候**：分时段随机发送特色问候语
- **风控机制**：超额P点自动触发爆炸事件
- **多群适配**：支持跨群组独立数据存储

---

## 安装指南

```bash
# 通过 npm 安装
npm install koishi-plugin-p-qiandao
```

```yaml
# koishi.yml 配置示例
plugins:
  p-qiandao:
    adminUsers:
      - '123456789'        # 管理员用户ID
    init_p: 1000           # 新用户初始P点
    limit_p: 50000         # P点安全阈值
    upper_limit: 3000      # 单日签到上限
    lower_limit: 500       # 单日签到下限
    boom_chance: 0.15      # 爆炸触发概率
    taxRate: 0.05          # 转账手续费率
    signOffset: 480        # 时区偏移（分钟）
```

---

## 指令说明

### 每日签到 `p-sign`
- **别名**：签到
- **说明**：
  每日获取随机P点，管理员无限签到。当P点超过安全阈值时，有概率触发爆炸事件。(个性化文本请在本地化修改)
- **示例**：
  ```bash
  签到
  > [灵梦] 签到成功！获得 1688 P点
  > 当前余额：12688 P点
  > ✨凌晨的守矢神社弥漫着神秘气息...
  ```
  ```bash
  签到
  > [魔理沙] 签到成功！获得 2433 P点
  > 💥检测到灵力过载！损失 11200 P点
  > 违规P点已注入群奖金池
  ```

### P点查询 `p-query`
- **别名**：查询p点、p点查询
- **说明**：
  实时查看当前P点余额
- **示例**：
  ```bash
  查询p点
  > 当前P点余额：8844
  ```

### 社交转账 `p-transfer`
- **别名**：转账
- **参数**：
  - `target`：@用户 或 QQ号
  - `value:number`：转账金额（管理员可输入负数）
- **选项**：
  - 自动扣除 `taxRate` 比例手续费（需配置启用）
- **示例**：
  ```bash
  转账 @早苗 2000
  > 转账成功！
  > 早苗 当前余额：13440
  > 灵梦 当前余额：6844
  > 已扣除手续费：100 P点
  ```

---

## 核心机制

### 签到系统
1. **基础奖励**：每日随机获得 `[lower_limit, upper_limit]` 范围P点
2. **超额风险**：当 `P点 > limit_p` 时：
   - 触发概率：`boom_chance`
   - 损失计算：`当前P点 × [boom_lower_limit, boom_upper_limit]` 随机比例
   - 风控处理：余额重置为 `limit_p - 损失值`
3. **数据同步**：爆炸损失值会自动注入群组擦弹奖金池（需启用 `entry_to_channel`）

### 转账系统
- **基础规则**：
  - 普通用户只能转账正整数
  - 管理员可转账负数（制裁功能）
- **税收机制**：
  ```math
  实际到账 = 转账金额 × (1 - taxRate)
  ```
- **限制条件**：
  - 余额不足时转账失败
  - 不可向自己转账

### 时间系统
- **每日重置**：基于 `signOffset` 配置时区偏移
- **时段问候**：
  ```
  23-2点：夜巡的妖精低声吟唱...
  6-8点 ：晨露在博丽神社闪烁...
  19-21点：宴会前的准备时间到啦！
  ```

---

## 高级配置

| 参数 | 类型 | 说明 |
|------|------|------|
| `enable_greatting` | boolean | 启用分时段问候语 |
| `boom_upper_limit` | 0-1 | 爆炸损失上限比例 |
| `boom_lower_limit` | 0-1 | 爆炸损失下限比例 |
| `taxEnabled` | boolean | 启用转账手续费 |

---

## 注意事项

1. 需配合数据库使用
2. 新用户首次签到自动创建账户
3. 管理员特权：
   - 无视每日签到限制
   - 可进行负数转账
   - 绕过P点查询限制
4. 问候语支持通过本地化文件自定义

---

## 联动建议

1. 配合 `p-graze` 实现P点消费场景
2. 通过 `favorability-list` 配合ai好感度
3. 使用 `adminUsers` 配置维护社区经济平衡

---

## 问题反馈
如有问题请提交 Issue 至 [GitHub仓库](https://github.com/gfjdh/koishi-plugin-p-qiandao)

---

> "幻想乡的経済システムも完璧ですわ！" —— 十六夜咲夜
