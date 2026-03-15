import React, { useState, useRef, useEffect } from 'react';

// --- 数据区 ---

// 响应时间评级数据
const RATING_DATA = [
  { title: "Excellent", range: "0 - 200ms", desc: "Website responds very fast, excellent user experience.", color: "#2ecc71", bgColor: "#eafaf1" },
  { title: "Good", range: "200 - 500ms", desc: "Response time is acceptable, most users won't notice the delay.", color: "#3498db", bgColor: "#ebf5fb" },
  { title: "Needs Improvement", range: "500 - 1000ms", desc: "Slow response, server or database optimization recommended.", color: "#f39c12", bgColor: "#fef5e7" },
  { title: "Critical Issue", range: "> 1000ms", desc: "Severely impacts user experience, needs immediate action.", color: "#e74c3c", bgColor: "#fdedec" }
];

// 常见 HTTP 状态码
const COMMON_STATUS_CODES = [
  { code: "200", name: "OK", desc: "Request successful. The website is running normally and data has been returned.", color: "#2ecc71", bg: "#eafaf1" },
  { code: "301", name: "Redirect", desc: "Page redirected. The requested resource has been moved to a new location.", color: "#3498db", bg: "#ebf5fb" },
  { code: "400", name: "Bad Request", desc: "Bad request. The server cannot understand it, usually due to invalid parameters.", color: "#f39c12", bg: "#fef5e7" },
  { code: "401", name: "Unauthorized", desc: "Unauthorized. The request requires authentication, or the provided credentials are invalid.", color: "#f39c12", bg: "#fef5e7" },
  { code: "403", name: "Forbidden", desc: "Forbidden. The server understands the request but refuses to authorize it, usually due to lack of permissions.", color: "#f39c12", bg: "#fef5e7" },
  { code: "404", name: "Not Found", desc: "Not found. The server cannot find the requested resource, the link may be broken.", color: "#e74c3c", bg: "#fdedec" },
  { code: "500", name: "Internal Server Error", desc: "Internal server error. The server encountered an unexpected condition, code threw an exception.", color: "#e74c3c", bg: "#fdedec" },
  { code: "502", name: "Bad Gateway", desc: "Bad gateway. The server, acting as a proxy, received an invalid response from the upstream server.", color: "#e74c3c", bg: "#fdedec" },
  { code: "503", name: "Service Unavailable", desc: "Service unavailable. The server is currently unavailable (overloaded or down for maintenance).", color: "#e74c3c", bg: "#fdedec" }
];

// 罕见/特殊 HTTP 状态码
const RARE_STATUS_CODES = [
  { code: "418", name: "I'm a teapot", desc: "I'm a teapot. April Fools' joke, indicating refusal to brew coffee because I am a teapot.", color: "#9b59b6", bg: "#f5eef8" },
  { code: "429", name: "Too Many Requests", desc: "Too many requests. The user has sent too many requests in a given amount of time (rate limiting triggered).", color: "#e67e22", bg: "#fef5e7" },
  { code: "451", name: "Unavailable For Legal Reasons", desc: "Unavailable for legal reasons. The resource is blocked due to legal demands (e.g., copyright, censorship).", color: "#7f8c8d", bg: "#f2f4f4" },
  { code: "508", name: "Loop Detected", desc: "Loop detected. The server detected an infinite loop while processing the request.", color: "#c0392b", bg: "#fdedec" }
];

// --- 扩充后的 AI 快捷问题总库 ---
const ALL_SUGGESTED_QUESTIONS = [
  "Can MonWeb monitor intranet IPs?",
  "Will there be email notifications if the website is down?",
  "How do I delete unwanted websites?",
  "Is your AI report accurate?",
  "What to do if the website frequently has 502 errors?",
  "Where is the misconfiguration if I get a 403 Forbidden?",
  "Why is my website reporting 429 Too Many Requests?",
  "Is a response time over 500ms considered slow?",
  "How does a CDN accelerate a website?",
  "What is the difference between Ping and HTTP tests?",
  "What is the difference between 301 and 302 redirects?",
  "How to troubleshoot slow website response times?",
  "Will MonWeb consume my website's performance?",
  "What metrics are included in the AI analysis report?",
  "How does the system determine if a website is in a Warning state?",
  "Status code is 200, but the page is blank, why?"
];

