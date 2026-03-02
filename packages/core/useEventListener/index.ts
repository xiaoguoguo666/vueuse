import type { Arrayable, Fn } from '@vueuse/shared'
import type { MaybeRef, MaybeRefOrGetter } from 'vue'
import { isObject, toArray, watchImmediate } from '@vueuse/shared'
// eslint-disable-next-line no-restricted-imports -- We specifically need to use unref here to distinguish between callbacks
import { computed, toValue, unref } from 'vue'
import { defaultWindow } from '../_configurable'
import { unrefElement } from '../unrefElement'

/**
 * 泛型接口，用于推断事件目标类型
 * @template Events - 事件名称类型
 */
interface InferEventTarget<Events> {
  addEventListener: (event: Events, fn?: any, options?: any) => any
  removeEventListener: (event: Events, fn?: any, options?: any) => any
}

/**
 * Window 对象支持的事件类型
 */
export type WindowEventName = keyof WindowEventMap

/**
 * Document 对象支持的事件类型
 */
export type DocumentEventName = keyof DocumentEventMap

/**
 * ShadowRoot 对象支持的事件类型
 */
export type ShadowRootEventName = keyof ShadowRootEventMap
/**
 * 通用事件监听器类型
 * @template E - 事件类型，默认为 Event
 */
export interface GeneralEventListener<E = Event> {
  (evt: E): void
}

/**
 * 在组件挂载时注册 addEventListener，并在组件卸载时自动移除事件监听器。
 *
 * 重载 1：省略 Window 目标参数（默认使用 Window）
 *
 * @see https://vueuse.org/useEventListener
 */
// @ts-expect-error - TypeScript gets confused with this and can't infer the correct overload with Parameters<...>
export function useEventListener<E extends keyof WindowEventMap>(
  event: MaybeRefOrGetter<Arrayable<E>>,
  listener: MaybeRef<Arrayable<(this: Window, ev: WindowEventMap[E]) => any>>,
  options?: MaybeRefOrGetter<boolean | AddEventListenerOptions>,
): Fn

/**
 * 在组件挂载时注册 addEventListener，并在组件卸载时自动移除事件监听器。
 *
 * 重载 2：显式指定 Window 目标
 *
 * @see https://vueuse.org/useEventListener
 * @param target - 目标对象（Window）
 * @param event - 事件名称
 * @param listener - 事件监听器
 * @param options - 事件监听选项
 */
export function useEventListener<E extends keyof WindowEventMap>(
  target: Window,
  event: MaybeRefOrGetter<Arrayable<E>>,
  listener: MaybeRef<Arrayable<(this: Window, ev: WindowEventMap[E]) => any>>,
  options?: MaybeRefOrGetter<boolean | AddEventListenerOptions>,
): Fn

/**
 * 在组件挂载时注册 addEventListener，并在组件卸载时自动移除事件监听器。
 *
 * 重载 3：显式指定 Document 目标
 *
 * @see https://vueuse.org/useEventListener
 * @param target - 目标对象（Document）
 * @param event - 事件名称
 * @param listener - 事件监听器
 * @param options - 事件监听选项
 */
export function useEventListener<E extends keyof DocumentEventMap>(
  target: Document,
  event: MaybeRefOrGetter<Arrayable<E>>,
  listener: MaybeRef<Arrayable<(this: Document, ev: DocumentEventMap[E]) => any>>,
  options?: MaybeRefOrGetter<boolean | AddEventListenerOptions>,
): Fn

/**
 * 在组件挂载时注册 addEventListener，并在组件卸载时自动移除事件监听器。
 *
 * 重载 4：显式指定 ShadowRoot 目标
 *
 * @see https://vueuse.org/useEventListener
 * @param target - 目标对象（ShadowRoot）
 * @param event - 事件名称
 * @param listener - 事件监听器
 * @param options - 事件监听选项
 */
