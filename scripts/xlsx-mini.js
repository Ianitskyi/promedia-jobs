/* Мінімальний читач .xlsx/.xls без зовнішніх залежностей — навмисно, а не
 * npm-пакет `xlsx`: опублікована на npm версія (0.18.5) має відомі незакриті
 * вразливості (prototype pollution, ReDoS), а офіційний патчений білд
 * SheetJS роздають лише зі свого CDN, недоступного з цього середовища
 * розробки для перевірки. Читає лише перший аркуш і лише значення клітинок
 * (без формул і стилів) — саме стільки, скільки треба для табличних
 * держдатасетів.
 *
 * Підтримує два різні формати під розширенням .xls/.xlsx, які реально
 * трапляються на data.gov.ua:
 *   1. Справжній .xlsx — ZIP-архів з xl/worksheets/sheet1.xml усередині.
 *   2. "Excel XML Spreadsheet 2003" (SpreadsheetML) — попри розширення
 *      .xls/.xlsx це насправді один текстовий XML-файл (<?xml ...?>
 *      <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet">...),
 *      без жодного стиснення чи ZIP-контейнера. Виявлено на реальних
 *      ресурсах ДСЗ за 2025-2026: усі вони саме такі, тож без підтримки
 *      цього формату імпорт бачив лише дані 2020 року. */
const zlib = require("zlib");

const OLE2_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

function findEocd(buf) {
  if (buf.length >= 8 && buf.slice(0, 8).equals(OLE2_SIGNATURE)) {
    throw new Error(
      "Це старий бінарний .xls (OLE2/Compound File), а не .xlsx (ZIP) — потрібен інший парсер для цього формату."
    );
  }
  const sig = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  const minLen = 22;
  const searchStart = Math.max(0, buf.length - 65557);
  for (let i = buf.length - minLen; i >= searchStart; i--) {
    if (buf[i] === sig[0] && buf[i + 1] === sig[1] && buf[i + 2] === sig[2] && buf[i + 3] === sig[3]) {
      return i;
    }
  }
  const head = buf.slice(0, Math.min(16, buf.length)).toString("hex");
  throw new Error(
    `Не ZIP-файл (не знайдено End Of Central Directory). Розмір: ${buf.length} байт, перші байти: ${head}.`
  );
}

function readZipEntries(buf) {
  const eocdOffset = findEocd(buf);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);
  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  const entries = {};
  let p = cdOffset;
  for (let i = 0; i < totalEntries; i++) {
    const sig = buf.readUInt32LE(p);
    if (sig !== 0x02014b50) throw new Error(`Пошкоджений ZIP: неочікуваний сигнатура центрального каталогу на ${p}.`);
    const compressionMethod = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const uncompressedSize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localHeaderOffset = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nameLen).toString("utf8");
    entries[name] = { compressionMethod, compressedSize, uncompressedSize, localHeaderOffset };
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function readZipEntryData(buf, entry) {
  const p = entry.localHeaderOffset;
  const sig = buf.readUInt32LE(p);
  if (sig !== 0x04034b50) throw new Error(`Пошкоджений ZIP: неочікувана сигнатура локального заголовка на ${p}.`);
  const nameLen = buf.readUInt16LE(p + 26);
  const extraLen = buf.readUInt16LE(p + 28);
  const dataStart = p + 30 + nameLen + extraLen;
  const compressed = buf.slice(dataStart, dataStart + entry.compressedSize);
  if (entry.compressionMethod === 0) return compressed;
  if (entry.compressionMethod === 8) return zlib.inflateRawSync(compressed);
  throw new Error(`Непідтримуваний метод стиснення ZIP: ${entry.compressionMethod}.`);
}

function xmlUnescape(s) {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, "&");
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  const strings = [];
  const siRe = /<si>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = siRe.exec(xml))) {
    const inner = m[1];
    let text = "";
    const tRe = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
    let tm;
    while ((tm = tRe.exec(inner))) text += xmlUnescape(tm[1]);
    strings.push(text);
  }
  return strings;
}

function colLettersToIndex(letters) {
  let idx = 0;
  for (let i = 0; i < letters.length; i++) {
    idx = idx * 26 + (letters.charCodeAt(i) - 64);
  }
  return idx - 1;
}

