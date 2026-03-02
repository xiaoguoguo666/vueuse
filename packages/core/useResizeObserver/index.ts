import type { MaybeRefOrGetter } from 'vue'
import type { ConfigurableWindow } from '../_configurable'
import type { Supportable } from '../types'
import type { MaybeComputedElementRef, MaybeElement } from '../unrefElement'
import { tryOnScopeDispose } from '@vueuse/shared'
import { computed, toValue, watch } from 'vue'
import { defaultWindow } from '../_configurable'
import { unrefElement } from '../unrefElement'
import { useSupported } from '../useSupported'

/**
 * @deprecated 此接口现在可在 DOM 库中使用
 * 请使用全局的 {@link globalThis.ResizeObserverSize} 替代
 */
export interface ResizeObserverSize {
  readonly inlineSize: number
  readonly blockSize: number
}

/**
 * @deprecated 此接口现在可在 DOM 库中使用
 * 请使用全局的 {@link globalThis.ResizeObserverEntry} 替代
 */
export interface ResizeObserverEntry {
  readonly target: Element
  readonly contentRect: DOMRectReadOnly
  readonly borderBoxSize: ReadonlyArray<ResizeObserverSize>
  readonly contentBoxSize: ReadonlyArray<ResizeObserverSize>
  readonly devicePixelContentBoxSize: ReadonlyArray<ResizeObserverSize>
}

/**
 * @deprecated 此类型现在可在 DOM 库中使用
 * 请使用全局的 {@link globalThis.ResizeObserverCallback} 替代
 */
export type ResizeObserverCallback = (entries: ReadonlyArray<ResizeObserverEntry>, observer: ResizeObserver) => void

/**
 * useResizeObserver 函数的配置选项接口
 */
export interface UseResizeObserverOptions extends ResizeObserverOptions, ConfigurableWindow {
}

/**
 * useResizeObserver 函数的返回值接口
 */
export interface UseResizeObserverReturn extends Supportable {
  /**
   * 停止监听的函数
   * 调用后会断开 ResizeObserver 的连接并停止监听尺寸变化
   */
  stop: () => void
}

/**
 * 报告元素内容或 border-box 尺寸的变化
 *
 * 使用 ResizeObserver API 监听元素尺寸变化
 * 当元素的尺寸（宽度、高度）发生变化时，会调用回调函数
 *
 * @see https://vueuse.org/useResizeObserver
 * @param target - 要监听的元素（可以是单个元素、元素数组或响应式引用）
 * @param callback - 尺寸变化时的回调函数
 * @param options - 配置选项
 * @returns 包含 isSupported 和 stop 的对象
 *
 * @example
 * ```vue
 * <script setup>
 * const el = ref<HTMLDivElement>()
 *
 * const { stop } = useResizeObserver(el, (entries) => {
 *   for (const entry of entries) {
 *     console.log('Element resized:', entry.contentRect)
 *   }
 * })
 *
 * // 停止监听
 * onUnmounted(() => {
 *   stop()
 * })
 * </script>
 *
 * <template>
 *   <div ref="el" style="width: 100px; height: 100px;">
 *     Resize me
 *   </div>
 * </template>
 * ```
 */
export function useResizeObserver(
  target: MaybeComputedElementRef | MaybeComputedElementRef[] | MaybeRefOrGetter<MaybeElement[]>,
  callback: globalThis.ResizeObserverCallback,
  options: UseResizeObserverOptions = {},
): UseResizeObserverReturn {
  // 解构配置选项，获取 window 对象和 ResizeObserver 的配置
  const { window = defaultWindow, ...observerOptions } = options

  // ResizeObserver 实例
  let observer: ResizeObserver | undefined

  // 检查浏览器是否支持 ResizeObserver API
  const isSupported = useSupported(() => window && 'ResizeObserver' in window)

  /**
   * 清理函数
   * 断开 ResizeObserver 的连接并重置实例
   */
  const cleanup = () => {
    if (observer) {
      observer.disconnect()
      observer = undefined
    }
  }

  /**
   * 解析目标元素
   * 处理单个元素、元素数组和响应式引用的情况
   */
  const targets = computed(() => {
    const _targets = toValue(target)
    return Array.isArray(_targets)
      ? _targets.map(el => unrefElement(el))
      : [unrefElement(_targets)]
  })

  // 监听目标元素的变化，动态注册和移除监听器
  const stopWatch = watch(
    targets,
    (els) => {
      // 先清理之前的监听器
      cleanup()

      // 如果支持 ResizeObserver 且 window 对象存在
      if (isSupported.value && window) {
        // 创建新的 ResizeObserver 实例
        observer = new ResizeObserver(callback)

        // 为每个目标元素注册监听
        for (const _el of els) {
          if (_el)
            observer!.observe(_el, observerOptions)
        }
      }
    },
    // 立即执行一次，并在 DOM 更新后执行
    { immediate: true, flush: 'post' },
  )

  /**
   * 停止监听的函数
   * 清理 ResizeObserver 并停止 watch 监听
   */
  const stop = () => {
    cleanup()
    stopWatch()
  }

  // 在作用域销毁时自动调用 stop 函数
  tryOnScopeDispose(stop)

  // 返回结果
  return {
    isSupported,
    stop,
  }
}
