let sourcesData = {};         // имя-файла → { timings: [], textLines: [], audio: "" }
let sourceDivs   = {};        // имя-файла → контейнер с уже отрендеренным текстом
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
    } else {
      textLines.push(line);
    }
  }
  return { timings, textLines };
}

// Рендерит внутрь переданного контейнера текст и спаны для выбранного источника
function renderSourceToDiv(container, filename) {
  const { timings, textLines } = sourcesData[filename];
  container.innerHTML = "";
  let idCounter = 0;

  textLines.forEach(line => {
    const p = document.createElement("p");
    line.split(/\s+/).forEach(word => {
      if (!word) return;
      const span = document.createElement("span");
      span.id = `sp-${filename}-${idCounter}`;
      span.textContent = word + " ";
      span.style.transition = "700ms ease-in";
      span.style.backgroundColor = "antiquewhite";
      span.style.cursor = "pointer";

      // при клике — перескакиваем в аудио
      const wordIndex = idCounter;
      span.addEventListener("click", () => {
        if (GPlayer && timings[wordIndex] != null) {
          GPlayer.currentTime = timings[wordIndex];
          GPlayer.play();
        }
      });

      p.appendChild(span);
      idCounter++;
    });
    container.appendChild(p);
  });
}

function activateSource(filename) {
  // 1) Снимаем подсветку со старых span’ов
  if (wordSpans.length) {
    wordSpans.forEach(span => {
      span.style.transition      = isFadingEffect ? "700ms ease-in" : "";
      span.style.backgroundColor = "antiquewhite";
      span.classList.remove("fake-bold");
    });
  }

  // 2) Сбрасываем индексы, чтобы step() сразу пересчитал highlight
  prevIndex   = -1;
  prevTiming  = -1;

  // 3) Прячем старый div и показываем новый
  if (currentSource) {
    sourceDivs[currentSource].style.display = "none";
  }
  const div = sourceDivs[filename];
  div.style.display = "block";

  // 4) Обновляем массив timings и список span’ов
  const { timings } = sourcesData[filename];
  wordsStartReadTimings       = timings;
  wordsStartReadTimingsLength = timings.length;
  wordSpans = Array.from(div.querySelectorAll("span"));

  currentSource = filename;
}


// Основная загрузка
async function loadAllSources() {
  // JSON называется "sources.json"
  const resp = await fetch("./data/sources.json");
  if (!resp.ok) throw new Error(`Ошибка загрузки sources.json: ${resp.status}`);
  const sourcesList = await resp.json();

  // парсим все txt и готовим места под них
  const containerAll = document.getElementById("text-container");
  for (const item of sourcesList) {
    // fetch txt
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

    // создаём скрытый div
    const div = document.createElement("div");
    div.id = `div-${item.text}`;
    div.style.display = "none";
    containerAll.appendChild(div);
    renderSourceToDiv(div, item.text);
    sourceDivs[item.text] = div;
  }

  // селект и его опции
  const select = document.getElementById("sourceSelect");
  sourcesList.forEach((item, idx) => {
    const opt = document.createElement("option");
    opt.value = item.text;
    opt.textContent = item.text;
    if (idx === 0) opt.selected = true;
    select.appendChild(opt);
  });

  // инициализируем первый источник и аудио
  currentSource = sourcesList[0].text;
  activateSource(currentSource);
  // загружаем аудио только один раз
  loadAudioFor(currentSource);

  // обработчик смены
  select.addEventListener("change", () => {
    activateSource(select.value);
    // аудио не трогаем!
  });
}

// Загружает нужный аудиофайл единожды
function loadAudioFor(sourceName) {
  const audioSrc = `./data/${sourcesData[sourceName].audio}`;
  GPlayer.src = audioSrc;
  GPlayer.load();
}

// бинарный поиск индекса по текущему времени
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
      // сброс старого
      if (prevIndex >= 0 && wordSpans[prevIndex]) {
        const prev = wordSpans[prevIndex];
        prev.style.transition = isFadingEffect ? "700ms ease-in" : "";
        prev.style.backgroundColor = "antiquewhite";
        prev.classList.remove("fake-bold");
      }
      // подсветка нового
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
  requestAnimationFrame(step);
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
  step();
});

// переключатели скорости и эффектов (jQuery)
$(document).ready(function () {
  GPlayer.playbackRate = 1.0;
  $("#toggle-button3, #toggle-button-effect").addClass("active");

  $(".exclusive-turnon-toggle-button").click(function () {
    switch (this.id) {
      case "toggle-button1":         GPlayer.playbackRate = 0.5;  break;
      case "toggle-button2":         GPlayer.playbackRate = 0.75; break;
      case "toggle-button3":         GPlayer.playbackRate = 1.0;  break;
      case "toggle-button-effect":   isFadingEffect = true;       break;
      case "toggle-button-noeffect": isFadingEffect = false;      break;
    }
    $(this).addClass("active").siblings().removeClass("active");
  });
});
