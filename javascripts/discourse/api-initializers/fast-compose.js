import { apiInitializer } from "discourse/lib/api";

const HOME_PATHS = new Set([
  "/",
  "/latest",
  "/latest/",
  "/top",
  "/categories",
  "/new",
]);

const MODEL_NAMES = {
  "gpt-4o": "GPT-4O",
  "o4-mini": "o4-mini",
  "grok-3": "Grok-3",
  "deepseek-r1-0528": "DeepSeek-R1-0528",
  "gpt-4.1": "GPT-4.1",
  "resim-olustur": "Create image",
};

const MODEL_TAGS = {
  "gpt-4o": "@Helper_bot",
  "o4-mini": "@o4-mini_bot",
  "grok-3": "@Grok-3_bot",
  "deepseek-r1-0528": "@DeepSeek-R1-0528_bot",
  "gpt-4.1": "@GPT_4.1_bot",
  "resim-olustur": "@sorumatik_art_bot",
};

export default apiInitializer("1.8.0", (api, settings) => {
  let selectedAIModel = null;
  let dropdownGlobalListenerBound = false;

  const currentUser = () => api.getCurrentUser();

  function isHomePage() {
    const path = window.location.pathname;
    if (HOME_PATHS.has(path)) {
      return true;
    }

    return /^\/c(\/|$)/.test(path);
  }

  function toggleVisibility() {
    const box = document.querySelector("#mini-composer-home-box");
    if (!box) {
      return;
    }

    if (isHomePage()) {
      box.classList.remove("fast-compose-hidden");
    } else {
      box.classList.add("fast-compose-hidden");
    }
  }

  function formattedResimliSoruTitle() {
    const now = new Date();
    const pad = (n) => (n < 10 ? "0" + n : String(n));
    const day = pad(now.getDate());
    const month = pad(now.getMonth() + 1);
    const year = now.getFullYear();
    const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    return `Question with picture ${day}-${month}-${year} ${time}`;
  }

  function openComposerOrSignup(title, body, openUpload) {
    if (!currentUser()) {
      window.location.href = "/signup";
      return;
    }

    const Composer = require("discourse/models/composer").default;
    const controller = api.container.lookup("controller:composer");

    let extraTag = "";
    if (selectedAIModel && MODEL_TAGS[selectedAIModel]) {
      extraTag = `\n\n${MODEL_TAGS[selectedAIModel]}`;
    }

    controller.open({
      action: Composer.CREATE_TOPIC,
      draftKey: Composer.DRAFT,
      draftSequence: 0,
      title,
      raw: `${body || ""}${extraTag}`,
    });

    let attempts = 0;
    const maxAttempts = 20;

    function tryFill() {
      const titleEl = document.querySelector("input#reply-title");
      const bodyEl = document.querySelector("textarea.d-editor-input");

      if (titleEl && bodyEl) {
        titleEl.value = title;
        titleEl.dispatchEvent(new Event("input", { bubbles: true }));

        const finalBody = `${body || ""}${extraTag}`;
        bodyEl.value = finalBody;
        bodyEl.dispatchEvent(new Event("input", { bubbles: true }));
        bodyEl.dispatchEvent(new Event("change", { bubbles: true }));
        titleEl.focus();

        if (openUpload) {
          window.setTimeout(() => {
            const input = document.querySelector(
              ".d-editor-input-wrapper input[type=\"file\"]"
            );
            if (input) {
              input.click();
              return;
            }
            const btn = document.querySelector(
              '.d-editor-button-bar .d-editor-button[data-format="![]({})"]'
            );
            if (btn) {
              btn.click();
            }
          }, 180);
        }

        return true;
      }

      const pmBody = document.querySelector(".ProseMirror");
      if (titleEl && pmBody) {
        titleEl.value = title;
        titleEl.dispatchEvent(new Event("input", { bubbles: true }));
        const finalBody = `${body || ""}${extraTag}`;
        if (pmBody.innerText.trim() === "") {
          try {
            const clipboardEvent = new ClipboardEvent("paste", {
              bubbles: true,
              cancelable: true,
              clipboardData: new DataTransfer(),
            });
            clipboardEvent.clipboardData.setData("text/plain", finalBody);
            pmBody.dispatchEvent(clipboardEvent);
          } catch (e) {
            pmBody.innerText = finalBody;
          }
        }
        titleEl.focus();

        if (openUpload) {
          window.setTimeout(() => {
            const input = document.querySelector(
              ".d-editor-input-wrapper input[type=\"file\"]"
            );
            if (input) {
              input.click();
              return;
            }
            const btn = document.querySelector(
              '.d-editor-button-bar .d-editor-button[data-format="![]({})"]'
            );
            if (btn) {
              btn.click();
            }
          }, 180);
        }

        return true;
      }

      if (++attempts < maxAttempts) {
        window.setTimeout(tryFill, 120);
      }

      return false;
    }

    window.setTimeout(tryFill, 120);
  }

  function bindAIModelDropdown(box) {
    const button = box.querySelector("#mini-composer-ai-select-btn");
    const dropdown = box.querySelector("#ai-model-dropdown");
    const label = box.querySelector("#selected-ai-model-label");

    if (!button || !dropdown || button.dataset.fastComposeBound) {
      return;
    }

    button.dataset.fastComposeBound = "true";

    function closeDropdown() {
      dropdown.style.display = "none";
      button.setAttribute("aria-expanded", "false");
    }

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const isOpen = dropdown.style.display === "block";
      document.querySelectorAll("#ai-model-dropdown").forEach((menu) => {
        if (menu !== dropdown) {
          menu.style.display = "none";
        }
      });

      dropdown.style.display = isOpen ? "none" : "block";
      button.setAttribute("aria-expanded", String(!isOpen));
    });

    dropdown.querySelectorAll(".ai-model-option").forEach((option) => {
      option.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        dropdown.querySelectorAll(".ai-model-option").forEach((opt) => {
          opt.classList.remove("selected");
        });

        option.classList.add("selected");
        selectedAIModel = option.dataset.model || null;
        if (label) {
          label.textContent = MODEL_NAMES[selectedAIModel] || "";
        }
        closeDropdown();
      });
    });

    if (!dropdownGlobalListenerBound) {
      dropdownGlobalListenerBound = true;
      document.addEventListener("mousedown", (event) => {
        const target = event.target;
        document.querySelectorAll(".ai-selector-wrapper").forEach((node) => {
          const menu = node.querySelector("#ai-model-dropdown");
          const trigger = node.querySelector("#mini-composer-ai-select-btn");
          if (
            menu &&
            menu.style.display === "block" &&
            target instanceof Node &&
            !menu.contains(target) &&
            target !== trigger
          ) {
            menu.style.display = "none";
            trigger?.setAttribute("aria-expanded", "false");
          }
        });
      });
    }
  }

  function bindForm(box) {
    const form = box.querySelector("#mini-composer-form");
    const textarea = box.querySelector("#mini-composer-text");
    const error = box.querySelector("#mini-composer-error");
    const uploadBtn = box.querySelector("#mini-composer-upload-btn");

    if (!form || form.dataset.fastComposeBound) {
      return;
    }

    form.dataset.fastComposeBound = "true";

    uploadBtn?.addEventListener("click", (event) => {
      event.preventDefault();
      openComposerOrSignup(formattedResimliSoruTitle(), "", true);
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = (textarea?.value || "").trim();

      if (value.length < settings.fast_compose_min_length) {
        if (error) {
          error.textContent = `Minimum ${settings.fast_compose_min_length} characters.`;
          error.style.display = "block";
        }
        return;
      }

      if (error) {
        error.textContent = "";
        error.style.display = "none";
      }

      const title = value
        .substring(0, 250)
        .replace(/\s+/g, " ")
        .trim();

      openComposerOrSignup(title, value, false);

      if (textarea) {
        textarea.value = "";
      }
    });
  }

  function initialize() {
    const box = document.querySelector("#mini-composer-home-box");
    if (!box) {
      return;
    }

    bindForm(box);
    bindAIModelDropdown(box);
    toggleVisibility();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }

  api.onPageChange(() => {
    window.requestAnimationFrame(() => {
      initialize();
    });
  });
});
