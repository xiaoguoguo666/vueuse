import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'
import type { StorageLike } from '../ssr-handlers'
import type { MaybeElementRef } from '../unrefElement'
import type { UseStorageOptions } from '../useStorage'
import { toRef, tryOnMounted } from '@vueuse/shared'
import { computed, watch } from 'vue'
import { defaultWindow } from '../_configurable'
import { getSSRHandler } from '../ssr-handlers'
import { unrefElement } from '../unrefElement'
import { usePreferredDark } from '../usePreferredDark'
import { useStorage } from '../useStorage'

/**
 * 基础颜色模式类型
 */
export type BasicColorMode = 'light' | 'dark'

/**
 * 基础颜色模式/模式（包含 auto）
 */
export type BasicColorSchema = BasicColorMode | 'auto'

/**
 * useColorMode 函数的配置选项接口
 * @template T - 自定义颜色模式类型
 */
export interface UseColorModeOptions<T extends string = BasicColorMode> extends UseStorageOptions<T | BasicColorMode> {
  /**
   * 应用颜色模式的目标元素 CSS 选择器或元素引用
   * @default 'html'
   */
  selector?: string | MaybeElementRef

  /**
   * 应用到目标元素的 HTML 属性
   * @default 'class'
   */
  attribute?: string

  /**
   * 初始颜色模式
   * @default 'auto'
   */
  initialValue?: MaybeRefOrGetter<T | BasicColorSchema>

  /**
   * 添加到属性时的前缀/模式映射
   * 用于自定义不同模式对应的 class 或属性值
   */
  modes?: Partial<Record<T | BasicColorSchema, string>>

  /**
   * 自定义处理颜色模式更新的回调函数
   * 当提供此选项时，会覆盖默认行为
   * @default undefined
   */
  onChanged?: (mode: T | BasicColorMode, defaultHandler: ((mode: T | BasicColorMode) => void)) => void

  /**
   * 自定义 storage 引用
   * 当提供此选项时，会跳过 useStorage
   */
  storageRef?: Ref<T | BasicColorSchema>

  /**
   * 持久化数据到 localStorage/sessionStorage 的 key
   * 传入 null 禁用持久化
   * @default 'vueuse-color-scheme'
   */
  storageKey?: string | null

  /**
   * Storage 对象，可以是 localStorage 或 sessionStorage
   * @default localStorage
   */
  storage?: StorageLike

  /**
   * 是否从状态中 emit 'auto' 模式
   * 当设置为 true 时，首选模式不会被转换为 'light' 或 'dark'
   * 当需要知道选择了 'auto' 模式时很有用
   * @default undefined
   * @deprecated 当需要知道 'auto' 模式时，请使用 `store.value`
   * @see https://vueuse.org/core/useColorMode/#advanced-usage
   */
  emitAuto?: boolean

  /**
   * 切换时禁用过渡动画
   * @see https://paco.me/writing/disable-theme-transitions
   * @default true
   */
  disableTransition?: boolean
}

/**
 * useColorMode 函数的返回值类型
 * @template T - 自定义颜色模式类型
 */
export type UseColorModeReturn<T extends string = BasicColorMode>
  = Ref<T | BasicColorSchema> & {
    /**
     * 存储的原始值（可能包含 'auto'）
     */
    store: Ref<T | BasicColorSchema>
    /**
     * 系统首选的颜色模式（根据系统设置）
     */
    system: ComputedRef<BasicColorMode>
    /**
     * 当前实际生效的颜色模式（'auto' 会被转换为 'light' 或 'dark'）
     */
    state: ComputedRef<T | BasicColorMode>
  }

/**
 * 禁用过渡动画的 CSS
 */
const CSS_DISABLE_TRANS = '*,*::before,*::after{-webkit-transition:none!important;-moz-transition:none!important;-o-transition:none!important;-ms-transition:none!important;transition:none!important}'

/**
 * 响应式颜色模式，带自动数据持久化
 *
 * 提供对网站颜色模式（light/dark/auto）的响应式管理
 * 支持自动检测系统设置、持久化到 storage、自定义模式等功能
 *
 * @see https://vueuse.org/useColorMode
 * @param options - 配置选项
 * @returns 包含当前模式、store、system 和 state 的响应式对象
 *
 * @example
 * ```vue
 * <script setup>
 * const mode = useColorMode({
 *   selector: 'body',
 *   initialValue: 'auto'
 * })
 * </script>
 *
 * <template>
 *   <button @click="mode = 'light'">Light</button>
 *   <button @click="mode = 'dark'">Dark</button>
 *   <button @click="mode = 'auto'">Auto</button>
 * </template>
 * ```
 */