function parseSheetRows(xml, sharedStrings) {
  const rows = [];
  const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g;
  let rm;
  while ((rm = rowRe.exec(xml))) {
    const rowXml = rm[1];
    const cells = [];
    const cellRe = /<c\s([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm;
    while ((cm = cellRe.exec(rowXml))) {
      const attrs = cm[1];
      const inner = cm[2] || "";
      const refMatch = attrs.match(/r="([A-Z]+)\d+"/);
      const typeMatch = attrs.match(/t="([^"]+)"/);
      const type = typeMatch ? typeMatch[1] : "n";
      let value = "";
      if (type === "s") {
        const vMatch = inner.match(/<v>([\s\S]*?)<\/v>/);
        if (vMatch) value = sharedStrings[parseInt(vMatch[1], 10)] || "";
      } else if (type === "inlineStr") {
        const tMatch = inner.match(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/);
        if (tMatch) value = xmlUnescape(tMatch[1]);
      } else {
        const vMatch = inner.match(/<v>([\s\S]*?)<\/v>/);
        if (vMatch) value = xmlUnescape(vMatch[1]);
      }
      const colIdx = refMatch ? colLettersToIndex(refMatch[1]) : cells.length;
      cells[colIdx] = value;
    }
    for (let i = 0; i < cells.length; i++) if (cells[i] === undefined) cells[i] = "";
    rows.push(cells);
  }
  return rows;
}

function stripBom(buf) {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return buf.slice(3);
  return buf;
}

function looksLikeXmlProlog(buf) {
  return buf.length >= 5 && buf.slice(0, 5).toString("latin1") === "<?xml";
}

// Кодування декларується в самому пролозі (encoding="..."), і саме йому
// довіряємо — на відміну від CSV, тут немає сенсу вгадувати евристикою:
// SpreadsheetML державних систем трапляється як у windows-1251, так і в UTF-8.
function decodeXmlBuffer(buf) {
  const prolog = buf.slice(0, 200).toString("latin1");
  const m = prolog.match(/encoding="([^"]+)"/i);
  const enc = (m ? m[1] : "utf-8").toLowerCase();
  try {
    if (enc.includes("1251")) return new TextDecoder("windows-1251").decode(buf);
    return new TextDecoder("utf-8").decode(buf);
  } catch (e) {
    return buf.toString("utf8");
  }
}

// "Excel XML Spreadsheet 2003" (SpreadsheetML): <Row><Cell ss:Index="N">
// <Data>текст</Data></Cell></Row>. ss:Index — це 1-based позиція колонки і
// трапляється, лише коли попередні клітинки в рядку пропущені (порожні), тож
// без нього рахуємо позицію послідовно.
function parseSpreadsheetMlRows(xml) {
  const wsMatch = xml.match(/<(?:ss:)?Table\b[^>]*>([\s\S]*?)<\/(?:ss:)?Table>/i);
  const tableXml = wsMatch ? wsMatch[1] : xml;
  const rows = [];
  const rowRe = /<(?:ss:)?Row\b[^>]*>([\s\S]*?)<\/(?:ss:)?Row>/g;
  let rm;
  while ((rm = rowRe.exec(tableXml))) {
    const rowXml = rm[1];
    const cells = [];
    let cursor = 0;
    const cellRe = /<(?:ss:)?Cell\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:ss:)?Cell>)/g;
    let cm;
    while ((cm = cellRe.exec(rowXml))) {
      const attrs = cm[1] || "";
      const inner = cm[2] || "";
      const idxMatch = attrs.match(/(?:ss:)?Index="(\d+)"/);
      if (idxMatch) cursor = parseInt(idxMatch[1], 10) - 1;
      const dataMatch = inner.match(/<(?:ss:)?Data\b[^>]*>([\s\S]*?)<\/(?:ss:)?Data>/);
      cells[cursor] = dataMatch ? xmlUnescape(dataMatch[1]) : "";
      cursor++;
    }
    for (let i = 0; i < cells.length; i++) if (cells[i] === undefined) cells[i] = "";
    rows.push(cells);
  }
  return rows.filter((r) => r.length && r.some((c) => String(c).trim() !== ""));
}

