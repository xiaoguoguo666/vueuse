import type { Awaitable, ConfigurableEventFilter, ConfigurableFlush, RemovableRef } from '@vueuse/shared'
import type { MaybeRefOrGetter } from 'vue'
import type { ConfigurableWindow } from '../_configurable'
import type { StorageLike } from '../ssr-handlers'
import { tryOnMounted, watchPausable } from '@vueuse/shared'
import { computed, ref as deepRef, nextTick, shallowRef, toValue, watch } from 'vue'
import { defaultWindow } from '../_configurable'
import { getSSRHandler } from '../ssr-handlers'
import { useEventListener } from '../useEventListener'
import { guessSerializerType } from './guess'

/**
 * 同步序列化器接口
 * @template T - 要序列化的数据类型
 */
export interface Serializer<T> {
  /**
   * 读取/反序列化方法
   * @param raw - 从 storage 读取的原始字符串
   * @returns 反序列化后的数据
   */
  read: (raw: string) => T
  /**
   * 写入/序列化方法
   * @param value - 要序列化的数据
   * @returns 序列化后的字符串
   */
  write: (value: T) => string
}

/**
 * 异步序列化器接口
 * @template T - 要序列化的数据类型
 */
export interface SerializerAsync<T> {
  /**
   * 读取/反序列化方法（异步）
   * @param raw - 从 storage 读取的原始字符串
   * @returns 反序列化后的数据（可以是 Promise）
   */
  read: (raw: string) => Awaitable<T>
  /**
   * 写入/序列化方法（异步）
   * @param value - 要序列化的数据
   * @returns 序列化后的字符串（可以是 Promise）
   */
  write: (value: T) => Awaitable<string>
}

/**
 * 预定义的序列化器对象
 * 支持多种数据类型的自动序列化和反序列化
 */
export const StorageSerializers: Record<'boolean' | 'object' | 'number' | 'any' | 'string' | 'map' | 'set' | 'date', Serializer<any>> = {
  boolean: {
    read: (v: any) => v === 'true',
    write: (v: any) => String(v),
  },
  object: {
    read: (v: any) => JSON.parse(v),
    write: (v: any) => JSON.stringify(v),
  },
  number: {
    read: (v: any) => Number.parseFloat(v),
    write: (v: any) => String(v),
  },
  any: {
    read: (v: any) => v,
    write: (v: any) => String(v),
  },
  string: {
    read: (v: any) => v,
    write: (v: any) => String(v),
  },
  map: {
    read: (v: any) => new Map(JSON.parse(v)),
    write: (v: any) => JSON.stringify(Array.from((v as Map<any, any>).entries())),
  },
  set: {
    read: (v: any) => new Set(JSON.parse(v)),
    write: (v: any) => JSON.stringify(Array.from(v as Set<any>)),
  },
  date: {
    read: (v: any) => new Date(v),
    write: (v: any) => v.toISOString(),
  },
}

/**
 * 自定义 storage 事件名称
 * 用于在同一文档内同步自定义 storage 后端的变化
 */
export const customStorageEventName = 'vueuse-storage'

/**
 * Storage 事件类似接口
 * 用于自定义 storage 事件
 */
export interface StorageEventLike {
  storageArea: StorageLike | null
  key: StorageEvent['key']
  oldValue: StorageEvent['oldValue']
  newValue: StorageEvent['newValue']
}

/**
 * useStorage 函数的配置选项接口
 * @template T - 存储数据的类型
 */
export interface UseStorageOptions<T> extends ConfigurableEventFilter, ConfigurableWindow, ConfigurableFlush {
  /**
   * 是否深度监听数据变化
   * 当数据是对象时，会监听对象内部属性的变化
   * @default true
   */
  deep?: boolean

  /**
   * 是否监听 storage 变化
   * 对于多标签页应用很有用，可以在不同标签页间同步数据
   * @default true
   */
  listenToStorageChanges?: boolean

