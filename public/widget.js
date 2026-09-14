(function () {
    // 1. Inject Styles
    const style = document.createElement('style');
    style.innerHTML = `
        .cfw-wrapper {
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        
        /* Floating Button */
        .cfw-fab {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: #0d0f12;
            border: 2px solid #00f2fe;
            box-shadow: 0 0 15px rgba(0, 242, 254, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            animation: cfw-pulse 2s infinite;
        }
        .cfw-fab:hover {
            transform: scale(1.1);
        }
        .cfw-fab svg {
            width: 28px;
            height: 28px;
            fill: #00f2fe;
        }
        
        @keyframes cfw-pulse {
            0% { box-shadow: 0 0 0 0 rgba(0, 242, 254, 0.4); }
            70% { box-shadow: 0 0 0 15px rgba(0, 242, 254, 0); }
            100% { box-shadow: 0 0 0 0 rgba(0, 242, 254, 0); }
        }

        /* Chat Window */
        .cfw-chat-window {
            position: absolute;
            bottom: 80px;
            right: 0;
            width: 350px;
            max-height: 500px;
            height: calc(100vh - 120px);
            background: rgba(18, 20, 29, 0.85);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 18px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.4);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            transform-origin: bottom right;
            transform: scale(0.5);
            opacity: 0;
            pointer-events: none;
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .cfw-chat-window.cfw-open {
            transform: scale(1);
            opacity: 1;
            pointer-events: all;
        }

        /* Header */
        .cfw-header {
            display: flex;
            align-items: center;
            padding: 16px;
            background: rgba(0,0,0,0.2);
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        .cfw-avatar {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: linear-gradient(135deg, #4facfe, #00f2fe);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            color: white;
            margin-right: 12px;
        }
        .cfw-header-info {
            flex: 1;
        }
        .cfw-title {
            color: #fff;
            font-size: 15px;
            font-weight: 600;
            margin: 0;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .cfw-status-dot {
            width: 8px;
            height: 8px;
            background: #2ecc71;
            border-radius: 50%;
            display: inline-block;
        }
        .cfw-subtitle {
            color: #9fa2c4;
            font-size: 12px;
            margin: 0;
        }
        .cfw-close {
            background: none;
            border: none;
            color: #9fa2c4;
            cursor: pointer;
            font-size: 20px;
            padding: 4px;
            transition: color 0.2s;
        }
        .cfw-close:hover {
            color: #fff;
        }

        /* Messages Area */
        .cfw-messages {
            flex: 1;
            padding: 16px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 12px;
            scroll-behavior: smooth;
        }
        .cfw-messages::-webkit-scrollbar {
            width: 6px;
        }
        .cfw-messages::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.1);
            border-radius: 3px;
        }

        .cfw-msg {
            max-width: 85%;
            padding: 12px 16px;
            border-radius: 16px;
            font-size: 14px;
            line-height: 1.4;
            animation: cfw-fade-in 0.3s ease;
            word-wrap: break-word;
        }
        @keyframes cfw-fade-in {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .cfw-msg.cfw-bot {
            align-self: flex-start;
            background: rgba(255, 255, 255, 0.08);
            color: #fff;
            border-bottom-left-radius: 4px;
        }
        .cfw-msg.cfw-user {
            align-self: flex-end;
            background: linear-gradient(135deg, #4facfe, #00f2fe);
            color: #fff;
            border-bottom-right-radius: 4px;
        }

        /* Typing Indicator */
        .cfw-typing {
            display: none;
            align-self: flex-start;
            background: rgba(255, 255, 255, 0.08);
            padding: 12px 16px;
            border-radius: 16px;
            border-bottom-left-radius: 4px;
            gap: 4px;
        }
        .cfw-typing.cfw-active {
            display: flex;
        }
        .cfw-dot {
            width: 8px;
            height: 8px;
            background: #9fa2c4;
            border-radius: 50%;
            animation: cfw-bounce 1.4s infinite ease-in-out both;
        }
        .cfw-dot:nth-child(1) { animation-delay: -0.32s; }
        .cfw-dot:nth-child(2) { animation-delay: -0.16s; }
        @keyframes cfw-bounce {
            0%, 80%, 100% { transform: scale(0); }
            40% { transform: scale(1); }
        }

        /* Input Area */
        .cfw-input-area {
            display: flex;
            padding: 12px;
            background: rgba(0,0,0,0.2);
            border-top: 1px solid rgba(255, 255, 255, 0.05);
            gap: 8px;
        }
        .cfw-input {
            flex: 1;
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 20px;
            padding: 10px 16px;
            color: #fff;
            font-size: 14px;
            outline: none;
            font-family: inherit;
            transition: border-color 0.2s;
        }
        .cfw-input:focus {
            border-color: #00f2fe;
        }
        .cfw-input::placeholder {
            color: #6c7293;
        }
        .cfw-send {
            background: #00f2fe;
            color: #0d0f12;
            border: none;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: transform 0.2s, opacity 0.2s;
        }
        .cfw-send:hover {
            transform: scale(1.05);
        }
        .cfw-send:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
        }
        .cfw-send svg {
            width: 18px;
            height: 18px;
            fill: currentColor;
            margin-left: 2px;
        }
        
        @media (max-width: 480px) {
            .cfw-chat-window {
                position: fixed;
                bottom: 0;
                right: 0;
                left: 0;
                width: 100%;
                height: 100vh;
                max-height: 100vh;
                border-radius: 0;
                border: none;
            }
            .cfw-wrapper {
                bottom: 16px;
                right: 16px;
            }
        }
    `;
    document.head.appendChild(style);

    // 2. HTML Structure
    const wrapper = document.createElement('div');
    wrapper.className = 'cfw-wrapper';

    wrapper.innerHTML = \`
        <div class="cfw-chat-window" id="cfw-window">
            <div class="cfw-header">
                <div class="cfw-avatar">CF</div>
                <div class="cfw-header-info">
                    <h3 class="cfw-title">CoinFlow AI <span class="cfw-status-dot"></span></h3>
                    <p class="cfw-subtitle">Онлайн</p>
                </div>
                <button class="cfw-close" id="cfw-close" aria-label="Закрыть">✕</button>
            </div>
            
            <div class="cfw-messages" id="cfw-messages">
                <!-- Messages will appear here -->
                <div class="cfw-typing" id="cfw-typing">
                    <div class="cfw-dot"></div>
                    <div class="cfw-dot"></div>
                    <div class="cfw-dot"></div>
                </div>
            </div>
            
            <div class="cfw-input-area">
                <input type="text" class="cfw-input" id="cfw-input" placeholder="Напишите сообщение..." autocomplete="off">
                <button class="cfw-send" id="cfw-send">
                    <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                </button>
            </div>
        </div>
        
        <div class="cfw-fab" id="cfw-fab">
            <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
        </div>
    \`;
    
    document.body.appendChild(wrapper);

    // 3. Logic
    const config = {
        apiEndpoint: '/api/widget/chat', // Change if deployed on different domain
    };

    const DOM = {
        fab: document.getElementById('cfw-fab'),
        window: document.getElementById('cfw-window'),
        close: document.getElementById('cfw-close'),
        messages: document.getElementById('cfw-messages'),
        input: document.getElementById('cfw-input'),
        sendBtn: document.getElementById('cfw-send'),
        typing: document.getElementById('cfw-typing'),
    };

    let isOpen = false;
    let isInitialized = false;
    let chatHistory = [];
    let isWaiting = false;

    // Toggle window
    const toggleWindow = () => {
        isOpen = !isOpen;
        if (isOpen) {
            DOM.window.classList.add('cfw-open');
            DOM.fab.style.transform = 'scale(0) opacity(0)';
            if (!isInitialized) {
                setTimeout(() => {
                    addMessage("Привет! 👋 Я виртуальный помощник CoinFlow. Могу рассказать о боте или помочь начать вести бюджет. Чем могу помочь?", 'bot');
                    isInitialized = true;
                }, 500);
            }
            setTimeout(() => DOM.input.focus(), 300);
        } else {
            DOM.window.classList.remove('cfw-open');
            DOM.fab.style.transform = '';
        }
    };

    DOM.fab.addEventListener('click', toggleWindow);
    DOM.close.addEventListener('click', toggleWindow);

    // Messaging
    const addMessage = (text, sender) => {
        const msg = document.createElement('div');
        msg.className = \`cfw-msg cfw-\${sender}\`;
        msg.innerText = text;
        DOM.messages.insertBefore(msg, DOM.typing);
        scrollToBottom();
        
        if (sender !== 'system') {
            chatHistory.push({ role: sender === 'bot' ? 'model' : 'user', content: text });
        }
    };

    const scrollToBottom = () => {
        DOM.messages.scrollTop = DOM.messages.scrollHeight;
    };

    const setLoading = (loading) => {
        isWaiting = loading;
        DOM.input.disabled = loading;
        DOM.sendBtn.disabled = loading;
        if (loading) {
            DOM.typing.classList.add('cfw-active');
            scrollToBottom();
        } else {
            DOM.typing.classList.remove('cfw-active');
            DOM.input.focus();
        }
    };

    const handleSend = async () => {
        const text = DOM.input.value.trim();
        if (!text || isWaiting) return;

        DOM.input.value = '';
        addMessage(text, 'user');
        setLoading(true);

        try {
            const response = await fetch(config.apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    history: chatHistory.slice(0, -1) // Excluding the one just added
                })
            });
            
            if (!response.ok) throw new Error('Network error');
            const data = await response.json();
            
            setLoading(false);
            if (data.reply) {
                addMessage(data.reply, 'bot');
            } else {
                addMessage("Извините, произошла ошибка на нашей стороне.", 'bot');
            }
        } catch (error) {
            console.error('Widget Error:', error);
            setLoading(false);
            addMessage("Сервер временно недоступен. Попробуйте написать нам напрямую в Telegram @coinflow_private_bot 😓", 'bot');
        }
    };

    DOM.sendBtn.addEventListener('click', handleSend);
    DOM.input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSend();
    });

})();
