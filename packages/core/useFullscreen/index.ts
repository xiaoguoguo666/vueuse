// 导入Vue 3的浅层响应式引用类型，用于性能优化
import type { ShallowRef } from 'vue'
// 导入可配置文档对象类型，支持自定义document环境
import type { ConfigurableDocument } from '../_configurable'
// 导入支持性检测接口，用于功能兼容性检查
import type { Supportable } from '../types'
// 导入可能的元素引用类型，支持DOM元素和Vue组件实例
import type { MaybeElementRef } from '../unrefElement'
// 导入生命周期钩子工具，用于组件挂载时执行和作用域清理
import { tryOnMounted, tryOnScopeDispose } from '@vueuse/shared'
// 导入Vue 3核心API：计算属性和浅层响应式引用
import { computed, shallowRef } from 'vue'
// 导入默认文档对象，用于服务端渲染环境兼容
import { defaultDocument } from '../_configurable'
// 导入元素解包工具函数，用于获取DOM元素或组件的$el
import { unrefElement } from '../unrefElement'
// 导入事件监听器组合函数，用于跨浏览器事件处理
import { useEventListener } from '../useEventListener'
// 导入功能支持性检测工具，用于运行时特性检测
import { useSupported } from '../useSupported'

/**
 * 全屏功能配置选项接口
 * 继承自ConfigurableDocument以支持自定义document环境
 */
export interface UseFullscreenOptions extends ConfigurableDocument {
  /**
   * 组件卸载时自动退出全屏模式
   * 用于防止内存泄漏和意外的全屏状态
   * @default false
   */
  autoExit?: boolean
}

/**
 * 全屏功能返回值接口
 * 扩展Supportable接口提供功能支持性检测
 */
export interface UseFullscreenReturn extends Supportable {
  // 响应式的全屏状态标志
  isFullscreen: ShallowRef<boolean>
  // 进入全屏模式的异步方法
  enter: () => Promise<void>
  // 退出全屏模式的异步方法
  exit: () => Promise<void>
  // 切换全屏状态的异步方法
  toggle: () => Promise<void>
}

/**
 * 跨浏览器全屏事件处理器数组
 * 包含标准和各厂商前缀的全屏变更事件
 * 使用双重类型断言绕过TypeScript严格类型检查
 */
const eventHandlers = [
  'fullscreenchange', // 标准全屏变更事件
  'webkitfullscreenchange', // WebKit浏览器全屏变更事件
  'webkitendfullscreen', // WebKit结束全屏事件（iOS Safari）
  'mozfullscreenchange', // Firefox全屏变更事件
  'MSFullscreenChange', // IE/Edge全屏变更事件
] as any as 'fullscreenchange'[]

/**
 * 响应式全屏API Hook
 * 提供跨浏览器的全屏功能控制，支持DOM元素和Vue组件实例
 * 自动处理浏览器兼容性和事件监听
 *
 * @see https://vueuse.org/useFullscreen
 * @param target - 目标元素引用，可以是DOM元素或Vue组件实例
 * @param options - 配置选项对象
 * @returns UseFullscreenReturn - 包含状态和控制方法的对象
 */