  /**
   * 当 storage 中不存在该 key 时，是否写入默认值
   * @default true
   */
  writeDefaults?: boolean

  /**
   * 是否合并默认值和从 storage 读取的值
   *
   * 当设置为 true 时，会对对象进行**浅合并**
   * 可以传入一个函数进行自定义合并（例如深合并）
   *
   * @default false
   */
  mergeDefaults?: boolean | ((storageValue: T, defaults: T) => T)

  /**
   * 自定义数据序列化器
   * 如果不提供，会根据默认值类型自动选择预定义的序列化器
   */
  serializer?: Serializer<T>

  /**
   * 错误回调函数
   * 当读写 storage 发生错误时调用
   * 默认会将错误打印到 console.error
   */
  onError?: (error: unknown) => void

  /**
   * 是否使用 shallowRef 作为响应式引用
   * 使用 shallowRef 可以提高大型对象的性能，但不会深度响应
   * @default false
   */
  shallow?: boolean

  /**
   * 是否等待组件挂载后再读取 storage
   * 主要用于服务端渲染（SSR）环境
   * @default false
   */
  initOnMounted?: boolean
}

/**
 * 函数重载 - string 类型
 */
export function useStorage(key: MaybeRefOrGetter<string>, defaults: MaybeRefOrGetter<string>, storage?: StorageLike, options?: UseStorageOptions<string>): RemovableRef<string>
/**
 * 函数重载 - boolean 类型
 */
export function useStorage(key: MaybeRefOrGetter<string>, defaults: MaybeRefOrGetter<boolean>, storage?: StorageLike, options?: UseStorageOptions<boolean>): RemovableRef<boolean>
/**
 * 函数重载 - number 类型
 */
export function useStorage(key: MaybeRefOrGetter<string>, defaults: MaybeRefOrGetter<number>, storage?: StorageLike, options?: UseStorageOptions<number>): RemovableRef<number>
/**
 * 函数重载 - 泛型类型
 */
export function useStorage<T>(key: MaybeRefOrGetter<string>, defaults: MaybeRefOrGetter<T>, storage?: StorageLike, options?: UseStorageOptions<T>): RemovableRef<T>
/**
 * 函数重载 - 默认值为 null
 */
export function useStorage<T = unknown>(key: MaybeRefOrGetter<string>, defaults: MaybeRefOrGetter<null>, storage?: StorageLike, options?: UseStorageOptions<T>): RemovableRef<T>

/**
 * 响应式 LocalStorage/SessionStorage
 *
 * 提供对浏览器 localStorage 和 sessionStorage 的响应式访问
 * 支持多种数据类型的自动序列化/反序列化
 * 支持多标签页同步、自定义序列化、深度监听等功能
 *
 * @see https://vueuse.org/useStorage
 * @param key - storage 的 key（可以是响应式引用）
 * @param defaults - 默认值，当 storage 中不存在该 key 时使用
 * @param storage - 要使用的 storage 对象，默认为 localStorage
 * @param options - 配置选项
 * @returns 可移除的响应式引用
 *
 * @example
 * ```vue
 * <script setup>
 * // 基础用法
 * const count = useStorage('count', 0)
 * count.value++ // 自动同步到 localStorage
 *
 * // 使用 sessionStorage
 * const token = useStorage('token', '', sessionStorage)
 *
 * // 自定义序列化
 * const data = useStorage('data', { name: 'Vue' }, localStorage, {
 *   serializer: {
 *     read: (v) => JSON.parse(v),
 *     write: (v) => JSON.stringify(v, null, 2)
 *   }
 * })
 * </script>
 * ```
 */
