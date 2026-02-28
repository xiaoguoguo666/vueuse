/* this implementation is original ported from https://github.com/logaretm/vue-use-web by Abdelrahman Awad */

import type { MaybeRefOrGetter, ShallowRef } from 'vue'
import type { ConfigurableNavigator } from '../_configurable'
import type { Supportable } from '../types'
import { useTimeoutFn } from '@vueuse/shared'
import { computed, readonly, shallowRef, toValue } from 'vue'
import { defaultNavigator } from '../_configurable'
import { useEventListener } from '../useEventListener'
import { usePermission } from '../usePermission'
import { useSupported } from '../useSupported'

/**
 * useClipboard 函数的配置选项接口
 */
export interface UseClipboardOptions<Source> extends ConfigurableNavigator {
  /**
   * 是否启用剪贴板读取功能
   * 当启用时，在 copy（复制）和 cut（剪切）事件发生时会自动更新 text 的值
   * @default false
   */
  read?: boolean

  /**
   * 默认的复制源内容
   * 当调用 copy() 方法时不传入参数，将使用此默认值进行复制
   * 支持响应式引用（Ref）或 getter 函数
   */
  source?: Source

  /**
   * copied 状态重置的延迟时间（毫秒）
   * 调用 copy() 后，copied 会变为 true，经过此时间后自动重置为 false
   * @default 1500
   */
  copiedDuring?: number

  /**
   * 是否在剪贴板 API 不可用时降级使用 document.execCommand('copy')
   * @default false
   */
  legacy?: boolean
}

/**
 * useClipboard 函数的返回值接口
 * @template Optional - 当 source 为可选参数时为 true，否则为 false
 */
export interface UseClipboardReturn<Optional> extends Supportable {
  /**
   * 当前剪贴板中的文本内容
   * 只读的 ShallowRef，支持响应式更新
   */
  text: Readonly<ShallowRef<string>>

  /**
   * 标记最近一次复制操作是否成功的布尔值
   * 调用 copy() 后会短暂变为 true，经过 copiedDuring 时间后自动重置为 false
   */
  copied: Readonly<ShallowRef<boolean>>

  /**
   * 复制函数
   * @param text - 要复制到剪贴板的文本内容
   * 当 Optional 为 true 时，text 参数可选；否则必须提供
   */
  copy: Optional extends true ? (text?: string) => Promise<void> : (text: string) => Promise<void>
}

/**
 * 响应式剪贴板 API
 *
 * 提供与浏览器剪贴板交互的响应式方法，支持现代 Clipboard API 和旧版降级方案
 *
 * @see https://vueuse.org/useClipboard
 * @param options - 配置选项
 * @returns 包含 text、copied、copy 和 isSupported 的对象
 *
 * @__NO_SIDE_EFFECTS__
 */
export function useClipboard(options?: UseClipboardOptions<undefined>): UseClipboardReturn<false>
export function useClipboard(options: UseClipboardOptions<MaybeRefOrGetter<string>>): UseClipboardReturn<true>
export function useClipboard(options: UseClipboardOptions<MaybeRefOrGetter<string> | undefined> = {}): UseClipboardReturn<boolean> {
  const {
    navigator = defaultNavigator,
    read = false,
    source,
    copiedDuring = 1500,
    legacy = false,
  } = options

  // 检查浏览器是否支持 Clipboard API
  const isClipboardApiSupported = useSupported(() => (navigator && 'clipboard' in navigator))

  // 检查读取剪贴板的权限状态
  const permissionRead = usePermission('clipboard-read')

  // 检查写入剪贴板的权限状态
  const permissionWrite = usePermission('clipboard-write')

  // 综合判断是否支持剪贴板功能（支持 Clipboard API 或启用降级方案）
  const isSupported = computed(() => isClipboardApiSupported.value || legacy)

  // 存储剪贴板中的文本内容
  const text = shallowRef('')

  // 标记最近一次复制操作是否成功
  const copied = shallowRef(false)

  // 超时定时器，用于在指定时间后将 copied 重置为 false
  const timeout = useTimeoutFn(() => copied.value = false, copiedDuring, { immediate: false })

  /**
   * 更新剪贴板文本内容
   * 优先使用现代 Clipboard API，失败后降级到旧版方案
   */
  async function updateText() {
    // 判断是否使用降级方案
    // 当 Clipboard API 不支持或没有读取权限时使用降级方案
    let useLegacy = !(isClipboardApiSupported.value && isAllowed(permissionRead.value))

    if (!useLegacy) {
      try {
        // 使用现代 Clipboard API 读取文本
        text.value = await navigator!.clipboard.readText()
      }
      catch {
        // 读取失败时切换到降级方案
        useLegacy = true
      }
    }

    if (useLegacy) {
      // 使用旧版方案读取文本
      text.value = legacyRead()
    }
  }

  // 如果支持剪贴板且启用了 read 选项，则监听 copy 和 cut 事件
  if (isSupported.value && read)
    useEventListener(['copy', 'cut'], updateText, { passive: true })

  /**
   * 复制文本到剪贴板
   * @param value - 要复制的文本内容，如果未提供则使用 source 配置的默认值
   */
  async function copy(value = toValue(source)) {
    // 检查是否支持剪贴板且提供了有效值
    if (isSupported.value && value != null) {
      // 判断是否使用降级方案
      let useLegacy = !(isClipboardApiSupported.value && isAllowed(permissionWrite.value))

      if (!useLegacy) {
        try {
          // 使用现代 Clipboard API 写入文本
          await navigator!.clipboard.writeText(value)
        }
        catch {
          // 写入失败时切换到降级方案
          useLegacy = true
        }
      }

      if (useLegacy)
        // 使用旧版方案复制文本
        legacyCopy(value)

      // 更新文本内容和复制状态
      text.value = value
      copied.value = true
      timeout.start()
    }
  }

  /**
   * 使用旧版 document.execCommand 方案复制文本
   * 适用于不支持 Clipboard API 的浏览器
   * @param value - 要复制的文本内容
   */
  function legacyCopy(value: string) {
    // 创建临时的隐藏 textarea 元素
    const ta = document.createElement('textarea')
    ta.value = value
    ta.style.position = 'absolute'
    ta.style.opacity = '0'
    ta.setAttribute('readonly', '')

    // 将元素添加到文档中并选中内容
    document.body.appendChild(ta)
    ta.select()

    // 执行复制命令
    document.execCommand('copy')

    // 清理临时元素
    ta.remove()
  }

  /**
   * 使用旧版方案读取剪贴板文本
   * 通过获取当前选中的文本内容来模拟读取剪贴板
   * @returns 选中的文本内容，如果没有选中内容则返回空字符串
   */
  function legacyRead() {
    return document?.getSelection?.()?.toString() ?? ''
  }

  /**
   * 检查权限状态是否允许操作
   * @param status - 权限状态
   * @returns 如果权限状态为 'granted'（已授权）或 'prompt'（待授权）则返回 true
   */
  function isAllowed(status: PermissionState | undefined) {
    return status === 'granted' || status === 'prompt'
  }

  // 返回响应式数据和操作方法
  return {
    isSupported,
    text: readonly(text),
    copied: readonly(copied),
    copy,
  }
}