// 随机抽取函数：从总库中打乱并抽取指定数量的问题
const getRandomQuestions = (count = 4) => {
  const shuffled = [...ALL_SUGGESTED_QUESTIONS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

function Support() {
  // 组件初始化时，随机抽取 4 个快捷问题
  const [currentSuggestions] = useState(() => getRandomQuestions(4));
  
  const [chatHistory, setChatHistory] = useState([
    { sender: 'ai', text: "Hi! I'm MonWeb's AI Assistant. Couldn't find the answer above? Feel free to ask me!" }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const handleSendMessage = async (text) => {
    if (!text.trim()) return;

    const userMsg = text.trim();
    setInputValue("");
    setChatHistory(prev => [...prev, { sender: 'user', text: userMsg }]);
    setIsTyping(true);

    try {
      const response = await fetch('http://localhost:5000/api/support-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg })
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setChatHistory(prev => [...prev, { sender: 'ai', text: data.reply }]);
      } else {
        setChatHistory(prev => [...prev, { sender: 'ai', text: "Oops, it seems I'm offline. Please try again in a moment!" }]);
      }
    } catch (error) {
      setChatHistory(prev => [...prev, { sender: 'ai', text: "The server took a nap. Please try again later." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSendMessage(inputValue);
    }
  };

  return (
    <div className="support-container" style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      
      {/* 头部标题区域 */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ fontSize: '2.5rem', color: '#2c3e50', marginBottom: '10px' }}>👋 Support & Knowledge Base</h1>
        <p style={{ color: '#7f8c8d', fontSize: '1.1rem' }}>Understand system metrics, or ask our AI assistant directly at the bottom.</p>
      </div>

      {/* 知识卡片 1：理解响应时间 */}
      <div style={{ background: '#fff', borderRadius: '16px', padding: '30px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', marginBottom: '30px' }}>
        <h2 style={{ fontSize: '1.8rem', color: '#2c3e50', marginBottom: '20px', borderBottom: '2px solid #f1f2f6', paddingBottom: '15px' }}>
          ⏱️ Understanding Response Time
        </h2>
        
        {/* 概念介绍 */}
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ fontSize: '1.2rem', color: '#34495e', marginBottom: '10px' }}>What is Response Time?</h3>
          <p style={{ color: '#576574', lineHeight: '1.6', fontSize: '1rem', margin: 0 }}>
            Response time is the interval from when your browser sends a request to when it receives the server's response.
            Simply put, it's how fast the website <strong>"reacts"</strong>. Shorter response times mean a better user experience.
          </p>
        </div>

        {/* 评级标准网格 */}
        <h3 style={{ fontSize: '1.2rem', color: '#34495e', marginBottom: '15px' }}>Response Time Rating Criteria</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '30px' }}>
          {RATING_DATA.map((item, idx) => (
            <div key={idx} style={{ background: item.bgColor, borderLeft: `5px solid ${item.color}`, padding: '15px', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: item.color }}>{item.title}</span>
                <span style={{ fontSize: '0.9rem', color: '#7f8c8d', fontWeight: '600', background: '#fff', padding: '3px 8px', borderRadius: '12px' }}>
                  {item.range}
                </span>
              </div>
              <p style={{ fontSize: '0.9rem', color: '#576574', margin: '0', lineHeight: '1.4' }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 知识卡片 2：HTTP 状态码指南 */}
      <div style={{ background: '#fff', borderRadius: '16px', padding: '30px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', marginBottom: '50px' }}>
        <h2 style={{ fontSize: '1.8rem', color: '#2c3e50', marginBottom: '20px', borderBottom: '2px solid #f1f2f6', paddingBottom: '15px' }}>
          🔌 HTTP Status Codes Guide
        </h2>
        
        {/* 常见状态码 */}
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ fontSize: '1.2rem', color: '#34495e', marginBottom: '15px' }}>📌 Common Status Codes</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px' }}>
            {COMMON_STATUS_CODES.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', background: item.bg, padding: '15px', borderRadius: '10px', border: `1px solid ${item.color}33` }}>
                <div style={{ background: item.color, color: '#fff', padding: '4px 10px', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.9rem', marginRight: '15px', minWidth: '45px', textAlign: 'center' }}>
                  {item.code}
                </div>
                <div>
                  <div style={{ fontWeight: 'bold', color: '#2c3e50', marginBottom: '4px' }}>{item.name}</div>
                  <div style={{ fontSize: '0.85rem', color: '#576574', lineHeight: '1.4' }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 罕见状态码 */}
        <div>
          <h3 style={{ fontSize: '1.2rem', color: '#34495e', marginBottom: '15px' }}>🦄 Rare or Special Status Codes</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px' }}>
            {RARE_STATUS_CODES.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', background: item.bg, padding: '15px', borderRadius: '10px', border: `1px solid ${item.color}33` }}>
                <div style={{ background: item.color, color: '#fff', padding: '4px 10px', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.9rem', marginRight: '15px', minWidth: '45px', textAlign: 'center' }}>
                  {item.code}
                </div>
                <div>
                  <div style={{ fontWeight: 'bold', color: '#2c3e50', marginBottom: '4px' }}>{item.name}</div>
                  <div style={{ fontSize: '0.85rem', color: '#576574', lineHeight: '1.4' }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '2px dashed #ecf0f1', marginBottom: '40px' }} />

      {/* 智能 AI 问答区域 */}
      <div style={{ background: '#fdfefe', borderRadius: '16px', padding: '30px', boxShadow: '0 10px 25px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: '25px' }}>
          <h2 style={{ fontSize: '1.8rem', color: '#2c3e50', margin: '0 0 10px 0' }}>🤖 AI Smart Assistant</h2>
          <p style={{ color: '#7f8c8d', margin: '0' }}>Didn't find the answer? Click on the preset questions below, or ask me directly!</p>
        </div>

        {/* 随机预设问题 (Tags/Chips) */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', marginBottom: '20px' }}>
          {currentSuggestions.map((q, idx) => (
            <button 
              key={idx} 
              onClick={() => handleSendMessage(q)}
              disabled={isTyping}
              style={{
                background: '#e3f2fd', color: '#2980b9', border: '1px solid #bbdefb', 
                padding: '8px 16px', borderRadius: '20px', cursor: isTyping ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem', transition: 'all 0.2s', fontWeight: 'bold'
              }}
              onMouseOver={(e) => { if(!isTyping) e.target.style.background = '#bbdefb' }}
              onMouseOut={(e) => { if(!isTyping) e.target.style.background = '#e3f2fd' }}
            >
              {q}
            </button>
          ))}
        </div>

        {/* 聊天记录窗口 */}
        <div style={{ 
          background: '#f8f9fa', border: '1px solid #e2e8f0', borderRadius: '12px', 
          height: '350px', overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '15px'
        }}>
          {chatHistory.map((msg, idx) => (
            <div key={idx} style={{ 
              alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '75%'
            }}>
              <span style={{ 
                fontSize: '0.8rem', color: '#95a5a6', 
                display: 'block', marginBottom: '4px',
                textAlign: msg.sender === 'user' ? 'right' : 'left'
              }}>
                {msg.sender === 'user' ? 'You' : 'MonWeb AI'}
              </span>
              <div style={{
                background: msg.sender === 'user' ? '#3498db' : '#ffffff',
                color: msg.sender === 'user' ? '#fff' : '#2c3e50',
                border: msg.sender === 'user' ? 'none' : '1px solid #dcdde1',
                padding: '12px 18px',
                borderRadius: msg.sender === 'user' ? '16px 16px 0 16px' : '16px 16px 16px 0',
                lineHeight: '1.5',
                fontSize: '0.95rem',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
              }}>
                {msg.text}
              </div>
            </div>
          ))}
          {isTyping && (
            <div style={{ alignSelf: 'flex-start', background: '#ffffff', border: '1px solid #dcdde1', padding: '10px 18px', borderRadius: '16px 16px 16px 0', color: '#7f8c8d', fontSize: '0.9rem' }}>
              Typing...
            </div>
          )}
        </div>

        {/* 输入框 */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <input 
            type="text" 
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isTyping}
            placeholder="Chat with me like a friend..."
            style={{
              flex: 1, padding: '15px 20px', borderRadius: '25px', border: '2px solid #dcdde1',
              fontSize: '1rem', outline: 'none', transition: 'border-color 0.3s',
              background: '#fff'
            }}
            onFocus={(e) => e.target.style.borderColor = '#3498db'}
            onBlur={(e) => e.target.style.borderColor = '#dcdde1'}
          />
          <button 
            onClick={() => handleSendMessage(inputValue)}
            disabled={isTyping || !inputValue.trim()}
            style={{
              background: inputValue.trim() && !isTyping ? '#3498db' : '#bdc3c7',
              color: '#fff', border: 'none', padding: '0 25px', borderRadius: '25px',
              fontSize: '1rem', fontWeight: 'bold', cursor: inputValue.trim() && !isTyping ? 'pointer' : 'not-allowed',
              transition: 'background 0.3s, transform 0.1s'
            }}
            onMouseDown={(e) => { if(inputValue.trim() && !isTyping) e.target.style.transform = 'scale(0.95)' }}
            onMouseUp={(e) => { if(inputValue.trim() && !isTyping) e.target.style.transform = 'scale(1)' }}
          >
            Send
          </button>
        </div>
      </div>

    </div>
  );
}

export default Support;