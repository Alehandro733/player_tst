let sourcesData = {}; // имя-файла → { timings: [], textLines: [], audio: "" }
let currentSource = null;
let wordsStartReadTimings = [];
let wordsStartReadTimingsLength = 0;
let wordSpans = [];
let isFadingEffect = true;
let GPlayer = null;

// Парсит текстовый файл с секциями [TIMINGS] и [TEXT]
function parseTxt(data) {
  const lines = data.split(/\r?\n/);
  let mode = null, timings = [], textLines = [];
  for (const line of lines) {
    const t = line.trim();
    if (t === "[TIMINGS]") { mode = "timings"; continue; }
    if (t === "[TEXT]")    { mode = "text";    continue; }
    if (!mode) continue;
    if (mode === "timings") {
      timings = t.split(",").map(parseFloat);
    } else if (mode === "text") {
      textLines.push(line);
    }
  }
  return { timings, textLines };
}

// Рендерит на странице текст и спаны для выбранного источника
function renderSource(filename) {
  const { timings, textLines } = sourcesData[filename];
  const container = document.getElementById("text-container");
  container.innerHTML = "";
  wordSpans = [];

  let idCounter = 0;
  textLines.forEach(line => {
    const p = document.createElement("p");
    line.split(/\s+/).forEach(word => {
      if (!word) return;
      const span = document.createElement("span");
      span.id = "sp" + idCounter;
      span.textContent = word + " ";
      span.style.transition = "700ms ease-in";
      span.style.backgroundColor = "antiquewhite";
      span.style.cursor = "pointer";

      const wordIndex = idCounter;
      span.addEventListener("click", () => {
        if (GPlayer && wordsStartReadTimings[wordIndex] != null) {
          GPlayer.currentTime = wordsStartReadTimings[wordIndex];
          GPlayer.play();
        }
      });

      p.appendChild(span);
      wordSpans.push(span);
      idCounter++;
    });
    container.appendChild(p);
  });

  wordsStartReadTimings = timings;
  wordsStartReadTimingsLength = timings.length;
}

// Загружает список источников из data/soucres.json и первый аудио
async function loadAllSources() {
  // JSON называется "soucres.json"
  const resp = await fetch("./data/soucres.json");
  if (!resp.ok) {
    throw new Error(`Не удалось загрузить список источников: ${resp.status}`);
  }
  const sourcesList = await resp.json();

  // парсим все txt
  for (const item of sourcesList) {
    const r2 = await fetch(`./data/${item.text}`);
    if (!r2.ok) {
      console.error(`Не удалось загрузить ${item.text}: ${r2.status}`);
      continue;
    }
    const raw = await r2.text();
    sourcesData[item.text] = {
      ...parseTxt(raw),
      audio: item.audio
    };
  }

  const select = document.getElementById("sourceSelect");
  sourcesList.forEach((item, idx) => {
    const opt = document.createElement("option");
    opt.value = item.text;
    opt.textContent = item.text;
    if (idx === 0) opt.selected = true;
    select.appendChild(opt);
  });

  // первый источник – загружаем его текст и аудио
  currentSource = sourcesList[0].text;
  loadAudioFor(currentSource);
  renderSource(currentSource);

  // при смене select: только обновляем текст
  select.addEventListener("change", () => {
    currentSource = select.value;
    renderSource(currentSource);
  });
}

// Загружает нужный аудиофайл единожды
function loadAudioFor(sourceName) {
  const audioSrc = `./data/${sourcesData[sourceName].audio}`;
  GPlayer.src = audioSrc;
  GPlayer.load();
}

// Бинарный поиск индекса слова по времени
function findIndexBinary(t) {
  let l = 0, r = wordsStartReadTimingsLength - 1;
  if (t < wordsStartReadTimings[0]) return -1;
  while (l < r) {
    const m = (l + r) >> 1;
    if (t > wordsStartReadTimings[m]) l = m + 1;
    else r = m;
  }
  return t > wordsStartReadTimings[l] ? l : l - 1;
}

let prevIndex = -1, prevTiming = -1;
function step() {
  const playerTime = GPlayer.currentTime + 0.002;
  if (playerTime > 0.001 && playerTime !== prevTiming) {
    const idx = findIndexBinary(playerTime);
    if (idx !== prevIndex) {
      if (prevIndex >= 0 && wordSpans[prevIndex]) {
        const prev = wordSpans[prevIndex];
        prev.style.transition = isFadingEffect ? "700ms ease-in" : "";
        prev.style.backgroundColor = "antiquewhite";
        prev.classList.remove("fake-bold");
      }
      if (idx >= 0 && wordSpans[idx]) {
        const curr = wordSpans[idx];
        curr.style.transition = isFadingEffect ? "100ms ease-out" : "";
        curr.style.backgroundColor = "#FFD300";
        curr.classList.add("fake-bold");
      }
      prevIndex = idx;
    }
    prevTiming = playerTime;
  }
  setTimeout(step, 5);
}

// Инициализация
window.addEventListener("DOMContentLoaded", async () => {
  new GreenAudioPlayer(".gplayer", {
    showTooltips: true,
    showDownloadButton: false,
    enableKeystrokes: true,
  });
  GPlayer = document.querySelector(".green-audio-player audio");

  await loadAllSources();
  setTimeout(step, 5);
});

// Переключатели скорости и эффекта (jQuery)
$(document).ready(function () {
  GPlayer.playbackRate = 1.0;
  $("#toggle-button3, #toggle-button-effect").addClass("active");

  $(".exclusive-turnon-toggle-button").click(function () {
    const id = this.id;
    switch (id) {
      case "toggle-button1":         GPlayer.playbackRate = 0.5;  break;
      case "toggle-button2":         GPlayer.playbackRate = 0.75; break;
      case "toggle-button3":         GPlayer.playbackRate = 1.0;  break;
      case "toggle-button-effect":   isFadingEffect = true;       break;
      case "toggle-button-noeffect": isFadingEffect = false;      break;
    }
    $(this).addClass("active").siblings().removeClass("active");
  });
});
