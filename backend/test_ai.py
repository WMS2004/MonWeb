from google import genai

# ⚠️ 请务必换成你刚刚在 AI Studio 重新生成的新 API Key！
API_KEY = "AIzaSyCLLZgWEULDccRaEzQLEVqqZMfB4wHLTBc"

# 初始化客户端
client = genai.Client(api_key=API_KEY)

# 调用模型 (由于是 2026 年，推荐使用最新的 flash 模型，比如 gemini-2.5-flash)
try:
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents="Hello, 请用中文跟我打个招呼，并告诉我你准备好帮我完成 FYP 监控系统了！"
    )
    print("AI 回复成功：\n")
    print(response.text)
except Exception as e:
    print(f"发生错误: {e}")