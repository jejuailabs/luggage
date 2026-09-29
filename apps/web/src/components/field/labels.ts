/** 현장 화면 한국어 표기. */
export const BAG_STATUS_KO: Record<string, string> = {
  registered: "등록",
  at_origin: "호텔 보관",
  collected: "수거 완료",
  in_transit: "이동 중",
  ready_for_handoff: "인계 준비",
  delivered: "인계 완료",
  exception_hold: "예외 보류",
  return_in_progress: "반환 중",
  returned: "반환 완료",
  cancelled_before_pickup: "수거 전 취소",
};

export const JOB_STATUS_KO: Record<string, string> = {
  planned: "배정 전",
  assigned: "배정됨",
  picking_up: "수거 중",
  transporting: "운송 중",
  ready: "인계 준비",
  completed: "완료",
  exception: "예외",
  returning: "반환 중",
  returned: "반환 완료",
  cancelled: "취소",
};

export const INCIDENT_TYPE_KO: Record<string, string> = {
  missing_at_origin: "호텔에서 짐을 찾지 못함",
  damage: "외관 손상",
  quantity_mismatch: "수량 불일치",
  vehicle_breakdown: "차량 고장",
  delay: "지연",
  flight_change: "항공편 변경",
  customer_no_show: "고객 미도착",
  partial_missing: "일부 누락",
  lost: "분실",
  location_change: "인계 장소 변경",
  other: "기타",
};

export const BAG_SIZE_KO: Record<string, string> = { standard: "보통", large: "대형" };