// Реальні "XLSX"-ресурси ДСЗ за 2025-2026 роки виявились не Excel-файлами
// взагалі (ні ZIP-.xlsx, ні SpreadsheetML) — а плоским XML-фідом вакансій
// власного формату dcz.gov.ua: <jobs><job id="..."><link>/<name>/<region>/
// /<description>/<pubdate>/<salary>/<company>/<expire>/<jobtype>/<phone>
// (кожне поле — у <![CDATA[...]]>, а всередині опису — ще й HTML-розмітка).
// data.gov.ua лише неправильно підписав формат ресурсу як XLSX.
function looksLikeJobsFeed(xml) {
  return /<jobs[\s>]/i.test(xml.slice(0, 500)) && /<job[\s>]/i.test(xml.slice(0, 3000));
}

function extractCdataOrText(inner) {
  // Зазвичай <![CDATA[ ... ]]>, але деякі ресурси ДСЗ віддають дещо
  // пошкоджений варіант без "<!" — тож приймаємо обидва.
  const m = inner.match(/<?!?\[CDATA\[([\s\S]*?)\]\]>?/);
  return xmlUnescape((m ? m[1] : inner)).trim();
}

function stripHtmlTags(text) {
  return text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function extractJobField(jobXml, tag) {
  const m = jobXml.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? extractCdataOrText(m[1]) : "";
}

function parseJobsFeedRows(xml) {
  const header = ["назва вакансії", "роботодавець", "область", "заробітна плата", "опис вакансії"];
  const rows = [header];
  const jobRe = /<job\b[^>]*>([\s\S]*?)<\/job>/g;
  let m;
  while ((m = jobRe.exec(xml))) {
    const jobXml = m[1];
    const title = extractJobField(jobXml, "name");
    if (!title) continue;
    const company = extractJobField(jobXml, "company");
    const region = extractJobField(jobXml, "region");
    const salary = extractJobField(jobXml, "salary");
    const description = stripHtmlTags(extractJobField(jobXml, "description"));
    rows.push([title, company, region, salary, description]);
  }
  return rows;
}

function parseXlsxRows(rawBuf) {
  const buf = stripBom(rawBuf);
  if (looksLikeXmlProlog(buf)) {
    const xml = decodeXmlBuffer(buf);
    if (looksLikeJobsFeed(xml)) {
      const rows = parseJobsFeedRows(xml);
      if (rows.length < 2) throw new Error("XML-фід вакансій ДСЗ розпізнано, але жодного <job> з назвою не знайдено.");
      return rows;
    }
    const rows = parseSpreadsheetMlRows(xml);
    if (!rows.length) {
      // Файл справді XML, але не в жодній із двох відомих структур — швидше
      // здатися з діагностикою, ніж мовчки повернути "порожній файл" і
      // втратити слід, чому саме.
      const rootTags = [...xml.slice(0, 3000).matchAll(/<([a-zA-Z][\w:.-]*)[ >]/g)].map((m) => m[1]);
      const uniqueTags = [...new Set(rootTags)].slice(0, 15);
      throw new Error(
        `XML-файл не розпізнано ні як SpreadsheetML, ні як фід вакансій ДСЗ. ` +
        `Перші теги в документі: ${JSON.stringify(uniqueTags)}. Фрагмент: ${xml.slice(0, 300)}`
      );
    }
    return rows;
  }

  const entries = readZipEntries(buf);
  const sheetName = Object.keys(entries)
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort()[0];
  if (!sheetName) throw new Error("У .xlsx не знайдено xl/worksheets/sheet*.xml.");
  const sheetXml = readZipEntryData(buf, entries[sheetName]).toString("utf8");
  let sharedStrings = [];
  if (entries["xl/sharedStrings.xml"]) {
    const sharedXml = readZipEntryData(buf, entries["xl/sharedStrings.xml"]).toString("utf8");
    sharedStrings = parseSharedStrings(sharedXml);
  }
  const rows = parseSheetRows(sheetXml, sharedStrings);
  return rows.filter((r) => r.length && r.some((c) => String(c).trim() !== ""));
}

module.exports = { parseXlsxRows };
