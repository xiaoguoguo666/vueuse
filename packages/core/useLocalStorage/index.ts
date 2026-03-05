import type { RemovableRef } from '@vueuse/shared'
import type { MaybeRefOrGetter } from 'vue'
import type { UseStorageOptions } from '../useStorage'
import { defaultWindow } from '../_configurable'
import { useStorage } from '../useStorage'

export function useLocalStorage(key: MaybeRefOrGetter<string>, initialValue: MaybeRefOrGetter<string>, options?: UseStorageOptions<string>): RemovableRef<string>
export function useLocalStorage(key: MaybeRefOrGetter<string>, initialValue: MaybeRefOrGetter<boolean>, options?: UseStorageOptions<boolean>): RemovableRef<boolean>
export function useLocalStorage(key: MaybeRefOrGetter<string>, initialValue: MaybeRefOrGetter<number>, options?: UseStorageOptions<number>): RemovableRef<number>
export function useLocalStorage<T>(key: MaybeRefOrGetter<string>, initialValue: MaybeRefOrGetter<T>, options?: UseStorageOptions<T>): RemovableRef<T>
export function useLocalStorage<T = unknown>(key: MaybeRefOrGetter<string>, initialValue: MaybeRefOrGetter<null>, options?: UseStorageOptions<T>): RemovableRef<T>

/**
 * Reactive LocalStorage.
 *
 * @see https://vueuse.org/useLocalStorage
 * @param key
 * @param initialValue
 * @param options
 */
/**
 * 响应式的 localStorage 操作 Hook
 *
 * 封装了 useStorage，专门用于操作 localStorage
 * 提供了类型安全的 localStorage 读写能力
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
 * const counter = useLocalStorage('counter', 0)
 *
 * // 对象类型
 * const user = useLocalStorage('user', { name: 'John', age: 30 })
 *
 * ```
 */
export function useLocalStorage<T extends(string | number | boolean | object | null)>(
  key: MaybeRefOrGetter<string>,
  initialValue: MaybeRefOrGetter<T>,
  options: UseStorageOptions<T> = {},
): RemovableRef<any> {
  // 解构配置选项，使用默认的 window 对象
  const { window = defaultWindow } = options

  // 调用通用的 useStorage，指定使用 localStorage 作为存储后端
  return useStorage(key, initialValue, window?.localStorage, options)
}
