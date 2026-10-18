/**
 * تمام شوب - سكربت Google Sheet للطلبات
 * نفس السكربت يُستخدم لشيت 1 ولشيت 2 (كل شيت له نسخة خاصة به ورابط خاص).
 *
 * طريقة التركيب:
 * 1) افتح الشيت ← Extensions ← Apps Script
 * 2) امسح الموجود والصق هذا الملف كاملاً ← Save
 * 3) Deploy ← New deployment ← النوع: Web app
 *      Execute as: Me
 *      Who has access: Anyone
 *    ← Deploy ← وافق على الصلاحيات ← انسخ رابط Web app (ينتهي بـ /exec)
 * 4) حط الرابط بـ Netlify:  GOOGLE_SHEET_1_URL  (أو GOOGLE_SHEET_2_URL للشيت الثاني)
 *
 * بعد أي تعديل على هذا الكود:
 * Deploy ← Manage deployments ← ✏️ ← Version: New version ← Deploy   (الرابط يبقى نفسه)
 *
 * يكتب في أول تبويب بالشيت. إذا الشيت فارغ يضيف العناوين تلقائياً.
 * يمنع التكرار: نفس رقم الطلب، أو نفس الرقم + نفس المنتج خلال 5 دقائق، يُتجاهل.
 */

const HEADERS = ['اسم المنتج', 'اسم المستلم', 'الرقم', 'الدولة', 'المحافظة / المدينة', 'العنوان', 'العنوان الوطني', 'معرف المنتج', 'الكمية', 'السعر الكلي', 'العملة', 'الملاحظات', 'التاريخ', 'رقم الطلب'];
const DUPLICATE_WINDOW_MS = 5 * 60 * 1000;
const ORDER_ID_MEMORY_MS = 60 * 60 * 1000;
const TIMEZONE = 'Asia/Baghdad';

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const order = JSON.parse(e.postData.contents);
    const now = Date.now();
    const props = PropertiesService.getScriptProperties();
    const memory = readMemory_(props, now);

    // 1) Same order sent twice (automatic retry) -> ignore
    if (order.orderId && memory.ids[order.orderId]) {
      return json_({ ok: true, duplicate: true });
    }
    // 2) Same phone + same product within 5 minutes -> ignore
    const dupKey = String(order.phone || '') + '_' + String(order.productId || '');
    if (memory.recent[dupKey] && now - memory.recent[dupKey] < DUPLICATE_WINDOW_MS) {
      return json_({ ok: true, duplicate: true });
    }

    const sheet = getSheet_();
    sheet.appendRow([
      order.productName || '',
      order.name || '',
      // Written as text so the leading 0 stays (07701234567)
      "'" + String(order.phone || ''),
      order.country || '',
      order.governorate || '',
      order.address || '',
      order.nationalAddress || '',
      order.productId || '',
      Number(order.quantity) || 1,
      Number(order.totalPrice) || 0,
      order.currency || '',
      order.notes || '',
      Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd H:mm:ss'),
      order.orderId || '',
    ]);

    if (order.orderId) memory.ids[order.orderId] = now;
    memory.recent[dupKey] = now;
    props.setProperty('memory', JSON.stringify(memory));
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/** Opening the link in a browser shows this (useful to check the link works). */
function doGet() {
  return json_({ ok: true, message: 'تمام شوب: سكربت الطلبات شغّال' });
}

function readMemory_(props, now) {
  let memory = { ids: {}, recent: {} };
  try {
    memory = JSON.parse(props.getProperty('memory') || '{}');
  } catch (e) {}
  memory.ids = memory.ids || {};
  memory.recent = memory.recent || {};
  Object.keys(memory.ids).forEach(function (k) {
    if (now - memory.ids[k] > ORDER_ID_MEMORY_MS) delete memory.ids[k];
  });
  Object.keys(memory.recent).forEach(function (k) {
    if (now - memory.recent[k] > DUPLICATE_WINDOW_MS) delete memory.recent[k];
  });
  return memory;
}

function getSheet_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