export function useEventListener<E extends keyof ShadowRootEventMap>(
  target: MaybeRefOrGetter<Arrayable<ShadowRoot> | null | undefined>,
  event: MaybeRefOrGetter<Arrayable<E>>,
  listener: MaybeRef<Arrayable<(this: ShadowRoot, ev: ShadowRootEventMap[E]) => any>>,
  options?: MaybeRefOrGetter<boolean | AddEventListenerOptions>,
): Fn

/**
 * 在组件挂载时注册 addEventListener，并在组件卸载时自动移除事件监听器。
 *
 * 重载 5：显式指定 HTMLElement 目标
 *
 * @see https://vueuse.org/useEventListener
 * @param target - 目标对象（HTMLElement）
 * @param event - 事件名称
 * @param listener - 事件监听器
 * @param options - 事件监听选项
 */
export function useEventListener<E extends keyof HTMLElementEventMap>(
  target: MaybeRefOrGetter<Arrayable<HTMLElement> | null | undefined>,
  event: MaybeRefOrGetter<Arrayable<E>>,
  listener: MaybeRef<(this: HTMLElement, ev: HTMLElementEventMap[E]) => any>,
  options?: MaybeRefOrGetter<boolean | AddEventListenerOptions>,
): Fn

/**
 * 在组件挂载时注册 addEventListener，并在组件卸载时自动移除事件监听器。
 *
 * 重载 6：自定义事件目标（带事件类型推断）
 *
 * @see https://vueuse.org/useEventListener
 * @param target - 自定义事件目标
 * @param event - 事件名称
 * @param listener - 事件监听器
 * @param options - 事件监听选项
 */
export function useEventListener<Names extends string, EventType = Event>(
  target: MaybeRefOrGetter<Arrayable<InferEventTarget<Names>> | null | undefined>,
  event: MaybeRefOrGetter<Arrayable<Names>>,
  listener: MaybeRef<Arrayable<GeneralEventListener<EventType>>>,
  options?: MaybeRefOrGetter<boolean | AddEventListenerOptions>,
): Fn

/**
 * 在组件挂载时注册 addEventListener，并在组件卸载时自动移除事件监听器。
 *
 * 重载 7：自定义事件目标（回退方案）
 *
 * @see https://vueuse.org/useEventListener
 * @param target - 自定义事件目标
 * @param event - 事件名称
 * @param listener - 事件监听器
 * @param options - 事件监听选项
 */
export function useEventListener<EventType = Event>(
  target: MaybeRefOrGetter<Arrayable<EventTarget> | null | undefined>,
  event: MaybeRefOrGetter<Arrayable<string>>,
  listener: MaybeRef<Arrayable<GeneralEventListener<EventType>>>,
  options?: MaybeRefOrGetter<boolean | AddEventListenerOptions>,
): Fn

/**
 * 在组件挂载时注册 addEventListener，并在组件卸载时自动移除事件监听器。
 *
 * 支持多种使用方式：
 * - useEventListener('click', handler) - 监听 Window 的 click 事件
 * - useEventListener(window, 'click', handler) - 显式指定 Window
 * - useEventListener(document, 'click', handler) - 监听 Document
 * - useEventListener(element, 'click', handler) - 监听 DOM 元素
 * - useEventListener(ref, 'click', handler) - 监听 Ref 包装的元素
 *
 * 特性：
 * - 支持数组形式的事件名称和监听器（一次注册多个事件）
 * - 支持响应式参数（参数可以是 Ref 或 getter）
 * - 自动管理事件监听器的添加和移除
 * - 在组件卸载时自动清理所有事件监听器
 *
 * @param args - 根据重载签名，参数可以是 [event, listener, options] 或 [target, event, listener, options]
 * @returns 移除事件监听器的函数
 *
 * @example
 * ```vue
 * <script setup>
 * // 监听 Window 的 resize 事件
 * const stop1 = useEventListener('resize', () => {
 *   console.log('Window resized')
 * })
 *
 * // 监听 Document 的 click 事件
 * const stop2 = useEventListener(document, 'click', (e) => {
 *   console.log('Document clicked')
 * })
 *
 * // 监听元素的事件
 * const el = ref<HTMLButtonElement>()
 * const stop3 = useEventListener(el, 'click', () => {
 *   console.log('Button clicked')
 * })
 *
 * // 多个事件监听
 * useEventListener(window, ['resize', 'scroll'], () => {
 *   console.log('Window event triggered')
 * })
 *
 * // 停止监听
 * onUnmounted(() => {
 *   stop1()
 *   stop2()
 *   stop3()
 * })
 * </script>
 * ```
 */
