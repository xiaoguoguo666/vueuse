import type { ShallowRef } from 'vue'
import type { MaybeComputedElementRef } from '../unrefElement'
import type { UseResizeObserverOptions } from '../useResizeObserver'
import { toArray, tryOnMounted } from '@vueuse/shared'
import { computed, shallowRef, watch } from 'vue'
import { defaultWindow } from '../_configurable'
import { unrefElement } from '../unrefElement'
import { useResizeObserver } from '../useResizeObserver'

/**
 * 元素尺寸类型定义
 */
export interface ElementSize {
  width: number
  height: number
}

/**
 * useElementSize 函数的配置选项接口
 * 继承自 useResizeObserver 的配置选项
 */
export interface UseElementSizeOptions extends UseResizeObserverOptions {
}

/**
 * useElementSize 函数的返回值接口
 */
export interface UseElementSizeReturn {
  /**
   * 元素宽度，响应式引用
   */
  width: ShallowRef<number>
  /**
   * 元素高度，响应式引用
   */
  height: ShallowRef<number>
  /**
   * 停止监听的函数
   */
  stop: () => void
}

/**
 * 响应式 HTML 元素尺寸
 *
 * 使用 ResizeObserver 监听元素尺寸变化，提供响应式的 width 和 height
 * 支持普通 HTML 元素和 SVG 元素
 *
 * @see https://vueuse.org/useElementSize
 * @param target - 要监听的元素（可以是单个元素或响应式引用）
 * @param initialSize - 初始尺寸，默认 { width: 0, height: 0 }
 * @param options - 配置选项，继承自 useResizeObserver
 * @returns 包含 width、height 和 stop 的对象
 *
 * @example
 * ```vue
 * <script setup>
 * const el = ref<HTMLDivElement>()
 * const { width, height } = useElementSize(el)
 *
 * watch([width, height], ([newWidth, newHeight]) => {
 *   console.log('Element size changed:', newWidth, newHeight)
 * })
 * </script>
 *
 * <template>
 *   <div ref="el">
 *     Size: {{ width }} x {{ height }}
 *   </div>
 * </template>
 * ```
 */
export function useElementSize(
  target: MaybeComputedElementRef,
  initialSize: ElementSize = { width: 0, height: 0 },
  options: UseElementSizeOptions = {},
): UseElementSizeReturn {
  // 解构配置选项，获取 window 对象和 box 类型
  const { window = defaultWindow, box = 'content-box' } = options

  // 判断目标元素是否是 SVG 元素
  const isSVG = computed(() => unrefElement(target)?.namespaceURI?.includes('svg'))

  // 初始化宽度和高度的响应式引用
  const width = shallowRef(initialSize.width)
  const height = shallowRef(initialSize.height)

  // 使用 useResizeObserver 监听元素尺寸变化
  const { stop: stop1 } = useResizeObserver(
    target,
    ([entry]) => {
      // 根据 box 选项选择要使用的尺寸信息
      const boxSize = box === 'border-box'
        ? entry.borderBoxSize
        : box === 'content-box'
          ? entry.contentBoxSize
          : entry.devicePixelContentBoxSize

      // 如果是 SVG 元素，使用 getBoundingClientRect 获取尺寸
      if (window && isSVG.value) {
        const $elem = unrefElement(target)
        if ($elem) {
          const rect = $elem.getBoundingClientRect()
          width.value = rect.width
          height.value = rect.height
        }
      }
      // 普通 HTML 元素，使用 ResizeObserver 提供的尺寸信息
      else {
        if (boxSize) {
          // 将 boxSize 转换为数组（兼容不同浏览器），累加计算宽度和高度
          // 理论上，在复杂布局中（如多列文本）
          // 一个元素的框可能被分割成多个片段
          const formatBoxSize = toArray(boxSize)
          width.value = formatBoxSize.reduce((acc, { inlineSize }) => acc + inlineSize, 0)
          height.value = formatBoxSize.reduce((acc, { blockSize }) => acc + blockSize, 0)
        }
        else {
          // 降级方案：使用 contentRect
          width.value = entry.contentRect.width
          height.value = entry.contentRect.height
        }
      }
    },
    options,
  )

  // 在组件挂载后，获取元素的初始尺寸
  tryOnMounted(() => {
    const ele = unrefElement(target)
    if (ele) {
      // 优先使用 offsetWidth/offsetHeight
      width.value = 'offsetWidth' in ele ? ele.offsetWidth : initialSize.width
      height.value = 'offsetHeight' in ele ? ele.offsetHeight : initialSize.height
    }
  })

  // 监听目标元素的变化，重置尺寸
  //   目标元素变化
  //     ↓
  // stop2 的 watch 回调 → 重置 width/height 为初始值
  //     ↓
  // stop1 的 watch 回调 → 清理旧 ResizeObserver，创建新的并监听新元素
  //     ↓
  // ResizeObserver 回调 → 计算新尺寸并更新 width/height
  const stop2 = watch(
    () => unrefElement(target),
    (ele) => {
      width.value = ele ? initialSize.width : 0
      height.value = ele ? initialSize.height : 0
    },
  )

  /**
   * 停止监听的函数
   * 同时停止 useResizeObserver 和 watch 监听
   */
  function stop() {
    stop1()
    stop2()
  }

  // 返回结果
  return {
    width,
    height,
    stop,
  }
}
