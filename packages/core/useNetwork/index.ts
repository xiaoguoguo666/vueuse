/* this implementation is original ported from https://github.com/logaretm/vue-use-web by Abdelrahman Awad */

import type { ShallowRef } from 'vue'
import type { ConfigurableWindow } from '../_configurable'
import type { Supportable } from '../types'
import { readonly, shallowRef } from 'vue'
import { defaultWindow } from '../_configurable'
import { useEventListener } from '../useEventListener'
import { useSupported } from '../useSupported'

// 网络状态监听选项接口
export interface UseNetworkOptions extends ConfigurableWindow {
}

// 网络连接类型枚举
export type NetworkType = 'bluetooth' | 'cellular' | 'ethernet' | 'none' | 'wifi' | 'wimax' | 'other' | 'unknown'

// 网络有效类型（表示连接速度等级）
export type NetworkEffectiveType = 'slow-2g' | '2g' | '3g' | '4g' | undefined

// 网络状态信息接口，继承支持性检测
export interface NetworkState extends Supportable {
  /**
   * 用户当前是否在线
   */
  isOnline: Readonly<ShallowRef<boolean>>
  /**
   * 用户最后一次离线的时间戳
   */
  offlineAt: Readonly<ShallowRef<number | undefined>>
  /**
   * 用户当前在线的时间戳（如果之前离线后重新连接）
   */
  onlineAt: Readonly<ShallowRef<number | undefined>>
  /**
   * 当前连接的下载速度（Mbps）
   */
  downlink: Readonly<ShallowRef<number | undefined>>
  /**
   * 最大可达到的下载速度（Mbps）
   */
  downlinkMax: Readonly<ShallowRef<number | undefined>>
  /**
   * 检测到的有效速度类型
   */
  effectiveType: Readonly<ShallowRef<NetworkEffectiveType | undefined>>
  /**
   * 当前连接的估计有效往返时间
   */
  rtt: Readonly<ShallowRef<number | undefined>>
  /**
   * 用户是否启用了数据节省模式
   */
  saveData: Readonly<ShallowRef<boolean | undefined>>
  /**
   * 检测到的连接/网络类型
   */
  type: Readonly<ShallowRef<NetworkType>>
}

// useNetwork 函数的返回类型
export type UseNetworkReturn = Readonly<NetworkState>

/**
 * 响应式网络状态监听
 * 实时监控浏览器的网络连接状态和质量
 *
 * @see https://vueuse.org/useNetwork
 * @param options - 网络监听选项
 *
 * @__NO_SIDE_EFFECTS__
 */
export function useNetwork(options: UseNetworkOptions = {}): UseNetworkReturn {
  // 解构获取 window 对象，如果未提供则使用默认 window
  const { window = defaultWindow } = options
  // 获取浏览器的 navigator 对象
  const navigator = window?.navigator
  // 检测浏览器是否支持网络信息 API
  const isSupported = useSupported(() => navigator && 'connection' in navigator)

  // 网络在线状态响应式变量
  const isOnline = shallowRef(true)
  // 数据节省模式状态
  const saveData = shallowRef(false)
  // 离线时间戳
  const offlineAt = shallowRef<number | undefined>(undefined)
  // 在线时间戳
  const onlineAt = shallowRef<number | undefined>(undefined)
  // 当前下载速度 (Mbps)
  const downlink = shallowRef<number | undefined>(undefined)
  // 最大下载速度 (Mbps)
  const downlinkMax = shallowRef<number | undefined>(undefined)
  // 往返时间 (ms)
  const rtt = shallowRef<number | undefined>(undefined)
  // 有效网络类型
  const effectiveType = shallowRef<NetworkEffectiveType>(undefined)
  // 网络连接类型
  const type = shallowRef<NetworkType>('unknown')

  // 获取网络连接信息对象（如果浏览器支持）
  const connection = isSupported.value && (navigator as any).connection

  // 更新网络信息的函数
  function updateNetworkInformation() {
    // 如果没有 navigator 对象，直接返回
    if (!navigator)
      return

    // 更新在线状态
    isOnline.value = navigator.onLine
    // 更新离线时间戳：如果在线则清空，离线则记录当前时间
    offlineAt.value = isOnline.value ? undefined : Date.now()
    // 更新在线时间戳：如果在线则记录当前时间，离线则清空
    onlineAt.value = isOnline.value ? Date.now() : undefined

    // 如果支持网络连接信息 API，则更新相关网络属性
    if (connection) {
      downlink.value = connection.downlink // 下载速度
      downlinkMax.value = connection.downlinkMax // 最大下载速度
      effectiveType.value = connection.effectiveType // 有效类型
      rtt.value = connection.rtt // 往返时间
      saveData.value = connection.saveData // 数据节省模式
      type.value = connection.type // 连接类型
    }
  }

  // 事件监听器选项，使用被动监听提高性能
  // 使用 passive: true 后，浏览器可以：
  // 1. 立即更新 navigator.onLine 状态
  // 2. 同时并行执行我们的回调函数
  // 3. 避免因为回调执行时间长而阻塞页面
  const listenerOptions = { passive: true }

  // 如果有 window 对象，设置网络状态变化监听器
  if (window) {
    // 监听离线事件
    useEventListener(window, 'offline', () => {
      isOnline.value = false // 设置为离线
      offlineAt.value = Date.now() // 记录离线时间
    }, listenerOptions)

    // 监听在线事件
    useEventListener(window, 'online', () => {
      isOnline.value = true // 设置为在线
      onlineAt.value = Date.now() // 记录在线时间
    }, listenerOptions)
  }

  // 如果支持网络连接信息 API，监听网络连接变化
  if (connection)
    useEventListener(connection, 'change', updateNetworkInformation, listenerOptions)

  // 初始化时立即更新一次网络信息
  updateNetworkInformation()

  // 返回只读的网络状态对象
  return {
    isSupported, // 浏览器是否支持网络信息 API
    isOnline: readonly(isOnline), // 当前在线状态
    saveData: readonly(saveData), // 数据节省模式状态
    offlineAt: readonly(offlineAt), // 最后离线时间
    onlineAt: readonly(onlineAt), // 最后在线时间
    downlink: readonly(downlink), // 下载速度
    downlinkMax: readonly(downlinkMax), // 最大下载速度
    effectiveType: readonly(effectiveType), // 网络有效类型
    rtt: readonly(rtt), // 往返时间
    type: readonly(type), // 连接类型
  }
}
