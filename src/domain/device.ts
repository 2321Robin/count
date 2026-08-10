export type DeviceKind = "computer" | "phone" | "tablet" | "unknown";

const PHONE_PATTERN = /Android|iPhone|iPod|Mobile|Opera Mini/;
const COMPUTER_PATTERN = /Windows|Macintosh|Mac OS X|Linux|X11|CrOS/;

/**
 * 纯函数设备分类：按 UA 与触摸能力把访问端归类为电脑/手机/平板。
 * 顺序敏感：iPad 优先，Macintosh+触摸判平板（iPad 桌面版网页伪装成 Mac），
 * 安卓无 Mobile 标记判平板，其余按手机/桌面特征兜底，无法识别返回 unknown。
 */
export function classifyDeviceKind(ua: string, maxTouchPoints: number): DeviceKind {
  if (/iPad/.test(ua)) return "tablet";
  if (/Macintosh/.test(ua) && maxTouchPoints > 1) return "tablet";
  if (/Android/.test(ua) && !/Mobile/.test(ua)) return "tablet";
  if (PHONE_PATTERN.test(ua)) return "phone";
  if (COMPUTER_PATTERN.test(ua)) return "computer";
  return "unknown";
}

type UserAgentDataLike = { mobile?: boolean; platform?: string };

/**
 * 浏览器环境封装：优先 navigator.userAgentData（现代 Chromium），降级 UA 正则。
 * 不缓存：apply 是低频用户操作，重复检测开销可忽略，且避免测试间状态污染。
 * 无 navigator（node 测试环境）或读取失败时返回 unknown，不向上抛。
 */
export function detectDeviceKind(): DeviceKind {
  const nav = typeof navigator === "undefined" ? undefined : navigator;
  if (!nav) return "unknown";

  try {
    const uad = (nav as Navigator & { userAgentData?: UserAgentDataLike }).userAgentData;
    if (uad) {
      if (uad.mobile) return "phone";
      if (uad.platform === "Android") return "tablet";
      if (uad.platform === "Windows" || uad.platform === "macOS" || uad.platform === "Linux" || uad.platform === "Chrome OS") return "computer";
    }
    const ua = nav.userAgent ?? "";
    const maxTouchPoints = typeof nav.maxTouchPoints === "number" ? nav.maxTouchPoints : 0;
    return classifyDeviceKind(ua, maxTouchPoints);
  } catch {
    return "unknown";
  }
}
