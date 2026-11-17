import { Context, h } from 'koishi'
import type {} from 'koishi-plugin-puppeteer'
import { PAGE_URL } from './common'

// 截图默认是 2000×1280 的无损 PNG（约 1.8MB），直接用 Chromium 编成 JPEG（约 270KB），
// 省掉 sharp 这类原生依赖，服务器不需要额外安装。
const JPEG_QUALITY = 85

export class Renderer {
  private queue: Promise<unknown> = Promise.resolve()
  private warned = false

  constructor(private ctx: Context) {}

  get available() {
    return !!this.ctx.puppeteer
  }

  /** 串行渲染，避免多个命令同时抢占 Chromium。失败时返回 null，由调用方降级为文字。 */
  render(html: string): Promise<string | null> {
    const task = this.queue.then(
      () => this.doRender(html),
      () => this.doRender(html),
    )
    this.queue = task.catch(() => undefined)
    return task
  }

  private async doRender(html: string): Promise<string | null> {
    if (!this.ctx.puppeteer) {
      if (!this.warned) {
        this.warned = true
        this.ctx.logger('p-qiandao').warn('未安装 koishi-plugin-puppeteer，无法生成图片，已降级为文字。')
      }
      return null
    }
    let page
    try {
      page = await this.ctx.puppeteer.page()
      await page.goto(PAGE_URL)
      await page.setContent(html)
      await page.evaluate(() => document.fonts.ready)
      const body = await page.$('body')
      const clip = await body?.boundingBox()
      const buffer = await page.screenshot({ clip: clip || undefined, type: 'jpeg', quality: JPEG_QUALITY })
      return h.image(buffer, 'image/jpeg').toString()
    } catch (error) {
      this.ctx.logger('p-qiandao').warn('图片渲染失败，已降级为文字：', error)
      return null
    } finally {
      await page?.close().catch(() => undefined)
    }
  }
}
