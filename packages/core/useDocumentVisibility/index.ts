import type { ShallowRef } from 'vue'
import type { ConfigurableDocument } from '../_configurable'
import { shallowRef } from 'vue'
import { defaultDocument } from '../_configurable'
import { useEventListener } from '../useEventListener'

export interface UseDocumentVisibilityOptions extends ConfigurableDocument {
}

export type UseDocumentVisibilityReturn = ShallowRef<DocumentVisibilityState>

/**
 * Reactively track `document.visibilityState`.
 *
 * @see https://vueuse.org/useDocumentVisibility
 *
 * @__NO_SIDE_EFFECTS__
 */
/**
 * 响应式地跟踪文档可见性状态
 *
 * 监听 document 的 visibilitychange 事件，实时获取文档的可见性状态
 *
 * @param options 配置选项
 * @returns 响应式的文档可见性状态引用
 *
 * @example
 * ```ts
 * const visibility = useDocumentVisibility()
 *
 * watch(visibility, (newVisibility) => {
 *   if (newVisibility === 'hidden') {
 *     // 文档不可见（标签页切换、最小化等）
 *   } else {
 *     // 文档可见
 *   }
 * })
 * ```
 */
export function useDocumentVisibility(options: UseDocumentVisibilityOptions = {}): UseDocumentVisibilityReturn {
  // 解构配置选项，默认使用 defaultDocument
  const { document = defaultDocument } = options

  // 如果没有 document 对象（如 SSR 环境），返回默认的 'visible' 状态
  if (!document)
    return shallowRef<DocumentVisibilityState>('visible')

  // 创建浅层响应式引用，存储当前文档可见性状态
  // 使用 shallowRef 提高性能，因为 DocumentVisibilityState 是简单字符串类型
  const visibility = shallowRef(document.visibilityState)

  // 添加 visibilitychange 事件监听器
  // 当文档可见性发生变化时，更新响应式状态
  useEventListener(document, 'visibilitychange', () => {
    // 直接更新 visibility 引用的值为最新的文档可见性状态
    visibility.value = document.visibilityState
  }, { passive: true }) // passive: true 提升滚动性能

  return visibility
}