export function useStorage<T extends (string | number | boolean | object | null)>(
  key: MaybeRefOrGetter<string>,
  defaults: MaybeRefOrGetter<T>,
  storage: StorageLike | undefined,
  options: UseStorageOptions<T> = {},
): RemovableRef<T> {
  // 解构配置选项
  const {
    // watch 的刷新时机：'pre' 在 DOM 更新前触发，'post' 在 DOM 更新后触发，'sync' 同步触发
    flush = 'pre',
    // 是否深度监听数据变化，对于对象类型会监听其内部属性的变化
    deep = true,
    // 是否监听其他标签页或窗口对 storage 的修改（多标签页同步）
    listenToStorageChanges = true,
    // 当 storage 中不存在该 key 时，是否将默认值写入 storage
    writeDefaults = true,
    // 是否合并从 storage 读取的值和默认值（仅对对象类型有效）
    mergeDefaults = false,
    // 是否使用 shallowRef 而非 ref，可提高大型对象的性能
    shallow,
    // 浏览器 window 对象，用于 SSR 和自定义 window
    window = defaultWindow,
    // 事件过滤器，用于控制 watch 的触发条件
    eventFilter,
    // 错误处理回调，当读写 storage 发生错误时调用
    onError = (e) => {
      console.error(e)
    },
    // 是否在组件挂载后再初始化（主要用于 SSR 环境）
    initOnMounted,
  } = options

  // 创建响应式数据引用
  const data = (shallow ? shallowRef : deepRef)(typeof defaults === 'function' ? defaults() : defaults) as RemovableRef<T>

  // 计算 key（支持响应式 key）
  const keyComputed = computed<string>(() => toValue(key))

  // 如果没有提供 storage，尝试获取默认的 storage
  if (!storage) {
    try {
      storage = getSSRHandler('getDefaultStorage', () => defaultWindow?.localStorage)()
    }
    catch (e) {
      onError(e)
    }
  }

  // 如果仍然没有 storage，直接返回数据引用（不进行任何 storage 操作）
  if (!storage)
    return data

  // 初始化原始默认值
  const rawInit: T = toValue(defaults)

  // 根据默认值类型猜测序列化器类型
  const type = guessSerializerType<T>(rawInit)

  // 获取序列化器，如果提供了自定义序列化器则使用，否则使用预定义的
  const serializer = options.serializer ?? StorageSerializers[type]

  // 创建可暂停的 watch，监听数据变化并写入 storage
  const { pause: pauseWatch, resume: resumeWatch } = watchPausable(
    data,
    newValue => write(newValue),
    { flush, deep, eventFilter },
  )

  // 监听 key 的变化，当 key 变化时重新读取 storage
  watch(keyComputed, () => update(), { flush })

  // 标记是否已首次挂载
  let firstMounted = false

  /**
   * 原生 storage 事件处理函数
   * @param ev - storage 事件对象
   */
  const onStorageEvent = (ev: StorageEvent): void => {
    // 如果配置了 initOnMounted 且尚未挂载，则返回
    if (initOnMounted && !firstMounted) {
      return
    }

    update(ev)
  }

  /**
   * 自定义 storage 事件处理函数
   * @param ev - 自定义事件对象
   */
  const onStorageCustomEvent = (ev: CustomEvent<StorageEventLike>): void => {
    if (initOnMounted && !firstMounted) {
      return
    }

    updateFromCustomEvent(ev)
  }

  /**
   * 自定义事件对于在使用自定义 storage 后端时在同一文档内同步是必需的，
   * 但它不能在不同文档间工作。
   *
   * TODO: 考虑实现基于 BroadcastChannel 的解决方案来解决这个问题。
   */
  if (window && listenToStorageChanges) {
    if (storage instanceof Storage)
      // 原生 storage，监听 'storage' 事件
      useEventListener(window, 'storage', onStorageEvent, { passive: true })
    else
      // 自定义 storage，监听自定义事件
      useEventListener(window, customStorageEventName, onStorageCustomEvent)
  }

  // 如果配置了 initOnMounted，则在组件挂载后初始化
  if (initOnMounted) {
    tryOnMounted(() => {
      firstMounted = true
      update()
    })
  }
  else {
    // 否则立即初始化
    update()
  }

  /**
   * 分发 storage 写入事件
   * @param oldValue - 旧值
   * @param newValue - 新值
   */
  function dispatchWriteEvent(oldValue: string | null, newValue: string | null) {
    // 发送自定义事件以在同一页面内通信
    if (window) {
      const payload = {
        key: keyComputed.value,
        oldValue,
        newValue,
        storageArea: storage as Storage,
      }
      // 我们也使用 CustomEvent，因为 StorageEvent 不能
      // 用非内置的 storage 区域构造
      window.dispatchEvent(storage instanceof Storage
        ? new StorageEvent('storage', payload)
        : new CustomEvent<StorageEventLike>(customStorageEventName, {
            detail: payload,
          }))
    }
  }

  /**
   * 将数据写入 storage
   * @param v - 要写入的数据
   */
  function write(v: unknown) {
    try {
      // 获取旧值
      const oldValue = storage!.getItem(keyComputed.value)

      if (v == null) {
        // 如果值为 null 或 undefined，则移除该 key
        dispatchWriteEvent(oldValue, null)
        storage!.removeItem(keyComputed.value)
      }
      else {
        // 序列化新值
        const serialized = serializer.write(v as any)
        // 只有当值发生变化时才写入 storage
        if (oldValue !== serialized) {
          storage!.setItem(keyComputed.value, serialized)
          dispatchWriteEvent(oldValue, serialized)
        }
      }
    }
    catch (e) {
      onError(e)
    }
  }

  /**
   * 从 storage 读取数据
   * @param event - storage 事件对象（可选）
   * @returns 读取并反序列化后的数据
   */
  function read(event?: StorageEventLike) {
    // 从事件或 storage 中获取原始值
    const rawValue = event
      ? event.newValue
      : storage!.getItem(keyComputed.value)

    if (rawValue == null) {
      // 如果 storage 中没有该原始值，且启用了写入默认值
      if (writeDefaults && rawInit != null)
        // 写入默认值
        storage!.setItem(keyComputed.value, serializer.write(rawInit))
      // 返回默认值
      return rawInit
    }
    else if (!event && mergeDefaults) {
      // 如果没有事件但启用了合并默认值
      const value = serializer.read(rawValue)
      if (typeof mergeDefaults === 'function')
        // 使用自定义合并函数
        return mergeDefaults(value, rawInit)
      else if (type === 'object' && !Array.isArray(value))
        // 浅合并对象
        return { ...rawInit as any, ...value }
      return value
    }
    else if (typeof rawValue !== 'string') {
      // 如果原始值不是字符串，直接返回
      return rawValue
    }
    else {
      // 正常情况：反序列化并返回
      return serializer.read(rawValue)
    }
  }

  /**
   * 更新数据
   * @param event - storage 事件对象（可选）
   */
  function update(event?: StorageEventLike) {
    // 检查事件是否对应正确的 storage
    if (event && event.storageArea !== storage)
      return

    // 如果 key 为 null（清空 storage），重置为默认值
    if (event && event.key == null) {
      data.value = rawInit
      return
    }

    // 检查事件是否对应正确的 key
    if (event && event.key !== keyComputed.value) {
      return
    }

    // 暂停 watch，避免在更新数据时触发写入 storage（防止循环）
    pauseWatch()

    try {
      // 先序列化当前数据
      const serializedData = serializer.write(data.value)
      // 只有当事件的 newValue 与当前序列化值不同时，才更新数据
      if (event === undefined || event?.newValue !== serializedData) {
        data.value = read(event)
      }
    }
    catch (e) {
      onError(e)
    }
    finally {
      // 使用 nextTick 避免无限循环
      if (event)
        nextTick(resumeWatch)
      else
        resumeWatch()
    }
  }

  /**
   * 从自定义事件更新数据
   * @param event - 自定义事件对象
   */
  function updateFromCustomEvent(event: CustomEvent<StorageEventLike>) {
    update(event.detail)
  }

  // 返回响应式数据引用
  return data
}