export function useFullscreen(
  target?: MaybeElementRef,
  options: UseFullscreenOptions = {},
): UseFullscreenReturn {
  // 解构配置选项，设置默认值
  const {
    document = defaultDocument, // 使用默认文档对象，支持SSR
    autoExit = false, // 默认不自动退出全屏
  } = options

  // 计算目标元素引用，优先使用传入的目标，否则使用文档根元素
  const targetRef = computed(() => unrefElement(target) ?? document?.documentElement)
  // 响应式的全屏状态标志，默认为false
  const isFullscreen = shallowRef(false)

  // 计算可用的全屏请求方法，按浏览器支持度排序
  const requestMethod = computed<'requestFullscreen' | undefined>(() => {
    return [
      'requestFullscreen', // 标准API
      'webkitRequestFullscreen', // WebKit前缀
      'webkitEnterFullscreen', // WebKit移动设备
      'webkitEnterFullScreen', // WebKit另一种写法
      'webkitRequestFullScreen', // WebKit旧版本
      'mozRequestFullScreen', // Firefox
      'msRequestFullscreen', // IE/Edge
    ].find(m => (document && m in document) || (targetRef.value && m in targetRef.value)) as 'requestFullscreen' | undefined
  })

  // 计算可用的全屏退出方法，按浏览器支持度排序
  const exitMethod = computed<'exitFullscreen' | undefined>(() => {
    return [
      'exitFullscreen', // 标准API
      'webkitExitFullscreen', // WebKit前缀
      'webkitExitFullScreen', // WebKit另一种写法
      'webkitCancelFullScreen', // WebKit旧版本
      'mozCancelFullScreen', // Firefox
      'msExitFullscreen', // IE/Edge
    ].find(m => (document && m in document) || (targetRef.value && m in targetRef.value)) as 'exitFullscreen' | undefined
  })

  // 计算全屏状态检测属性，用于检查当前是否处于全屏模式
  const fullscreenEnabled = computed<'fullscreenEnabled' | undefined>(() => {
    return [
      'fullScreen', // 标准属性
      'webkitIsFullScreen', // WebKit前缀
      'webkitDisplayingFullscreen', // WebKit移动设备
      'mozFullScreen', // Firefox
      'msFullscreenElement', // IE/Edge
    ].find(m => (document && m in document) || (targetRef.value && m in targetRef.value)) as 'fullscreenEnabled' | undefined
  })

  // 查找可用的全屏元素检测方法
  const fullscreenElementMethod = [
    'fullscreenElement', // 标准API
    'webkitFullscreenElement', // WebKit前缀
    'mozFullScreenElement', // Firefox
    'msFullscreenElement', // IE/Edge
  ].find(m => (document && m in document)) as 'fullscreenElement' | undefined

  // 检测当前环境是否支持全屏功能
  const isSupported = useSupported(() =>
    targetRef.value // 目标元素存在
    && document // 文档对象存在
    && requestMethod.value !== undefined // 有可用的请求方法
    && exitMethod.value !== undefined // 有可用的退出方法
    && fullscreenEnabled.value !== undefined) // 有可用的状态检测方法

  // 检查当前元素是否为全屏元素
  const isCurrentElementFullScreen = (): boolean => {
    // 如果有全屏元素检测方法且目标元素存在
    if (fullscreenElementMethod)
      return document?.[fullscreenElementMethod] === targetRef.value
    return false
  }

  // 检查元素是否处于全屏状态
  const isElementFullScreen = (): boolean => {
    // 如果有全屏状态检测属性
    if (fullscreenEnabled.value) {
      // 优先检查文档级别的全屏状态
      if (document && document[fullscreenEnabled.value] != null) {
        return document[fullscreenEnabled.value]
      }
      else {
        // 回退到检查目标元素的全屏状态（WebKit/iOS Safari）
        const target = targetRef.value
        // @ts-expect-error - Fallback for WebKit and iOS Safari browsers
        if (target?.[fullscreenEnabled.value] != null) {
          // @ts-expect-error - Fallback for WebKit and iOS Safari browsers
          return Boolean(target[fullscreenEnabled.value])
        }
      }
    }
    return false
  }

  // 异步退出全屏模式
  async function exit() {
    // 如果不支持全屏功能或当前未处于全屏状态，则直接返回
    if (!isSupported.value || !isFullscreen.value)
      return
    // 如果有可用的退出方法
    if (exitMethod.value) {
      // 优先尝试文档级别的退出方法
      if (document?.[exitMethod.value] != null) {
        await document[exitMethod.value]()
      }
      else {
        // 回退到目标元素的退出方法（Safari iOS）
        const target = targetRef.value
        // @ts-expect-error - Fallback for Safari iOS
        if (target?.[exitMethod.value] != null)
          // @ts-expect-error - Fallback for Safari iOS
          await target[exitMethod.value]()
      }
    }

    // 更新全屏状态为false
    isFullscreen.value = false
  }

  // 异步进入全屏模式
  async function enter() {
    // 如果不支持全屏功能或当前已处于全屏状态，则直接返回
    if (!isSupported.value || isFullscreen.value)
      return

    // 如果当前元素已经是全屏状态，先退出再重新进入
    if (isElementFullScreen())
      await exit()

    // 获取目标元素并调用全屏请求方法
    const target = targetRef.value
    if (requestMethod.value && target?.[requestMethod.value] != null) {
      await target[requestMethod.value]()
      // 成功进入全屏后更新状态
      isFullscreen.value = true
    }
  }

  // 异步切换全屏状态
  async function toggle() {
    // 根据当前状态选择进入或退出全屏
    await (isFullscreen.value ? exit() : enter())
  }

  // 全屏状态变更事件处理器
  const handlerCallback = () => {
    // 获取当前元素的全屏状态
    const isElementFullScreenValue = isElementFullScreen()
    // 如果不是全屏状态，或者虽然是全屏状态但确实是当前元素的全屏
    if (!isElementFullScreenValue || (isElementFullScreenValue && isCurrentElementFullScreen()))
      // 更新响应式状态
      isFullscreen.value = isElementFullScreenValue
  }

  // 事件监听器配置选项
  const listenerOptions = { capture: false, passive: true }
  // 为文档添加全屏事件监听器
  useEventListener(document, eventHandlers, handlerCallback, listenerOptions)
  // 为目标元素添加全屏事件监听器
  useEventListener(() => unrefElement(targetRef), eventHandlers, handlerCallback, listenerOptions)

  // 组件挂载时执行一次状态检查
  tryOnMounted(handlerCallback, false)

  // 如果启用了自动退出功能，在作用域销毁时退出全屏
  if (autoExit)
    tryOnScopeDispose(exit)

  // 返回公共API接口
  return {
    isSupported, // 功能支持性检测结果
    isFullscreen, // 响应式的全屏状态
    enter, // 进入全屏方法
    exit, // 退出全屏方法
    toggle, // 切换全屏方法
  }
}
