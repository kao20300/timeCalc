let anchorId = "A";
let ceremonyCounter = 1;
const DEFAULT_ANCHOR_ID = "A";
let draggedRow = null;

/**
 * 輔助函數：時間字串轉分鐘數
 * @param {string} timeStr - 時間字串 (HH:MM)
 * @returns {number|null} 總分鐘數 (從午夜開始)
 */
function timeToMinutes(timeStr) {
  if (!timeStr || timeStr.length !== 5) return null;
  const [hours, minutes] = timeStr.split(":").map(Number);
  if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
    return hours * 60 + minutes;
  }
  return null;
}

/**
 * 輔助函數：分鐘數轉時間字串
 * @param {number} totalMinutes - 總分鐘數 (可超過一天)
 * @returns {string} 時間字串 (HH:MM)
 */
function minutesToTime(totalMinutes) {
  const MINUTES_IN_DAY = 24 * 60;
  // 處理跨天 (正數或負數)
  const safeMinutes =
    ((totalMinutes % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  const hourStr = String(hours).padStart(2, "0");
  const minuteStr = String(minutes).padStart(2, "0");
  return `${hourStr}:${minuteStr}`;
}

/**
 * 輔助函數：取得當前所有流程的 ID 列表
 * @returns {string[]} 流程 ID 陣列
 */
function getCeremonyIds() {
  const rows = document.getElementById("ceremony-tbody").querySelectorAll("tr");
  const ids = Array.from(rows).map((row) => row.getAttribute("data-id"));
  return ids;
}

/**
 * 核心計算邏輯
 * 根據任一設定的時間 (Anchor) 推算其他流程的時間。
 * @param {string|null} triggeredId - 觸發計算的元素的 ID (通常是 start-time-X)
 */
function calculateTimes(triggeredId) {
  const CEREMONY_IDS = getCeremonyIds();

  // 1. 檢查並更新錨點 (Anchor)
  if (triggeredId && triggeredId.startsWith("start-time-")) {
    const currentAnchor = triggeredId.replace("start-time-", "");
    const timeValue = document.getElementById(triggeredId).value;
    if (timeToMinutes(timeValue) !== null) {
      anchorId = currentAnchor;
    }
  }

  let effectiveAnchorId = anchorId;
  let anchorTimeElement = document.getElementById(`start-time-${effectiveAnchorId}`);
  let anchorTime_min = timeToMinutes(
    anchorTimeElement ? anchorTimeElement.value : null
  );

  // 2. 如果當前錨點時間無效，尋找第一個有設定時間的作為新的錨點
  if (anchorTime_min === null || !anchorTimeElement) {
    effectiveAnchorId = null;
    for (const id of CEREMONY_IDS) {
      const timeInput = document.getElementById(`start-time-${id}`);
      if (timeToMinutes(timeInput ? timeInput.value : null) !== null) {
        effectiveAnchorId = id;
        anchorTime_min = timeToMinutes(timeInput.value);
        break;
      }
    }
  }

  // 3. 如果仍找不到錨點 (所有時間都未設定)
  if (anchorTime_min === null || effectiveAnchorId === null) {
    anchorId = DEFAULT_ANCHOR_ID;
    CEREMONY_IDS.forEach((id) => {
      const timeInput = document.getElementById(`start-time-${id}`);
      if (timeInput) {
        timeInput.classList.remove("output-field");
        timeInput.title = "";
      }
    });
    return;
  }

  // 確定有效的錨點
  anchorId = effectiveAnchorId;

  // 4. 收集所有流程時長
  const durations = {};
  CEREMONY_IDS.forEach((id) => {
    const durationInput = document.getElementById(`duration-${id}`);
    durations[id] = Number(durationInput ? durationInput.value : 0) || 0;
  });

  // 5. 進行時間推算
  const calculatedMinutes = {};
  calculatedMinutes[anchorId] = anchorTime_min;
  const anchorIndex = CEREMONY_IDS.indexOf(anchorId);

  // 往前推算
  let currentMin = anchorTime_min;
  for (let i = anchorIndex; i > 0; i--) {
    const prevId = CEREMONY_IDS[i - 1];
    const prevDuration = durations[prevId];
    currentMin -= prevDuration;
    calculatedMinutes[prevId] = currentMin;
  }

  // 往後推算
  currentMin = anchorTime_min;
  for (let i = anchorIndex; i < CEREMONY_IDS.length - 1; i++) {
    const currentId = CEREMONY_IDS[i];
    const currentDuration = durations[currentId];
    currentMin += currentDuration;
    const nextId = CEREMONY_IDS[i + 1];
    calculatedMinutes[nextId] = currentMin;
  }

  // 6. 更新 DOM 顯示結果
  CEREMONY_IDS.forEach((id) => {
    const timeInput = document.getElementById(`start-time-${id}`);
    const calculatedMin = calculatedMinutes[id];

    if (timeInput) {
      if (id !== anchorId) {
        // 非錨點：顯示計算結果
        timeInput.value = minutesToTime(calculatedMin);
        timeInput.classList.add("output-field");
        const currentAnchorElement = document.getElementById(
          `start-time-${anchorId}`
        );
        const anchorTime = currentAnchorElement
          ? currentAnchorElement.value
          : "未知時間";
        timeInput.title = `由 ${anchorId} (${anchorTime}) 推算而來`;
      } else {
        // 錨點：移除計算結果樣式，標記為手動設定
        timeInput.classList.remove("output-field");
        timeInput.title = "手動設定的起始時間";
      }
    }
  });
}

/**
 * 建立一個新的表格行 (<tr>) 的 HTML 結構
 */
function createNewCeremonyRow(id, name, duration = 0, startTime = "") {
  const removeButtonRWD = `<button class="remove-btn-rwd" onclick="removeCeremony('${id}')" title="移除流程">✖</button>`;

  return `<tr data-id="${id}" draggable="true">
            <td>
              <div class="ceremony-name-wrapper">
                ${removeButtonRWD} 
                <input type="text" class="ceremony-name-input" value="${name}" oninput="this.title=this.value">
              </div>
            </td>
            <td class="time-cell">
              <input type="time" id="start-time-${id}" oninput="calculateTimes(this.id)" value="${startTime}">
            </td>
            <td><input type="number" id="duration-${id}" min="0" value="${duration}" oninput="calculateTimes()"></td>
          </tr>
        `;
}

/**
 * 新增流程行
 * @param {string} position - "top" 或 "bottom"
 */
function addCeremony(position) {
  const tbody = document.getElementById("ceremony-tbody");
  const newId = `CUST${ceremonyCounter++}`;
  const newName = `新流程 ${ceremonyCounter - 1}`;
  const newRowHtml = createNewCeremonyRow(newId, newName, 0, "");

  if (position === "top") {
    tbody.insertAdjacentHTML("afterbegin", newRowHtml);
  } else {
    tbody.insertAdjacentHTML("beforeend", newRowHtml);
  }

  calculateTimes();
  setupDragAndDrop();
}

/**
 * 移除流程行
 * @param {string} id - 流程 ID
 */
function removeCeremony(id) {
  const rowToRemove = document.querySelector(`tr[data-id="${id}"]`);

  if (rowToRemove) {
    rowToRemove.remove();

    // 如果移除的是當前錨點，則重新設定錨點
    if (anchorId === id) {
      let newAnchorId = null;
      const CEREMONY_IDS = getCeremonyIds();
      // 尋找下一個有時間設定的流程作為新錨點
      for (const nextId of CEREMONY_IDS) {
        const timeInput = document.getElementById(`start-time-${nextId}`);
        if (timeInput && timeToMinutes(timeInput.value) !== null) {
          newAnchorId = nextId;
          break;
        }
      }
      anchorId = newAnchorId !== null ? newAnchorId : DEFAULT_ANCHOR_ID;
    }

    calculateTimes();
  }
}

/**
 * 重設規劃器為預設值
 */
function resetPlanner() {
  const defaultRowsData = [
    { id: "A", name: "集合", t: "07:30", n: 30 },
    { id: "B", name: "入殮", t: "08:00", n: 45 },
    { id: "C", name: "點主", t: "08:45", n: 5 },
    { id: "D", name: "家奠", t: "08:50", n: 40 },
    { id: "E", name: "公奠", t: "09:30", n: 30 },
    { id: "F", name: "拈香", t: "10:00", n: 30 },
    { id: "G", name: "發引", t: "10:30", n: 15 },
    { id: "H", name: "火化", t: "10:45", n: 150 },
  ];

  const tbody = document.getElementById("ceremony-tbody");
  tbody.innerHTML = "";
  ceremonyCounter = 1;
  anchorId = DEFAULT_ANCHOR_ID;
  // 清除案名
  document.getElementById("case-name-input").value = "";

  defaultRowsData.forEach((row) => {
    const rowHtml = createNewCeremonyRow(row.id, row.name, row.n, row.t);
    tbody.insertAdjacentHTML("beforeend", rowHtml);
  });

  setupDragAndDrop();
  calculateTimes();
}

/* =======================================================
   共用函數：建立用於捕捉/列印的表格內容 HTML
   ======================================================= */

/**
 * 建立用於 html2canvas 捕捉/列印的表格內容 HTML
 * @returns {string} 包含流程資料的 tbody HTML
 */
function createCaptureTableHTML() {
  const tbody = document.getElementById("ceremony-tbody");
  const rows = tbody.querySelectorAll("tr");

  let tableBodyHtml = "<tbody>";

  rows.forEach((row, index) => {
    const id = row.getAttribute("data-id");
    const timeInput = document.getElementById(`start-time-${id}`);
    const nameInput = row.querySelector(".ceremony-name-input");
    const durationInput = document.getElementById(`duration-${id}`);

    const time = timeInput ? timeInput.value || "" : "";
    const name = nameInput ? nameInput.value || "" : "";
    const duration = durationInput ? durationInput.value || "0" : "0";

    // 內聯樣式用於確保圖片/列印樣式正確
    const rowStyle =
      index % 2 === 0
        ? "background-color: #fff;"
        : "background-color: #f0f0f0;";
    // 強制在列印時保留背景色
    const printColorAdjust = "-webkit-print-color-adjust: exact; print-color-adjust: exact;";


    tableBodyHtml += `<tr style="${rowStyle} ${printColorAdjust}">`;
    tableBodyHtml += `<td style="width: 40%; border: 1px solid #333; padding: 12px 10px; text-align: left; font-weight: bold;">${name}</td>`;
    tableBodyHtml += `<td style="width: 30%; border: 1px solid #333; padding: 12px 10px; text-align: center; color: #333; font-weight: bold;">${time}</td>`;
    tableBodyHtml += `<td style="width: 30%; border: 1px solid #333; padding: 12px 10px; text-align: center;">${duration}</td>`;
    tableBodyHtml += "</tr>";
  });

  tableBodyHtml += "</tbody>";
  return tableBodyHtml;
}


/* =======================================================
   功能一：輸出 PNG 圖片 (保留原功能)
   ======================================================= */
async function outputSchedule() {
  const caseNameInput = document.getElementById("case-name-input");
  const caseName = caseNameInput.value.trim() || "未命名案名";
  const finalFileName = `${caseName}_出殯流程.png`;

  // 1. 準備用於捕捉的 HTML 結構 
  const captureWrapper = document.getElementById("image-capture-wrapper");
  const captureHeader = document.getElementById("capture-header");
  const captureTable = document.getElementById("capture-table");

  captureHeader.textContent = `${caseName} - 出殯流程時間表`;

  // 設定表格的 header 和 body 內容
  captureTable.innerHTML = `
            <thead>
              <tr>
                  <th style="width: 40%; background-color: #4caf50; color: white; border: 1px solid #333; padding: 12px 10px;">儀式</th>
                  <th style="width: 30%; background-color: #4caf50; color: white; border: 1px solid #333; padding: 12px 10px;">表定時間</th>
                  <th style="width: 30%; background-color: #4caf50; color: white; border: 1px solid #333; padding: 12px 10px;">規劃時長 (分)</th>
              </tr>
            </thead>
            ${createCaptureTableHTML()}
        `;

  // 2. 顯示 Modal 並準備捕捉
  document.getElementById("output-modal-title").textContent = `${caseName} - PNG 輸出`;
  document.getElementById("outputModal").style.display = "flex";

  // 清空舊圖片
  const imageContainer = document.getElementById("outputImageContainer");
  imageContainer.innerHTML = "正在生成圖片...";

  try {
    const canvas = await html2canvas(captureWrapper, {
      scale: 2, // 提高解析度
      backgroundColor: "#ffffff", // 確保背景為白色
      useCORS: true,
      logging: false, 
      width: captureWrapper.offsetWidth, 
      height: captureWrapper.offsetHeight,
      x: captureWrapper.offsetLeft,
      y: captureWrapper.offsetTop,
    });

    const dataURL = canvas.toDataURL("image/png");

    // 3. 顯示圖片預覽
    imageContainer.innerHTML = "";
    const img = document.createElement("img");
    img.src = dataURL;
    img.style.maxWidth = "100%";
    img.style.height = "auto";
    imageContainer.appendChild(img);

    // 4. 設定下載按鈕
    const downloadBtn = document.getElementById("download-btn");
    downloadBtn.onclick = function () {
      const a = document.createElement("a");
      a.href = dataURL;
      a.download = finalFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };
  } catch (error) {
    imageContainer.innerHTML = "圖片生成失敗。";
    console.error("html2canvas 錯誤:", error);
  }
}

/* =======================================================
   功能二：列印 A4 格式 (新增)
   ======================================================= */

/**
 * 列印排程表，利用瀏覽器原生列印功能優化為 A4 格式
 */
function printSchedule() {
    const caseNameInput = document.getElementById("case-name-input");
    const caseName = caseNameInput.value.trim() || "未命名案名";
    
    // 1. 準備用於列印的 HTML 結構
    const captureWrapper = document.getElementById("image-capture-wrapper");
    const captureHeader = document.getElementById("capture-header");
    const captureTable = document.getElementById("capture-table");

    captureHeader.textContent = `${caseName} - 出殯流程時間表`;

    // 設置內聯樣式來確保列印時顏色保留 (print-color-adjust)
    const printColorAdjustHeader = "-webkit-print-color-adjust: exact; print-color-adjust: exact;";
    
    // 設定表格的 header 內容 (確保內聯樣式用於列印)
    captureTable.innerHTML = `
            <thead>
              <tr>
                  <th style="width: 40%; background-color: #4caf50; color: white; border: 1px solid #333; padding: 12px 10px; ${printColorAdjustHeader}">儀式</th>
                  <th style="width: 30%; background-color: #4caf50; color: white; border: 1px solid #333; padding: 12px 10px; ${printColorAdjustHeader}">表定時間</th>
                  <th style="width: 30%; background-color: #4caf50; color: white; border: 1px solid #333; padding: 12px 10px; ${printColorAdjustHeader}">規劃時長 (分)</th>
              </tr>
            </thead>
            ${createCaptureTableHTML()}
        `;

    // 2. 觸發瀏覽器列印 (它會使用 CSS 的 @media print 規則)
    window.print();
}


/* =======================================================
   拖曳排序功能 (保持不變)
   ======================================================= */
function handleDragStart(e) {
  // 避免在點擊輸入框或按鈕時觸發拖曳
  if (
    e.target.tagName.toLowerCase() === "input" ||
    e.target.tagName.toLowerCase() === "button"
  ) {
    e.preventDefault();
    return;
  }

  draggedRow = this;
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", this.getAttribute("data-id"));
  this.classList.add("dragging");
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  const targetRow = this;
  if (draggedRow && draggedRow !== targetRow) {
    // 清除所有行的視覺效果
    document.querySelectorAll("#ceremony-tbody tr").forEach((row) => {
      row.classList.remove("drag-over-top", "drag-over-bottom");
    });
    
    // 根據滑鼠位置判斷插入點
    const rect = targetRow.getBoundingClientRect();
    const midPoint = rect.y + rect.height / 2;
    if (e.clientY < midPoint) {
      targetRow.classList.add("drag-over-top");
    } else {
      targetRow.classList.add("drag-over-bottom");
    }
  }
}

function handleDragLeave(e) {
  this.classList.remove("drag-over-top", "drag-over-bottom");
}

function handleDrop(e) {
  e.preventDefault();
  const targetRow = this;
  
  // 清除所有視覺效果
  document.querySelectorAll("#ceremony-tbody tr").forEach((row) => {
    row.classList.remove("drag-over-top", "drag-over-bottom", "dragging");
  });
  
  if (draggedRow && draggedRow !== targetRow) {
    const tbody = document.getElementById("ceremony-tbody");
    const isBefore = targetRow.classList.contains("drag-over-top");
    
    if (isBefore) {
      // 插入到目標行的前面
      tbody.insertBefore(draggedRow, targetRow);
    } else {
      // 插入到目標行的後面
      tbody.insertBefore(draggedRow, targetRow.nextSibling);
    }
    
    // 重新計算時間
    calculateTimes();
  }
  draggedRow = null;
}

function handleDragEnd(e) {
  // 清除所有視覺效果
  document.querySelectorAll("#ceremony-tbody tr").forEach((row) => {
    row.classList.remove("drag-over-top", "drag-over-bottom", "dragging");
  });
  draggedRow = null;
}

/**
 * 為所有流程行設置拖曳事件監聽器
 */
function setupDragAndDrop() {
  const rows = document.querySelectorAll("#ceremony-tbody tr");
  rows.forEach((row) => {
    // 先移除舊的，再新增，避免重複監聽
    row.removeEventListener("dragstart", handleDragStart);
    row.removeEventListener("dragover", handleDragOver);
    row.removeEventListener("dragleave", handleDragLeave);
    row.removeEventListener("drop", handleDrop);
    row.removeEventListener("dragend", handleDragEnd);

    row.addEventListener("dragstart", handleDragStart);
    row.addEventListener("dragover", handleDragOver);
    row.addEventListener("dragleave", handleDragLeave);
    row.addEventListener("drop", handleDrop);
    row.addEventListener("dragend", handleDragEnd);
  });
}

// 頁面載入完成後執行重設和初始化
document.addEventListener("DOMContentLoaded", resetPlanner);

// 將必要的函數暴露給全域範圍，以供 HTML 中的 onclick 屬性調用
window.addCeremony = addCeremony;
window.removeCeremony = removeCeremony;
window.outputSchedule = outputSchedule;
window.printSchedule = printSchedule; // 新增暴露
window.resetPlanner = resetPlanner;
window.calculateTimes = calculateTimes;