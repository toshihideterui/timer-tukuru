/**
 * やすらぎタイマー - app.js
 * 水色・自然テーマ、Web Audio API による癒し音付きタイマー
 */

'use strict';

// ===========================
// Web Audio API セットアップ
// ===========================
let audioCtx = null;
let soundEnabled = true;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

/**
 * 癒し系のチャイム音を鳴らす（倍音の豊かな穏やかなベル）
 * @param {'start'|'end'} type
 */
function playChime(type) {
  if (!soundEnabled) return;
  const ctx = getAudioCtx();

  // 倍音を重ねた穏やかなベル風チャイム
  const notes = type === 'end'
    ? [523.25, 659.25, 783.99, 1046.5]  // C5, E5, G5, C6（完了：明るい和音）
    : [440, 523.25, 659.25];             // A4, C5, E5（開始：優しい和音）

  const now = ctx.currentTime;

  notes.forEach((freq, i) => {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();

    // 柔らかい音色：サイン波 + 少量の三角波
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    // 僅かに周波数を揺らしてビブラート感
    osc.frequency.linearRampToValueAtTime(freq * 1.002, now + 0.3);
    osc.frequency.linearRampToValueAtTime(freq,         now + 0.6);

    // エンベロープ: ソフトアタック → 長めのリリース
    const startTime  = now + i * 0.12;
    const peakVolume = type === 'end' ? 0.18 : 0.12;
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(peakVolume, startTime + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 2.5);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + 2.6);
  });
}

/**
 * 一時停止時の短い柔らかいクリック音
 */
function playPauseSound() {
  if (!soundEnabled) return;
  const ctx = getAudioCtx();
  const now = ctx.currentTime;

  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(320, now);
  osc.frequency.exponentialRampToValueAtTime(160, now + 0.15);

  gain.gain.setValueAtTime(0.06, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.3);
}

