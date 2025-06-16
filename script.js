// script.js

let sourcesData = {};      // запись: имя-файла → { timings: [], textLines: [] }
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
      span.style.transition      = "700ms ease-in";
      span.style.backgroundColor = "antiquewhite";

      // --- делаем слово кликабельным ---
      const wordIndex = idCounter;               // сохраняем индекс слова
      span.style.cursor = "pointer";             // показываем, что это кнопка
      span.addEventListener("click", () => {
        if (GPlayer && wordsStartReadTimings[wordIndex] != null) {
          GPlayer.currentTime = wordsStartReadTimings[wordIndex];
          GPlayer.play();
        }
      });
      // --- конец новой логики ---

      p.appendChild(span);
      wordSpans.push(span);
      idCounter++;
    });
    container.appendChild(p);
  });

  wordsStartReadTimings        = timings;
  wordsStartReadTimingsLength  = timings.length;
}

// Загружает список всех .txt из папки data/, парсит и заполняет селект
// async function loadAllSources() {
//   // Ожидаем, что сервер вернёт HTML-листинг директории
//   const res  = await fetch("data/");
//   const html = await res.text();
//   const doc  = new DOMParser().parseFromString(html, "text/html");
//   const links = Array.from(doc.querySelectorAll("a[href$='.txt']"))
//                      .map(a => a.getAttribute("href"));

//   for (const name of links) {
//     const raw = await fetch("data/" + name).then(r => r.text());
//     sourcesData[name] = parseTxt(raw);
//   }

//   const select = document.getElementById("sourceSelect");
//   links.forEach((name, idx) => {
//     const opt = document.createElement("option");
//     opt.value = name;
//     opt.textContent = name;
//     if (idx === 0) opt.selected = true;
//     select.appendChild(opt);
//   });

async function loadAllSources() {
  const sourcesList = await fetch("data/sources.json").then(r => r.json());

  for (const item of sourcesList) {
    const raw = await fetch("data/" + item.text).then(r => r.text());
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

  currentSource = sourcesList[0].text;
  loadAudioFor(currentSource);
  renderSource(currentSource);

  select.addEventListener("change", () => {
    currentSource = select.value;
    loadAudioFor(currentSource);
    renderSource(currentSource);
  });
}

// загружает нужный аудиофайл
function loadAudioFor(sourceName) {
  const audioSrc = "data/" + sourcesData[sourceName].audio;
  GPlayer.src = audioSrc;
  GPlayer.load();
}

  currentSource = links[0];
  renderSource(currentSource);

  select.addEventListener("change", () => {
    currentSource = select.value;
    renderSource(currentSource);
  });
}

// Бинарный поиск индекса слова по времени
function findIndexBinary(t) {
  let l = 0, r = wordsStartReadTimingsLength - 1;
  if (t < wordsStartReadTimings[0]) return -1;
  while (l < r) {
    const m = (l + r) >> 1;
    if (t > wordsStartReadTimings[m]) l = m + 1;
    else                             r = m;
  }
  return t > wordsStartReadTimings[l] ? l : l - 1;
}

let prevIndex = -1, prevTiming = -1;
function step() {
  const playerTime = GPlayer.currentTime + 0.002;
  if (playerTime > 0.001 && playerTime !== prevTiming) {
    const idx = findIndexBinary(playerTime);
    if (idx !== prevIndex) {
      // снять подсветку старого
      if (prevIndex >= 0 && wordSpans[prevIndex]) {
        const prev = wordSpans[prevIndex];
        prev.style.transition      = isFadingEffect ? "700ms ease-in" : "";
        prev.style.backgroundColor = "antiquewhite";
        prev.classList.remove("fake-bold");
      }
      // подсветить новое
      if (idx >= 0 && wordSpans[idx]) {
        const curr = wordSpans[idx];
        curr.style.transition      = isFadingEffect ? "100ms ease-out" : "";
        curr.style.backgroundColor = "#FFD300";
        curr.classList.add("fake-bold");
      }
      prevIndex = idx;
    }
    prevTiming = playerTime;
  }
  setTimeout(step, 5);
}

// Инициализация плеера, загрузка источников и старт подсветки
window.addEventListener("DOMContentLoaded", async () => {
  // init audio player
  new GreenAudioPlayer(".gplayer", {
    showTooltips: true,
    showDownloadButton: false,
    enableKeystrokes: true,
  });
  GPlayer = document.querySelector(".green-audio-player audio");

  // загрузить и отрисовать все источники
  await loadAllSources();

  // запустить цикл подсветки
  setTimeout(step, 5);
});

// переключатели скорости и эффекта (jQuery)
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
