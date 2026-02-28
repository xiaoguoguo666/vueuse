import type { TimerHandle } from '@vueuse/shared'
import type { MaybeRefOrGetter, ShallowRef } from 'vue'
import type { ConfigurableWindow } from '../_configurable'
import type { MaybeComputedElementRef } from '../unrefElement'
import { computed, shallowRef } from 'vue'
import { defaultWindow } from '../_configurable'
import { onElementRemoval } from '../onElementRemoval'
import { unrefElement } from '../unrefElement'
import { useEventListener } from '../useEventListener'

/**
 * useElementHover 函数的配置选项接口
 */
export interface UseElementHoverOptions extends ConfigurableWindow {
  /**
   * 鼠标进入元素后延迟设置 hovered 状态的时间（毫秒）
   * 用于防抖处理，避免快速移动鼠标时状态频繁切换
   * @default 0
   */
  delayEnter?: number

  /**
   * 鼠标离开元素后延迟设置 hovered 状态的时间（毫秒）
   * 用于防抖处理，避免快速移动鼠标时状态频繁切换
   * @default 0
   */
  delayLeave?: number

  /**
   * 当元素从 DOM 中移除时是否触发状态更新
   * 使用 MutationObserver 监听元素移除事件
   * @default false
   */
  triggerOnRemoval?: boolean
}

/**
 * 响应式元素悬停状态
 *
 * 提供对元素是否被鼠标悬停的响应式追踪
 * 支持延迟设置和元素移除监听
 *
 * @param el - 要监听的元素引用（可以是 Ref、getter 或直接的 DOM 元素）
 * @param options - 配置选项
 * @returns 响应式的布尔值，表示元素是否处于悬停状态
 */
export function useElementHover(el: MaybeRefOrGetter<EventTarget | null | undefined>, options: UseElementHoverOptions = {}): ShallowRef<boolean> {
  // 解构配置选项
  const {
    delayEnter = 0,
    delayLeave = 0,
    triggerOnRemoval = false,
    window = defaultWindow,
  } = options

  // 存储元素是否被悬停的响应式引用
  const isHovered = shallowRef(false)

  // 定时器句柄，用于延迟设置状态
  let timer: TimerHandle

  /**
   * 切换悬停状态
   * @param entering - 是否进入悬停状态（true 表示进入，false 表示离开）
   */
  const toggle = (entering: boolean) => {
    // 根据状态选择对应的延迟时间
    const delay = entering ? delayEnter : delayLeave

    // 如果存在未执行的定时器，先清除
    if (timer) {
      clearTimeout(timer)
      timer = undefined
    }

    // 如果设置了延迟时间，则使用 setTimeout 延迟设置状态
    if (delay)
      timer = setTimeout(() => isHovered.value = entering, delay)
    else
      // 否则立即设置状态
      isHovered.value = entering
  }

  // 如果 window 对象不存在，直接返回初始状态
  if (!window)
    return isHovered

  // 监听 mouseenter 事件（鼠标进入元素）
  useEventListener(el, 'mouseenter', () => toggle(true), { passive: true })

  // 监听 mouseleave 事件（鼠标离开元素）
  useEventListener(el, 'mouseleave', () => toggle(false), { passive: true })

  // 如果启用了 triggerOnRemoval 选项，则监听元素移除事件
  if (triggerOnRemoval) {
    onElementRemoval(
      computed(() => unrefElement(el as MaybeComputedElementRef)),
      () => toggle(false),
    )
  }

  // 返回悬停状态的响应式引用
  return isHovered
}
