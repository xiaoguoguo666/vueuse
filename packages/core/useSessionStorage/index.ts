/**
 * 可移除的响应式引用类型
 */
import type { RemovableRef } from '@vueuse/shared'

/**
 * 可能是响应式引用或普通值的类型
 */
import type { MaybeRefOrGetter } from 'vue'

/**
 * useStorage 的配置选项类型
 */
import type { UseStorageOptions } from '../useStorage'

/**
 * 默认的 window 对象
 */
import { defaultWindow } from '../_configurable'

/**
 * 通用的存储 Hook
 */
import { useStorage } from '../useStorage'

/**
 * useSessionStorage 函数的重载签名
 * 为不同类型的初始值提供类型安全的返回值
 */
export function useSessionStorage(key: MaybeRefOrGetter<string>, initialValue: MaybeRefOrGetter<string>, options?: UseStorageOptions<string>): RemovableRef<string>
export function useSessionStorage(key: MaybeRefOrGetter<string>, initialValue: MaybeRefOrGetter<boolean>, options?: UseStorageOptions<boolean>): RemovableRef<boolean>
export function useSessionStorage(key: MaybeRefOrGetter<string>, initialValue: MaybeRefOrGetter<number>, options?: UseStorageOptions<number>): RemovableRef<number>
export function useSessionStorage<T>(key: MaybeRefOrGetter<string>, initialValue: MaybeRefOrGetter<T>, options?: UseStorageOptions<T>): RemovableRef<T>
export function useSessionStorage<T = unknown>(key: MaybeRefOrGetter<string>, initialValue: MaybeRefOrGetter<null>, options?: UseStorageOptions<T>): RemovableRef<T>

/**
 * 响应式的 sessionStorage 操作 Hook
 *
 * 封装了 useStorage，专门用于操作 sessionStorage
 * 提供了类型安全的 sessionStorage 读写能力
 *
 * 与 localStorage 不同，sessionStorage 的数据只在当前会话期间存在
 * 关闭浏览器标签页或窗口后数据会被清除
 *
 * @template T - 存储值的类型
 * @param key - 存储的键名，支持响应式引用
 * @param initialValue - 初始值，支持响应式引用
 * @param options - 配置选项
 * @returns 可移除的响应式引用，包含 remove 方法用于删除存储项
 *
 * @example
 * ```ts
 * // 基本用法
 * const counter = useSessionStorage('counter', 0)
 * // 对象类型
 * const user = useSessionStorage('user', { name: 'John', age: 30 })

 * ```
 */
export function useSessionStorage<T extends(string | number | boolean | object | null)>(
  key: MaybeRefOrGetter<string>,
  initialValue: MaybeRefOrGetter<T>,
  options: UseStorageOptions<T> = {},
): RemovableRef<any> {
  // 解构配置选项，使用默认的 window 对象
  const { window = defaultWindow } = options

  // 调用通用的 useStorage，指定使用 sessionStorage 作为存储后端
  return useStorage(key, initialValue, window?.sessionStorage, options)
}