export function useEventListener(...args: Parameters<typeof useEventListener>) {
  /**
   * 注册事件监听器
   * @param el - 事件目标元素
   * @param event - 事件名称
   * @param listener - 事件监听器函数
   * @param options - 事件监听选项
   * @returns 移除事件监听器的函数
   */
  const register = (
    el: EventTarget,
    event: string,
    listener: any,
    options: boolean | AddEventListenerOptions | undefined,
  ) => {
    el.addEventListener(event, listener, options)
    return () => el.removeEventListener(event, listener, options)
  }

  /**
   * 判断第一个参数是否是事件目标（而非事件名称）
   * 如果第一个参数是字符串，则认为是事件名称，返回 undefined
   * 否则返回解析后的目标数组
   */
  const firstParamTargets = computed(() => {
    const test = toArray(toValue(args[0])).filter(e => e != null)
    return test.every(e => typeof e !== 'string') ? test : undefined
  })

  /**
   * 使用 watchImmediate 监听参数变化，动态注册和移除事件监听器
   *
   * @returns 移除所有事件监听器的函数组合
   */
  return watchImmediate(
    () => [
      // 解析事件目标
      // 如果第一个参数是目标，则使用它；否则使用 defaultWindow
      firstParamTargets.value?.map(e => unrefElement(e as never)) ?? [defaultWindow].filter(e => e != null),

      // 解析事件名称
      // 如果第一个参数是目标，则第二个参数是事件名称；否则第一个参数是事件名称
      toArray(toValue(firstParamTargets.value ? args[1] : args[0]) as string[]),

      // 解析监听器函数
      // 如果第一个参数是目标，则第三个参数是监听器；否则第二个参数是监听器
      toArray(unref(firstParamTargets.value ? args[2] : args[1]) as Function[]),

      // 解析监听选项
      // 如果第一个参数是目标，则第四个参数是选项；否则第三个参数是选项
      // @ts-expect-error - TypeScript gets the correct types, but somehow still complains
      toValue(firstParamTargets.value ? args[3] : args[2]) as boolean | AddEventListenerOptions | undefined,
    ] as const,

    // 监听器回调函数
    ([raw_targets, raw_events, raw_listeners, raw_options], _, onCleanup) => {
      // 如果任何必需的参数为空，则跳过注册
      if (!raw_targets?.length || !raw_events?.length || !raw_listeners?.length)
        return

      // 克隆 options，避免在移除时被响应式修改影响
      const optionsClone = isObject(raw_options) ? { ...raw_options } : raw_options

      // 为每个目标、事件、监听器的组合注册事件监听器
      const cleanups = raw_targets
        .flatMap(el =>
          raw_events
            .flatMap(event =>
              raw_listeners.map(listener =>
                register(el, event, listener, optionsClone),
              ),
            ),
        )

      // 注册清理函数，在组件卸载或参数变化时调用
      // onCleanup 注册的清理函数会在以下时机执行：
      // ## 执行时机
      // ### 1. 组件卸载时（主要场景）
      // 当使用 useEventListener 的组件被卸载时，Vue 会自动调用所有通过 onCleanup 注册的清理函数。

      // ### 2. 依赖项变化时
      // 由于 watchImmediate 监听了参数变化，当以下任一参数变化时：

      // - target （事件目标）
      // - event （事件名称）
      // - listener （监听器函数）
      // - options （监听选项）
      // 在重新执行回调之前，会先调用 onCleanup 清理之前的事件监听器。
      onCleanup(() => {
        cleanups.forEach(fn => fn())
      })
    },
    { flush: 'post' },
  )
}
