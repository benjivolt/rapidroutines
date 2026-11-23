function showEnhancedTypingEffect(text, textElement, incomingMessageDiv, speed = 5) {
  const segments = window.messageUtils.parseFormattingElements(text || "");
  const characters = [];
  segments.forEach((segment) => {
    if (segment.lineBreak) {
      characters.push({ lineBreak: true });
    } else {
      for (const char of segment.text) characters.push({ char, bold: segment.bold });
    }
  });

  textElement.replaceChildren();
  const icon = incomingMessageDiv.querySelector(".icon");
  let index = 0;
  let current = null;

  const typingInterval = setInterval(() => {
    for (let i = 0; i < speed && index < characters.length; i++, index++) {
      const item = characters[index];
      if (item.lineBreak) {
        textElement.appendChild(document.createElement("br"));
        current = null;
        continue;
      }
      if (!current || current.bold !== item.bold) {
        const node = item.bold ? document.createElement("strong") : document.createElement("span");
        textElement.appendChild(node);
        current = { node, bold: item.bold };
      }
      current.node.textContent += item.char;
    }

    if (icon) icon.classList.toggle("hide", index < characters.length);
    window.chatApp.chatContainer.scrollTo(0, window.chatApp.chatContainer.scrollHeight);

    if (index >= characters.length) {
      clearInterval(typingInterval);
      window.chatApp.isResponseGenerating = false;
    }
  }, 20);
}

window.typingEffects = {
  showEnhancedTypingEffect,
  showSlowerTypingEffect(text, textElement, incomingMessageDiv) {
    showEnhancedTypingEffect(text, textElement, incomingMessageDiv, 3);
  },
};
