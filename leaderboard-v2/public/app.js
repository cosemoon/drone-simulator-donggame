const REFRESH_MS = 10_000;

const tbody = document.querySelector("#leaderboard-body");
const statusMessage = document.querySelector("#status-message");
const refreshButton = document.querySelector("#refresh-button");
const schoolFilter = document.querySelector("#school-filter");

let refreshTimer = null;

function setStatus(message, tone = "neutral") {
  statusMessage.textContent = message;
  statusMessage.dataset.tone = tone;
}

function formatScore(score) {
  return new Intl.NumberFormat("ko-KR").format(score);
}

function formatTime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

function renderRows(items) {
  if (items.length === 0) {
    tbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="5">아직 등록된 점수가 없습니다.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = items
    .map(
      (item) => `
        <tr>
          <td class="rank">${item.rank}</td>
          <td>${escapeHtml(item.nickname)}</td>
          <td>${escapeHtml(item.school)}</td>
          <td class="score">${formatScore(item.best_score)}</td>
          <td>${escapeHtml(formatTime(item.updated_at))}</td>
        </tr>
      `,
    )
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadLeaderboard() {
  const params = new URLSearchParams({ limit: "100" });
  const school = schoolFilter.value.trim();

  if (school) {
    params.set("school", school);
  }

  setStatus("점수판을 불러오는 중...");

  try {
    const response = await fetch(`/api/leaderboard?${params.toString()}`, {
      headers: { accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const items = Array.isArray(data.items) ? data.items : [];

    renderRows(items);
    setStatus(`총 ${items.length}개 기록 · 10초마다 자동 갱신`);
  } catch (error) {
    setStatus("점수판을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.", "error");
  }
}

function scheduleRefresh() {
  if (refreshTimer) {
    window.clearInterval(refreshTimer);
  }

  refreshTimer = window.setInterval(loadLeaderboard, REFRESH_MS);
}

refreshButton.addEventListener("click", loadLeaderboard);
schoolFilter.addEventListener("input", () => {
  window.clearTimeout(schoolFilter.filterTimer);
  schoolFilter.filterTimer = window.setTimeout(loadLeaderboard, 250);
});

loadLeaderboard();
scheduleRefresh();
