/* this implementation is original ported from https://github.com/logaretm/vue-use-web by Abdelrahman Awad */

import type { Ref } from 'vue'
import type { ConfigurableWindow } from '../_configurable'
import { objectEntries } from '@vueuse/shared'
import { ref as deepRef, reactive, watch } from 'vue'
import { defaultWindow } from '../_configurable'
import { useEventListener } from '../useEventListener'

/**
 * 可以通过赋值修改的 URL 属性列表
 * 这些属性可以通过直接赋值的方式修改浏览器地址栏
 */
const WRITABLE_PROPERTIES = [
  'hash',
  'host',
  'hostname',
  'href',
  'pathname',
  'port',
  'protocol',
  'search',
] as const

/**
 * useBrowserLocation 函数的配置选项接口
 */
export interface UseBrowserLocationOptions extends ConfigurableWindow {
}

/**
 * 浏览器位置状态的类型定义
 * 包含 URL 的所有可读写属性以及历史记录信息
 */
export interface BrowserLocationState {
  /**
   * 触发状态更新的事件类型
   * 可能的值：'load'（页面加载）、'popstate'（浏览器前进后退）、'hashchange'（哈希变化）
   */
  readonly trigger: string

  /**
   * 当前历史记录条目的 state 对象
   * 通过 history.pushState() 或 history.replaceState() 设置
   */
  readonly state?: any

  /**
   * 浏览器历史记录的总条数
   */
  readonly length?: number

  /**
   * 当前页面的协议加主机名加端口号（不含路径和查询参数）
   * 例如：https://example.com:8080
   */
  readonly origin?: string

  /**
   * URL 的哈希部分（包括 # 号）
   * 例如：#section1
   */
  hash?: string

  /**
   * URL 的主机名和端口号
   * 例如：example.com:8080
   */
  host?: string

  /**
   * URL 的主机名（不含端口号）
   * 例如：example.com
   */
  hostname?: string

  /**
   * 完整的 URL 地址
   * 例如：https://example.com:8080/path?query=1#section1
   */
  href?: string

  /**
   * URL 的路径部分（包括前导斜杠）
   * 例如：/path
   */
  pathname?: string

  /**
   * URL 的端口号
   * 例如：8080
   */
  port?: string

  /**
   * URL 的协议部分（包括冒号）
   * 例如：https:
   */
  protocol?: string

  /**
   * URL 的查询参数部分（包括问号）
   * 例如：?query=1&foo=bar
   */
  search?: string
}

/**
 * useBrowserLocation 函数的返回值类型
 * 返回一个响应式的 BrowserLocationState 引用
 */
export type UseBrowserLocationReturn = Ref<BrowserLocationState>

/**
 * 响应式浏览器位置信息
 *
 * 提供对浏览器 location 对象的响应式访问和修改能力
 * 支持监听 popstate、hashchange 事件，自动更新状态
 * 可以通过修改返回对象的属性来改变 URL（不会触发页面刷新）
 *
 * @see https://vueuse.org/useBrowserLocation
 * @param options - 配置选项，可指定 window 对象
 * @returns 响应式的 BrowserLocationState 引用
 *
 * @__NO_SIDE_EFFECTS__
 */
export function useBrowserLocation(options: UseBrowserLocationOptions = {}): UseBrowserLocationReturn {
  // 解构配置选项，获取 window 对象
  const { window = defaultWindow } = options

  // 为每个可写属性创建响应式引用
  // 使用 Object.fromEntries 将属性数组转换为对象
  const refs = Object.fromEntries(
    WRITABLE_PROPERTIES.map(key => [key, deepRef()]),
  ) as Record<typeof WRITABLE_PROPERTIES[number], Ref<string | undefined>>

  // 为每个属性设置监听器，当属性值变化时同步到 window.location
  for (const [key, ref] of objectEntries(refs)) {
    watch(ref, (value) => {
      // 如果 window 或 location 不存在，或新值与当前值相同，则跳过
      if (!window?.location || window.location[key] === value)
        return
      // 将新值写入 location 对应属性，触发 URL 更新
      window.location[key] = value!
    })
  }

  /**
   * 构建 BrowserLocationState 对象
   * @param trigger - 触发更新的事件类型
   * @returns 包含当前 URL 状态和历史记录信息的对象
   */
  const buildState = (trigger: string): BrowserLocationState => {
    // 从 history 对象获取 state 和 length
    const { state, length } = window?.history || {}
    // 从 location 对象获取 origin
    const { origin } = window?.location || {}

    // 更新所有可写属性的响应式引用值
    for (const key of WRITABLE_PROPERTIES)
      refs[key].value = window?.location?.[key]

    // 返回一个响应式的对象，包含所有属性
    return reactive({
      trigger,
      state,
      length,
      origin,
      ...refs,
    })
  }

  // 初始化状态，触发类型为 'load'
  const state = deepRef<BrowserLocationState>(buildState('load'))

  // 监听浏览器导航事件
  if (window) {
    const listenerOptions = { passive: true }

    // 监听 popstate 事件（浏览器前进/后退按钮）
    useEventListener(window, 'popstate', () => state.value = buildState('popstate'), listenerOptions)

    // 监听 hashchange 事件（URL 哈希部分变化）
    useEventListener(window, 'hashchange', () => state.value = buildState('hashchange'), listenerOptions)
  }

  // 返回响应式状态引用
  return state
}