// ===========================
// 背景の泡を生成
// ===========================
function createBubbles() {
  const container = document.getElementById('bgBubbles');
  const COUNT = 14;
  for (let i = 0; i < COUNT; i++) {
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    const size = Math.random() * 40 + 10; // 10px ~ 50px
    bubble.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      left: ${Math.random() * 100}%;
      animation-duration: ${Math.random() * 12 + 10}s;
      animation-delay: ${Math.random() * 8}s;
    `;
    container.appendChild(bubble);
  }
}

// ===========================
// SVG グラデーション定義を注入
// ===========================
function injectSvgGradient() {
  const svg = document.querySelector('.progress-ring');
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#4fc3f7"/>
      <stop offset="50%"  stop-color="#29b6f6"/>
      <stop offset="100%" stop-color="#26c6da"/>
    </linearGradient>
  `;
  svg.insertBefore(defs, svg.firstChild);
}

// ===========================
// タイマー本体
// ===========================
const CIRCUMFERENCE = 2 * Math.PI * 96; // ≈ 603.19

const elTimeText    = document.getElementById('timeText');
const elTimeLabel   = document.getElementById('timeLabel');
const elRingProgress = document.getElementById('ringProgress');
const elStartBtn    = document.getElementById('startBtn');
const elResetBtn    = document.getElementById('resetBtn');
const elSoundBtn    = document.getElementById('soundBtn');
const elCard        = document.getElementById('mainCard');
const elCustomMin   = document.getElementById('customMinutes');
const elCustomSec   = document.getElementById('customSeconds');
const elCompleteOverlay = document.getElementById('completeOverlay');
const elCloseComplete   = document.getElementById('closeCompleteBtn');
const elIconPlay    = elStartBtn.querySelector('.icon-play');
const elIconPause   = elStartBtn.querySelector('.icon-pause');
const elIconSoundOn  = elSoundBtn.querySelector('.icon-sound-on');
const elIconSoundOff = elSoundBtn.querySelector('.icon-sound-off');

let totalSeconds   = 0;   // 設定秒数
let remainSeconds  = 0;   // 残り秒数
let intervalId     = null;
let isRunning      = false;
let activePreset   = null;

// プログレスリングを更新
function updateRing(remaining, total) {
  const ratio  = total > 0 ? remaining / total : 0;
  const offset = CIRCUMFERENCE * (1 - ratio);
  elRingProgress.style.strokeDashoffset = offset;
}

// 時間を mm:ss 形式に
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// 表示を更新
function updateDisplay(sec, total) {
  elTimeText.textContent = formatTime(sec);
  updateRing(sec, total);

  if (total === 0) {
    elTimeLabel.textContent = '準備中';
  } else if (isRunning) {
    elTimeLabel.textContent = 'カウント中';
  } else if (sec === 0) {
    elTimeLabel.textContent = '完了';
  } else {
    elTimeLabel.textContent = '一時停止';
  }
}

// スタート状態のUI切り替え
function setRunningUI(running) {
  elIconPlay.style.display  = running ? 'none'  : '';
  elIconPause.style.display = running ? ''      : 'none';
  if (running) {
    elCard.classList.add('running');
  } else {
    elCard.classList.remove('running');
  }
}

// タイマースタート
function startTimer() {
  if (remainSeconds <= 0) return;

  isRunning = true;
  setRunningUI(true);
  playChime('start');

  intervalId = setInterval(() => {
    remainSeconds--;
    updateDisplay(remainSeconds, totalSeconds);

    if (remainSeconds <= 0) {
      clearInterval(intervalId);
      intervalId  = null;
      isRunning   = false;
      setRunningUI(false);
      elTimeLabel.textContent = '完了';
      updateRing(0, totalSeconds);
      onComplete();
    }
  }, 1000);
}

// タイマー一時停止
function pauseTimer() {
  clearInterval(intervalId);
  intervalId = null;
  isRunning  = false;
  setRunningUI(false);
  playPauseSound();
  updateDisplay(remainSeconds, totalSeconds);
}

// タイマーリセット
function resetTimer() {
  clearInterval(intervalId);
  intervalId = null;
  isRunning  = false;
  setRunningUI(false);

  remainSeconds = totalSeconds;
  updateDisplay(remainSeconds, totalSeconds);

  if (totalSeconds === 0) {
    elTimeLabel.textContent = '準備中';
    updateRing(0, 0);
  }
}

// 完了時
function onComplete() {
  playChime('end');
  elCompleteOverlay.classList.add('show');
  // ページタイトルを点滅
  const originalTitle = document.title;
  let blink = 0;
  const blinkInterval = setInterval(() => {
    document.title = blink % 2 === 0 ? '✨ タイマー完了！' : originalTitle;
    blink++;
    if (blink >= 8) {
      clearInterval(blinkInterval);
      document.title = originalTitle;
    }
  }, 700);
}

// カスタム入力から秒数を読み込む
function loadCustomTime() {
  const m = Math.max(0, Math.min(99, parseInt(elCustomMin.value, 10) || 0));
  const s = Math.max(0, Math.min(59, parseInt(elCustomSec.value, 10) || 0));
  totalSeconds  = m * 60 + s;
  remainSeconds = totalSeconds;
  elCustomMin.value = String(m);
  elCustomSec.value = String(s);
  clearActivePreset();
  updateDisplay(remainSeconds, totalSeconds);
}

// プリセットをアクティブに
function setActivePreset(btn) {
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  activePreset = btn;
}

function clearActivePreset() {
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  activePreset = null;
}

// ===========================
// イベントリスナー
// ===========================

// スタート / 一時停止
elStartBtn.addEventListener('click', () => {
  // AudioContext はユーザー操作後に有効化
  getAudioCtx();

  if (totalSeconds === 0) {
    loadCustomTime();
    if (totalSeconds === 0) return;
  }

  if (isRunning) {
    pauseTimer();
  } else {
    startTimer();
  }
});

// リセット
elResetBtn.addEventListener('click', () => {
  resetTimer();
});

// サウンドのオン/オフ
elSoundBtn.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  elIconSoundOn.style.display  = soundEnabled ? '' : 'none';
  elIconSoundOff.style.display = soundEnabled ? 'none' : '';
  elSoundBtn.title = soundEnabled ? 'サウンドをオフ' : 'サウンドをオン';
});

// プリセットボタン
document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (isRunning) pauseTimer();
    const minutes = parseInt(btn.dataset.minutes, 10);
    totalSeconds  = minutes * 60;
    remainSeconds = totalSeconds;
    elCustomMin.value = String(minutes);
    elCustomSec.value = '0';
    setActivePreset(btn);
    updateDisplay(remainSeconds, totalSeconds);
  });
});

// カスタム入力の変更
[elCustomMin, elCustomSec].forEach(input => {
  input.addEventListener('change', () => {
    if (isRunning) pauseTimer();
    loadCustomTime();
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      if (isRunning) pauseTimer();
      loadCustomTime();
    }
  });
});

// 完了オーバーレイを閉じる
elCloseComplete.addEventListener('click', () => {
  elCompleteOverlay.classList.remove('show');
  resetTimer();
});

// ===========================
// 初期化
// ===========================
function init() {
  createBubbles();
  injectSvgGradient();
  elRingProgress.style.strokeDasharray  = CIRCUMFERENCE;
  elRingProgress.style.strokeDashoffset = CIRCUMFERENCE;
  updateDisplay(0, 0);
}

init();
