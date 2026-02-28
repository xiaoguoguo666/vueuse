import type { ReadonlyRefOrGetter } from '@vueuse/shared'
import type { ComputedRef, MaybeRef, MaybeRefOrGetter, Ref } from 'vue'
import type { ConfigurableDocument } from '../_configurable'
import { toRef } from '@vueuse/shared'
import { watch } from 'vue'
import { defaultDocument } from '../_configurable'

/**
 * useFavicon 函数的配置选项接口
 */
export interface UseFaviconOptions extends ConfigurableDocument {
  /**
   * 图标的基础 URL 地址
   * 会拼接到图标路径前面，用于处理相对路径
   * @default ''
   */
  baseUrl?: string

  /**
   * link 标签的 rel 属性值
   * 用于匹配页面中已有的 favicon link 标签
   * @default 'icon'
   */
  rel?: string
}

/**
 * useFavicon 函数的返回值类型
 * 根据传入参数的不同，返回 ComputedRef 或 Ref
 */
export type UseFaviconReturn = ComputedRef<string | null | undefined> | Ref<string | null | undefined>

/**
 * 响应式网站图标（favicon）
 *
 * 提供对浏览器标签页图标（favicon）的响应式管理
 * 支持动态修改 favicon 图标，自动创建或更新 link 标签
 *
 * @see https://vueuse.org/useFavicon
 * @param newIcon - 新的图标路径（可以是 Ref、getter 或直接的字符串值）
 *                  传入 null 或 undefined 可移除 favicon
 * @param options - 配置选项
 * @returns 响应式的图标路径引用
 *
 * @example
 * ```vue
 * <script setup>
 * const favicon = useFavicon('https://example.com/favicon.ico')
 *
 * // 动态修改图标
 * favicon.value = 'https://example.com/new-favicon.ico'
 *
 * // 移除 favicon
 * favicon.value = null
 * </script>
 * ```
 */
export function useFavicon(
  newIcon: ReadonlyRefOrGetter<string | null | undefined>,
  options?: UseFaviconOptions,
): ComputedRef<string | null | undefined>
export function useFavicon(
  newIcon?: MaybeRef<string | null | undefined>,
  options?: UseFaviconOptions,
): Ref<string | null | undefined>
export function useFavicon(
  newIcon: MaybeRefOrGetter<string | null | undefined> = null,
  options: UseFaviconOptions = {},
): UseFaviconReturn {
  // 解构配置选项
  const {
    baseUrl = '',
    rel = 'icon',
    document = defaultDocument,
  } = options

  // 将传入的图标路径转换为响应式引用
  // 如果传入的是 Ref，则返回相同的 Ref
  // 如果传入的是 getter，则返回 ComputedRef
  const favicon = toRef(newIcon)

  /**
   * 应用图标到页面
   * @param icon - 图标路径
   */
  const applyIcon = (icon: string) => {
    // 查询页面中所有 rel 属性包含指定值的 link 标签
    // 例如：rel="icon"、rel="shortcut icon" 都会被匹配
    const elements = document?.head
      .querySelectorAll<HTMLLinkElement>(`link[rel*="${rel}"]`)

    // 如果没有找到任何 link 标签
    if (!elements || elements.length === 0) {
      // 创建新的 link 标签
      const link = document?.createElement('link')
      if (link) {
        // 设置 link 标签的属性
        link.rel = rel
        link.href = `${baseUrl}${icon}`
        // 根据文件扩展名设置 MIME 类型
        link.type = `image/${icon.split('.').pop()}`
        // 将 link 标签添加到 head 中
        document?.head.append(link)
      }
      return
    }

    // 如果已存在 link 标签，则更新所有匹配标签的 href 属性
    elements?.forEach(el => el.href = `${baseUrl}${icon}`)
  }

  // 监听图标路径的变化
  watch(
    favicon,
    (i, o) => {
      // 当新值是字符串且与旧值不同时，应用新图标
      if (typeof i === 'string' && i !== o)
        applyIcon(i)
    },
    // 立即执行一次，初始化 favicon
    { immediate: true },
  )

  // 返回响应式的图标路径引用
  return favicon
}