export function useColorMode<T extends string = BasicColorMode>(
  options: UseColorModeOptions<T> = {},
): UseColorModeReturn<T> {
  // 解构配置选项
  const {
    selector = 'html',
    attribute = 'class',
    initialValue = 'auto',
    window = defaultWindow,
    storage,
    storageKey = 'vueuse-color-scheme',
    listenToStorageChanges = true,
    storageRef,
    emitAuto,
    disableTransition = true,
  } = options

  // 颜色模式映射，合并默认值和自定义模式
  const modes = {
    auto: '',
    light: 'light',
    dark: 'dark',
    ...options.modes || {},
  } as Record<BasicColorSchema | T, string>

  // 检测系统是否偏好暗黑模式
  const preferredDark = usePreferredDark({ window })

  // 系统首选的颜色模式
  const system = computed(() => preferredDark.value ? 'dark' : 'light')

  // 存储当前颜色模式
  // 如果提供了 storageRef，则使用它
  // 如果 storageKey 为 null，则不持久化，使用 toRef
  // 否则使用 useStorage 持久化
  const store = storageRef || (
    storageKey == null
      ? toRef(initialValue) as Ref<T | BasicColorSchema>
      : useStorage<T | BasicColorSchema>(storageKey, initialValue, storage, { window, listenToStorageChanges })
  )

  // 当前实际生效的颜色模式
  // 如果 store 的值是 'auto'，则使用 system 的值
  const state = computed<T | BasicColorMode>(() =>
    store.value === 'auto'
      ? system.value
      : store.value)

  // 更新 HTML 属性的处理函数
  const updateHTMLAttrs = getSSRHandler(
    'updateHTMLAttrs',
    (selector, attribute, value) => {
      // 获取目标元素
      const el = typeof selector === 'string'
        ? window?.document.querySelector(selector)
        : unrefElement(selector)
      if (!el)
        return

      // 准备要添加和移除的 class，以及要修改的属性
      const classesToAdd = new Set<string>()
      const classesToRemove = new Set<string>()
      let attributeToChange: { key: string, value: string } | null = null

      if (attribute === 'class') {
        // 如果是 class 属性
        const current = value.split(/\s/g)
        // 遍历所有模式值，确定哪些 class 需要添加或移除
        Object.values(modes)
          .flatMap(i => (i || '').split(/\s/g))
          .filter(Boolean)
          .forEach((v) => {
            if (current.includes(v))
              classesToAdd.add(v)
            else
              classesToRemove.add(v)
          })
      }
      else {
        // 如果是其他属性
        attributeToChange = { key: attribute, value }
      }

      // 如果没有变化，则直接返回，避免重新渲染
      if (classesToAdd.size === 0 && classesToRemove.size === 0 && attributeToChange === null)
        return

      let style: HTMLStyleElement | undefined
      if (disableTransition) {
        // 禁用过渡动画
        style = window!.document.createElement('style')
        style.appendChild(document.createTextNode(CSS_DISABLE_TRANS))
        window!.document.head.appendChild(style)
      }

      // 添加和移除 class
      for (const c of classesToAdd) {
        el.classList.add(c)
      }
      for (const c of classesToRemove) {
        el.classList.remove(c)
      }

      // 修改属性
      if (attributeToChange) {
        el.setAttribute(attributeToChange.key, attributeToChange.value)
      }
      //         为什么需要 getComputedStyle？
      // 因为浏览器会对 DOM 操作进行 批处理优化 ：
      // ❌这样可能不会生效：
      // document.head.appendChild(style) // 添加禁用样式
      // document.head.removeChild(style)  // 立即移除
      // 浏览器可能把这两个操作合并，导致看不到效果
      // 调用 getComputedStyle(style!).opacity 会 强制浏览器立即计算样式并重绘 ，确保：
      // 1. 先应用禁用过渡的样式
      // 2. 然后执行主题切换
      // 3. 最后再移除禁用过渡的样式
      // 这样用户就不会看到主题切换的动画了。
      if (disableTransition) {
        // 调用 getComputedStyle 强制浏览器重绘
        // @ts-expect-error unused variable
        const _ = window!.getComputedStyle(style!).opacity
        document.head.removeChild(style!)
      }
    },
  )

  /**
   * 默认的颜色模式变化处理函数
   */
  function defaultOnChanged(mode: T | BasicColorMode) {
    updateHTMLAttrs(selector, attribute, modes[mode] ?? mode)
  }

  /**
   * 颜色模式变化处理函数
   */
  function onChanged(mode: T | BasicColorMode) {
    if (options.onChanged)
      // 如果提供了自定义回调，则调用它，并传递默认处理函数
      options.onChanged(mode, defaultOnChanged)
    else
      // 否则使用默认处理函数
      defaultOnChanged(mode)
  }

  // 监听 state 的变化，调用 onChanged
  watch(state, onChanged, { flush: 'post', immediate: true })

  // 在组件挂载后再调用一次 onChanged，确保初始状态正确
  tryOnMounted(() => onChanged(state.value))

  // 主要返回的引用
  const auto = computed({
    get() {
      // 如果设置了 emitAuto，则返回 store 的原始值（可能包含 'auto'）
      // 否则返回 state（'auto' 已被转换为 'light' 或 'dark'）
      return emitAuto ? store.value : state.value
    },
    set(v) {
      // 设置 store 的值
      store.value = v
    },
  })

  // 返回结果，合并主要引用和其他属性
  return Object.assign(auto, { store, system, state }) as UseColorModeReturn<T>
}
