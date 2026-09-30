import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export interface SettlementStatement {
  partnerName: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  totalMinor: number;
  payoutReference: string | null;
  items: { orderCode: string; hotelName: string; kind: string; amountMinor: number }[];
}

const navy = rgb(0.045, 0.17, 0.27);
const blue = rgb(0.04, 0.43, 0.82);
const muted = rgb(0.39, 0.48, 0.55);
const line = rgb(0.85, 0.89, 0.92);
const pale = rgb(0.94, 0.97, 0.99);
const won = (minor: number) => `${minor.toLocaleString("ko-KR")}원`;

function fit(font: PDFFont, value: string, size: number, width: number): string {
  if (font.widthOfTextAtSize(value, size) <= width) return value;
  let text = value;
  while (text.length > 1 && font.widthOfTextAtSize(`${text}…`, size) > width) text = text.slice(0, -1);
  return `${text}…`;
}

function drawFooter(page: PDFPage, font: PDFFont, index: number, total: number) {
  const width = page.getWidth();
  page.drawLine({ start: { x: 44, y: 42 }, end: { x: width - 44, y: 42 }, thickness: 0.7, color: line });
  page.drawText("제주 커넥트 · 제휴 정산 내역", { x: 44, y: 27, size: 8, font, color: muted });
  const count = `${index} / ${total}`;
  page.drawText(count, { x: width - 44 - font.widthOfTextAtSize(count, 8), y: 27, size: 8, font, color: muted });
}

/** 재무/제휴사에 제공하는 정산 배치 내역. 청구서·세금계산서가 아니다. */
export async function makeSettlementPdf(statement: SettlementStatement): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fontBytes = await readFile(join(process.cwd(), "public", "fonts", "Pretendard-Medium.ttf"));
  const font = await pdf.embedFont(fontBytes, { subset: false });
  const pageSize: [number, number] = [595.28, 841.89];
  let page = pdf.addPage(pageSize);
  let y = pageSize[1] - 48;
  const left = 44;
  const right = pageSize[0] - 44;
  const text = (value: string, x: number, atY: number, size: number, color = navy) => page.drawText(value, { x, y: atY, size, font, color });
  const rowHead = () => {
    page.drawRectangle({ x: left, y: y - 28, width: right - left, height: 30, color: pale });
    text("예약번호", left + 11, y - 16, 9, muted);
    text("숙소", left + 132, y - 16, 9, muted);
    text("구분", left + 316, y - 16, 9, muted);
    text("금액", right - 75, y - 16, 9, muted);
    y -= 36;
  };
  page.drawRectangle({ x: 0, y: pageSize[1] - 185, width: pageSize[0], height: 185, color: navy });
  text("JEJU CONNECT / PARTNER", left, pageSize[1] - 55, 10, rgb(0.55, 0.82, 1));
  text("호텔 제휴 정산 내역서", left, pageSize[1] - 96, 24, rgb(1, 1, 1));
  text(fit(font, statement.partnerName, 12, right - left), left, pageSize[1] - 128, 12, rgb(1, 1, 1));
  text(`${statement.periodStart} ~ ${statement.periodEnd}`, left, pageSize[1] - 153, 10, rgb(0.72, 0.82, 0.88));
  y = pageSize[1] - 218;
  text("정산 상태", left, y, 10, muted);
  text(statement.status === "paid" ? "지급 완료" : statement.status === "confirmed" ? "확정" : "초안", left, y - 23, 14);
  text("정산 합계", left + 256, y, 10, muted);
  text(won(statement.totalMinor), left + 256, y - 25, 19, blue);
  y -= 72;
  if (statement.payoutReference) { text(`지급 참조: ${fit(font, statement.payoutReference, 9, 385)}`, left, y, 9, muted); y -= 25; }
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.7, color: line });
  y -= 34;
  text("정산 항목", left, y, 14);
  text(`${statement.items.length}건`, right - 34, y, 10, muted);
  y -= 18;
  rowHead();
  for (const item of statement.items) {
    if (y < 85) { page = pdf.addPage(pageSize); y = pageSize[1] - 62; rowHead(); }
    text(fit(font, item.orderCode, 9, 116), left + 11, y - 14, 9);
    text(fit(font, item.hotelName, 9, 172), left + 132, y - 14, 9);
    text(item.kind === "clawback" ? "환수" : "수수료", left + 316, y - 14, 9, item.kind === "clawback" ? blue : muted);
    const amount = won(item.amountMinor);
    text(amount, right - 11 - font.widthOfTextAtSize(amount, 9), y - 14, 9);
    page.drawLine({ start: { x: left, y: y - 24 }, end: { x: right, y: y - 24 }, thickness: 0.4, color: line });
    y -= 27;
  }
  if (y < 105) { page = pdf.addPage(pageSize); y = pageSize[1] - 75; }
  y -= 30;
  page.drawRectangle({ x: left, y: y - 34, width: right - left, height: 46, color: pale });
  text("합계", left + 13, y - 16, 11);
  const total = won(statement.totalMinor);
  text(total, right - 13 - font.widthOfTextAtSize(total, 14), y - 18, 14, blue);
  y -= 68;
  text("이 문서는 정산 확인용이며 세금계산서를 대신하지 않습니다.", left, y, 9, muted);
  pdf.getPages().forEach((current, index) => drawFooter(current, font, index + 1, pdf.getPageCount()));
  pdf.setTitle(`${statement.partnerName} 정산 내역서`);
  pdf.setAuthor("제주 커넥트");
  return pdf.save();
}
