"use client";

import { useEffect } from "react";
import { putItem } from "@/lib/local-store";

export interface VoucherSnapshot {
  orderId: string;
  publicCode: string;
  /** 표시용 요약 줄 (노선·시간·짐). 이름·연락처는 넣지 않는다. */
  lines: string[];
  checkedAtKst: string;
}

/** 확정 예약증의 오프라인 사본을 기기에 저장한다 (오프라인 화면에서 마지막 서버 확인 시각과 함께 표시). */
export function VoucherOfflineCopy({ snapshot }: { snapshot: VoucherSnapshot }) {
  useEffect(() => {
    if (typeof indexedDB === "undefined") return;
    putItem("vouchers", snapshot.orderId, snapshot).catch(() => {
      // 저장 공간 부족 등은 무시한다 (온라인 화면은 그대로 동작).
    });
  }, [snapshot]);
  return null;
}
