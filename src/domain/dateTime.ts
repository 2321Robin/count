import type { DeviceKind } from "./device";

export function formatDateTimeInput(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

export function normalizeRecordDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00:00`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return `${value}:00`;
  return value;
}

export function formatRecordDate(value: string): string {
  return normalizeRecordDate(value).replace("T", " ");
}

export const DEVICE_LABELS: Record<DeviceKind, string> = {
  computer: "电脑",
  phone: "手机",
  tablet: "平板",
  unknown: "未知设备",
};

/**
 * 记录/数据的修改时间与设备展示文案。旧数据无 updatedAt 时返回 null（调用方不渲染）；
 * 有时间但缺设备信息时显示"未知设备"。时间显示格式与 DataManager 的"上次同步"一致。
 */
export function formatMetaStamp(updatedAt: string | undefined, updatedBy: DeviceKind | undefined): string | null {
  if (!updatedAt) return null;
  const device = updatedBy ? DEVICE_LABELS[updatedBy] : "未知设备";
  return `${device} · ${new Date(updatedAt).toLocaleString("zh-CN", { hour12: false })}`;
}
