import { useState, useRef, useEffect } from 'react';
import './Chat.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

function Chat() {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalInput, setModalInput] = useState('');
  const [showGlobalLoading, setShowGlobalLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const [currentTypingMessage, setCurrentTypingMessage] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [showLocalModal, setShowLocalModal] = useState(false);
  const [localPathInput, setLocalPathInput] = useState('');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ 
      behavior: "smooth",
      block: "end",
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentTypingMessage]);

  const typeMessage = async (message, delay = 50) => {
    setIsTyping(true);
    let currentText = "";
    
    for (let i = 0; i < message.length; i++) {
      currentText += message[i];
      setCurrentTypingMessage(prev => ({
        ...prev,
        content: currentText
      }));
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    setIsTyping(false);
    setCurrentTypingMessage(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage = {
      content: inputValue,
      role: 'user',
      timestamp: new Date().toLocaleTimeString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // 创建AI响应消息对象
      const aiResponse = {
        content: "",
        role: 'assistant',
        timestamp: new Date().toLocaleTimeString()
      };
      
      // 添加空的AI响应到消息列表
      setMessages(prev => [...prev, aiResponse]);
      setCurrentTypingMessage(aiResponse);

      // 创建 EventSource 连接
      const queryParams = new URLSearchParams({
        question: inputValue,
        source: localStorage.getItem('bookIndex')
      }).toString();
      console.log(queryParams);
      const eventSource = new EventSource(
        `http://127.0.0.1:8000/api/book-ask?${queryParams}`
      );
      console.log("`http://127.0.0.1:8000/api/book-ask?${queryParams}`");
      console.log(`http://127.0.0.1:8000/api/book-ask?${queryParams}`);
      // 处理消息事件
      eventSource.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        aiResponse.content += data.data.data;
        setCurrentTypingMessage({ ...aiResponse });
        scrollToBottom();
      };

      // 处理错误
      eventSource.onerror = (error) => {
        console.error('SSE Error:', error);
        eventSource.close();
        setIsLoading(false);
        setIsTyping(false);
      };

      // 处理连接关闭
      eventSource.addEventListener('done', (event) => {
        eventSource.close();
        setIsLoading(false);
        setIsTyping(false);
        setCurrentTypingMessage(null);
        
        // 更新最终的消息内容
        setMessages(prev => 
          prev.map((msg, index) => 
            index === prev.length - 1 ? { ...msg, content: aiResponse.content } : msg
          )
        );
      });

    } catch (error) {
      console.error('Error:', error);
      setIsLoading(false);
      setIsTyping(false);
    }
  };

  const handleModalSubmit = async () => {
    if (!modalInput.trim()) {
        alert('请输入网址');
        return;
    }
    // 验证URL格式
    if(!modalInput.startsWith('http://') && !modalInput.startsWith('https://')){
        alert('请输入有效的网址格式');
        return;
    }
    setShowModal(false);
    setShowGlobalLoading(true);

    
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/book-vec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: modalInput
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      // 将当前网址保存到本地存储（单值存储）
      localStorage.setItem('bookIndex', modalInput);
      
      const data = await response.json();
      console.log('Fetched data:', data);
      console.log('Modal input:', modalInput);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setShowGlobalLoading(false);
      setModalInput('');

    }
  };

  const handleLocalModalSubmit = async () => {
    if (!localPathInput) {
      alert('请选择文件');
      return;
    }
    
    setShowLocalModal(false);
    setShowGlobalLoading(true);

    try {
      // 创建 FormData 对象
      const formData = new FormData();
      formData.append('file', localPathInput);

      const response = await fetch(`http://127.0.0.1:8000/api/upload-doc`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // 将文件名保存到本地存储
      localStorage.setItem('bookIndex', localPathInput.name);
      
      const data = await response.json();
      console.log('Fetched data:', data);
    } catch (error) {
      console.error('Error:', error);
      alert('上传失败，请重试');
    } finally {
      setShowGlobalLoading(false);
      setLocalPathInput(null);
    }
  };

  const hideGlobalLoading = () => {
    setShowGlobalLoading(false);
  };

  const handleQuickOption = (option) => {
    let message = '';
    switch(option) {
      case 'summary':
        message = "请总结这本书的主要内容和核心观点";
        break;
      case 'concepts':
        message = "请列出这本书中的关键概念和术语，并简要解释它们的含义";
        break;
      case 'practice':
        message = "请提供这本书中最重要的实践建议和行动指南";
        break;
      case 'cases':
        message = "请分享书中的典型案例和实际应用示例";
        break;
      case 'analysis':
        message = "请深入分析这本书的创新观点和独特见解";
        break;
      default:
        message = "";
    }
    setInputValue(message);
  };

  return (
    <div className="chat-container">
      {showGlobalLoading && (
        <div className="global-loading-overlay">
          <div className="loading-spinner"></div>
        </div>
      )}

      <div className="chat-header">
        <button 
          className="modal-trigger-button"
          onClick={() => setShowLocalModal(true)}
        >
          设置本地book
        </button>
        <button 
          className="modal-trigger-button"
          onClick={() => setShowModal(true)}
        >
          设置book网址
        </button>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>设置</h3>
            <input
              type="text"
              value={modalInput}
              onChange={(e) => setModalInput(e.target.value)}
              placeholder="请输入..."
              className="modal-input"
            />
            <div className="modal-buttons">
              <button 
                className="modal-button confirm"
                onClick={handleModalSubmit}
              >
                确定
              </button>
              <button 
                className="modal-button cancel"
                onClick={() => setShowModal(false)}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {showLocalModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>上传本地文件</h3>
            <div className="file-upload-container">
              <input
                type="file"
                onChange={(e) => setLocalPathInput(e.target.files[0])}
                className="file-input"
                accept=".txt,.pdf,.doc,.docx"  // 可以根据需要修改接受的文件类型
              />
              {localPathInput && (
                <div className="selected-file">
                  已选择: {localPathInput.name}
                </div>
              )}
            </div>
            <div className="modal-buttons">
              <button 
                className="modal-button confirm"
                onClick={handleLocalModalSubmit}
                disabled={!localPathInput}
              >
                上传
              </button>
              <button 
                className="modal-button cancel"
                onClick={() => {
                  setShowLocalModal(false);
                  setLocalPathInput(null);
                }}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="empty-state">
            <h3>开始新的对话</h3>
            <p>你可以问我任何问题...</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div key={index} className={`message ${message.role}`}>
              <div className="message-content">
                <div className="message-text">
                  {currentTypingMessage && index === messages.length - 1 && message.role === 'assistant' ? (
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw]}
                      components={{
                        // 自定义代码块样式
                        code({node, inline, className, children, ...props}) {
                          return (
                            <code className={`${className} code-block`} {...props}>
                              {children}
                            </code>
                          )
                        }
                      }}
                    >
                      {currentTypingMessage.content}
                    </ReactMarkdown>
                  ) : (
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw]}
                      components={{
                        code({node, inline, className, children, ...props}) {
                          return (
                            <code className={`${className} code-block`} {...props}>
                              {children}
                            </code>
                          )
                        }
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  )}
                  {isTyping && index === messages.length - 1 && message.role === 'assistant' && (
                    <span className="typing-cursor">|</span>
                  )}
                </div>
                <div className="message-timestamp">{message.timestamp}</div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="quick-options">
        <button 
          className="option-pill" 
          onClick={() => handleQuickOption('summary')}
        >
          总结全文
        </button>
        <button 
          className="option-pill" 
          onClick={() => handleQuickOption('concepts')}
        >
          关键概念
        </button>
        <button 
          className="option-pill" 
          onClick={() => handleQuickOption('practice')}
        >
          实践建议
        </button>
        <button 
          className="option-pill" 
          onClick={() => handleQuickOption('cases')}
        >
          相关案例
        </button>
        <button 
          className="option-pill" 
          onClick={() => handleQuickOption('analysis')}
        >
          深入分析
        </button>
      </div>

      <form className="chat-input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="输入消息..."
          className="chat-input"
          disabled={isLoading}
        />
        <button 
          type="submit" 
          className="send-button"
          disabled={isLoading || !inputValue.trim()}
        >
          {isLoading ? '发送中...' : '发送'}
        </button>
      </form>
    </div>
  );
}

export default Chat; 