import type { ShallowRef } from 'vue'
import type { ConfigurableDocumentOrShadowRoot, ConfigurableWindow } from '../_configurable'
import { shallowRef } from 'vue'
import { defaultWindow } from '../_configurable'
import { onElementRemoval } from '../onElementRemoval'
import { useEventListener } from '../useEventListener'

/**
 * useActiveElement 函数的配置选项接口
 */
export interface UseActiveElementOptions extends ConfigurableWindow, ConfigurableDocumentOrShadowRoot {
  /**
   * 是否深入查询 Shadow DOM 中的活动元素
   * 当启用时，会递归查询 Shadow DOM 树中的 activeElement
   * 例如：在 Web Component 中获取实际获得焦点的元素
   * @default true
   */
  deep?: boolean

  /**
   * 当活动元素从 DOM 中移除时是否继续追踪
   * 使用 MutationObserver 监听元素移除事件
   * 当元素被移除时会触发回调更新状态
   * @default false
   */
  triggerOnRemoval?: boolean
}

/**
 * useActiveElement 函数的返回值类型
 * @template T - HTMLElement 的子类型，默认为 HTMLElement
 */
export type UseActiveElementReturn<T extends HTMLElement = HTMLElement> = ShallowRef<T | null | undefined>

/**
 * 响应式 document.activeElement
 *
 * 提供对当前文档中获得焦点元素的响应式访问
 * 支持 Shadow DOM 查询和元素移除追踪
 *
 * @see https://vueuse.org/useActiveElement
 * @param options - 配置选项
 * @returns 响应式的活动元素引用，当没有活动元素时为 null
 *
 * @__NO_SIDE_EFFECTS__
 */
export function useActiveElement<T extends HTMLElement>(
  options: UseActiveElementOptions = {},
): UseActiveElementReturn<T> {
  // 解构配置选项
  const {
    window = defaultWindow,
    deep = true,
    triggerOnRemoval = false,
  } = options

  // 获取 document 对象，优先使用 options.document，否则从 window 获取
  const document = options.document ?? window?.document

  /**
   * 获取深度活动元素
   * 如果启用了 deep 选项，会递归查询 Shadow DOM 中的活动元素
   * @returns 当前的活动元素，如果不存在则返回 null
   */
  const getDeepActiveElement = () => {
    let element = document?.activeElement
    if (deep) {
      // 递归查询 Shadow DOM 中的活动元素
      while (element?.shadowRoot)
        element = element?.shadowRoot?.activeElement
    }
    return element
  }

  // 存储当前活动元素的响应式引用
  const activeElement = shallowRef<T | null | undefined>()

  /**
   * 触发器函数
   * 更新 activeElement 的值为当前的活动元素
   */
  const trigger = () => {
    activeElement.value = getDeepActiveElement() as T | null | undefined
  }

  // 如果 window 对象存在，则监听焦点事件
  if (window) {
    const listenerOptions = {
      capture: true,
      passive: true,
    }

    // 监听 blur 事件（元素失去焦点）
    // 只有当 relatedTarget 为 null 时才触发（表示窗口失去焦点而非切换到其他元素）
    //     ### 核心逻辑
    // event.relatedTarget 表示焦点转移的目标元素：

    // 1. event.relatedTarget !== null ：表示焦点从当前窗口转移到了页面上的其他元素（例如点击了另一个输入框）

    //    - 此时直接返回，不触发 trigger()
    //    - 因为 focus 事件会处理新获得焦点的元素
    // 2. event.relatedTarget === null ：表示焦点从窗口移出（例如切换到其他应用、点击了浏览器其他区域）

    //    - 此时调用 trigger() 更新活动元素状态
    //    - 因为此时没有活动元素（ document.activeElement 会变为 body 或 null ）
    // ### 为什么需要这个判断？
    // - blur 事件在窗口级别触发时，可能是：

    //   - 焦点转移到页面内其他元素（由 focus 事件处理）
    //   - 窗口完全失去焦点（需要更新为无活动元素状态）
    // - 通过检查 relatedTarget 可以区分这两种情况，避免重复触发或状态错误
    useEventListener(
      window,
      'blur',
      (event) => {
        if (event.relatedTarget !== null)
          return
        trigger()
      },
      listenerOptions,
    )

    // 监听 focus 事件（元素获得焦点）
    useEventListener(
      window,
      'focus',
      trigger,
      listenerOptions,
    )
  }

  // 如果启用了 triggerOnRemoval 选项，则监听元素移除事件
  if (triggerOnRemoval) {
    onElementRemoval(activeElement, trigger, { document })
  }

  // 初始化时立即触发一次，获取初始的活动元素
  trigger()

  // 返回活动元素的响应式引用
  return activeElement
}
