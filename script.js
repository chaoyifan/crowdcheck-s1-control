(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const qs = new URLSearchParams(window.location.search);
  const repositoryName = window.location.pathname.split("/").filter(Boolean)[0] || "";
  const condition = repositoryName === "crowdcheck-s1-public-note" ? "public_note" : "control";
  const returnUrl = qs.get("returnUrl");
  const participantId = sanitizeId(qs.get("pid")) || createId("P");
  const sessionId = createId("S");
  const state = {
    participantId,
    sessionId,
    study: 1,
    condition: null,
    eligibleForRandomization: null,
    initialDisclosure: null,
    prompt: "",
    aiDraft: "",
    finalDraft: "",
    aiCalls: 0,
    startedAt: new Date().toISOString(),
    events: []
  };

  const generatedText = "周末想放慢脚步，可以试试这条城市散步路线：从老街口出发，沿着河边步道慢慢走，途中在街角咖啡店休息，再到城市公园看日落。全程不赶时间，穿一双舒服的鞋就好。傍晚光线柔和，桥边和树影下都很适合拍照。#周末散步 #城市生活";
  const defaultPrompt = "写一段周末城市散步路线分享，语气自然，包含路线、休息点和一个拍照建议。";

  function sanitizeId(value) {
    return value ? value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) : "";
  }

  function createId(prefix) {
    const bytes = new Uint32Array(2);
    crypto.getRandomValues(bytes);
    return `${prefix}-${Date.now().toString(36)}-${bytes[0].toString(36)}${bytes[1].toString(36)}`;
  }

  function logEvent(name, detail = {}) {
    state.events.push({
      name,
      at: new Date().toISOString(),
      elapsedMs: Date.now() - new Date(state.startedAt).getTime(),
      ...detail
    });
  }

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach((screen) => {
      screen.classList.toggle("active", screen.id === id);
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
    logEvent("screen_view", { screen: id });
  }

  function updateCount(input, output, limit) {
    output.textContent = `${input.value.length} / ${limit}`;
  }

  function generateDraft() {
    const prompt = $("prompt-input").value.trim();
    if (prompt.length < 5) {
      $("prompt-input").setCustomValidity("请先输入至少5个字的提示词。");
      $("prompt-input").reportValidity();
      return;
    }
    $("prompt-input").setCustomValidity("");
    state.prompt = prompt;
    state.aiCalls += 1;
    logEvent("ai_generation_requested", { call: state.aiCalls, promptLength: prompt.length });
    $("generate-btn").disabled = true;
    $("ai-working").hidden = false;
    window.setTimeout(() => {
      state.aiDraft = generatedText;
      $("draft-input").value = state.aiDraft;
      $("draft-panel").hidden = false;
      $("ai-working").hidden = true;
      $("generate-btn").disabled = false;
      updateCount($("draft-input"), $("draft-count"), 1500);
      logEvent("ai_generation_completed", { outputLength: state.aiDraft.length });
      $("draft-panel").scrollIntoView({ behavior: "smooth", block: "start" });
    }, 700);
  }

  function displayPublishedPost() {
    $("published-content").textContent = state.finalDraft;
    $("ai-label").hidden = !state.initialDisclosure;
    const hasNote = state.eligibleForRandomization && state.condition === "public_note";
    $("community-note").hidden = !hasNote;
    $("note-metadata").hidden = true;
    $("initial-discloser-exit").hidden = !state.initialDisclosure;
    $("continue-panel").hidden = Boolean(state.initialDisclosure);
    showScreen("post-screen");
    logEvent("post_rendered", {
      initialDisclosure: state.initialDisclosure,
      condition: state.condition,
      noteVisible: hasNote
    });
  }

  function finishExperiment(path) {
    state.completedAt = new Date().toISOString();
    state.completionPath = path;
    state.completionCode = `WG-1-${sessionId.slice(-8).toUpperCase()}`;
    logEvent("experiment_complete", { path });
    try {
      localStorage.setItem(`crowdchecking-${sessionId}`, JSON.stringify(state));
    } catch (_) {
      state.storageWarning = true;
    }
    window.parent?.postMessage({ type: "crowdchecking-experiment-complete", payload: state }, "*");
    $("completion-code").textContent = `完成码：${state.completionCode}`;
    if (returnUrl) $("return-btn").hidden = false;
    showScreen("complete-screen");
  }

  const hiddenGuard = document.createElement("style");
  hiddenGuard.textContent = "[hidden]{display:none!important}";
  document.head.appendChild(hiddenGuard);
  document.body.dataset.version = "2026-07-29-no-inline-survey";
  ["survey-screen", "checks-screen"].forEach((id) => $(id)?.remove());

  const continuePanel = $("continue-panel");
  continuePanel.querySelector("p").textContent = "请确认页面中的动态及相关信息。后续问题将在见数平台中呈现。";
  const finishButton = $("to-survey-btn");
  finishButton.id = "finish-experiment-btn";
  finishButton.textContent = "完成体验并返回";
  $("complete-title").textContent = "本阶段体验已完成";
  $("complete-title").nextElementSibling.textContent = "网站内不再呈现问卷题项，请返回见数平台继续完成后续测量。";
  document.querySelectorAll(".step-kicker").forEach((item) => {
    item.textContent = item.textContent.replace("/ 4", "/ 2");
  });

  $("topic-instruction").textContent = "本次主题：城市散步路线。请让AI助手创作一段“周末城市散步路线”分享，内容应轻松、具体，适合发布在社交媒体。";
  $("prompt-input").value = defaultPrompt;
  updateCount($("prompt-input"), $("prompt-count"), 500);
  $("initial-disclosure").setAttribute("autocomplete", "off");
  $("initial-disclosure").checked = false;
  window.addEventListener("pageshow", () => {
    if ($("publish-screen").classList.contains("active")) $("initial-disclosure").checked = false;
  });

  $("consent").addEventListener("change", (event) => {
    $("start-btn").disabled = !event.target.checked;
  });
  $("start-btn").addEventListener("click", () => {
    logEvent("consent_confirmed");
    showScreen("create-screen");
  });
  $("prompt-input").addEventListener("input", () => updateCount($("prompt-input"), $("prompt-count"), 500));
  $("draft-input").addEventListener("input", () => updateCount($("draft-input"), $("draft-count"), 1500));
  $("generate-btn").addEventListener("click", generateDraft);
  $("to-publish-btn").addEventListener("click", () => {
    const finalDraft = $("draft-input").value.trim();
    if (finalDraft.length < 20) {
      $("draft-input").setCustomValidity("最终文案请至少保留20个字。");
      $("draft-input").reportValidity();
      return;
    }
    $("draft-input").setCustomValidity("");
    state.finalDraft = finalDraft;
    state.editDistanceApprox = Math.abs(state.aiDraft.length - finalDraft.length);
    $("publish-text").value = finalDraft;
    logEvent("draft_confirmed", { finalLength: finalDraft.length });
    showScreen("publish-screen");
  });
  $("publish-text").addEventListener("input", (event) => {
    state.finalDraft = event.target.value;
  });
  $("publish-btn").addEventListener("click", () => {
    const finalDraft = $("publish-text").value.trim();
    if (finalDraft.length < 20) {
      $("publish-text").setCustomValidity("发布文案请至少保留20个字。");
      $("publish-text").reportValidity();
      return;
    }
    state.finalDraft = finalDraft;
    state.initialDisclosure = $("initial-disclosure").checked;
    state.eligibleForRandomization = !state.initialDisclosure;
    state.condition = state.eligibleForRandomization ? condition : "initial_discloser";
    logEvent("initial_publish_submitted", {
      initialDisclosure: state.initialDisclosure,
      assignedCondition: state.condition
    });
    displayPublishedPost();
  });
  $("initial-finish-btn").addEventListener("click", () => finishExperiment("initial_discloser"));
  $("finish-experiment-btn").addEventListener("click", () => finishExperiment("randomized_experiment"));
  $("return-btn").addEventListener("click", () => {
    const target = new URL(returnUrl);
    target.searchParams.set("completionCode", state.completionCode);
    target.searchParams.set("pid", participantId);
    window.location.href = target.toString();
  });

  logEvent("experiment_loaded", { study: 1, participantId, fixedCondition: condition });
})();
